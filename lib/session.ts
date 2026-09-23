import { assess, type Alert, type FuelStats, type GradeResult } from "@/lib/assess";
import { analyze } from "@/lib/analyze";
import { missingRequirements } from "@/lib/columns";
import { isOctane, safeWindow, type Octane, type SafeWindow } from "@/lib/limits";
import type { ParsedLog } from "@/lib/parse-log";
import { parseTune, tuneTitle, type TuneInfo } from "@/lib/tune";
import type { Review } from "@/lib/types";

export type FuelChoice = "tune" | Octane;

export type MissingChannel = {
  file: string;
  label: string;
  why: string;
};

export type Blocker = {
  file: string;
  detail: string;
};

export type SessionRefusal = {
  ok: false;
  title: string;
  lead: string;
  blockers: Blocker[];
  missing: MissingChannel[];
  needsOctane: boolean;
  tuneSummary: string | null;
};

export type SessionReview = {
  ok: true;
  review: Review;
  tunes: TuneInfo[];
  limits: SafeWindow;
  windowNote: string;
  fuelOctane: Octane;
  alerts: Alert[];
  grade: GradeResult;
  fuelStats: FuelStats;
  sampleData: boolean;
  headgaskets: boolean;
};

export type SessionResult = SessionRefusal | SessionReview;

/** One independent review per CSV. Multi-file loads get a tab each. */
export function buildFileSessions(logs: ParsedLog[], fuel: FuelChoice) {
  return logs.map((log, index) => ({
    id: `${index}-${log.name}`,
    name: log.name,
    session: buildSession([log], fuel),
  }));
}

function uniqueOctane(tunes: TuneInfo[]): Octane | null | "mixed" {
  const found = [...new Set(tunes.map((tune) => tune.octane).filter((value): value is Octane => value !== null))];
  if (!found.length) return null;
  if (found.length > 1) return "mixed";
  return found[0];
}

function emptyChannels(log: ParsedLog): MissingChannel[] {
  if (log.samples.length < 2) return [];
  const rows: { label: string; why: string; empty: boolean }[] = [
    {
      label: "AF Sens 1 Ratio",
      why: "The column is present, but every value is blank or zero. A grade without a wideband reading would hide a lean pull.",
      empty: log.samples.every((sample) => sample.afr <= 0),
    },
    {
      label: "Comm Fuel Final",
      why: "The column is present, but the ECU command is blank. Actual AFR cannot be compared with the request.",
      empty: log.samples.every((sample) => sample.cmd <= 0),
    },
    {
      label: "Boost",
      why: "The column is present, but every value is zero. Idle on this car is vacuum, so an all-zero column is not a real boost trace.",
      empty: log.samples.every((sample) => sample.boost === 0),
    },
    {
      label: "DAM",
      why: "The column is present, but DAM has no numeric values. A knocked log would look clean.",
      empty: log.samples.every((sample) => sample.dam === null),
    },
    {
      label: "Fuel Pressure",
      why: "The column is present, but fuel pressure never reports a number, so the pump check cannot be done.",
      empty: log.samples.every((sample) => sample.fp <= 0),
    },
  ];
  return rows.filter((row) => row.empty).map((row) => ({ file: log.name, label: row.label, why: row.why }));
}

export function buildSession(logs: ParsedLog[], fuel: FuelChoice): SessionResult {
  const blockers: Blocker[] = [];
  const missing: MissingChannel[] = [];
  const tunes: TuneInfo[] = [];

  for (const log of logs) {
    if (log.parseError && log.headers.length === 0) {
      blockers.push({ file: log.name, detail: log.parseError });
      continue;
    }
    if (log.parseError) blockers.push({ file: log.name, detail: log.parseError });
    for (const column of missingRequirements(log.headers)) {
      missing.push({ file: log.name, label: column.label, why: column.why });
    }
    missing.push(...emptyChannels(log));
    const tune = parseTune(log.map);
    tunes.push(tune);
    const apMissing = missing.some((item) => item.file === log.name && item.label === "AP Info");
    if (!apMissing && !tune.isVb && tune.rejectReason) {
      blockers.push({ file: log.name, detail: tune.rejectReason });
    }
  }

  const named = tunes.filter((tune) => tune.reflash || tune.vehicle);
  const tuneSummary = named.length
    ? named
        .map((tune) => {
          const vehicle = tune.vehicle ?? (tune.year ? `${tune.year} WRX` : null);
          return [vehicle, tuneTitle(tune)].filter(Boolean).join(" · ");
        })
        .filter((value, index, all) => all.indexOf(value) === index)
        .join(" / ")
    : null;

  const headerOctane = uniqueOctane(tunes.filter((tune) => tune.isVb));
  const vbReady = tunes.length > 0 && tunes.every((tune) => tune.isVb) && blockers.length === 0 && missing.length === 0;
  let fuelOctane: Octane | null = null;
  let needsOctane = false;
  if (headerOctane === "mixed") {
    needsOctane = fuel === "tune";
    if (fuel !== "tune") fuelOctane = fuel;
  } else if (headerOctane === null) {
    needsOctane = fuel === "tune";
    if (fuel !== "tune") fuelOctane = fuel;
  } else if (fuel === "tune") {
    fuelOctane = headerOctane;
  } else {
    fuelOctane = isOctane(Math.min(headerOctane, fuel)) ? (Math.min(headerOctane, fuel) as Octane) : headerOctane;
  }

  if (!vbReady || fuelOctane === null) {
    const onlyOctane = needsOctane && blockers.length === 0 && missing.length === 0;
    const missingData = missing.length > 0;
    return {
      ok: false,
      needsOctane,
      tuneSummary,
      blockers,
      missing,
      title: onlyOctane
        ? "The tune name does not say which octane it was written for."
        : missingData
          ? "There isn't enough data to write a review."
          : "This review cannot be completed.",
      lead: onlyOctane
        ? "Safe AFR, the alert limits, and the grade all change from 87 to 93. Choose the octane in the tank, then start the review again. No grade is shown until that number is known."
        : missingData
          ? "These logs are missing channels a review depends on. Without that data there isn't enough to judge the tune, the mixture, or knock, so no review was written."
          : "A full review needs a 2022–2026 WRX in the Accessport header and an octane. No grade is shown.",
    };
  }

  const boostFromName = tunes.map((tune) => tune.targetPsi).filter((value): value is number => value !== null);
  const review = analyze(logs);
  let boostPsi = 15;
  let boostSource = "a 15 psi reference, because the tune name has no boost target";
  if (boostFromName.length) {
    boostPsi = Math.max(...boostFromName);
    boostSource = `the ${boostPsi % 1 === 0 ? boostPsi.toFixed(0) : boostPsi.toFixed(1)} psi target written in the tune name`;
  } else if (review.targetAtPeak && review.targetAtPeak > 5) {
    boostPsi = review.targetAtPeak;
    boostSource = `the logged boost target of ${boostPsi.toFixed(1)} psi`;
  }
  const limits = safeWindow(fuelOctane, boostPsi);
  const octaneNote =
    headerOctane === "mixed"
      ? `The files name more than one octane, so the window uses ${fuelOctane}, the lower of the map and the fuel you selected.`
      : headerOctane === null
        ? `Octane was not in the tune name. This window uses ${fuelOctane}, the fuel you selected.`
        : fuel !== "tune" && fuel < headerOctane
          ? `The map says ${headerOctane} and the tank is ${fuel}. The window uses ${fuelOctane} so the lower octane is held to a richer limit.`
          : fuel !== "tune" && fuel > headerOctane
            ? `The tank is marked ${fuel}. The map says ${headerOctane}, so the window stays on ${headerOctane}.`
            : `Octane ${fuelOctane} was read from the tune name.`;
  const assessed = assess(logs, review, tunes, limits, fuelOctane);
  const sampleFlags = tunes.map((tune) => (tune.raw ?? "").toUpperCase().includes("SAMPLE DATA"));
  const sampleData = sampleFlags.some(Boolean);

  return {
    ok: true,
    review,
    tunes,
    limits,
    windowNote: `${octaneNote} Boost scaling uses ${boostSource}. The preferred band gets 0.03 AFR richer for each psi of target above 14.`,
    fuelOctane,
    alerts: assessed.alerts,
    grade: assessed.grade,
    fuelStats: assessed.fuelStats,
    sampleData,
    headgaskets: sampleFlags.length > 0 && sampleFlags.every(Boolean) && lotsOfKnock(logs),
  };
}

function lotsOfKnock(logs: ParsedLog[]) {
  let hits = 0;
  let worst = 0;
  for (const log of logs) {
    for (const sample of log.samples) {
      if (sample.fk < 0 && sample.boost >= 5 && sample.accel >= 80) {
        hits += 1;
        worst = Math.min(worst, sample.fk);
      }
    }
  }
  return worst <= -6 || hits >= 40;
}
