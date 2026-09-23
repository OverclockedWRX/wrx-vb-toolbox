/** OEM and stock-height aftermarket guidance for VB WRX (2022–2026). */

export type TireSpec = {
  widthMm: number;
  aspect: number;
  rimIn: number;
};

export type WheelSpec = {
  widthIn: number;
  diameterIn: number;
  offsetMm: number;
};

export type StockPackage = {
  id: string;
  label: string;
  tire: TireSpec;
  wheel: WheelSpec;
  note: string;
};

export const PCD = "5x114.3";
export const CENTER_BORE_MM = 56.1;
export const LUG_THREAD = "12×1.25";

/** Factory packages used on USDM VB WRX; other markets map onto these. */
export const STOCK_PACKAGES = {
  base17: {
    id: "base17",
    label: "Base 17″",
    tire: { widthMm: 235, aspect: 45, rimIn: 17 },
    wheel: { widthIn: 8, diameterIn: 17, offsetMm: 55 },
    note: "OEM Base / entry trims: 235/45R17 on 17×8 ET55 (Subaru trim sheets; wheel-size.com).",
  },
  premium18: {
    id: "premium18",
    label: "Premium / Limited / GT 18″",
    tire: { widthMm: 245, aspect: 40, rimIn: 18 },
    wheel: { widthIn: 8.5, diameterIn: 18, offsetMm: 55 },
    note: "OEM Premium, Limited, and GT: 245/40R18 on 18×8.5 ET55.",
  },
  ts19: {
    id: "ts19",
    label: "TR / tS 19″",
    tire: { widthMm: 245, aspect: 35, rimIn: 19 },
    wheel: { widthIn: 8.5, diameterIn: 19, offsetMm: 55 },
    note: "OEM TR, tS, and Series.Yellow: 245/35R19 on 19×8.5 ET55. Brembo 6-piston clearance matters on these trims.",
  },
} as const satisfies Record<string, StockPackage>;

/**
 * Conservative community guidance for **stock ride height only**
 * (r/wrx_vb, ThreePiece VB fitment guide, rimlist cheatsheet).
 * Lowered cars are intentionally excluded.
 */
export const STOCK_HEIGHT_GUIDANCE = {
  diameterMinIn: 17,
  diameterMaxIn: 19,
  /** Widest wheel that routinely clears stock height without fender work. */
  widthMaxIn: 9.5,
  /** Prefer at least this offset on a 9.5″ wheel (+38 is the common flush target). */
  wideWheelPreferOffsetMinMm: 38,
  /** Absolute low offset still reported to clear on stock height with poke (9.5″). */
  wideWheelOffsetMinMm: 35,
  /** Narrower wheels (≤8.5″) stay nearer OEM. */
  narrowWheelOffsetMinMm: 40,
  narrowWheelOffsetMaxMm: 55,
  /** Section width: 255 common; 265 reported on stock height with some tires. */
  tireWidthPreferMaxMm: 255,
  tireWidthMaxMm: 265,
  /** Overall diameter vs stock — speedo / gearing. */
  diameterDeltaWarnPct: 2,
  diameterDeltaBadPct: 3.5,
} as const;

const NINETEEN_TRIM = /\b(tr|ts|t\.?s|series\.?\s*yellow|spec\s*b)\b/i;
const EIGHTEEN_TRIM =
  /\b(premium|limited|gt|sport-?tech|sport(?!\s*wagon)|rs(?!\s*$)|wrx\s+rs|wrx\s+sport)\b/i;
const BASE_TRIM = /\b(base|wrx)\b/i;

/**
 * Resolve OEM wheel/tire package from year + trim text (VIN or car preset).
 * Returns null when the trim cannot be mapped confidently.
 */
export function resolveStockPackage(year: number | null, trim: string | null): StockPackage | null {
  if (!trim?.trim()) return null;
  const text = trim.trim();

  if (NINETEEN_TRIM.test(text)) return STOCK_PACKAGES.ts19;

  // Canada 2024+ RS tracks US TR (19″). AU/NZ "WRX RS" is typically an 18″ package.
  if (/\brs\b/i.test(text) && year !== null && year >= 2024 && !/wrx\s+rs/i.test(text)) {
    return STOCK_PACKAGES.ts19;
  }
  if (/\bwrx\s+rs\b/i.test(text)) return STOCK_PACKAGES.premium18;

  if (EIGHTEEN_TRIM.test(text)) return STOCK_PACKAGES.premium18;

  // Bare "WRX" / Base / Sportswagon entry often share Base-equivalent or Sport (18).
  if (/\bsportswagon\b/i.test(text) && !/\bgt\b/i.test(text) && !/\bts\b/i.test(text)) {
    return STOCK_PACKAGES.premium18;
  }
  if (/\bgt\s+sportswagon\b/i.test(text)) return STOCK_PACKAGES.premium18;
  if (/\bts\s+sportswagon\b/i.test(text)) return STOCK_PACKAGES.ts19;

  if (/^base$/i.test(text) || /^wrx$/i.test(text)) return STOCK_PACKAGES.base17;

  if (BASE_TRIM.test(text) && !EIGHTEEN_TRIM.test(text) && !NINETEEN_TRIM.test(text)) {
    return STOCK_PACKAGES.base17;
  }

  // Fallback: most optioned VB sedans are 18″.
  if (year !== null && year >= 2022 && year <= 2026) return STOCK_PACKAGES.premium18;
  return null;
}

export function formatTire(tire: TireSpec) {
  return `${tire.widthMm}/${tire.aspect}R${tire.rimIn}`;
}

export function formatWheel(wheel: WheelSpec) {
  const width = Number.isInteger(wheel.widthIn) ? String(wheel.widthIn) : wheel.widthIn.toFixed(1);
  return `${width}×${wheel.diameterIn} ET${wheel.offsetMm}`;
}

/** Common VB WRX OEM + popular plus-size tires for dropdown picks. */
export const COMMON_TIRE_SIZES: { size: string; note: string }[] = [
  { size: "235/45R17", note: "OEM Base" },
  { size: "245/45R17", note: "17″ plus" },
  { size: "255/40R17", note: "17″ plus" },
  { size: "225/50R17", note: "17″ tall" },
  { size: "235/40R18", note: "18″ narrow" },
  { size: "245/40R18", note: "OEM Premium / Limited / GT" },
  { size: "245/35R18", note: "18″ lower profile" },
  { size: "255/35R18", note: "Popular on 18×9.5" },
  { size: "255/40R18", note: "18″ square-ish" },
  { size: "265/35R18", note: "Wide on 18×9.5 (stock height)" },
  { size: "235/35R19", note: "19″ narrow" },
  { size: "245/35R19", note: "OEM TR / tS" },
  { size: "245/30R19", note: "19″ low profile" },
  { size: "255/35R19", note: "19″ plus" },
  { size: "255/30R19", note: "19″ plus low" },
];
