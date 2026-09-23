import { useId, useMemo, useState, type PointerEvent } from "react";
import { airflowCurve, roadCurve, type PowerPoint } from "@/lib/power";
import { binByRpm, rpmBinSize } from "@/lib/rpm-series";
import { chartRadius, gaussianSmooth } from "@/lib/smooth";
import type { PowerSettings, PullPoint } from "@/lib/types";

export type Trace = {
  id: string;
  label: string;
  color: string;
  points: PullPoint[];
};

const W = 760;
const H = 292;
const PAD = { l: 52, r: 46, t: 18, b: 34 };

function xOf(rpm: number, rpmMin: number, rpmMax: number) {
  const span = Math.max(rpmMax - rpmMin, 1);
  return PAD.l + ((rpm - rpmMin) / span) * (W - PAD.l - PAD.r);
}

function yOf(value: number, min: number, max: number) {
  return PAD.t + ((max - value) / Math.max(max - min, 0.001)) * (H - PAD.t - PAD.b);
}

function pathFrom(coords: { x: number; y: number }[]) {
  return coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function smoothField(points: PullPoint[], field: keyof PullPoint, radius: number): number[] {
  return gaussianSmooth(
    points.map((point) => Number(point[field]) || 0),
    radius,
  );
}

function loaded(points: PullPoint[], turbo: boolean) {
  const filtered = points.filter((point) =>
    turbo ? point.boost >= 8 && point.afr > 8 && point.afr < 18 : point.accel >= 85 && point.afr > 8 && point.afr < 18,
  );
  if (filtered.length < 2) return filtered;
  return binByRpm(filtered, rpmBinSize(filtered));
}

export type AfrBand = { min: number; max: number; label: string };

export function PullCharts({
  traces,
  showCommand,
  boostPoints,
  settings,
  smoothing,
  turbo,
  band,
}: {
  traces: Trace[];
  showCommand: boolean;
  boostPoints: PullPoint[] | null;
  settings: PowerSettings;
  smoothing: number;
  turbo: boolean;
  band: AfrBand | null;
}) {
  const radius = chartRadius(smoothing);
  const prepared = useMemo(
    () =>
      traces
        .map((trace) => {
          const window = loaded(trace.points, turbo);
          if (window.length < 2) return null;
          const afr = smoothField(window, "afr", radius);
          const cmd = smoothField(window, "cmd", radius);
          return {
            ...trace,
            points: window.map((point, index) => ({
              ...point,
              afr: afr[index],
              cmd: cmd[index],
            })),
          };
        })
        .filter((trace): trace is Trace => trace !== null),
    [traces, turbo, radius],
  );

  return (
    <div className="space-y-3">
      <AfrChart traces={prepared} showCommand={showCommand} band={band} />
      {boostPoints ? <BoostChart points={boostPoints} radius={radius} turbo={turbo} /> : null}
      <PowerChart traces={traces} settings={settings} smoothing={smoothing} turbo={turbo} />
    </div>
  );
}

function AfrChart({ traces, showCommand, band }: { traces: Trace[]; showCommand: boolean; band: AfrBand | null }) {
  const [hover, setHover] = useState<{ trace: string; index: number } | null>(null);
  const clipId = useId().replace(/:/g, "");
  const values = traces.flatMap((trace) => trace.points.flatMap((point) => [point.afr, point.cmd].filter((value) => value > 8)));
  const dataMin = values.length ? Math.min(...values) : 10.5;
  const dataMax = values.length ? Math.max(...values) : 11.8;
  const floor = Math.min(dataMin, band?.min ?? dataMin);
  const ceiling = Math.max(dataMax, band?.max ?? dataMax);
  const yMin = Math.min(10, Math.floor((floor - 0.2) * 5) / 5);
  const yMax = Math.max(band ? band.max + 0.15 : 12.1, Math.ceil((ceiling + 0.25) * 5) / 5);
  const rpms = traces.flatMap((trace) => trace.points.map((point) => point.rpm));
  const rpmMin = rpms.length ? Math.floor((Math.min(...rpms) - 80) / 100) * 100 : 2500;
  const rpmMax = rpms.length ? Math.ceil((Math.max(...rpms) + 80) / 100) * 100 : 6500;
  const yAt = (afr: number) => yOf(afr, yMin, yMax);

  const hovered = (() => {
    if (!hover) return null;
    const trace = traces.find((item) => item.id === hover.trace);
    const point = trace?.points[hover.index];
    return trace && point ? { trace, point } : null;
  })();

  function move(event: PointerEvent<SVGSVGElement>) {
    const x = svgX(event);
    if (x < PAD.l || x > W - PAD.r) return;
    let best: { trace: string; index: number } | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const trace of traces) {
      trace.points.forEach((point, index) => {
        const dist = Math.abs(xOf(point.rpm, rpmMin, rpmMax) - x);
        if (dist < bestDist) {
          bestDist = dist;
          best = { trace: trace.id, index };
        }
      });
    }
    if (best) setHover(best);
  }

  const yTicks: number[] = [];
  for (let tick = Math.ceil(yMin * 5) / 5; tick <= yMax + 0.001; tick += 0.4) yTicks.push(Number(tick.toFixed(1)));
  const xTicks = rpmTicks(rpmMin, rpmMax);
  const showBand = band !== null && yMin <= band.min && yMax >= band.max;

  return (
    <figure className="rounded-xl border border-[#3f382f] bg-[#1c1915] p-3 text-[#efe8dc] sm:p-4">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[#c9bfb0]">
        <Legend swatch="#f0a202" label="Wideband AFR" />
        {showCommand ? <Legend dashed label="Commanded AFR" /> : null}
        {showBand && band ? <Legend band label={band.label} /> : null}
        {traces.map((trace) => (
          <Legend key={trace.id} swatch={trace.color} label={trace.label} />
        ))}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none" role="img" aria-label="Wideband and commanded AFR against engine speed" onPointerDown={move} onPointerMove={move}>
        <Clip id={clipId} />
        {showBand && band ? (
          <rect x={PAD.l} y={yAt(band.max)} width={W - PAD.l - PAD.r} height={Math.max(0, yAt(band.min) - yAt(band.max))} fill="#f0a202" opacity="0.1" />
        ) : null}
        {yTicks.map((tick) => (
          <GridY key={tick} y={yAt(tick)} label={tick.toFixed(1)} />
        ))}
        {xTicks.map((tick) => (
          <text key={tick} x={xOf(tick, rpmMin, rpmMax)} y={H - 10} textAnchor="middle" fill="#b7ad9e" fontSize="11" fontFamily="ui-monospace, monospace">
            {(tick / 1000).toFixed(1)}k
          </text>
        ))}
        <g clipPath={`url(#${clipId})`}>
          {showCommand
            ? traces.map((trace) => (
                <path
                  key={`${trace.id}-cmd`}
                  d={pathFrom(trace.points.filter((point) => point.cmd > 8).map((point) => ({ x: xOf(point.rpm, rpmMin, rpmMax), y: yAt(point.cmd) })))}
                  fill="none"
                  stroke="#efe8dc"
                  strokeWidth="1.4"
                  strokeDasharray="4 4"
                />
              ))
            : null}
          {traces.map((trace) => (
            <path
              key={trace.id}
              d={pathFrom(trace.points.map((point) => ({ x: xOf(point.rpm, rpmMin, rpmMax), y: yAt(point.afr) })))}
              fill="none"
              stroke={trace.color}
              strokeWidth={hovered?.trace.id === trace.id ? 2.6 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {hovered ? (
            <Marker x={xOf(hovered.point.rpm, rpmMin, rpmMax)} y={yAt(hovered.point.afr)} color={hovered.trace.color} />
          ) : null}
        </g>
      </svg>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[#3a342c] px-1 pt-3 font-mono text-xs sm:grid-cols-4">
        <Read term={(hovered?.trace.label ?? traces[0]?.label) || "Pull"} value={hovered ? `${Math.round(hovered.point.rpm).toLocaleString()} rpm` : "Click the line"} />
        <Read term="Wideband" value={hovered ? `${hovered.point.afr.toFixed(2)} AFR` : "—"} />
        <Read
          term="Commanded"
          value={
            hovered && hovered.point.cmd > 8
              ? `${hovered.point.cmd.toFixed(2)} (${hovered.point.afr - hovered.point.cmd > 0 ? "+" : ""}${(hovered.point.afr - hovered.point.cmd).toFixed(2)})`
              : "—"
          }
        />
        <Read term="Boost / timing" value={hovered ? `${hovered.point.boost.toFixed(1)} psi · ${hovered.point.timing.toFixed(1)}°` : "—"} />
      </dl>
    </figure>
  );
}

function BoostChart({ points, radius, turbo }: { points: PullPoint[]; radius: number; turbo: boolean }) {
  const filtered = points.filter((point) => point.boost > -6);
  const window = filtered.length < 2 ? filtered : binByRpm(filtered, rpmBinSize(filtered));
  if (window.length < 2) return null;
  const boost = smoothField(window, "boost", radius);
  const tgt = smoothField(window, "tgt", radius);
  const timing = smoothField(window, "timing", radius);
  const rpmMin = Math.floor((Math.min(...window.map((point) => point.rpm)) - 80) / 100) * 100;
  const rpmMax = Math.ceil((Math.max(...window.map((point) => point.rpm)) + 80) / 100) * 100;
  const yMax = Math.max(turbo ? 20 : 4, Math.ceil(Math.max(...boost, ...tgt) + 1));
  const yMin = Math.min(-2, Math.floor(Math.min(...boost) - 1));
  const tMin = Math.min(-2, Math.floor(Math.min(...timing) - 1));
  const tMax = Math.max(10, Math.ceil(Math.max(...timing) + 1));
  const xTicks = rpmTicks(rpmMin, rpmMax);
  const yTicks = ticksBetween(yMin, yMax, 4);
  return (
    <figure className="rounded-xl border border-[#3f382f] bg-[#1c1915] p-3 text-[#efe8dc] sm:p-4">
      <figcaption className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-[#c9bfb0]">
        <Legend swatch="#7eb6c9" label="Boost" />
        <Legend dashed color="#7eb6c9" label="Target" />
        <Legend swatch="#d4785a" label="Timing, right scale" />
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Boost, target, and ignition timing">
        {yTicks.map((tick) => (
          <GridY key={tick} y={yOf(tick, yMin, yMax)} label={String(Math.round(tick))} color="#8fb8c6" x2={W - PAD.r} />
        ))}
        {[tMin, (tMin + tMax) / 2, tMax].map((tick) => (
          <text key={tick} x={W - 8} y={yOf(tick, tMin, tMax) + 3} textAnchor="end" fill="#d4785a" fontSize="11" fontFamily="ui-monospace, monospace">
            {Math.round(tick)}°
          </text>
        ))}
        {xTicks.map((tick) => (
          <text key={tick} x={xOf(tick, rpmMin, rpmMax)} y={H - 10} textAnchor="middle" fill="#b7ad9e" fontSize="11" fontFamily="ui-monospace, monospace">
            {(tick / 1000).toFixed(1)}k
          </text>
        ))}
        <path d={pathFrom(window.map((point, index) => ({ x: xOf(point.rpm, rpmMin, rpmMax), y: yOf(tgt[index], yMin, yMax) })))} fill="none" stroke="#7eb6c9" strokeDasharray="4 4" strokeWidth="1.4" />
        <path d={pathFrom(window.map((point, index) => ({ x: xOf(point.rpm, rpmMin, rpmMax), y: yOf(boost[index], yMin, yMax) })))} fill="none" stroke="#7eb6c9" strokeWidth="2" strokeLinejoin="round" />
        <path d={pathFrom(window.map((point, index) => ({ x: xOf(point.rpm, rpmMin, rpmMax), y: yOf(timing[index], tMin, tMax) })))} fill="none" stroke="#d4785a" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </figure>
  );
}

function PowerChart({
  traces,
  settings,
  smoothing,
  turbo,
}: {
  traces: Trace[];
  settings: PowerSettings;
  smoothing: number;
  turbo: boolean;
}) {
  const [hover, setHover] = useState<{ trace: string; index: number } | null>(null);
  const clipId = useId().replace(/:/g, "");
  const series = useMemo(
    () =>
      traces
        .map((trace) => {
          const window = loaded(trace.points, turbo);
          const airflow = airflowCurve(window, settings, smoothing);
          const road = roadCurve(window, settings, smoothing);
          if (airflow.every((point) => point.hp < 5) && !road) return null;
          return { ...trace, airflow, road };
        })
        .filter((trace): trace is Trace & { airflow: PowerPoint[]; road: PowerPoint[] | null } => trace !== null),
    [traces, settings, smoothing, turbo],
  );
  if (!series.length) {
    return (
      <p className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
        Horsepower needs Calculated Load or a mass-airflow column. Wheel horsepower from the speed trace also needs a vehicle weight.
      </p>
    );
  }
  const plotted = series.flatMap((trace) => trace.airflow.filter((point) => point.hp > 5 || point.whp > 5));
  const numbers = plotted.flatMap((point) => [point.hp, point.tq, point.whp, point.wtq]);
  const yMax = Math.max(100, Math.ceil(Math.max(...numbers, 1) / 50) * 50);
  const rpms = plotted.map((point) => point.rpm);
  const rpmMin = rpms.length ? Math.floor((Math.min(...rpms) - 80) / 100) * 100 : 2500;
  const rpmMax = rpms.length ? Math.ceil((Math.max(...rpms) + 80) / 100) * 100 : 6500;
  const yTicks = ticksBetween(0, yMax, 4);
  const xTicks = rpmTicks(rpmMin, rpmMax);

  const hovered = (() => {
    if (!hover) return null;
    const trace = series.find((item) => item.id === hover.trace);
    const point = trace?.airflow[hover.index];
    return trace && point ? { trace, point } : null;
  })();

  function move(event: PointerEvent<SVGSVGElement>) {
    const x = svgX(event);
    if (x < PAD.l || x > W - PAD.r) return;
    let best: { trace: string; index: number } | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const trace of series) {
      trace.airflow.forEach((point, index) => {
        if (point.hp < 5) return;
        const dist = Math.abs(xOf(point.rpm, rpmMin, rpmMax) - x);
        if (dist < bestDist) {
          bestDist = dist;
          best = { trace: trace.id, index };
        }
      });
    }
    if (best) setHover(best);
  }

  return (
    <figure className="rounded-xl border border-[#3f382f] bg-[#1c1915] p-3 text-[#efe8dc] sm:p-4">
      <figcaption className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-[#c9bfb0]">
        <Legend swatch="#f0a202" label="Crank hp" />
        <Legend dashed color="#f0a202" label="Wheel hp" />
        <Legend swatch="#7eb6c9" label="Crank lb-ft" />
        <Legend dashed color="#7eb6c9" label="Wheel lb-ft" />
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none" role="img" aria-label="Estimated horsepower and torque" onPointerDown={move} onPointerMove={move}>
        <Clip id={clipId} />
        {yTicks.map((tick) => (
          <GridY key={tick} y={yOf(tick, 0, yMax)} label={String(Math.round(tick))} />
        ))}
        {xTicks.map((tick) => (
          <text key={tick} x={xOf(tick, rpmMin, rpmMax)} y={H - 10} textAnchor="middle" fill="#b7ad9e" fontSize="11" fontFamily="ui-monospace, monospace">
            {(tick / 1000).toFixed(1)}k
          </text>
        ))}
        <g clipPath={`url(#${clipId})`}>
          {series.map((trace) => (
            <g key={trace.id}>
              <PowerPath points={trace.airflow} rpmMin={rpmMin} rpmMax={rpmMax} yMax={yMax} field="tq" color="#7eb6c9" />
              <PowerPath points={trace.airflow} rpmMin={rpmMin} rpmMax={rpmMax} yMax={yMax} field="wtq" color="#7eb6c9" dashed />
              <PowerPath points={trace.airflow} rpmMin={rpmMin} rpmMax={rpmMax} yMax={yMax} field="hp" color={trace.color} width={2.2} />
              <PowerPath points={trace.airflow} rpmMin={rpmMin} rpmMax={rpmMax} yMax={yMax} field="whp" color={trace.color} dashed />
            </g>
          ))}
          {hovered ? <Marker x={xOf(hovered.point.rpm, rpmMin, rpmMax)} y={yOf(hovered.point.hp, 0, yMax)} color={hovered.trace.color} /> : null}
        </g>
      </svg>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[#3a342c] px-1 pt-3 font-mono text-xs sm:grid-cols-4">
        <Read term="RPM" value={hovered ? `${Math.round(hovered.point.rpm).toLocaleString()}` : "Click the curve"} />
        <Read term="HP / WHP" value={hovered ? `${Math.round(hovered.point.hp)} / ${Math.round(hovered.point.whp)}` : "—"} />
        <Read term="TQ / WTQ" value={hovered ? `${Math.round(hovered.point.tq)} / ${Math.round(hovered.point.wtq)}` : "—"} />
        <Read term="Source" value="Airflow estimate" />
      </dl>
    </figure>
  );
}

function PowerPath({
  points,
  rpmMin,
  rpmMax,
  yMax,
  field,
  color,
  dashed,
  width = 1.6,
}: {
  points: PowerPoint[];
  rpmMin: number;
  rpmMax: number;
  yMax: number;
  field: keyof Pick<PowerPoint, "hp" | "whp" | "tq" | "wtq">;
  color: string;
  dashed?: boolean;
  width?: number;
}) {
  const usable = points.filter((point) => point.hp > 5);
  if (usable.length < 2) return null;
  return (
    <path
      d={pathFrom(usable.map((point) => ({ x: xOf(point.rpm, rpmMin, rpmMax), y: yOf(point[field], 0, yMax) })))}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashed ? "5 4" : undefined}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

function svgX(event: PointerEvent<SVGSVGElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return ((event.clientX - rect.left) / rect.width) * W;
}

function rpmTicks(rpmMin: number, rpmMax: number) {
  const ticks: number[] = [];
  for (let rpm = Math.ceil(rpmMin / 500) * 500; rpm <= rpmMax; rpm += 500) ticks.push(rpm);
  return ticks;
}

function ticksBetween(min: number, max: number, count: number) {
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, index) => min + step * index);
}

function Clip({ id }: { id: string }) {
  return (
    <defs>
      <clipPath id={id}>
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
      </clipPath>
    </defs>
  );
}

function GridY({ y, label, color = "#b7ad9e", x2 = W - PAD.r }: { y: number; label: string; color?: string; x2?: number }) {
  return (
    <g>
      <line x1={PAD.l} x2={x2} y1={y} y2={y} stroke="#3a342c" />
      <text x={PAD.l - 8} y={y + 3} textAnchor="end" fill={color} fontSize="11" fontFamily="ui-monospace, monospace">
        {label}
      </text>
    </g>
  );
}

function Marker({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <line x1={x} x2={x} y1={PAD.t} y2={H - PAD.b} stroke="#efe8dc" strokeOpacity="0.35" />
      <circle cx={x} cy={y} r="4.5" fill={color} stroke="#1c1915" strokeWidth="1.5" />
    </g>
  );
}

function Legend({ swatch, dashed, band, label, color = "#efe8dc" }: { swatch?: string; dashed?: boolean; band?: boolean; label: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {band ? <span className="h-2 w-4 rounded-sm bg-[#f0a202]/20" /> : null}
      {dashed ? <span className="h-0 w-4 border-t border-dashed" style={{ borderColor: color }} /> : null}
      {swatch ? <span className="h-0.5 w-4" style={{ background: swatch }} /> : null}
      {label}
    </span>
  );
}

function Read({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wide text-[#9d9486] uppercase">{term}</dt>
      <dd className="text-[#f6f1e7]">{value}</dd>
    </div>
  );
}
