import assert from "node:assert/strict";
import { matchPresetFromVin } from "../lib/vin-preset";
import type { VinDecodeResult, VinField } from "../lib/vin";

function decoded(partial: Partial<VinDecodeResult> & { fields: VinField[] }): VinDecodeResult {
  return {
    vin: "JF1VBAL69N9801234",
    ok: true,
    checkDigitOk: true,
    source: "nhtsa",
    summary: null,
    error: null,
    ...partial,
  };
}

const limited = matchPresetFromVin(
  decoded({
    fields: [
      { key: "Make", label: "Make", value: "SUBARU" },
      { key: "Model", label: "Model", value: "WRX" },
      { key: "ModelYear", label: "Model year", value: "2022" },
      { key: "Trim", label: "Trim", value: "Limited" },
      { key: "TransmissionStyle", label: "Transmission", value: "Manual/Standard" },
      { key: "BodyClass", label: "Body", value: "Sedan/Saloon" },
    ],
  }),
);
assert.equal(limited.ok, true);
if (limited.ok) assert.equal(limited.preset.id, "US-2022-limited-6mt-sedan");

const gt = matchPresetFromVin(
  decoded({
    fields: [
      { key: "Make", label: "Make", value: "SUBARU" },
      { key: "Model", label: "Model", value: "WRX" },
      { key: "ModelYear", label: "Model year", value: "2022" },
      { key: "Trim", label: "Trim", value: "GT" },
      { key: "TransmissionStyle", label: "Transmission", value: "Continuously Variable Transmission (CVT)" },
      { key: "BodyClass", label: "Body", value: "Sedan/Saloon" },
      { key: "PlantCountry", label: "Plant country", value: "JAPAN" },
    ],
  }),
);
assert.equal(gt.ok, false);
if (!gt.ok) {
  assert.match(gt.message, /cannot be determined/i);
  assert.match(gt.message, /United States/);
  assert.match(gt.message, /Canada/);
}

const baseCvt2024 = matchPresetFromVin(
  decoded({
    fields: [
      { key: "Make", label: "Make", value: "SUBARU" },
      { key: "Model", label: "Model", value: "WRX" },
      { key: "ModelYear", label: "Model year", value: "2024" },
      { key: "Trim", label: "Trim", value: "Base" },
      { key: "TransmissionStyle", label: "Transmission", value: "Continuously Variable Transmission (CVT)" },
      { key: "BodyClass", label: "Body", value: "Sedan/Saloon" },
    ],
  }),
);
assert.equal(baseCvt2024.ok, false);
if (!baseCvt2024.ok) assert.match(baseCvt2024.message, /6-speed manual only/);

const tr = matchPresetFromVin(
  decoded({
    fields: [
      { key: "Make", label: "Make", value: "SUBARU" },
      { key: "Model", label: "Model", value: "WRX" },
      { key: "ModelYear", label: "Model year", value: "2024" },
      { key: "Trim", label: "Trim", value: "TR" },
      { key: "TransmissionStyle", label: "Transmission", value: "Manual/Standard" },
      { key: "BodyClass", label: "Body", value: "Sedan/Saloon" },
    ],
  }),
);
assert.equal(tr.ok, true);
if (tr.ok) assert.equal(tr.preset.id, "US-2024-tr-6mt-sedan");

const offline = matchPresetFromVin(
  decoded({
    source: "local",
    fields: [
      { key: "ModelYear", label: "Model year", value: "2022" },
      { key: "Chassis", label: "Chassis", value: "VB (2022–present WRX)" },
      { key: "Plant", label: "Plant", value: "Main plant, Ōta, Gunma, Japan (often 6MT on WRX)" },
    ],
  }),
);
assert.equal(offline.ok, false);
if (!offline.ok) {
  assert.match(offline.message, /cannot be determined/i);
  assert.match(offline.message, /Premium/);
  assert.match(offline.message, /Sport/);
}

const va = matchPresetFromVin(
  decoded({
    source: "local",
    fields: [
      { key: "ModelYear", label: "Model year", value: "2019" },
      { key: "Chassis", label: "Chassis", value: "VA (2015–2021 WRX / STI)" },
    ],
  }),
);
assert.equal(va.ok, false);
if (!va.ok) assert.match(va.message, /VA/);

const other = matchPresetFromVin(
  decoded({
    vin: "1HGCM82633A004352",
    fields: [
      { key: "Make", label: "Make", value: "HONDA" },
      { key: "Model", label: "Model", value: "ACCORD" },
      { key: "ModelYear", label: "Model year", value: "2003" },
    ],
  }),
);
assert.equal(other.ok, false);
if (!other.ok) assert.match(other.message, /HONDA ACCORD/);

const short = matchPresetFromVin(
  decoded({
    vin: "JF1VBAL69",
    ok: false,
    checkDigitOk: false,
    source: "none",
    fields: [],
    error: "A VIN needs 17 characters. This one has 9.",
  }),
);
assert.equal(short.ok, false);
if (!short.ok) assert.match(short.message, /17/);

const noTrim = matchPresetFromVin(
  decoded({
    fields: [
      { key: "Make", label: "Make", value: "SUBARU" },
      { key: "Model", label: "Model", value: "WRX" },
      { key: "ModelYear", label: "Model year", value: "2023" },
      { key: "TransmissionStyle", label: "Transmission", value: "Manual/Standard" },
    ],
  }),
);
assert.equal(noTrim.ok, false);
if (!noTrim.ok) assert.match(noTrim.message, /no trim/);

console.log("vin preset match ok");
