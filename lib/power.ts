import { binByRpm, rpmBinSize } from "@/lib/rpm-series";
import { gaussianSmooth, powerRadius } from "@/lib/smooth";
import type { PowerPeaks, PowerSettings, Pull, PullPoint, RoadPeaks } from "@/lib/types";

const HP_WATTS = 745.7;
const STOICH = 14.7;
const LHV_J_PER_KG = 43.4e6;
const G = 9.80665;
const AIR_DENSITY = 1.18;

export function airGramsPerSecond(point: Pick<PullPoint, "rpm" | "load" | "maf">): number | null {
  if (point.maf !== null && point.maf > 1) return point.maf;
  if (point.load !== null && point.load > 0 && point.rpm > 0) return (point.load * point.rpm) / 60;
  return null;
}

/** Crank horsepower from intake air, assuming gasoline and a brake thermal efficiency. */
export function crankHpFromAir(airGps: number, thermalEfficiency: number): number {
  return (airGps * thermalEfficiency * LHV_J_PER_KG) / (STOICH * 1000 * HP_WATTS);
}

export function torqueLbFt(hp: number, rpm: number): number {
  if (rpm < 500) return 0;
  return (hp * 5252) / rpm;
}

export type PowerPoint = {
  rpm: number;
  hp: number;
  tq: number;
  whp: number;
  wtq: number;
};

export function airflowCurve(points: PullPoint[], settings: PowerSettings, smoothing: number): PowerPoint[] {
  const loss = clamp(settings.drivetrainLossPct, 0, 40) / 100;
  const bte = clamp(settings.thermalEfficiencyPct, 15, 45) / 100;
  const radius = powerRadius(smoothing);
  const ordered = points.length < 2 ? points : binByRpm(points, rpmBinSize(points));
  const raw = ordered.map((point) => {
    const air = airGramsPerSecond(point);
    const hp = air === null ? 0 : crankHpFromAir(air, bte);
    return { rpm: point.rpm, hp, tq: torqueLbFt(hp, point.rpm) };
  });
  const hp = gaussianSmooth(
    raw.map((point) => point.hp),
    radius,
  );
  const tq = gaussianSmooth(
    raw.map((point) => point.tq),
    radius,
  );
  return raw.map((point, index) => ({
    rpm: point.rpm,
    hp: hp[index],
    tq: tq[index],
    whp: hp[index] * (1 - loss),
    wtq: tq[index] * (1 - loss),
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function usable(points: PullPoint[], turbo: boolean) {
  return points.filter((point) => (turbo ? point.boost >= 8 && point.accel >= 70 : point.accel >= 85 && point.rpm >= 2500));
}

export function airflowPeaks(pulls: Pull[], settings: PowerSettings, smoothing: number, turbo: boolean): PowerPeaks | null {
  let bestHp: PowerPoint | null = null;
  let bestTq: PowerPoint | null = null;
  for (const pull of pulls) {
    const window = usable(pull.points, turbo);
    if (window.length < 8) continue;
    const curve = airflowCurve(window, settings, smoothing);
    const edge = Math.min(6, Math.floor(curve.length / 8));
    for (const point of curve.slice(edge, curve.length - edge)) {
      if (!bestHp || point.hp > bestHp.hp) bestHp = point;
      if (!bestTq || point.tq > bestTq.tq) bestTq = point;
    }
  }
  if (!bestHp || !bestTq || bestHp.hp < 20) return null;
  return {
    hp: bestHp.hp,
    hpRpm: bestHp.rpm,
    tq: bestTq.tq,
    tqRpm: bestTq.rpm,
    whp: bestHp.whp,
    whpRpm: bestHp.rpm,
    wtq: bestTq.wtq,
    wtqRpm: bestTq.rpm,
    source: "airflow",
  };
}

export function roadCurve(points: PullPoint[], settings: PowerSettings, smoothing: number): PowerPoint[] | null {
  if (settings.weightLb === null || settings.weightLb < 800) return null;
  const speeds = points.map((point) => point.speed);
  if (Math.max(...speeds) - Math.min(...speeds) < 4) return null;
  const dt =
    points.length > 2 ? (points[points.length - 1].t - points[0].t) / (points.length - 1) : 0.025;
  const radius = Math.max(powerRadius(smoothing), Math.round(0.45 / Math.max(dt, 0.01)));
  const velocity = gaussianSmooth(
    speeds.map((mph) => mph * 0.44704),
    radius,
  );
  const mass = settings.weightLb * 0.45359237;
  const cd = clamp(settings.dragCd, 0.15, 0.8);
  const area = clamp(settings.frontalAreaM2, 1, 4);
  const crr = clamp(settings.rollingResistance, 0.005, 0.03);
  const loss = clamp(settings.drivetrainLossPct, 0, 40) / 100;
  const whpRaw = velocity.map((speed, index) => {
    if (index === 0 || index === velocity.length - 1) return 0;
    const step = points[index + 1].t - points[index - 1].t;
    if (step <= 0) return 0;
    const accel = (velocity[index + 1] - velocity[index - 1]) / step;
    if (accel < 0.2) return 0;
    const drag = 0.5 * AIR_DENSITY * cd * area * speed * speed;
    const roll = crr * mass * G;
    const force = mass * accel + drag + roll;
    return (force * speed) / HP_WATTS;
  });
  const whp = gaussianSmooth(whpRaw, radius);
  return points.map((point, index) => {
    const wheel = Math.max(0, whp[index]);
    const crank = loss < 0.95 ? wheel / (1 - loss) : wheel;
    return {
      rpm: point.rpm,
      hp: crank,
      tq: torqueLbFt(crank, point.rpm),
      whp: wheel,
      wtq: torqueLbFt(wheel, point.rpm),
    };
  });
}

export function roadPeaks(pulls: Pull[], settings: PowerSettings, smoothing: number, turbo: boolean): RoadPeaks | null {
  let bestWhp: PowerPoint | null = null;
  let bestWtq: PowerPoint | null = null;
  for (const pull of pulls) {
    const window = usable(pull.points, turbo);
    const curve = roadCurve(window, settings, smoothing);
    if (!curve) continue;
    const edge = Math.min(8, Math.floor(curve.length / 6));
    for (const point of curve.slice(edge, curve.length - edge)) {
      if (!bestWhp || point.whp > bestWhp.whp) bestWhp = point;
      if (!bestWtq || point.wtq > bestWtq.wtq) bestWtq = point;
    }
  }
  if (!bestWhp || !bestWtq || bestWhp.whp < 20) return null;
  return {
    whp: bestWhp.whp,
    whpRpm: bestWhp.rpm,
    wtq: bestWtq.wtq,
    wtqRpm: bestWtq.rpm,
    hp: bestWhp.hp,
    hpRpm: bestWhp.rpm,
    tq: bestWtq.tq,
    tqRpm: bestWtq.rpm,
  };
}
