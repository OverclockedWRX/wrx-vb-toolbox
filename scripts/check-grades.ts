import assert from "node:assert/strict";
import { parseLog } from "../lib/parse-log";
import { buildSession, type FuelChoice, type SessionReview } from "../lib/session";

const AP = "AP Info:[AP3-SUB-006 v0.0.0-1][2024 USDM WRX][Reflash: Grade Rule - 16psi 93oct.ptm]";

const headers = [
  "Time (sec)",
  "RPM (RPM)",
  "Accel Position (%)",
  "AF Sens 1 Ratio (AFR)",
  "Comm Fuel Final (AFR)",
  "Boost (psi)",
  "Target Boost Final Rel (psi)",
  "Dyn Adv Mult (DAM)",
  "Feedback Knock (deg)",
  "Fine Knock Learn (deg)",
  "Ignition Timing (deg)",
  "AF Learning 1 (%)",
  "AF Learning 3 (%)",
  "AF Correction 1 (%)",
  "Calculated Load (g/rev)",
  "Gear Position (gear)",
  "Fuel Pressure (psi)",
  "Coolant Temp (F)",
  "Oil Temp (F)",
  "Vehicle Speed (mph)",
  "Intake Temp (F)",
  AP,
];

type Row = Record<string, string | number>;

function row(values: Row) {
  return headers
    .map((header) => {
      if (header.startsWith("AP Info")) return "";
      return String(values[header] ?? "");
    })
    .join(",");
}

function healthy(t: number, overrides: Row = {}): Row {
  return {
    "Time (sec)": t.toFixed(2),
    "RPM (RPM)": 3000 + t * 400,
    "Accel Position (%)": 100,
    "AF Sens 1 Ratio (AFR)": 11.1,
    "Comm Fuel Final (AFR)": 11.05,
    "Boost (psi)": 16,
    "Target Boost Final Rel (psi)": 16,
    "Dyn Adv Mult (DAM)": 1,
    "Feedback Knock (deg)": 0,
    "Fine Knock Learn (deg)": 0,
    "Ignition Timing (deg)": 8,
    "AF Learning 1 (%)": -1,
    "AF Learning 3 (%)": 2,
    "AF Correction 1 (%)": 0.4,
    "Calculated Load (g/rev)": 1.4,
    "Gear Position (gear)": 3,
    "Fuel Pressure (psi)": 2200,
    "Coolant Temp (F)": 190,
    "Oil Temp (F)": 200,
    "Vehicle Speed (mph)": 45,
    "Intake Temp (F)": 80,
    ...overrides,
  };
}

function grade(name: string, overrides: Row = {}, count = 12, fuel: FuelChoice = "tune"): SessionReview {
  const samples = Array.from({ length: count }, (_, index) => healthy(index * 0.05, overrides));
  const text = [headers.join(","), ...samples.map(row)].join("\n");
  const session = buildSession([parseLog(name, text)], fuel);
  if (!session.ok) {
    throw new Error(`${name} refused: ${session.title} ${session.missing.map((item) => item.label).join(", ")}`);
  }
  return session;
}

function gradeRows(name: string, samples: Row[], fuel: FuelChoice = "tune"): SessionReview {
  const text = [headers.join(","), ...samples.map(row)].join("\n");
  const session = buildSession([parseLog(name, text)], fuel);
  if (!session.ok) throw new Error(`${name} refused: ${session.title}`);
  return session;
}

function hasAlert(session: SessionReview, title: string) {
  return session.alerts.some((alert) => alert.title === title);
}

const clean = grade("clean.csv");
assert(clean.grade.letter === "S", `clean log should be S, got ${clean.grade.letter} ${clean.grade.summary}`);
assert(clean.alerts.length === 0, "clean log has no alerts");
assert(clean.review.correctionMedian === 0.4, "clean log keeps AF Correction");
assert(clean.review.logs[0]?.intakeMax === 80, "clean log keeps non-manifold intake temp");

const leanStop = grade("lean-stop.csv", { "AF Sens 1 Ratio (AFR)": 12.8 });
assert(leanStop.grade.letter === "F" && hasAlert(leanStop, "Wide-open AFR is lean for this fuel"), "AFR past the stop is F");

const leanPreferred = grade("lean-preferred.csv", { "AF Sens 1 Ratio (AFR)": 11.95 });
assert(leanPreferred.grade.letter !== "F", "AFR above preferred and under the stop is not F");
assert(leanPreferred.grade.noticed.some((line) => /preferred limit/.test(line)), "preferred-lean is noted");

const richStop = grade("rich-stop.csv", { "AF Sens 1 Ratio (AFR)": 9.2 });
assert(richStop.grade.letter === "F" && hasAlert(richStop, "Wide-open AFR is richer than the safe floor"), "AFR richer than the floor is F");

const richPreferred = grade("rich-preferred.csv", { "AF Sens 1 Ratio (AFR)": 10.0 });
assert(richPreferred.grade.letter !== "F", "AFR richer than preferred and above the floor is not F");

const commanded = grade("commanded-lean.csv", { "Comm Fuel Final (AFR)": 12.8 });
assert(commanded.grade.letter === "F" && hasAlert(commanded, "The map is commanding a lean AFR"), "a lean command is F");

const dam = grade("dam.csv", { "Dyn Adv Mult (DAM)": 0.75 });
assert(dam.grade.letter === "F" && hasAlert(dam, "DAM has dropped"), "DAM below 1.00 is F");

const noise = gradeRows(
  "noise.csv",
  Array.from({ length: 12 }, (_, index) => healthy(index * 0.05, index < 2 ? { "Feedback Knock (deg)": -1.05 } : {})),
);
assert(noise.grade.letter !== "F", "a short -1.05° blip with DAM 1.00 is not F");
assert(noise.grade.noticed.some((line) => /sensor noise/.test(line)), "the short blip is called sensor noise");

const longKnock = grade("long-knock.csv", { "Feedback Knock (deg)": -2.11 });
assert(longKnock.grade.letter === "F" && hasAlert(longKnock, "Knock under load"), "deeper under-load knock is F");

const offBoost = gradeRows(
  "off-boost.csv",
  Array.from({ length: 12 }, (_, index) =>
    healthy(index * 0.05, index < 3 ? { "Accel Position (%)": 12, "Boost (psi)": -6, "Feedback Knock (deg)": -1.05 } : {}),
  ),
);
assert(offBoost.grade.letter !== "F", "off-boost knock is not F");
assert(offBoost.grade.noticed.some((line) => /off boost/.test(line)), "off-boost knock is a note");

const mildFlk = grade("mild-flk.csv", { "Fine Knock Learn (deg)": -1.17 });
assert(mildFlk.grade.letter !== "F", "fine knock learn of -1.17° is not F");
assert(mildFlk.grade.noticed.some((line) => /Fine knock learn/.test(line)), "mild fine knock learn is noted");

const severeFlk = grade("severe-flk.csv", { "Fine Knock Learn (deg)": -3 });
assert(severeFlk.grade.letter === "F" && hasAlert(severeFlk, "Fine knock learn is stored"), "fine knock learn of -3° is F");

const farTrim = grade("far-trim.csv", { "AF Learning 3 (%)": 16.4 });
assert(hasAlert(farTrim, "Fuel trims are far out"), "a trim past 15% raises an alert");
assert(farTrim.grade.letter === "B", `a large trim without a safety F is held at B, got ${farTrim.grade.letter}`);

const modestTrim = grade("modest-trim.csv", { "AF Learning 3 (%)": 10 });
assert(modestTrim.grade.letter === "B", "a trim past 8% and under 15% is a B");
assert(!hasAlert(modestTrim, "Fuel trims are far out"), "a 10% trim is not the far-out alert");

const mildBoost = grade("mild-boost.csv", { "Boost (psi)": 18 });
assert(mildBoost.grade.letter !== "F", "boost 2 psi over the target is not F");
assert(mildBoost.grade.noticed.some((line) => /above the target/.test(line)), "mild overboost is noted");

const severeBoost = grade("severe-boost.csv", { "Boost (psi)": 20 });
assert(severeBoost.grade.letter === "F" && hasAlert(severeBoost, "Boost is above the target"), "boost well above the target is F");

const lowPressure = grade("low-pressure.csv", { "Fuel Pressure (psi)": 1100 });
assert(lowPressure.grade.letter === "F" && hasAlert(lowPressure, "Fuel pressure is low under boost"), "fuel pressure under 1,500 psi is F");

const hotCoolant = grade("hot-coolant.csv", { "Coolant Temp (F)": 235 });
assert(hotCoolant.grade.letter === "F" && hasAlert(hotCoolant, "Coolant is hot"), "coolant above 230°F is F");

const hotOil = grade("hot-oil.csv", { "Oil Temp (F)": 260 });
assert(hotOil.grade.letter === "F" && hasAlert(hotOil, "Oil is hot"), "oil above 250°F is F");

const lowOctane = grade("low-octane.csv", {}, 12, 91);
assert(lowOctane.grade.letter === "F" && hasAlert(lowOctane, "Fuel octane is below the map"), "tank octane below the map is F");

const cruise = grade("cruise.csv", { "Accel Position (%)": 12, "Boost (psi)": -6, "AF Sens 1 Ratio (AFR)": 14.7 });
assert(cruise.grade.letter !== "S" && cruise.grade.letter !== "F", `a log with no wide-open samples is not S or F, got ${cruise.grade.letter}`);

console.log("grade rules ok");
