import assert from "node:assert/strict";
import { CAR_PRESETS, applyCarPreset, presetsFor, yearsForMarket } from "../lib/car-presets";
import { defaultSettings } from "../lib/types";

assert.ok(CAR_PRESETS.length > 40, "expected a full preset table");
assert.deepEqual(yearsForMarket("US"), [2026, 2025, 2024, 2023, 2022]);
assert.ok(presetsFor("US", 2022).some((car) => car.trim === "Base" && car.transmission === "6MT" && car.curbWeightLb === 3297));
assert.ok(presetsFor("AU", 2025).some((car) => car.trim.includes("Sportswagon") && car.body === "wagon"));
assert.ok(presetsFor("JP", 2022).every((car) => car.dragCd === 0.32));

const applied = applyCarPreset(presetsFor("US", 2024).find((car) => car.trim === "Premium" && car.transmission === "6MT")!, defaultSettings);
assert.equal(applied.weightWithDriverLb, 3358 + 170);
assert.equal(applied.settings.dragCd, 0.32);
assert.equal(applied.settings.frontalAreaM2, 2.25);
assert.equal(applied.settings.drivetrainLossPct, 18);

console.log(`car presets ok (${CAR_PRESETS.length} cars)`);
