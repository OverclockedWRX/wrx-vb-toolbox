import type { ParsedLog } from "@/lib/parse-log";
import type { Octane, SafeWindow } from "@/lib/limits";
import type { Review } from "@/lib/types";
import type { TuneInfo } from "@/lib/tune";

export type GradeLetter = "S" | "A" | "B" | "F";
export type Health = "good" | "warn" | "bad";

export type Alert = {
  title: string;
  problem: string;
  remedy: string;
};

export type FuelStats = {
  samples: number;
  abovePreferred: number;
  aboveAbsolute: number;
  belowPreferred: number;
  belowAbsolute: number;
};

export type TopicHealth = {
  afr: Health;
  knock: Health;
  trims: Health;
  boost: Health;
  delivery: Health;
};

export type GradeResult = {
  letter: GradeLetter;
  score: number;
  blurb: string;
  summary: string;
  noticed: string[];
  changes: string[];
  reasons: string[];
  health: TopicHealth;
};

const ORDER: GradeLetter[] = ["S", "A", "B", "F"];

const BLURB: Record<GradeLetter, string> = {
  S: "Best case. Wide-open fueling, knock, and trims sit where they should for this tune.",
  A: "Great. Only a small item is off, and nothing here says to stay out of boost.",
  B: "Fine to drive carefully, but the tune should be adjusted before you call it finished.",
  F: "Outstanding issue. Something here can hurt the engine until it is fixed.",
};

function worseLetter(current: GradeLetter, cap: GradeLetter): GradeLetter {
  return ORDER.indexOf(current) >= ORDER.indexOf(cap) ? current : cap;
}

function letterFor(score: number): GradeLetter {
  if (score >= 96) return "S";
  if (score >= 88) return "A";
  if (score >= 74) return "B";
  return "F";
}

function percentile(values: number[], p: number) {
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.round((p / 100) * (ordered.length - 1))));
  return ordered[index];
}

type Loaded = {
  log: string;
  afr: number;
  cmd: number;
  rpm: number;
  boost: number;
  gear: number;
  fp: number;
};

export function assess(
  logs: ParsedLog[],
  review: Review,
  tunes: TuneInfo[],
  limits: SafeWindow,
  fuelOctane: Octane,
): { alerts: Alert[]; grade: GradeResult; fuelStats: FuelStats } {
  const alerts: Alert[] = [];
  const noticed: string[] = [];
  const changes: string[] = [];
  let score = 100;
  let safety = false;
  let needsTune = false;
  const health: TopicHealth = {
    afr: "good",
    knock: "good",
    trims: "good",
    boost: "good",
    delivery: "good",
  };

  const loaded: Loaded[] = [];
  let damMin = Number.POSITIVE_INFINITY;
  let damMax = Number.NEGATIVE_INFINITY;
  let damLog = "";
  let fkLoad = 0;
  let fkLoadLog = "";
  let fkLoadDetail = "";
  let fkOff = 0;
  let fklMin = 0;
  let fklLog = "";
  let learnPeak = 0;
  let learnLabel = "";
  let learnLog = "";
  let coolantMax = Number.NEGATIVE_INFINITY;
  let oilMax = Number.NEGATIVE_INFINITY;

  for (const log of logs) {
    for (const sample of log.samples) {
      if (sample.dam !== null && sample.dam < damMin) {
        damMin = sample.dam;
        damLog = log.name;
      }
      if (sample.dam !== null && sample.dam > damMax) damMax = sample.dam;
      if (sample.fkl < fklMin) {
        fklMin = sample.fkl;
        fklLog = log.name;
      }
      const underLoad = sample.boost >= 5 && sample.accel >= 80;
      if (sample.fk < 0 && underLoad && sample.fk < fkLoad) {
        fkLoad = sample.fk;
        fkLoadLog = log.name;
        fkLoadDetail = `${sample.fk.toFixed(2)}° in ${log.name} at ${Math.round(sample.rpm).toLocaleString()} rpm and ${sample.boost.toFixed(1)} psi`;
      } else if (sample.fk < fkOff) fkOff = sample.fk;
      for (const [value, label] of [
        [sample.learn1, "AF Learning 1"],
        [sample.learn3, "AF Learning 3"],
      ] as const) {
        if (value !== null && Math.abs(value) > Math.abs(learnPeak)) {
          learnPeak = value;
          learnLabel = label;
          learnLog = log.name;
        }
      }
      if (sample.coolant !== null) coolantMax = Math.max(coolantMax, sample.coolant);
      if (sample.oil !== null) oilMax = Math.max(oilMax, sample.oil);
      if (sample.accel >= 80 && sample.boost >= 10 && sample.afr > 8) {
        loaded.push({
          log: log.name,
          afr: sample.afr,
          cmd: sample.cmd,
          rpm: sample.rpm,
          boost: sample.boost,
          gear: sample.gear,
          fp: sample.fp,
        });
      }
    }
  }

  const fuelStats: FuelStats = {
    samples: loaded.length,
    abovePreferred: loaded.filter((row) => row.afr > limits.preferredMax).length,
    aboveAbsolute: loaded.filter((row) => row.afr > limits.absoluteMax).length,
    belowPreferred: loaded.filter((row) => row.afr < limits.preferredMin).length,
    belowAbsolute: loaded.filter((row) => row.afr < limits.absoluteMin).length,
  };

  if (!loaded.length) {
    score -= 8;
    needsTune = true;
    health.afr = "warn";
    noticed.push("No wide-open boost samples were found, so the mixture under load was not checked.");
    changes.push("Log a clean third-gear pull on boost so AFR can be graded.");
  } else {
    const leanest = loaded.reduce((best, row) => (row.afr > best.afr ? row : best));
    const richest = loaded.reduce((best, row) => (row.afr < best.afr ? row : best));
    if (fuelStats.aboveAbsolute > 0) {
      safety = true;
      health.afr = "bad";
      score -= 28;
      alerts.push({
        title: "Wide-open AFR is lean for this fuel",
        problem: `${leanest.log} reached ${leanest.afr.toFixed(2)} AFR at ${Math.round(leanest.rpm).toLocaleString()} rpm and ${leanest.boost.toFixed(1)} psi. The stop for ${limits.octane} octane at ${limits.boostPsi.toFixed(0)} psi is ${limits.absoluteMax.toFixed(2)} AFR. ${fuelStats.aboveAbsolute} on-boost sample${fuelStats.aboveAbsolute === 1 ? "" : "s"} passed that line.`,
        remedy:
          "Stay out of wide-open throttle. Confirm the fuel in the tank matches the map, then send the log to the tuner and ask for more fuel in the load cells where the wideband went lean.",
      });
      noticed.push(`On-boost AFR reached ${leanest.afr.toFixed(2)}, past the ${limits.absoluteMax.toFixed(2)} stop for ${limits.octane} octane.`);
      changes.push("Add fuel in the lean load cells and stay out of boost until that is done.");
    } else if (fuelStats.abovePreferred > 0) {
      const gap = leanest.afr - limits.preferredMax;
      score -= gap <= 0.15 ? 4 : gap <= 0.35 ? 8 : 12;
      health.afr = worseHealth(health.afr, "warn");
      noticed.push(
        `Leanest on-boost AFR is ${leanest.afr.toFixed(2)}, above the ${limits.preferredMax.toFixed(2)} preferred limit. It stayed under the ${limits.absoluteMax.toFixed(2)} stop.`,
      );
      if (gap > 0.15) {
        needsTune = true;
        changes.push("Have the tuner richen the open-loop target a little in the leanest cells.");
      } else {
        changes.push("Optional: richen the leanest cells a touch on the next revision.");
      }
    } else {
      noticed.push(
        `On-boost AFR stayed inside the preferred window (${limits.preferredMin.toFixed(2)}–${limits.preferredMax.toFixed(2)}) for ${limits.octane} octane.`,
      );
    }

    if (fuelStats.belowAbsolute > 0) {
      safety = true;
      health.afr = "bad";
      score -= 16;
      alerts.push({
        title: "Wide-open AFR is richer than the safe floor",
        problem: `${richest.log} went to ${richest.afr.toFixed(2)} AFR under boost. Richer than ${limits.absoluteMin.toFixed(2)} on this setup washes the cylinders and can misfire.`,
        remedy: "Have the tuner pull fuel from the cells that went this rich.",
      });
      noticed.push(`On-boost AFR went as rich as ${richest.afr.toFixed(2)}.`);
      changes.push("Pull fuel from the richest open-loop cells.");
    } else if (fuelStats.belowPreferred > 0) {
      score -= 4;
      health.afr = worseHealth(health.afr, "warn");
      needsTune = true;
      noticed.push(`Richest on-boost AFR is ${richest.afr.toFixed(2)}, richer than the ${limits.preferredMin.toFixed(2)} preferred floor.`);
      changes.push("Ask the tuner to lean the richest cells slightly.");
    }

    const commanded = loaded.filter((row) => row.cmd > limits.absoluteMax);
    if (commanded.length) {
      safety = true;
      health.afr = "bad";
      score -= 22;
      const worst = commanded.reduce((best, row) => (row.cmd > best.cmd ? row : best));
      alerts.push({
        title: "The map is commanding a lean AFR",
        problem: `Comm Fuel Final asked for ${worst.cmd.toFixed(2)} AFR at ${Math.round(worst.rpm).toLocaleString()} rpm in ${worst.log}. That request is leaner than the ${limits.absoluteMax.toFixed(2)} stop.`,
        remedy: "Ask the tuner to richen the open-loop target before you judge the wideband.",
      });
      noticed.push(`The ECU commanded ${worst.cmd.toFixed(2)} AFR under boost.`);
      changes.push("Richen the commanded AFR table for this fuel and boost.");
    }
  }

  if (Number.isFinite(damMin) && damMin < 0.999) {
    safety = true;
    health.knock = "bad";
    score -= damMin < 0.625 ? 40 : 28;
    alerts.push({
      title: "DAM has dropped",
      problem: `DAM reached ${damMin.toFixed(2)} in ${damLog}. Below 1.00 the ECU has already pulled global timing because it detected knock.`,
      remedy: "Stay out of boost. Confirm octane, then have the tuner read feedback knock and fine knock learn.",
    });
    noticed.push(`DAM fell to ${damMin.toFixed(2)}.`);
    changes.push("Do not wide-open throttle until DAM and knock are sorted with the tuner.");
  }

  if (fkLoad < 0) {
    safety = true;
    health.knock = "bad";
    score -= fkLoad <= -4 ? 28 : fkLoad <= -2.1 ? 22 : 16;
    alerts.push({
      title: "Knock under load",
      problem: `Feedback knock hit ${fkLoadDetail}. Timing pulled under boost is treated as real knock until a tuner shows it is sensor noise.`,
      remedy: "Stop wide-open pulls. Confirm the octane matches the map, then send this log to the tuner.",
    });
    noticed.push(`Feedback knock under load reached ${fkLoad.toFixed(2)}° in ${fkLoadLog}.`);
    changes.push("Have the tuner inspect knock under load before another pull.");
  } else if (fkOff < 0) {
    score -= 3;
    health.knock = worseHealth(health.knock, "warn");
    noticed.push(
      `Feedback knock of ${fkOff.toFixed(2)}° showed up off boost only. That often fits exhaust noise at the sensor, especially with an unequal-length header.`,
    );
  }

  if (fklMin <= -0.7) {
    const severe = fklMin <= -2;
    if (severe) {
      safety = true;
      health.knock = "bad";
    } else {
      health.knock = worseHealth(health.knock, "warn");
      needsTune = true;
    }
    score -= fklMin <= -3 ? 20 : severe ? 14 : 6;
    if (severe) {
      alerts.push({
        title: "Fine knock learn is stored",
        problem: `Fine knock learn reached ${fklMin.toFixed(2)}° in ${fklLog}. The ECU has stored a timing reduction.`,
        remedy: "Leave the car out of boost and send the log to the tuner.",
      });
      changes.push("Clear the cause of stored fine knock learn with the tuner before more pulls.");
    } else {
      changes.push("Ask the tuner to review the fine knock learn cells.");
    }
    noticed.push(`Fine knock learn reached ${fklMin.toFixed(2)}°.`);
  }

  if (Number.isFinite(damMin) && damMin >= 0.999 && fkLoad === 0 && fklMin > -0.7) {
    noticed.push("DAM stayed at 1.00, and there was no feedback knock under load.");
  }

  const learnAbs = Math.abs(learnPeak);
  if (learnAbs >= 8) {
    const severe = learnAbs >= 15;
    health.trims = severe ? worseHealth(health.trims, "bad") : worseHealth(health.trims, "warn");
    if (severe) needsTune = true;
    else needsTune = true;
    score -= learnAbs >= 20 ? 18 : severe ? 12 : learnAbs >= 10 ? 8 : 4;
    const signed = `${learnPeak > 0 ? "+" : ""}${learnPeak.toFixed(1)}%`;
    if (severe) {
      alerts.push({
        title: "Fuel trims are far out",
        problem:
          learnPeak > 0
            ? `${learnLabel} reached ${signed} in ${learnLog}. Past about 15%, the airflow model is no longer describing this car.`
            : `${learnLabel} reached ${signed} in ${learnLog}. A negative trim that large means closed loop is removing a lot of fuel.`,
        remedy: "Send the log to the tuner and ask for a rescale of the airflow model.",
      });
      changes.push("Rescale the airflow model where AF Learning is large.");
    } else {
      changes.push("Have the tuner check the closed-loop trim tables.");
    }
    noticed.push(`${learnLabel} reached ${signed} in ${learnLog}.`);
  } else if (learnAbs > 0) {
    noticed.push(`Fuel trims stayed modest (peak ${learnPeak > 0 ? "+" : ""}${learnPeak.toFixed(1)}%).`);
  }

  const target = review.targetAtPeak;
  const peak = review.peakBoost;
  const namePsi = Math.max(...tunes.map((tune) => tune.targetPsi ?? 0));
  const overTarget = peak !== null && target !== null && target > 2 ? peak - target : 0;
  const overName = peak !== null && namePsi > 0 ? peak - namePsi : 0;
  const over = Math.max(overTarget, overName);
  if (over > 1.5) {
    const severe = over > 2.5;
    if (severe) {
      safety = true;
      health.boost = "bad";
    } else {
      health.boost = worseHealth(health.boost, "warn");
      needsTune = true;
    }
    score -= severe ? 16 : 6;
    if (severe) {
      alerts.push({
        title: "Boost is above the target",
        problem: `Peak boost is ${peak?.toFixed(2)} psi, which is ${over.toFixed(1)} psi above ${overName >= overTarget && namePsi > 0 ? `the ${namePsi.toFixed(0)} psi written in the tune name` : `the logged target of ${target?.toFixed(1)} psi`}.`,
        remedy: "Have the tuner check wastegate duty and the boost targets before more pulls.",
      });
      changes.push("Bring boost back to the map target before another wide-open pull.");
    } else {
      changes.push("Ask the tuner to tighten boost control a little.");
    }
    noticed.push(`Boost peaked ${over.toFixed(1)} psi above the target.`);
  } else if (peak !== null) {
    noticed.push(`Peak boost was ${peak.toFixed(1)} psi${target ? ` with a target near ${target.toFixed(1)} psi` : ""}.`);
  }

  const pressures = loaded.map((row) => row.fp).filter((fp) => fp > 50);
  if (pressures.length >= 8) {
    const low = percentile(pressures, 10);
    if (low < 1500) {
      safety = true;
      health.delivery = "bad";
      score -= 24;
      alerts.push({
        title: "Fuel pressure is low under boost",
        problem: `Direct-injection pressure under boost is down to about ${Math.round(low).toLocaleString()} psi.`,
        remedy: "Check fuel level, the high-pressure pump, and the tuner’s pressure targets.",
      });
      noticed.push(`Fuel pressure under boost fell to about ${Math.round(low).toLocaleString()} psi.`);
      changes.push("Fix fuel pressure before more pulls.");
    } else {
      noticed.push(`Fuel pressure under boost stayed healthy (about ${Math.round(low).toLocaleString()} psi at the low end).`);
    }
  }

  if (coolantMax > 230) {
    safety = true;
    health.delivery = worseHealth(health.delivery, "bad");
    score -= 12;
    alerts.push({
      title: "Coolant is hot",
      problem: `Coolant reached ${coolantMax.toFixed(0)}°F.`,
      remedy: "Let the car cool and skip repeated wide-open pulls until coolant stays under control.",
    });
    noticed.push(`Coolant reached ${coolantMax.toFixed(0)}°F.`);
    changes.push("Cool the car down before another pull.");
  }
  if (oilMax > 250) {
    safety = true;
    health.delivery = worseHealth(health.delivery, "bad");
    score -= 12;
    alerts.push({
      title: "Oil is hot",
      problem: `Oil reached ${oilMax.toFixed(0)}°F during these logs.`,
      remedy: "Let the oil cool and avoid back-to-back pulls.",
    });
    noticed.push(`Oil reached ${oilMax.toFixed(0)}°F.`);
    changes.push("Let oil temperature come down before another pull.");
  }

  const tuneOctane = tunes.find((tune) => tune.octane !== null)?.octane ?? null;
  const mixedOctane = new Set(tunes.map((tune) => tune.octane).filter((value) => value !== null)).size > 1;
  if (tuneOctane !== null && fuelOctane < tuneOctane) {
    safety = true;
    health.afr = worseHealth(health.afr, "bad");
    score -= 18;
    alerts.push({
      title: "Fuel octane is below the map",
      problem: `The tune name is written for ${tuneOctane} octane and the review is using ${fuelOctane}.`,
      remedy: `Use ${tuneOctane} octane, or have the map retuned for ${fuelOctane}.`,
    });
    noticed.push(`Tank octane ${fuelOctane} is below the map’s ${tuneOctane}.`);
    changes.push(`Fill with ${tuneOctane} octane or retune for ${fuelOctane}.`);
  }

  const reflashes = [...new Set(tunes.map((tune) => tune.reflash).filter((value): value is string => Boolean(value)))];
  if (reflashes.length > 1 || mixedOctane) {
    score -= 6;
    needsTune = true;
    health.trims = worseHealth(health.trims, "warn");
    alerts.push({
      title: "These logs are not all on the same map",
      problem: `The files name more than one reflash (${reflashes.join("; ")}).`,
      remedy: "Review one map at a time.",
    });
    noticed.push("More than one reflash is loaded across these files.");
    changes.push("Review each map in its own session.");
  }

  if (damMax > 1.05) {
    health.knock = worseHealth(health.knock, "warn");
    noticed.push(`DAM read as high as ${damMax.toFixed(2)}. On this ECU 1.00 is the top, so that column is not a normal DAM trace.`);
  }

  let letter = letterFor(score);
  const uncapped = letter;
  if (!loaded.length) letter = worseLetter(letter, "A");
  if (needsTune && !safety) letter = worseLetter(letter, "B");
  if (safety) letter = "F";
  if (letter !== uncapped) {
    noticed.push(
      `The grade is held at ${letter} because ${safety ? "an outstanding safety issue is open" : needsTune ? "the tune should be adjusted" : "wide-open fueling was never logged"}.`,
    );
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const uniqueChanges = [...new Set(changes)];
  const uniqueNoticed = [...new Set(noticed)];
  const summary =
    letter === "S"
      ? `Nothing outstanding showed up. ${uniqueNoticed.slice(0, 2).join(" ")}`
      : letter === "A"
        ? `The log looks great overall. ${uniqueNoticed.filter((line) => !/stayed inside|stayed modest|stayed healthy|DAM stayed/.test(line)).slice(0, 2).join(" ") || uniqueNoticed[0] || ""} ${uniqueChanges.length ? `Small follow-up: ${uniqueChanges[0]}` : ""}`.trim()
        : letter === "B"
          ? `The car is usable, but the tune should be adjusted. ${uniqueNoticed.filter((line) => /trim|preferred|Fine knock|Boost peaked/.test(line)).slice(0, 3).join(" ") || uniqueNoticed.slice(0, 2).join(" ")} ${uniqueChanges.length ? `What to change: ${uniqueChanges.join(" ")}` : ""}`.trim()
          : `Outstanding issues need attention before more wide-open pulls. ${alerts.map((alert) => alert.title).join("; ") || uniqueNoticed.slice(0, 2).join(" ")}. ${uniqueChanges.length ? `What to change: ${uniqueChanges.join(" ")}` : ""}`.trim();

  return {
    alerts,
    fuelStats,
    grade: {
      letter,
      score,
      blurb: BLURB[letter],
      summary,
      noticed: uniqueNoticed,
      changes: uniqueChanges,
      reasons: uniqueNoticed,
      health,
    },
  };
}

export function worseHealth(a: Health, b: Health): Health {
  const order: Health[] = ["good", "warn", "bad"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

export function healthBorder(health: Health) {
  if (health === "good") return "border-emerald-500/70 bg-emerald-500/5";
  if (health === "warn") return "border-amber-400/80 bg-amber-400/10";
  return "border-red-500/70 bg-red-500/10";
}

export function gradeTone(letter: GradeLetter) {
  if (letter === "S") return "border-blue-500 bg-blue-500/15 text-blue-800 dark:text-blue-100";
  if (letter === "A") return "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-100";
  if (letter === "B") return "border-amber-400 bg-amber-400/20 text-amber-950 dark:text-amber-50";
  return "border-red-500 bg-red-500/15 text-red-800 dark:text-red-100";
}
