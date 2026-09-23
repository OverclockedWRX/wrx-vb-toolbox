import type { PowerSettings } from "@/lib/types";

/**
 * VB WRX road-load presets (2022–2026) by market and trim.
 *
 * Curb weights come from Subaru trim-comparison sheets (US), Subaru Canada
 * specs, Australian dealer kerb tables, and Japanese catalog vehicle weight.
 * Subaru does not publish an official Cd; 0.32 is the commonly cited figure
 * used for every preset. Frontal area is width × height × 0.84 from catalog
 * dimensions (sedan ≈ 2.25 m², Sportswagon ≈ 2.26 m²).
 */

export type Market = "US" | "CA" | "AU" | "NZ" | "JP";
export type Transmission = "6MT" | "CVT";
export type Body = "sedan" | "wagon";

export type CarPreset = {
  id: string;
  market: Market;
  year: number;
  trim: string;
  transmission: Transmission;
  body: Body;
  curbWeightLb: number;
  curbWeightKg: number;
  dragCd: number;
  frontalAreaM2: number;
  rollingResistance: number;
  drivetrainLossPct: number;
  source: string;
};

/** SAE-style standard driver added on top of curb weight for road-load WHP. */
export const DRIVER_LB = 170;

export const MARKETS: { id: Market; label: string }[] = [
  { id: "US", label: "United States" },
  { id: "CA", label: "Canada" },
  { id: "AU", label: "Australia" },
  { id: "NZ", label: "New Zealand" },
  { id: "JP", label: "Japan" },
];

const CD = 0.32;
const SEDAN_AREA = 2.25;
const WAGON_AREA = 2.26;
const CRR = 0.013;
const MT_LOSS = 18;
const CVT_LOSS = 20;

function lbFromKg(kg: number) {
  return Math.round(kg * 2.2046226218);
}

function kgFromLb(lb: number) {
  return Math.round(lb / 2.2046226218);
}

function preset(
  market: Market,
  year: number,
  trim: string,
  transmission: Transmission,
  curbWeightLb: number,
  opts: { body?: Body; source: string; crr?: number },
): CarPreset {
  const body = opts.body ?? "sedan";
  const curbWeightKg = kgFromLb(curbWeightLb);
  return {
    id: `${market}-${year}-${trim.replace(/\s+/g, "-").toLowerCase()}-${transmission.toLowerCase()}-${body}`,
    market,
    year,
    trim,
    transmission,
    body,
    curbWeightLb,
    curbWeightKg,
    dragCd: CD,
    frontalAreaM2: body === "wagon" ? WAGON_AREA : SEDAN_AREA,
    rollingResistance: opts.crr ?? CRR,
    drivetrainLossPct: transmission === "6MT" ? MT_LOSS : CVT_LOSS,
    source: opts.source,
  };
}

function fromKg(
  market: Market,
  year: number,
  trim: string,
  transmission: Transmission,
  curbWeightKg: number,
  opts: { body?: Body; source: string; crr?: number },
): CarPreset {
  return preset(market, year, trim, transmission, lbFromKg(curbWeightKg), opts);
}

const US = "Subaru US trim comparison";
const CA = "Subaru Canada specifications / US-equivalent curb where noted";
const AU = "Australian WRX kerb weight tables";
const NZ = "Subaru New Zealand specifications";
const JP = "Japanese WRX S4 catalog vehicle weight";

/** United States — official Subaru curb weights (manual / CVT). */
const US_PRESETS: CarPreset[] = [
  // 2022
  preset("US", 2022, "Base", "6MT", 3297, { source: US }),
  preset("US", 2022, "Base", "CVT", 3431, { source: US }),
  preset("US", 2022, "Premium", "6MT", 3320, { source: US }),
  preset("US", 2022, "Premium", "CVT", 3457, { source: US }),
  preset("US", 2022, "Limited", "6MT", 3390, { source: US }),
  preset("US", 2022, "Limited", "CVT", 3529, { source: US }),
  preset("US", 2022, "GT", "CVT", 3534, { source: US }),
  // 2023
  preset("US", 2023, "Base", "6MT", 3297, { source: US }),
  preset("US", 2023, "Base", "CVT", 3431, { source: US }),
  preset("US", 2023, "Premium", "6MT", 3324, { source: US }),
  preset("US", 2023, "Premium", "CVT", 3462, { source: US }),
  preset("US", 2023, "Limited", "6MT", 3397, { source: US }),
  preset("US", 2023, "Limited", "CVT", 3535, { source: US }),
  preset("US", 2023, "GT", "CVT", 3537, { source: US }),
  // 2024
  preset("US", 2024, "Base", "6MT", 3329, { source: US }),
  preset("US", 2024, "Premium", "6MT", 3358, { source: US }),
  preset("US", 2024, "Premium", "CVT", 3494, { source: US }),
  preset("US", 2024, "Limited", "6MT", 3428, { source: US }),
  preset("US", 2024, "Limited", "CVT", 3565, { source: US }),
  preset("US", 2024, "TR", "6MT", 3430, { source: US }),
  preset("US", 2024, "GT", "CVT", 3569, { source: US }),
  // 2025 — Base dropped; Premium / Limited / GT / tS
  preset("US", 2025, "Premium", "6MT", 3351, { source: US }),
  preset("US", 2025, "Premium", "CVT", 3488, { source: US }),
  preset("US", 2025, "Limited", "6MT", 3419, { source: US }),
  preset("US", 2025, "Limited", "CVT", 3554, { source: US }),
  preset("US", 2025, "GT", "CVT", 3560, { source: US }),
  preset("US", 2025, "tS", "6MT", 3430, { source: US }),
  // 2026 — Base returns; Premium MT-only; Limited / GT / tS / Series.Yellow
  preset("US", 2026, "Base", "6MT", 3348, { source: US }),
  preset("US", 2026, "Premium", "6MT", 3351, { source: US }),
  preset("US", 2026, "Limited", "6MT", 3419, { source: US }),
  preset("US", 2026, "Limited", "CVT", 3554, { source: US }),
  preset("US", 2026, "GT", "CVT", 3560, { source: US }),
  preset("US", 2026, "tS", "6MT", 3430, { source: US }),
  preset("US", 2026, "Series.Yellow", "6MT", 3430, { source: US }),
];

/**
 * Canada — local trim names on the same VB platform. Curb weights follow the
 * matching US equipment level (Subaru Canada kg tables are hard to scrape
 * cleanly by trim); Sport-tech 2022 uses the published 3,435 lb figure.
 */
const CA_PRESETS: CarPreset[] = [
  preset("CA", 2022, "WRX", "6MT", 3297, { source: `${CA}; US Base curb` }),
  preset("CA", 2022, "WRX", "CVT", 3431, { source: `${CA}; US Base curb` }),
  preset("CA", 2022, "Sport", "6MT", 3320, { source: `${CA}; US Premium curb` }),
  preset("CA", 2022, "Sport", "CVT", 3457, { source: `${CA}; US Premium curb` }),
  preset("CA", 2022, "Sport-tech", "6MT", 3435, { source: "Auto123 Canada Sport-tech curb" }),
  preset("CA", 2022, "Sport-tech", "CVT", 3529, { source: `${CA}; US Limited curb` }),
  preset("CA", 2022, "GT", "CVT", 3534, { source: `${CA}; US GT curb` }),

  preset("CA", 2023, "WRX", "6MT", 3297, { source: `${CA}; US Base curb` }),
  preset("CA", 2023, "WRX", "CVT", 3431, { source: `${CA}; US Base curb` }),
  preset("CA", 2023, "Sport", "6MT", 3324, { source: `${CA}; US Premium curb` }),
  preset("CA", 2023, "Sport", "CVT", 3462, { source: `${CA}; US Premium curb` }),
  preset("CA", 2023, "Sport-tech", "6MT", 3397, { source: `${CA}; US Limited curb` }),
  preset("CA", 2023, "Sport-tech", "CVT", 3535, { source: `${CA}; US Limited curb` }),
  preset("CA", 2023, "GT", "CVT", 3537, { source: `${CA}; US GT curb` }),

  preset("CA", 2024, "WRX", "6MT", 3329, { source: `${CA}; US Base curb` }),
  preset("CA", 2024, "Sport", "6MT", 3358, { source: `${CA}; US Premium curb` }),
  preset("CA", 2024, "Sport", "CVT", 3494, { source: `${CA}; US Premium curb` }),
  preset("CA", 2024, "RS", "6MT", 3430, { source: `${CA}; US TR curb` }),
  preset("CA", 2024, "Sport-tech", "6MT", 3428, { source: `${CA}; US Limited curb` }),
  preset("CA", 2024, "Sport-tech", "CVT", 3565, { source: `${CA}; US Limited curb` }),
  preset("CA", 2024, "GT", "CVT", 3569, { source: `${CA}; US GT curb` }),

  preset("CA", 2025, "Sport", "6MT", 3351, { source: `${CA}; US Premium curb` }),
  preset("CA", 2025, "Sport", "CVT", 3488, { source: `${CA}; US Premium curb` }),
  preset("CA", 2025, "Sport-tech", "6MT", 3419, { source: `${CA}; US Limited curb` }),
  preset("CA", 2025, "Sport-tech", "CVT", 3554, { source: `${CA}; US Limited curb` }),
  preset("CA", 2025, "GT", "CVT", 3560, { source: `${CA}; US GT curb` }),
  preset("CA", 2025, "tS", "6MT", 3430, { source: `${CA}; US tS curb` }),

  preset("CA", 2026, "WRX", "6MT", 3348, { source: `${CA}; US Base curb` }),
  preset("CA", 2026, "Sport", "6MT", 3351, { source: `${CA}; US Premium curb` }),
  preset("CA", 2026, "Sport-tech", "6MT", 3419, { source: `${CA}; US Limited curb` }),
  preset("CA", 2026, "Sport-tech", "CVT", 3554, { source: `${CA}; US Limited curb` }),
  preset("CA", 2026, "GT", "CVT", 3560, { source: `${CA}; US GT curb` }),
  preset("CA", 2026, "tS", "6MT", 3430, { source: `${CA}; US tS curb` }),
];

/** Australia — current VB kerb weights (sedan + Sportswagon). */
const AU_PRESETS: CarPreset[] = [
  fromKg("AU", 2022, "WRX", "6MT", 1524, { source: AU }),
  fromKg("AU", 2022, "WRX Sport", "CVT", 1596, { source: AU }),
  fromKg("AU", 2022, "WRX RS", "6MT", 1561, { source: AU }),
  fromKg("AU", 2022, "WRX RS", "CVT", 1633, { source: AU }),
  fromKg("AU", 2022, "WRX Sportswagon", "CVT", 1622, { body: "wagon", source: AU }),
  fromKg("AU", 2022, "WRX GT Sportswagon", "CVT", 1655, { body: "wagon", source: AU }),

  fromKg("AU", 2023, "WRX", "6MT", 1524, { source: AU }),
  fromKg("AU", 2023, "WRX Sport", "CVT", 1596, { source: AU }),
  fromKg("AU", 2023, "WRX RS", "6MT", 1561, { source: AU }),
  fromKg("AU", 2023, "WRX RS", "CVT", 1633, { source: AU }),
  fromKg("AU", 2023, "WRX Sportswagon", "CVT", 1622, { body: "wagon", source: AU }),
  fromKg("AU", 2023, "WRX GT Sportswagon", "CVT", 1655, { body: "wagon", source: AU }),

  fromKg("AU", 2024, "WRX", "6MT", 1524, { source: AU }),
  fromKg("AU", 2024, "WRX Sport", "CVT", 1596, { source: AU }),
  fromKg("AU", 2024, "WRX RS", "6MT", 1561, { source: AU }),
  fromKg("AU", 2024, "WRX RS", "CVT", 1633, { source: AU }),
  fromKg("AU", 2024, "WRX tS Spec B", "6MT", 1562, { source: AU, crr: 0.014 }),
  fromKg("AU", 2024, "WRX tS", "CVT", 1631, { source: AU }),
  fromKg("AU", 2024, "WRX Sportswagon", "CVT", 1622, { body: "wagon", source: AU }),
  fromKg("AU", 2024, "WRX GT Sportswagon", "CVT", 1655, { body: "wagon", source: AU }),
  fromKg("AU", 2024, "WRX tS Sportswagon", "CVT", 1658, { body: "wagon", source: AU }),

  fromKg("AU", 2025, "WRX", "6MT", 1524, { source: AU }),
  fromKg("AU", 2025, "WRX Sport", "CVT", 1596, { source: AU }),
  fromKg("AU", 2025, "WRX RS", "6MT", 1561, { source: AU }),
  fromKg("AU", 2025, "WRX RS", "CVT", 1633, { source: AU }),
  fromKg("AU", 2025, "WRX tS Spec B", "6MT", 1562, { source: AU, crr: 0.014 }),
  fromKg("AU", 2025, "WRX tS", "CVT", 1631, { source: AU }),
  fromKg("AU", 2025, "WRX Sportswagon", "CVT", 1622, { body: "wagon", source: AU }),
  fromKg("AU", 2025, "WRX GT Sportswagon", "CVT", 1655, { body: "wagon", source: AU }),
  fromKg("AU", 2025, "WRX tS Sportswagon", "CVT", 1658, { body: "wagon", source: AU }),

  fromKg("AU", 2026, "WRX", "6MT", 1524, { source: AU }),
  fromKg("AU", 2026, "WRX Sport", "CVT", 1596, { source: AU }),
  fromKg("AU", 2026, "WRX RS", "6MT", 1561, { source: AU }),
  fromKg("AU", 2026, "WRX RS", "CVT", 1633, { source: AU }),
  fromKg("AU", 2026, "WRX tS Spec B", "6MT", 1562, { source: AU, crr: 0.014 }),
  fromKg("AU", 2026, "WRX tS", "CVT", 1631, { source: AU }),
  fromKg("AU", 2026, "WRX Sportswagon", "CVT", 1622, { body: "wagon", source: AU }),
  fromKg("AU", 2026, "WRX GT Sportswagon", "CVT", 1655, { body: "wagon", source: AU }),
  fromKg("AU", 2026, "WRX tS Sportswagon", "CVT", 1658, { body: "wagon", source: AU }),
];

/** New Zealand — same VB family as Australia; NZ catalog mirrors AU kerb figures. */
const NZ_PRESETS: CarPreset[] = AU_PRESETS.map((car) => ({
  ...car,
  id: car.id.replace(/^AU-/, "NZ-"),
  market: "NZ" as const,
  source: NZ,
}));

/** Japan — WRX S4 (CVT). STI Sport# manual is a 2026 limited model; weight not catalogued as widely yet. */
const JP_PRESETS: CarPreset[] = [
  fromKg("JP", 2022, "S4 GT-H", "CVT", 1590, { source: JP }),
  fromKg("JP", 2022, "S4 GT-H EX", "CVT", 1590, { source: JP }),
  fromKg("JP", 2022, "S4 STI Sport R", "CVT", 1600, { source: JP }),
  fromKg("JP", 2022, "S4 STI Sport R EX", "CVT", 1600, { source: JP }),

  fromKg("JP", 2023, "S4 GT-H", "CVT", 1590, { source: JP }),
  fromKg("JP", 2023, "S4 GT-H EX", "CVT", 1590, { source: JP }),
  fromKg("JP", 2023, "S4 STI Sport R", "CVT", 1600, { source: JP }),
  fromKg("JP", 2023, "S4 STI Sport R EX", "CVT", 1600, { source: JP }),

  fromKg("JP", 2024, "S4 GT-H EX", "CVT", 1600, { source: JP }),
  fromKg("JP", 2024, "S4 STI Sport R EX", "CVT", 1610, { source: JP }),
  fromKg("JP", 2024, "S4 STI Sport R-Black Limited", "CVT", 1610, { source: JP }),

  fromKg("JP", 2025, "S4 GT-H EX", "CVT", 1600, { source: JP }),
  fromKg("JP", 2025, "S4 STI Sport R EX", "CVT", 1610, { source: JP }),
  fromKg("JP", 2025, "S4 STI Sport R-Black Limited", "CVT", 1610, { source: JP }),

  fromKg("JP", 2026, "S4 GT-H EX", "CVT", 1600, { source: JP }),
  fromKg("JP", 2026, "S4 STI Sport R EX", "CVT", 1610, { source: JP }),
  // STI Sport# returns a 6MT to Japan; until a catalog curb is published, use Spec B-class mass.
  fromKg("JP", 2026, "STI Sport#", "6MT", 1562, { source: `${JP}; provisional Spec B-class until catalog curb is published` }),
];

export const CAR_PRESETS: CarPreset[] = [...US_PRESETS, ...CA_PRESETS, ...AU_PRESETS, ...NZ_PRESETS, ...JP_PRESETS];

export function yearsForMarket(market: Market): number[] {
  return [...new Set(CAR_PRESETS.filter((car) => car.market === market).map((car) => car.year))].sort((a, b) => b - a);
}

export function presetsFor(market: Market, year: number): CarPreset[] {
  return CAR_PRESETS.filter((car) => car.market === market && car.year === year);
}

export function presetLabel(car: CarPreset) {
  const body = car.body === "wagon" ? " · wagon" : "";
  return `${car.trim} · ${car.transmission}${body} · ${car.curbWeightLb.toLocaleString()} lb (${car.curbWeightKg} kg)`;
}

export function applyCarPreset(car: CarPreset, current: PowerSettings): { settings: PowerSettings; weightWithDriverLb: number } {
  const weightWithDriverLb = car.curbWeightLb + DRIVER_LB;
  return {
    weightWithDriverLb,
    settings: {
      ...current,
      weightLb: weightWithDriverLb,
      dragCd: car.dragCd,
      frontalAreaM2: car.frontalAreaM2,
      rollingResistance: car.rollingResistance,
      drivetrainLossPct: car.drivetrainLossPct,
    },
  };
}

export function findPreset(id: string | null): CarPreset | null {
  if (!id) return null;
  return CAR_PRESETS.find((car) => car.id === id) ?? null;
}
