export const OCTANES = [87, 89, 91, 92, 93] as const;
export type Octane = (typeof OCTANES)[number];

export function isOctane(value: number): value is Octane {
  return (OCTANES as readonly number[]).includes(value);
}

type Band = {
  preferredMax: number;
  absoluteMax: number;
  preferredMin: number;
  absoluteMin: number;
};

/** Windows at 14 psi. Each psi above that richens the limit by 0.03 AFR. */
const AT_14_PSI: Record<Octane, Band> = {
  87: { preferredMax: 11.2, absoluteMax: 11.7, preferredMin: 10.05, absoluteMin: 9.6 },
  89: { preferredMax: 11.4, absoluteMax: 11.9, preferredMin: 10.1, absoluteMin: 9.7 },
  91: { preferredMax: 11.6, absoluteMax: 12.05, preferredMin: 10.15, absoluteMin: 9.75 },
  92: { preferredMax: 11.7, absoluteMax: 12.15, preferredMin: 10.2, absoluteMin: 9.8 },
  93: { preferredMax: 11.85, absoluteMax: 12.3, preferredMin: 10.25, absoluteMin: 9.85 },
};

export type SafeWindow = {
  octane: Octane;
  boostPsi: number;
  preferredMin: number;
  preferredMax: number;
  absoluteMin: number;
  absoluteMax: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function safeWindow(octane: Octane, boostPsi: number): SafeWindow {
  const base = AT_14_PSI[octane];
  const shift = (boostPsi - 14) * 0.03;
  const preferredMax = clamp(round2(base.preferredMax - shift), 10.7, 12.2);
  const absoluteMax = clamp(round2(Math.max(base.absoluteMax - shift, preferredMax + 0.3)), preferredMax + 0.3, 12.7);
  const preferredMin = clamp(round2(base.preferredMin - shift * 0.4), 9.7, preferredMax - 0.4);
  const absoluteMin = clamp(round2(base.absoluteMin - shift * 0.25), 9.3, preferredMin - 0.15);
  return {
    octane,
    boostPsi: round2(boostPsi),
    preferredMin,
    preferredMax,
    absoluteMin,
    absoluteMax,
  };
}
