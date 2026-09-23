import assert from "node:assert/strict";
import { decodeVin, normalizeVin, vinCheckDigit, vinCheckDigitOk } from "../lib/vin";

assert.equal(normalizeVin(" jf1vbal69n9801234 "), "JF1VBAL69N9801234");
assert.equal(vinCheckDigit("JF1VBAL69N9801234"), "9");
assert.equal(vinCheckDigitOk("JF1VBAL69N9801234"), true);
assert.equal(vinCheckDigitOk("JF1VBAL60N9801234"), false);

const short = await decodeVin("JF1VBAL69");
assert.equal(short.ok, false);
assert.match(short.error ?? "", /17/);

const localOnly = await decodeVin("JF1VBAL69N9801234");
assert.equal(localOnly.vin, "JF1VBAL69N9801234");
assert.ok(localOnly.fields.length > 5, "expected decoded fields");
assert.ok(localOnly.fields.some((field) => field.key === "ModelYear" && field.value === "2022"));
assert.ok(localOnly.summary?.includes("2022") || localOnly.fields.some((field) => field.key === "Model"));

if (localOnly.source === "nhtsa") {
  assert.ok(localOnly.fields.some((field) => field.key === "Make"));
  assert.ok(localOnly.fields.some((field) => field.key === "Model" && /WRX/i.test(field.value)));
  console.log("vin decode ok via NHTSA", localOnly.summary, `(${localOnly.fields.length} fields)`);
} else {
  console.log("vin decode ok via local fallback", localOnly.summary, `(${localOnly.fields.length} fields)`);
}
