import { readFileSync, readdirSync } from "node:fs";
import { parseLog } from "../lib/parse-log";
import { SAMPLE_PACKS } from "../lib/sample-packs";
import { buildFileSessions, buildSession } from "../lib/session";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function loadPack(id: string) {
  const pack = SAMPLE_PACKS.find((item) => item.id === id);
  if (!pack) throw new Error(`missing pack ${id}`);
  return pack.files.map((name) => {
    const text = readFileSync(new URL(`../logs/${name}`, import.meta.url), "utf8");
    assert(!/preracing|perrin/i.test(text), `${name} still names the old tune`);
    return parseLog(name, text);
  });
}

function bestOkGrade(id: string) {
  const files = buildFileSessions(loadPack(id), "tune");
  assert(files.length >= 1, `${id} should produce file sessions`);
  const ok = files.filter((item) => item.session.ok);
  assert(ok.length >= 1, `${id} should complete at least one file`);
  for (const item of files) {
    if (item.session.ok) {
      console.log(id, item.name, item.session.grade.letter, item.session.grade.score, item.session.grade.summary.slice(0, 80));
      assert(item.session.sampleData, `${id} ${item.name} sample flag`);
      assert(item.session.grade.noticed.length > 0, `${id} ${item.name} noticed`);
    } else {
      console.log(id, item.name, "refused", item.session.title);
    }
  }
  // Prefer the pull log grade when packs ship cruise + pull.
  const pull = ok.find((item) => /pull/i.test(item.name)) ?? ok[ok.length - 1];
  assert(pull.session.ok, `${id} pull should be ok`);
  return pull.session;
}

const expected: Record<string, string> = { s: "S", a: "A", b: "B", c: "B" };
for (const id of Object.keys(expected)) {
  const session = bestOkGrade(id);
  assert(!session.headgaskets, `${id} should not joke about headgaskets`);
  assert(session.grade.letter === expected[id], `${id} expected ${expected[id]}, got ${session.grade.letter} (${session.grade.score})`);
}

const boostFiles = buildFileSessions(loadPack("boost"), "tune");
assert(boostFiles.length === 1 && boostFiles[0].session.ok, "boost pack");
if (boostFiles[0].session.ok) {
  const boost = boostFiles[0].session;
  console.log("boost", boost.grade.letter, boost.grade.score, boost.grade.summary);
  assert(boost.grade.letter === "F", "50 psi is F");
  assert((boost.review.peakBoost ?? 0) >= 49, "50 psi peak");
  assert(!boost.headgaskets, "50 psi is not the knock joke");
  assert(boost.alerts.some((alert) => /boost/i.test(alert.title)), "overboost alert");
}

const knockFiles = buildFileSessions(loadPack("knock"), "tune");
assert(knockFiles.length === 1 && knockFiles[0].session.ok, "knock pack");
if (knockFiles[0].session.ok) {
  const knock = knockFiles[0].session;
  console.log("knock", knock.grade.letter, knock.grade.score, knock.grade.summary, "headgaskets", knock.headgaskets);
  assert(knock.grade.letter === "F", "knock is F");
  assert(knock.headgaskets, "knock pack shows the headgasket line");
  assert((knock.review.damMax ?? 0) > 2, "DAM is absurdly high");
  assert(knock.alerts.some((alert) => /knock/i.test(alert.title)), "knock alert");
}

const multi = buildFileSessions(loadPack("s"), "tune");
assert(multi.length === 2, "S pack should yield two file tabs");
assert(multi.every((item) => item.session.ok), "both S files should review");

// Combined multi-log path still works for callers that want one grade across files.
const combined = buildSession(loadPack("s"), "tune");
assert(combined.ok && combined.grade.letter === "S", "combined S pack still grades S");

const names = readdirSync(new URL("../logs/", import.meta.url));
assert(names.every((name) => name.startsWith("sample-")), `unexpected log files: ${names.join(", ")}`);

const aPull = bestOkGrade("a");
assert(
  !aPull.alerts.some((alert) => alert.title === "Knock under load"),
  "A pull short knock blip is not an F",
);
assert(
  aPull.grade.noticed.some((line) => /sensor noise/i.test(line) && /1\.00/.test(line)),
  "A pull explains the knock blip as sensor noise with DAM at 1.00",
);

const AP =
  "AP Info:[AP3-SUB-006 v0.0.0-1][2024 USDM WRX MT SAMPLE DATA][Reflash: Checklist Map - 16psi 93oct.ptm]";

function row(values: Record<string, string | number>, headers: string[]) {
  return headers
    .map((header) => {
      if (header.startsWith("AP Info")) return "";
      const key = header.split(" ")[0];
      return String(values[header] ?? values[key] ?? "");
    })
    .join(",");
}

function miniLog(name: string, headers: string[], samples: Record<string, string | number>[]) {
  const text = [headers.join(","), ...samples.map((sample) => row(sample, headers))].join("\n");
  return parseLog(name, text);
}

const baseHeaders = [
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
  "Vehicle Speed (mph)",
  "Intake Temp (F)",
  AP,
];

function sampleAt(t: number, overrides: Record<string, string | number> = {}) {
  return {
    "Time (sec)": t.toFixed(2),
    "RPM (RPM)": 4000,
    "Accel Position (%)": 100,
    "AF Sens 1 Ratio (AFR)": 11.1,
    "Comm Fuel Final (AFR)": 11.05,
    "Boost (psi)": 14,
    "Target Boost Final Rel (psi)": 16,
    "Dyn Adv Mult (DAM)": 1,
    "Feedback Knock (deg)": 0,
    "Fine Knock Learn (deg)": 0,
    "Ignition Timing (deg)": 8,
    "AF Learning 1 (%)": -1,
    "AF Learning 3 (%)": 2,
    "AF Correction 1 (%)": 0.4,
    "Calculated Load (g/rev)": 1.2,
    "Gear Position (gear)": 3,
    "Fuel Pressure (psi)": 2200,
    "Coolant Temp (F)": 190,
    "Vehicle Speed (mph)": 50,
    "Intake Temp (F)": 80,
    ...overrides,
  };
}

const damAliasHeaders = baseHeaders.map((header) => (header.startsWith("Dyn Adv") ? "DAM" : header));
const damAlias = buildSession(
  [
    miniLog(
      "dam-alias.csv",
      damAliasHeaders,
      [0, 0.05, 0.1].map((t) => sampleAt(t, { DAM: 1 })),
    ),
  ],
  "tune",
);
assert(damAlias.ok, "DAM alias header should review");
if (damAlias.ok) {
  assert(damAlias.review.damMin === 1, `DAM alias should read 1.00, got ${damAlias.review.damMin}`);
  assert(!damAlias.alerts.some((alert) => alert.title === "Knock under load"), "clean DAM alias log is not knock");
}

const missingAfrHeaders = baseHeaders.filter((header) => !header.startsWith("AF Sens"));
const missingAfr = buildSession(
  [miniLog("missing-afr.csv", missingAfrHeaders, [0, 0.05, 0.1].map((t) => sampleAt(t)))],
  "tune",
);
assert(!missingAfr.ok, "missing wideband should refuse");
if (!missingAfr.ok) {
  const afr = missingAfr.missing.filter((item) => item.label === "AF Sens 1 Ratio");
  assert(afr.length === 1, `missing wideband should be listed once, got ${afr.length}`);
  assert(!/column is present/i.test(afr[0]?.why ?? ""), "a missing column is not an empty column");
}

const emptyAfr = buildSession(
  [
    miniLog(
      "empty-afr.csv",
      baseHeaders,
      [0, 0.05, 0.1].map((t) => sampleAt(t, { "AF Sens 1 Ratio (AFR)": 0 })),
    ),
  ],
  "tune",
);
assert(!emptyAfr.ok, "blank wideband should refuse");
if (!emptyAfr.ok) {
  const afr = emptyAfr.missing.filter((item) => item.label === "AF Sens 1 Ratio");
  assert(afr.length === 1, "blank wideband listed once");
  assert(/column is present/i.test(afr[0]?.why ?? ""), "blank wideband says the column is present");
}

const longKnock = buildSession(
  [
    miniLog(
      "long-knock.csv",
      baseHeaders,
      Array.from({ length: 12 }, (_, index) => sampleAt(index * 0.05, { "Feedback Knock (deg)": -2.11 })),
    ),
  ],
  "tune",
);
assert(longKnock.ok && longKnock.grade.letter === "F", "longer under-load knock is F");
if (longKnock.ok) {
  assert(longKnock.alerts.some((alert) => alert.title === "Knock under load"), "longer knock raises the under-load alert");
}

const droppedDam = buildSession(
  [
    miniLog(
      "dropped-dam.csv",
      baseHeaders,
      [0, 0.05, 0.1].map((t) => sampleAt(t, { "Dyn Adv Mult (DAM)": 0.75, "Feedback Knock (deg)": -1.05 })),
    ),
  ],
  "tune",
);
assert(droppedDam.ok && droppedDam.grade.letter === "F", "short knock with dropped DAM is still F");
if (droppedDam.ok) {
  assert(droppedDam.alerts.some((alert) => alert.title === "Knock under load"), "dropped DAM does not get the noise exception");
}

console.log("checks passed");
