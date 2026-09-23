import { isOctane, type Octane } from "@/lib/limits";

export type TuneInfo = {
  raw: string | null;
  accessport: string | null;
  vehicle: string | null;
  reflash: string | null;
  tuner: string | null;
  year: number | null;
  octane: Octane | null;
  targetPsi: number | null;
  isVb: boolean;
  rejectReason: string | null;
};

const EMPTY: TuneInfo = {
  raw: null,
  accessport: null,
  vehicle: null,
  reflash: null,
  tuner: null,
  year: null,
  octane: null,
  targetPsi: null,
  isVb: false,
  rejectReason: "The AP Info header is missing, so the car and the tune cannot be identified.",
};

const KNOWN_TUNERS: { pattern: RegExp; name: string }[] = [
  { pattern: /pre\s*racing|preracing/i, name: "PRERacing" },
  { pattern: /\bdmann\b|drunk\s*man/i, name: "DMANN" },
  { pattern: /\bcobb\b/i, name: "COBB" },
  { pattern: /\bperrin\b/i, name: "Perrin" },
  { pattern: /\biag\b/i, name: "IAG" },
  { pattern: /\bets\b/i, name: "ETS" },
  { pattern: /\bgrimmspeed\b|grimm\s*speed/i, name: "Grimmspeed" },
  { pattern: /\bmafia\b/i, name: "Mafia Tuning" },
  { pattern: /\bboosted\s*performance\b/i, name: "Boosted Performance" },
  { pattern: /\bstratified\b/i, name: "Stratified" },
];

function tunerIn(value: string | null): string | null {
  if (!value) return null;
  for (const entry of KNOWN_TUNERS) {
    if (entry.pattern.test(value)) return entry.name;
  }
  return null;
}

function brackets(value: string) {
  return [...value.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].trim());
}

function octaneIn(value: string): Octane | null {
  const match = value.match(/(?:^|[^0-9])(87|89|91|92|93)(?![0-9])/);
  if (!match) return null;
  const octane = Number(match[1]);
  return isOctane(octane) ? octane : null;
}

function psiIn(value: string): number | null {
  const match = value.match(/(\d{1,2}(?:\.\d+)?)\s*psi/i);
  if (!match) return null;
  const psi = Number(match[1]);
  return psi >= 5 && psi <= 35 ? psi : null;
}

export function parseTune(mapHeader: string | null): TuneInfo {
  if (!mapHeader) return EMPTY;
  const raw = mapHeader.replace(/^ap info\s*:\s*/i, "").trim();
  const parts = brackets(mapHeader);
  const accessport = parts.find((part) => /ap3-sub-\d+/i.test(part)) ?? null;
  const vehicle = parts.find((part) => /\bwrx\b|\bsti\b|\bbrz\b/i.test(part)) ?? null;
  const reflashPart = parts.find((part) => /^reflash\s*:/i.test(part)) ?? null;
  const reflash = reflashPart ? reflashPart.replace(/^reflash\s*:\s*/i, "").trim() : null;
  const yearMatch = (vehicle ?? raw).match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const blob = `${vehicle ?? ""} ${raw}`;
  const isWrx = /\bwrx\b/i.test(blob);
  const isSti = /\bsti\b/i.test(blob);
  const isOther = /\bbrz\b|\bfr-s\b|\bgr86\b|\b86\b|\bfa20\b|\bforester\b|\bascent\b|\boutback\b|\bcrosstrek\b|\bimpreza\b/i.test(blob);
  const isVbPort = /ap3-sub-006/i.test(raw);

  let isVb = false;
  let rejectReason: string | null = null;
  if (!isWrx && isOther) {
    rejectReason = "This header is not a WRX. The review only covers the 2022–2026 WRX VB.";
  } else if (!isWrx) {
    rejectReason = "The header does not identify a WRX. The review only covers the 2022–2026 WRX VB.";
  } else if (isSti) {
    rejectReason = "This header is an STI. The review only covers the WRX VB, 2022 through 2026.";
  } else if (year !== null && (year < 2022 || year > 2026)) {
    rejectReason = `The header says ${year}. The review only covers WRX model years 2022 through 2026.`;
  } else if (year !== null) {
    isVb = true;
  } else if (isVbPort) {
    isVb = true;
  } else {
    rejectReason =
      "The header names a WRX but has no model year and is not the VB Accessport (AP3-SUB-006), so it cannot be confirmed as a 2022–2026 car.";
  }

  return {
    raw,
    accessport,
    vehicle,
    reflash,
    tuner: tunerIn(reflash) ?? tunerIn(raw),
    year,
    octane: reflash ? octaneIn(reflash) : null,
    targetPsi: reflash ? psiIn(reflash) : null,
    isVb,
    rejectReason,
  };
}

export function tuneTitle(tune: TuneInfo) {
  if (tune.reflash) return tune.reflash.replace(/\.ptm$/i, "");
  if (tune.vehicle) return tune.vehicle;
  return "Unnamed map";
}
