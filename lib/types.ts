export type PullPoint = {
  t: number;
  rpm: number;
  accel: number;
  boost: number;
  tgt: number;
  afr: number;
  cmd: number;
  timing: number;
  fp: number;
  duty: number;
  load: number | null;
  maf: number | null;
  speed: number;
};

export type Pull = {
  id: string;
  log: string;
  gear: number;
  t0: number;
  t1: number;
  rpm0: number;
  rpm1: number;
  speed0: number;
  speed1: number;
  boostMax: number;
  afrMin: number;
  afrMax: number;
  afrMean: number;
  cmdMean: number;
  deltaMin: number;
  deltaMax: number;
  deltaMean: number;
  timingMin: number;
  timingMax: number;
  fpMin: number | null;
  dutyMax: number | null;
  oil: number | null;
  manifold: number | null;
  points: PullPoint[];
};

export type LeanSample = {
  log: string;
  t: number;
  afr: number;
  cmd: number;
  rpm: number;
  boost: number;
  gear: number;
};

export type KnockEvent = {
  log: string;
  count: number;
  t0: number;
  t1: number;
  seconds: number;
  fk: number;
  rpmMin: number;
  rpmMax: number;
  boostMin: number;
  boostMax: number;
  accel: number;
  gear: number;
  afr: number;
  timing: number;
  ks2Max: number | null;
  underLoad: boolean;
};

export type LearningStep = {
  log: string;
  t: number;
  value: number;
};

export type LogSummary = {
  id: string;
  blurb: string;
  seconds: number;
  samples: number;
  boostMax: number | null;
  coolantMin: number | null;
  coolantMax: number | null;
  oilMax: number | null;
  manifoldMax: number | null;
  learn1Median: number | null;
  learn3Start: number | null;
  learn3End: number | null;
  cruiseAfr: number | null;
  map: string | null;
};

export type OnBoost = {
  samples: number;
  afrMin: number;
  afrMax: number;
  afrMedian: number;
  cmdMedian: number | null;
  deltaMean: number | null;
  deltaMax: number | null;
  deltaMin: number | null;
  above115: number;
  above12: number;
  leanest: LeanSample;
};

export type Review = {
  turbo: boolean;
  sampleHz: number;
  maps: string[];
  onBoost: OnBoost | null;
  damMin: number | null;
  damMax: number | null;
  wotKnockEvents: number;
  knock: KnockEvent | null;
  roughMax: number | null;
  peakBoost: number | null;
  targetAtPeak: number | null;
  learning1Median: number | null;
  learning3Final: number | null;
  learningSteps: LearningStep[];
  learningLog: string | null;
  logs: LogSummary[];
  pulls: Pull[];
  warnings: string[];
  hasAir: boolean;
  hasSpeed: boolean;
};

export type PowerSettings = {
  drivetrainLossPct: number;
  thermalEfficiencyPct: number;
  weightLb: number | null;
  dragCd: number;
  frontalAreaM2: number;
  rollingResistance: number;
};

export const defaultSettings: PowerSettings = {
  drivetrainLossPct: 18,
  thermalEfficiencyPct: 30,
  weightLb: null,
  dragCd: 0.32,
  frontalAreaM2: 2.25,
  rollingResistance: 0.013,
};

export type PowerPeaks = {
  hp: number;
  hpRpm: number;
  tq: number;
  tqRpm: number;
  whp: number;
  whpRpm: number;
  wtq: number;
  wtqRpm: number;
  source: "airflow";
};

export type RoadPeaks = {
  whp: number;
  whpRpm: number;
  wtq: number;
  wtqRpm: number;
  hp: number;
  hpRpm: number;
  tq: number;
  tqRpm: number;
};

export function gearLabel(gear: number) {
  if (gear === 1) return "1st";
  if (gear === 2) return "2nd";
  if (gear === 3) return "3rd";
  return `${gear}th`;
}

export function formatSigned(value: number, digits = 2) {
  const text = value.toFixed(digits);
  return value > 0 ? `+${text}` : text;
}
