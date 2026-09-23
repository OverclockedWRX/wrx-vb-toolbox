import type { PullPoint } from "@/lib/types";

/** Average a pull onto a rising RPM axis so the chart does not zigzag when rpm wobbles in time. */
export function binByRpm(points: PullPoint[], binSize = 25): PullPoint[] {
  if (points.length < 2) return points.slice();
  const bins = new Map<number, PullPoint[]>();
  for (const point of points) {
    if (!(point.rpm > 0)) continue;
    const key = Math.round(point.rpm / binSize) * binSize;
    const group = bins.get(key);
    if (group) group.push(point);
    else bins.set(key, [point]);
  }
  return [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rpm, group]) => averagePoint(rpm, group));
}

/** Pick a bin width from the pull length so short pulls keep detail and long ones stay readable. */
export function rpmBinSize(points: PullPoint[]): number {
  if (points.length < 2) return 25;
  const rpms = points.map((point) => point.rpm);
  const span = Math.max(...rpms) - Math.min(...rpms);
  if (span < 400) return 20;
  if (span < 1200) return 25;
  if (span < 2500) return 40;
  return 50;
}

function averagePoint(rpm: number, group: PullPoint[]): PullPoint {
  const n = group.length;
  const avg = (pick: (point: PullPoint) => number) => group.reduce((sum, point) => sum + pick(point), 0) / n;
  const avgNullable = (pick: (point: PullPoint) => number | null) => {
    const values = group.map(pick).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  return {
    t: avg((point) => point.t),
    rpm,
    accel: avg((point) => point.accel),
    boost: avg((point) => point.boost),
    tgt: avg((point) => point.tgt),
    afr: avg((point) => point.afr),
    cmd: avg((point) => point.cmd),
    timing: avg((point) => point.timing),
    fp: avg((point) => point.fp),
    duty: avg((point) => point.duty),
    load: avgNullable((point) => point.load),
    maf: avgNullable((point) => point.maf),
    speed: avg((point) => point.speed),
  };
}
