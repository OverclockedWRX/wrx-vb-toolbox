import assert from "node:assert/strict";
import { compareSetup, parseTireSize, tireDiameterMm } from "../lib/wheel-math";
import { resolveStockPackage, STOCK_PACKAGES } from "../lib/stock-wheels";

assert.deepEqual(parseTireSize("245/40R18"), { widthMm: 245, aspect: 40, rimIn: 18, raw: "245/40R18" });
assert.deepEqual(parseTireSize("p235/45zr17"), { widthMm: 235, aspect: 45, rimIn: 17, raw: "P235/45ZR17" });
assert.equal(parseTireSize("nope"), null);

const oem18 = STOCK_PACKAGES.premium18;
const diameter = tireDiameterMm(oem18.tire);
assert.ok(Math.abs(diameter - (18 * 25.4 + 2 * 245 * 0.4)) < 0.01);

assert.equal(resolveStockPackage(2024, "Base")?.id, "base17");
assert.equal(resolveStockPackage(2024, "Premium")?.id, "premium18");
assert.equal(resolveStockPackage(2024, "Limited")?.id, "premium18");
assert.equal(resolveStockPackage(2024, "GT")?.id, "premium18");
assert.equal(resolveStockPackage(2024, "TR")?.id, "ts19");
assert.equal(resolveStockPackage(2025, "tS")?.id, "ts19");
assert.equal(resolveStockPackage(2024, "RS")?.id, "ts19");
assert.equal(resolveStockPackage(2024, "WRX RS")?.id, "premium18");

const stockHeight = compareSetup(
  oem18.tire,
  oem18.wheel,
  { widthMm: 245, aspect: 40, rimIn: 18 },
  { widthIn: 9.5, diameterIn: 18, offsetMm: 38 },
);
assert.equal(stockHeight.fitment.overall, "ok");
assert.ok(stockHeight.pokeDeltaMm > 0);

const diameterShift = compareSetup(
  oem18.tire,
  oem18.wheel,
  { widthMm: 255, aspect: 35, rimIn: 18 },
  { widthIn: 9.5, diameterIn: 18, offsetMm: 38 },
);
assert.ok(diameterShift.fitment.overall === "ok" || diameterShift.fitment.overall === "caution");

const tooWide = compareSetup(
  oem18.tire,
  oem18.wheel,
  { widthMm: 275, aspect: 35, rimIn: 18 },
  { widthIn: 10.5, diameterIn: 18, offsetMm: 22 },
);
assert.equal(tooWide.fitment.overall, "outside");

console.log("wheel fitment checks ok");
