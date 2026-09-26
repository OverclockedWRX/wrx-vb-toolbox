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
  /** Shown after the title. Stock-height checks leave this empty and use the stock wording. */
  status?: string;
};

export type FitmentReport = {
  overall: FitmentLevel;
  checks: FitmentCheck[];
  disclaimer: string;
  lowered: boolean;
};

export const MM_PER_INCH = 25.4;
/** About 2.5 in. Owner posts past ~2 in are sparse, so the slider stops here. */
export const MAX_DROP_MM = 2.5 * MM_PER_INCH;

export type RideDrop = {
  frontMm: number;
  rearMm: number;
};

export const STOCK_RIDE: RideDrop = { frontMm: 0, rearMm: 0 };

export function clampDropMm(mm: number) {
  if (!Number.isFinite(mm)) return 0;
  return Math.min(MAX_DROP_MM, Math.max(0, mm));
}

function worse(a: FitmentLevel, b: FitmentLevel): FitmentLevel {
  const rank = { ok: 0, caution: 1, outside: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Fitment notes from owner reports (r/wrx_vb, ThreePiece, rimlist).
 * Stock-height bands are the baseline. A drop tightens them with a rough
 * estimate: the rear is treated as slightly tighter because posts mention
 * rear liner and cladding contact more often than the front.
 * Not a measurement of any one car.
 */
export function assessStockHeightFitment(
  wheel: WheelSpec,
  tire: TireSpec,
  stockTire: TireSpec,
  ride: RideDrop = STOCK_RIDE,
): FitmentReport {
  const frontMm = clampDropMm(ride.frontMm);
  const rearMm = clampDropMm(ride.rearMm);
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

  const lowered = frontMm >= 1 || rearMm >= 1;
  if (lowered) {
    checks.push(dropCheck("Front", frontMm, wheel, tire, 1));
    checks.push(dropCheck("Rear", rearMm, wheel, tire, 1.25));
  }

  let overall: FitmentLevel = "ok";
  for (const check of checks) overall = worse(overall, check.level);

  const dropText = lowered
    ? ` Front is ${formatDrop(frontMm)} below stock and rear is ${formatDrop(rearMm)} below stock.`
    : " Ride height is stock. Enter a front or rear drop to include lowering.";

  return {
    overall,
    checks,
    lowered,
    disclaimer:
      "Fitment numbers are estimates only, gathered from owner reports such as r/wrx_vb, fitment threads, and rim guides. They are not a measurement of your car. Tire brand, camber, passengers, and bumps change the result." +
      dropText +
      " This is a guide, not a guarantee.",
  };
}

/**
 * Rough clearance score from forum patterns, not a fender scan.
 * Anchors: about 1 in of drop on 18×9.5 ET38 with a 245/40 is often reported clear;
 * a 255/40 at that drop is mixed; around 1.5–2 in the rear is where light rub shows up
 * on 265/35 or 255/35, especially with weight in the back.
 * `endBias` is 1 at the front and 1.25 at the rear.
 */
function dropCheck(end: "Front" | "Rear", dropMm: number, wheel: WheelSpec, tire: TireSpec, endBias: number): FitmentCheck {
  const inches = dropMm / MM_PER_INCH;
  const flushLip = outerLipFromHubMm({ widthIn: 9.5, diameterIn: 18, offsetMm: 38 });
  const extraPokeMm = Math.max(0, outerLipFromHubMm(wheel) - flushLip);
  const extraWidthMm = Math.max(0, tire.widthMm - 255);
  const referenceDiameter = 18 * MM_PER_INCH + 2 * 245 * 0.4;
  const extraHeightMm = Math.max(0, tireDiameterMm(tire) - referenceDiameter);
  const risk = inches * endBias + extraPokeMm / 25 + extraWidthMm / 28 + extraHeightMm / 40;

  const level: FitmentLevel = risk < 1.4 ? "ok" : risk < 2.6 ? "caution" : "outside";
  const band =
    level === "ok"
      ? "Similar setups are often reported to clear at this drop."
      : level === "caution"
        ? "Owner reports are mixed here: some cars clear, and some rub the liner or cladding on bumps."
        : "Drops and sizes in this range are often reported to rub, especially over bumps or with people in the car.";
  const endNote =
    end === "Rear"
      ? "Rear posts mention liner and cladding contact more often than the front."
      : "Front posts mention rub less often than the rear at the same drop.";

  return {
    level,
    title: `${end} clearance`,
    status: level === "ok" ? "often reported clear" : level === "caution" ? "reports are mixed" : "often reported to rub",
    detail: `${end} is ${formatDrop(dropMm)} below stock. ${band} ${endNote}`,
  };
}

function formatDrop(mm: number) {
  return `${(mm / MM_PER_INCH).toFixed(2)} in (${mm.toFixed(0)} mm)`;
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
  ride: RideDrop = STOCK_RIDE,
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
    fitment: assessStockHeightFitment(proposedWheel, proposedTire, stockTire, ride),
  };
}
