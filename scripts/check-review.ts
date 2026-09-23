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
console.log("checks passed");
