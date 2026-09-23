import {
  STOCK_HEIGHT_GUIDANCE,
  type TireSpec,
  type WheelSpec,
} from "@/lib/stock-wheels";

export type ParsedTire = TireSpec & { raw: string };

/** Parse 245/40R18, 245/40/18, 245-40-18, P245/40ZR18, etc. */
export function parseTireSize(raw: string): ParsedTire | null {
  const text = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = text.match(/^P?(\d{3})[/|-](\d{2})Z?R?(\d{2})$/);
  if (!match) return null;
  const widthMm = Number(match[1]);
  const aspect = Number(match[2]);
  const rimIn = Number(match[3]);
  if (![widthMm, aspect, rimIn].every((n) => Number.isFinite(n) && n > 0)) return null;
  return { widthMm, aspect, rimIn, raw: text };
}

export function tireSidewallMm(tire: TireSpec) {
  return (tire.widthMm * tire.aspect) / 100;
}

/** Overall diameter in millimeters. */
export function tireDiameterMm(tire: TireSpec) {
  return tire.rimIn * 25.4 + 2 * tireSidewallMm(tire);
}

export function tireDiameterIn(tire: TireSpec) {
  return tireDiameterMm(tire) / 25.4;
}

export function tireCircumferenceMm(tire: TireSpec) {
  return Math.PI * tireDiameterMm(tire);
}

/** Distance from hub face to outer lip (mm). Higher = more poke. */
export function outerLipFromHubMm(wheel: WheelSpec) {
  return (wheel.widthIn * 25.4) / 2 - wheel.offsetMm;
}

/** Distance from hub face to inner lip (mm). Higher = closer to suspension. */
export function innerLipFromHubMm(wheel: WheelSpec) {
  return (wheel.widthIn * 25.4) / 2 + wheel.offsetMm;
}

export function diameterDeltaPct(proposed: TireSpec, stock: TireSpec) {
  const stockD = tireDiameterMm(stock);
  if (stockD <= 0) return 0;
  return ((tireDiameterMm(proposed) - stockD) / stockD) * 100;
}

/** Indicated speed when true speed is `trueMph` (approximate). */
export function indicatedSpeedMph(trueMph: number, proposed: TireSpec, stock: TireSpec) {
  const stockC = tireCircumferenceMm(stock);
  const propC = tireCircumferenceMm(proposed);
  if (propC <= 0) return trueMph;
  return trueMph * (stockC / propC);
}

export type FitmentLevel = "ok" | "caution" | "outside";

export type FitmentCheck = {
  level: FitmentLevel;
  title: string;
  detail: string;
};

export type FitmentReport = {
  overall: FitmentLevel;
  checks: FitmentCheck[];
  disclaimer: string;
};

function worse(a: FitmentLevel, b: FitmentLevel): FitmentLevel {
  const rank = { ok: 0, caution: 1, outside: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Stock-height-only fitment notes from community reports
 * (r/wrx_vb, ThreePiece, rimlist). Not a guarantee — tire brand and
 * alignment still matter. Lowered cars are not considered.
 */
export function assessStockHeightFitment(wheel: WheelSpec, tire: TireSpec, stockTire: TireSpec): FitmentReport {
  const checks: FitmentCheck[] = [];
  const g = STOCK_HEIGHT_GUIDANCE;

  if (wheel.diameterIn < g.diameterMinIn || wheel.diameterIn > g.diameterMaxIn) {
    checks.push({
      level: "outside",
      title: "Wheel diameter",
      detail: `${wheel.diameterIn}″ is outside the usual 17–19″ range for stock-height VB WRX.`,
    });
  } else {
    checks.push({
      level: "ok",
      title: "Wheel diameter",
      detail: `${wheel.diameterIn}″ is in the usual 17–19″ range for this chassis.`,
    });
  }

  if (wheel.widthIn > g.widthMaxIn) {
    checks.push({
      level: "outside",
      title: "Wheel width",
      detail: `${wheel.widthIn}″ is wider than the common stock-height max of ${g.widthMaxIn}″ (18×9.5 is the usual ceiling without fender work).`,
    });
  } else if (wheel.widthIn >= 9) {
    checks.push({
      level: "ok",
      title: "Wheel width",
      detail: `${wheel.widthIn}″ is at the wide end but still within the usual stock-height ceiling (${g.widthMaxIn}″). 18×9.5 is the community go-to.`,
    });
  } else {
    checks.push({
      level: "ok",
      title: "Wheel width",
      detail: `${wheel.widthIn}″ is within common stock-height widths (OEM is 8–8.5″; up to 9.5″ is typical).`,
    });
  }

  const wide = wheel.widthIn >= 9;
  if (wide) {
    if (wheel.offsetMm < g.wideWheelOffsetMinMm) {
      checks.push({
        level: "outside",
        title: "Offset",
        detail: `ET${wheel.offsetMm} on a ${wheel.widthIn}″ wheel is below the ET${g.wideWheelOffsetMinMm} floor usually cited for stock height (expect heavy poke / rubbing risk).`,
      });
    } else if (wheel.offsetMm < g.wideWheelPreferOffsetMinMm) {
      checks.push({
        level: "caution",
        title: "Offset",
        detail: `ET${wheel.offsetMm} on ${wheel.widthIn}″ typically pokes a little on stock height. Community sweet spot is about ET${g.wideWheelPreferOffsetMinMm} (often called flush with 245/40 or 255/35).`,
      });
    } else {
      checks.push({
        level: "ok",
        title: "Offset",
        detail: `ET${wheel.offsetMm} on ${wheel.widthIn}″ matches common stock-height fitment (ET38+ on 9.5″ is the usual flush target).`,
      });
    }
  } else if (wheel.offsetMm < g.narrowWheelOffsetMinMm) {
    checks.push({
      level: "caution",
      title: "Offset",
      detail: `ET${wheel.offsetMm} is lower than OEM ET55 on an ≤8.5″ wheel. Many run ET40–55 at stock height; expect more poke than factory.`,
    });
  } else if (wheel.offsetMm > g.narrowWheelOffsetMaxMm + 5) {
    checks.push({
      level: "caution",
      title: "Offset",
      detail: `ET${wheel.offsetMm} is higher (more inset) than OEM. Check inner clearance to struts and control arms.`,
    });
  } else {
    checks.push({
      level: "ok",
      title: "Offset",
      detail: `ET${wheel.offsetMm} is in a common range for ≤8.5″ wheels at stock height (OEM is ET55).`,
    });
  }

  if (tire.widthMm > g.tireWidthMaxMm) {
    checks.push({
      level: "outside",
      title: "Tire width",
      detail: `${tire.widthMm} mm is wider than sizes commonly cleared at stock height (community reports top out around ${g.tireWidthMaxMm} mm).`,
    });
  } else if (tire.widthMm > g.tireWidthPreferMaxMm) {
    checks.push({
      level: "caution",
      title: "Tire width",
      detail: `${tire.widthMm} mm has been run at stock height (often 265/35), but brand stretch and cladding contact vary. ${g.tireWidthPreferMaxMm} mm is the safer everyday pick.`,
    });
  } else {
    checks.push({
      level: "ok",
      title: "Tire width",
      detail: `${tire.widthMm} mm is within common stock-height sizes (245 OEM on 18/19″; 255 is a frequent upgrade).`,
    });
  }

  if (tire.rimIn !== wheel.diameterIn) {
    checks.push({
      level: "outside",
      title: "Tire vs wheel diameter",
      detail: `Tire is R${tire.rimIn} but the wheel is ${wheel.diameterIn}″. They must match.`,
    });
  }

  const delta = diameterDeltaPct(tire, stockTire);
  const abs = Math.abs(delta);
  if (abs > g.diameterDeltaBadPct) {
    checks.push({
      level: "outside",
      title: "Overall diameter",
      detail: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% vs stock. Beyond ~±${g.diameterDeltaBadPct}% speedo and gearing error get large, and rubbing risk rises.`,
    });
  } else if (abs > g.diameterDeltaWarnPct) {
    checks.push({
      level: "caution",
      title: "Overall diameter",
      detail: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% vs stock. Within a usable band, but expect a noticeable speedo/odometer offset.`,
    });
  } else {
    checks.push({
      level: "ok",
      title: "Overall diameter",
      detail: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% vs stock — close enough for everyday driving.`,
    });
  }

  let overall: FitmentLevel = "ok";
  for (const check of checks) overall = worse(overall, check.level);

  return {
    overall,
    checks,
    disclaimer:
      "Fitment notes are for stock ride height only. Lowered cars are not considered. Community reports (r/wrx_vb, ThreePiece, rimlist) vary by tire brand, camber, and load — this is a guide, not a guarantee.",
  };
}

export type CompareResult = {
  stockDiameterMm: number;
  proposedDiameterMm: number;
  diameterDeltaMm: number;
  diameterDeltaPct: number;
  stockSidewallMm: number;
  proposedSidewallMm: number;
  sidewallDeltaMm: number;
  stockOuterMm: number;
  proposedOuterMm: number;
  pokeDeltaMm: number;
  stockInnerMm: number;
  proposedInnerMm: number;
  innerDeltaMm: number;
  speedAt60: number;
  fitment: FitmentReport;
};

export function compareSetup(
  stockTire: TireSpec,
  stockWheel: WheelSpec,
  proposedTire: TireSpec,
  proposedWheel: WheelSpec,
): CompareResult {
  const stockDiameterMm = tireDiameterMm(stockTire);
  const proposedDiameterMm = tireDiameterMm(proposedTire);
  const stockSidewallMm = tireSidewallMm(stockTire);
  const proposedSidewallMm = tireSidewallMm(proposedTire);
  const stockOuterMm = outerLipFromHubMm(stockWheel);
  const proposedOuterMm = outerLipFromHubMm(proposedWheel);
  const stockInnerMm = innerLipFromHubMm(stockWheel);
  const proposedInnerMm = innerLipFromHubMm(proposedWheel);

  return {
    stockDiameterMm,
    proposedDiameterMm,
    diameterDeltaMm: proposedDiameterMm - stockDiameterMm,
    diameterDeltaPct: diameterDeltaPct(proposedTire, stockTire),
    stockSidewallMm,
    proposedSidewallMm,
    sidewallDeltaMm: proposedSidewallMm - stockSidewallMm,
    stockOuterMm,
    proposedOuterMm,
    pokeDeltaMm: proposedOuterMm - stockOuterMm,
    stockInnerMm,
    proposedInnerMm,
    innerDeltaMm: proposedInnerMm - stockInnerMm,
    speedAt60: indicatedSpeedMph(60, proposedTire, stockTire),
    fitment: assessStockHeightFitment(proposedWheel, proposedTire, stockTire),
  };
}
