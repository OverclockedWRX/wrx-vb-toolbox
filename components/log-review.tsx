import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PullCharts, type Trace } from "@/components/pull-chart";
import { ReviewHeader } from "@/components/review-header";
import { healthBorder, worseHealth, type Health } from "@/lib/assess";
import { airflowPeaks, roadPeaks } from "@/lib/power";
import type { SessionReview } from "@/lib/session";
import { formatSigned, gearLabel, type PowerSettings, type Pull, type Review } from "@/lib/types";
import { formatSpeedRange } from "@/lib/units";

const COLORS = ["#f0a202", "#7eb6c9", "#e07a5f", "#c6d36a", "#d4a574", "#c9a0dc"];

export function LogReview({
  session,
  settings,
  smoothing,
  onSmoothing,
}: {
  session: SessionReview;
  settings: PowerSettings;
  smoothing: number;
  onSmoothing: (value: number) => void;
}) {
  const report = session.review;
  const gears = [...new Set(report.pulls.map((pull) => pull.gear))].sort((a, b) => a - b);
  const initialGear = preferredGear(report.pulls);
  const longest = widestPull(report.pulls.filter((pull) => pull.gear === initialGear));
  const [gear, setGear] = useState(initialGear);
  const [selectedId, setSelectedId] = useState(longest?.id ?? "");
  const [view, setView] = useState("pull");

  const inGear = report.pulls.filter((pull) => pull.gear === gear);
  const selected = inGear.find((pull) => pull.id === selectedId) ?? inGear[0];
  const peaks = useMemo(
    () => airflowPeaks(report.pulls, settings, smoothing, report.turbo),
    [report, settings, smoothing],
  );
  const road = useMemo(
    () => roadPeaks(report.pulls, settings, smoothing, report.turbo),
    [report, settings, smoothing],
  );
  const traces: Trace[] = useMemo(() => {
    const source = view === "overlay" ? inGear : selected ? [selected] : [];
    return source.map((pull, index) => ({
      id: pull.id,
      label: `${pull.log} · ${gearLabel(pull.gear)}`,
      color: view === "overlay" ? COLORS[index % COLORS.length] : "#f0a202",
      points: pull.points,
    }));
  }, [inGear, selected, view]);
  const bins = useMemo(() => rpmBins(inGear, report.turbo), [inGear, report.turbo]);

  return (
    <div>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
          <ReviewHeader session={session} />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{report.logs.length} log{report.logs.length === 1 ? "" : "s"}</Badge>
            <Badge variant="secondary">VB WRX</Badge>
            {report.damMin !== null ? <Badge variant="secondary">DAM {report.damMin.toFixed(2)}</Badge> : null}
            {session.fuelStats.aboveAbsolute > 0 ? <Badge variant="destructive">AFR past the stop</Badge> : null}
            {session.fuelStats.samples > 0 && session.fuelStats.aboveAbsolute === 0 && session.fuelStats.abovePreferred === 0 ? (
              <Badge>AFR inside the preferred window</Badge>
            ) : null}
            {session.fuelStats.aboveAbsolute === 0 && session.fuelStats.abovePreferred > 0 ? (
              <Badge variant="secondary">AFR a bit lean of preferred</Badge>
            ) : null}
          </div>
          <div className="max-w-3xl space-y-3">
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">Log review</p>
            <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{headline(report)}</h1>
            <p className="text-base leading-7 text-muted-foreground sm:text-lg">{summary(report)}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label={report.turbo ? "On-boost AFR" : "Wide-open AFR"}
              value={report.onBoost ? `${report.onBoost.afrMin.toFixed(2)}–${report.onBoost.afrMax.toFixed(2)}` : "—"}
              detail={report.onBoost ? `${report.onBoost.samples} samples` : "No load samples"}
              health={session.grade.health.afr}
            />
            <Stat
              label="Versus command"
              value={report.onBoost?.deltaMean === null || report.onBoost?.deltaMean === undefined ? "—" : formatSigned(report.onBoost.deltaMean)}
              detail={
                report.onBoost?.deltaMax === null || report.onBoost?.deltaMax === undefined
                  ? "Commanded AFR not logged"
                  : `Leanest gap ${formatSigned(report.onBoost.deltaMax)}`
              }
              health={session.grade.health.afr}
            />
            <Stat
              label="Peak boost"
              value={report.peakBoost === null ? "—" : `${report.peakBoost.toFixed(1)} psi`}
              detail={report.targetAtPeak ? `Target near ${report.targetAtPeak.toFixed(1)} psi` : "Manifold pressure"}
              health={session.grade.health.boost}
            />
            <Stat
              label="Knock under load"
              value={String(report.wotKnockEvents)}
              detail={report.damMin === null ? "DAM not logged" : `DAM ${report.damMin.toFixed(2)}–${report.damMax?.toFixed(2)}`}
              health={session.grade.health.knock}
            />
          </dl>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Peak HP" value={peaks ? String(Math.round(peaks.hp)) : "—"} detail={peaks ? `${Math.round(peaks.hpRpm).toLocaleString()} rpm · crank` : "Need airflow"} />
            <Stat label="Peak TQ" value={peaks ? String(Math.round(peaks.tq)) : "—"} detail={peaks ? `${Math.round(peaks.tqRpm).toLocaleString()} rpm · lb-ft` : "Need airflow"} />
            <Stat label="Peak WHP" value={peaks ? String(Math.round(peaks.whp)) : "—"} detail={peaks ? `${settings.drivetrainLossPct}% drivetrain loss` : "Need airflow"} />
            <Stat label="Peak WTQ" value={peaks ? String(Math.round(peaks.wtq)) : "—"} detail={peaks ? `${Math.round(peaks.wtqRpm).toLocaleString()} rpm · lb-ft` : "Need airflow"} />
          </dl>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6">
        {report.warnings.length ? (
          <ul className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Estimated power</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Crank horsepower is estimated from airflow. Calculated Load in grams per revolution times rpm, divided by 60, is grams of air per second. That air can burn gasoline at 14.7:1. The thermal efficiency you set ({settings.thermalEfficiencyPct}%) turns that fuel energy into crank horsepower. Torque is horsepower times 5252, divided by rpm. Wheel numbers subtract the {settings.drivetrainLossPct}% drivetrain loss. The curves are smoothed the way a dyno plot is smoothed. These are estimates, not a chassis-dyno measurement.
          </p>
          {road ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Road-load check, from vehicle speed, weight, drag, and rolling resistance: about {Math.round(road.whp)} whp at {Math.round(road.whpRpm).toLocaleString()} rpm and {Math.round(road.wtq)} wtq at {Math.round(road.wtqRpm).toLocaleString()} rpm. That implies roughly {Math.round(road.hp)} hp and {Math.round(road.tq)} lb-ft at the crank with the same drivetrain loss. It assumes a flat road and no wind.
            </p>
          ) : (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Enter a vehicle weight before starting the review to add a road-load wheel-horsepower check from the speed trace.
            </p>
          )}
        </section>

        <section className="space-y-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Pulls</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                A pull is the pedal at 90% or more for at least 0.8 seconds in one gear, with rpm rising. Click a line to read it. Lines are Gaussian-smoothed. A negative AFR gap means the wideband is richer than commanded.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Dyno smoothing
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={smoothing}
                  onChange={(event) => onSmoothing(Number(event.target.value))}
                  className="w-28 accent-neutral-700 dark:accent-neutral-200"
                />
                <span className="w-4 font-mono text-xs text-foreground">{smoothing}</span>
              </label>
              <Button size="sm" variant={view === "pull" ? "default" : "outline"} onClick={() => setView("pull")}>
                This pull
              </Button>
              <Button size="sm" variant={view === "overlay" ? "default" : "outline"} onClick={() => setView("overlay")}>
                Overlay gear
              </Button>
            </div>
          </div>

          {gears.length ? (
            <div className="flex flex-wrap gap-2">
              {gears.map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={item === gear ? "default" : "outline"}
                  onClick={() => {
                    setGear(item);
                    const best = widestPull(report.pulls.filter((pull) => pull.gear === item));
                    if (best) setSelectedId(best.id);
                  }}
                >
                  {gearLabel(item)} gear
                  <span className="font-mono text-xs opacity-70">{report.pulls.filter((pull) => pull.gear === item).length}</span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No wide-open pulls in these files. Cruise, trims, and knock are still summarized below.</p>
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {inGear.map((pull) => (
              <Button
                key={pull.id}
                variant={pull.id === selected?.id ? "default" : "outline"}
                className="h-auto items-start justify-start px-3 py-2 text-left whitespace-normal!"
                onClick={() => setSelectedId(pull.id)}
              >
                <span className="flex w-full flex-col gap-0.5">
                  <span className="font-mono text-xs tracking-wide uppercase opacity-70">
                    {pull.log} · {gearLabel(pull.gear)} · {formatSpeedRange(pull.speed0, pull.speed1)}
                  </span>
                  <span>
                    {pull.rpm0.toLocaleString()}–{pull.rpm1.toLocaleString()} rpm
                  </span>
                  <span className="font-mono text-xs opacity-80">
                    AFR {pull.afrMin.toFixed(2)}–{pull.afrMax.toFixed(2)} · {pull.boostMax.toFixed(1)} psi
                  </span>
                </span>
              </Button>
            ))}
          </div>

          {traces.length ? (
            <PullCharts
              traces={traces}
              showCommand={view === "pull"}
              boostPoints={selected?.points ?? null}
              settings={settings}
              smoothing={smoothing}
              turbo={report.turbo}
              band={{
                min: session.limits.preferredMin,
                max: session.limits.preferredMax,
                label: `${session.limits.octane} octane · ${session.limits.preferredMin.toFixed(2)}–${session.limits.preferredMax.toFixed(2)}`,
              }}
            />
          ) : null}
          {selected ? <PullFacts pull={selected} /> : null}
        </section>

        <Separator />

        <section className={`grid gap-8 rounded-xl border-2 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] ${healthBorder(session.grade.health.afr)}`}>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Air-fuel</h2>
            <AfrCopy session={session} />
          </div>
          {bins.length ? (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <caption className="px-4 py-3 text-left text-sm font-medium">
                  {gearLabel(gear)} gear, {report.turbo ? "above 12 psi" : "at wide-open throttle"}
                </caption>
                <thead className="border-y border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">RPM</th>
                    <th className="px-3 py-2 font-medium">AFR</th>
                    <th className="px-3 py-2 font-medium">Asked</th>
                    <th className="px-3 py-2 font-medium">Boost</th>
                    <th className="px-3 py-2 font-medium">Timing</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {bins.map((bin) => (
                    <tr key={bin.rpm} className="border-b border-border/70 last:border-0">
                      <td className="px-3 py-2">
                        {bin.rpm.toLocaleString()}–{(bin.rpm + 250).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {bin.afr.toFixed(2)}
                        <span className="text-muted-foreground"> / {bin.afrMax.toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2">{bin.cmd ? bin.cmd.toFixed(2) : "—"}</td>
                      <td className="px-3 py-2">{bin.boost.toFixed(1)}</td>
                      <td className="px-3 py-2">{bin.timing.toFixed(1)}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className={`grid gap-6 rounded-xl border-2 p-5 sm:p-6 lg:grid-cols-[1fr_16rem] ${healthBorder(session.grade.health.trims)}`}>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Fuel trims</h2>
            <TrimCopy report={report} />
          </div>
          <LearningStrip report={report} />
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <article className={`space-y-3 rounded-xl border-2 p-5 ${healthBorder(session.grade.health.knock)}`}>
            <h2 className="text-xl font-semibold tracking-tight">Knock</h2>
            <KnockCopy report={report} />
          </article>
          <article className={`space-y-3 rounded-xl border-2 p-5 ${healthBorder(worseHealth(session.grade.health.boost, session.grade.health.delivery))}`}>
            <h2 className="text-xl font-semibold tracking-tight">Boost, timing, and fuel delivery</h2>
            <HardwareCopy report={report} />
          </article>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Files</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Log</th>
                  <th className="px-3 py-2 font-medium">What it is</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Boost</th>
                  <th className="px-3 py-2 font-medium">Cruise AFR</th>
                  <th className="px-3 py-2 font-medium">Learn 3</th>
                  <th className="px-3 py-2 font-medium">Oil</th>
                </tr>
              </thead>
              <tbody>
                {report.logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{log.id}</td>
                    <td className="px-3 py-2">{log.blurb}</td>
                    <td className="px-3 py-2 font-mono text-xs">{log.seconds.toFixed(0)}s</td>
                    <td className="px-3 py-2 font-mono text-xs">{log.boostMax === null ? "—" : log.boostMax.toFixed(1)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{log.cruiseAfr === null ? "—" : log.cruiseAfr.toFixed(2)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {log.learn3Start === null ? "—" : `${formatSigned(log.learn3Start, 1)} → ${formatSigned(log.learn3End ?? log.learn3Start, 1)}`}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{log.oilMax === null ? "—" : `${log.oilMax.toFixed(0)}°F`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.maps.length ? (
            <p className="text-sm leading-6 text-muted-foreground">Map string from the log header: {report.maps.join(" · ")}</p>
          ) : null}
        </section>
      </main>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs leading-5 text-muted-foreground sm:px-6">
          Parsed in the browser from the files you loaded{report.sampleHz ? ` at about ${report.sampleHz} samples per second` : ""}. Wideband is whatever column the Accessport logged as AF Sens 1 Ratio, compared with Comm Fuel Final when that column exists. Power figures are estimates. This does not change a calibration.
        </p>
      </footer>
    </div>
  );
}

function preferredGear(pulls: Pull[]) {
  const counts = new Map<number, number>();
  for (const pull of pulls) counts.set(pull.gear, (counts.get(pull.gear) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

function widestPull(pulls: Pull[]) {
  return [...pulls].sort((a, b) => b.rpm1 - b.rpm0 - (a.rpm1 - a.rpm0))[0];
}

function headline(report: Review) {
  if (!report.onBoost) return "These logs have no wide-open load to judge.";
  if (report.turbo && report.onBoost.afrMax <= 12) {
    return `Wide-open AFR stayed between ${report.onBoost.afrMin.toFixed(2)} and ${report.onBoost.afrMax.toFixed(2)}.`;
  }
  if (report.turbo && report.onBoost.afrMax > 12.2) {
    return `Wide-open AFR reached ${report.onBoost.afrMax.toFixed(2)} under boost.`;
  }
  return `Wide-open AFR ran from ${report.onBoost.afrMin.toFixed(2)} to ${report.onBoost.afrMax.toFixed(2)}.`;
}

function summary(report: Review) {
  if (!report.onBoost) {
    return `${report.logs.length} file${report.logs.length === 1 ? "" : "s"} loaded. Nothing in them meets the wide-open pull rules, so the review below is cruise, trims, and knock only.`;
  }
  const asked =
    report.onBoost.cmdMedian !== null
      ? ` The ECU’s median command on those samples is ${report.onBoost.cmdMedian.toFixed(2)} AFR.`
      : "";
  const pulls = report.pulls.length
    ? ` ${report.pulls.length} pull${report.pulls.length === 1 ? "" : "s"} made the cut.`
    : "";
  return `${report.onBoost.samples} samples at high pedal${report.turbo ? " and at least 10 psi" : ""}.${asked}${pulls}`;
}

function AfrCopy({ session }: { session: SessionReview }) {
  const report = session.review;
  if (!report.onBoost) {
    return <p className="text-sm leading-6 text-muted-foreground">No wide-open samples to compare.</p>;
  }
  const lean = report.onBoost.leanest;
  const limits = session.limits;
  return (
    <>
      <p className="text-sm leading-6 text-muted-foreground">
        The shaded band is the preferred window for {limits.octane} octane at {limits.boostPsi.toFixed(0)} psi: {limits.preferredMin.toFixed(2)}–{limits.preferredMax.toFixed(2)} AFR. Leaner than {limits.absoluteMax.toFixed(2)} is the stop for this fuel and boost. The richest on-boost sample was {report.onBoost.afrMin.toFixed(2)}, and the leanest was {report.onBoost.afrMax.toFixed(2)}. {session.fuelStats.abovePreferred} sample{session.fuelStats.abovePreferred === 1 ? "" : "s"} sat leaner than the preferred limit, and {session.fuelStats.aboveAbsolute} passed the stop.
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        The leanest point is {lean.log}
        {lean.gear > 0 ? `, ${gearLabel(lean.gear)} gear` : ""}, {lean.rpm.toLocaleString()} rpm, {lean.boost.toFixed(2)} psi.
        {lean.cmd > 8
          ? ` The ECU commanded ${lean.cmd.toFixed(2)} there, so the wideband was ${(lean.afr - lean.cmd).toFixed(2)} AFR ${lean.afr >= lean.cmd ? "leaner" : "richer"} than the request.`
          : ""}
        {report.onBoost.deltaMean !== null ? ` The average gap is ${formatSigned(report.onBoost.deltaMean)} AFR.` : ""}
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        Wideband spikes into the high teens or 20s on a closed throttle are fuel cut. They are not a lean condition under load.
      </p>
    </>
  );
}

function TrimCopy({ report }: { report: Review }) {
  const learn1 = report.learning1Median;
  const learn3 = report.learning3Final;
  if (learn1 === null && learn3 === null) {
    return <p className="text-sm leading-6 text-muted-foreground">These logs do not include AF Learning channels.</p>;
  }
  return (
    <>
      <p className="text-sm leading-6 text-muted-foreground">
        Positive fuel trim means the ECU is adding fuel. Negative means it is removing fuel.
        {learn1 !== null ? ` AF Learning 1, across the loaded files, has a median of ${formatSigned(learn1, 1)}%.` : ""}
        {learn3 !== null ? ` AF Learning 3 finished at ${formatSigned(learn3, 1)}%.` : ""}
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        {(learn3 !== null && Math.abs(learn3) >= 10) || (learn1 !== null && Math.abs(learn1) >= 10)
          ? "A stored trim past about ±10% means closed loop is covering a fueling error. That is worth sending back to the tuner so the airflow model can be rescaled. The wideband under load is the check on whether the same error shows up at wide-open throttle, where trims may not apply the same way."
          : "Stored trims are inside a normal closed-loop window. Cruise AFR near 14.7 means the correction is doing its job."}
      </p>
    </>
  );
}

function KnockCopy({ report }: { report: Review }) {
  return (
    <>
      <p className="text-sm leading-6 text-muted-foreground">
        {report.damMin === null
          ? "DAM was not in these logs."
          : `DAM ran from ${report.damMin.toFixed(2)} to ${report.damMax?.toFixed(2)}.`}
        {` Feedback knock events while actually under load: ${report.wotKnockEvents}.`}
        {report.roughMax === null ? "" : ` The highest cylinder roughness count in the files is ${report.roughMax.toFixed(0)}.`}
      </p>
      {report.knock ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {report.knock.underLoad ? "Under load, " : "Off boost, "}
          {report.knock.log} shows feedback knock of {report.knock.fk.toFixed(2)}° for {report.knock.seconds.toFixed(1)} seconds
          {report.knock.gear > 0 ? ` in ${gearLabel(report.knock.gear)}` : ""}, {report.knock.rpmMin.toLocaleString()}–{report.knock.rpmMax.toLocaleString()} rpm, boost {report.knock.boostMin.toFixed(2)} to {report.knock.boostMax.toFixed(2)} psi, about {report.knock.accel.toFixed(0)}% pedal, AFR {report.knock.afr.toFixed(2)}.
          {report.knock.ks2Max !== null ? ` Cylinder 2 knock-sensor noise peaked at ${report.knock.ks2Max.toLocaleString()}.` : ""}
          {report.knock.underLoad
            ? " Timing pulled under boost is worth a look from the tuner."
            : " Knock logged in vacuum at light pedal is often exhaust noise at the sensor, especially with an unequal-length header, when learned timing does not move."}
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">No feedback knock was logged.</p>
      )}
    </>
  );
}

function HardwareCopy({ report }: { report: Review }) {
  const oil = maxNum(report.logs.map((log) => log.oilMax));
  const coolant = maxNum(report.logs.map((log) => log.coolantMax));
  const manifold = maxNum(report.logs.map((log) => log.manifoldMax));
  const duty = maxNum(report.pulls.map((pull) => pull.dutyMax));
  const fp = minNum(report.pulls.map((pull) => pull.fpMin));
  return (
    <>
      <p className="text-sm leading-6 text-muted-foreground">
        {report.peakBoost === null
          ? "Boost was not logged."
          : `The highest boost in the files is ${report.peakBoost.toFixed(2)} psi${report.targetAtPeak ? `, with the target near ${report.targetAtPeak.toFixed(1)} psi at that moment` : ""}.`}
        {report.pulls.length
          ? ` On the pulls, timing runs from ${Math.min(...report.pulls.map((pull) => pull.timingMin)).toFixed(1)}° to ${Math.max(...report.pulls.map((pull) => pull.timingMax)).toFixed(1)}°.`
          : ""}
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        {fp !== null ? `The lowest fuel pressure during the loaded part of a pull is ${Math.round(fp).toLocaleString()} psi. ` : ""}
        {duty !== null ? `Injector duty peaks at ${duty.toFixed(1)}%. ` : ""}
        {coolant !== null ? `Coolant reached ${coolant.toFixed(0)}°F. ` : ""}
        {oil !== null ? `Oil reached ${oil.toFixed(0)}°F. ` : ""}
        {manifold !== null ? `Manifold air reached ${manifold.toFixed(0)}°F.` : ""}
      </p>
    </>
  );
}

function LearningStrip({ report }: { report: Review }) {
  const steps = report.learningSteps;
  if (steps.length < 2) return null;
  const width = 240;
  const height = 140;
  const pad = { l: 36, r: 8, t: 12, b: 22 };
  const values = steps.map((step) => step.value);
  const min = Math.min(0, ...values) - 1;
  const max = Math.max(8, ...values) + 1;
  const t0 = steps[0].t;
  const t1 = steps[steps.length - 1].t;
  const y = (value: number) => pad.t + ((max - value) / (max - min)) * (height - pad.t - pad.b);
  const x = (t: number) => pad.l + ((t - t0) / Math.max(t1 - t0, 1)) * (width - pad.l - pad.r);
  const d = steps.map((step, index) => `${index === 0 ? "M" : "L"}${x(step.t).toFixed(1)} ${y(step.value).toFixed(1)}`).join(" ");
  return (
    <figure className="rounded-lg border border-[#3f382f] bg-[#1c1915] p-3 text-[#efe8dc]">
      <figcaption className="mb-1 font-mono text-[10px] tracking-wide text-[#b7ad9e] uppercase">
        {report.learningLog} · AF Learning 3
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="AF Learning 3 over the log">
        {[min, (min + max) / 2, max].map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke="#3a342c" />
            <text x={pad.l - 6} y={y(tick) + 3} textAnchor="end" fill="#b7ad9e" fontSize="10" fontFamily="ui-monospace, monospace">
              {tick.toFixed(0)}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="#f0a202" strokeWidth="1.8" />
      </svg>
    </figure>
  );
}

function PullFacts({ pull }: { pull: Pull }) {
  const facts: [string, string][] = [
    ["Duration", `${(pull.t1 - pull.t0).toFixed(2)} s`],
    ["Speed", formatSpeedRange(pull.speed0, pull.speed1)],
    ["Mean AFR / command", `${pull.afrMean.toFixed(2)} / ${pull.cmdMean ? pull.cmdMean.toFixed(2) : "—"}`],
    ["Gap", `${formatSigned(pull.deltaMin)} to ${formatSigned(pull.deltaMax)}`],
    ["Timing on load", `${pull.timingMin.toFixed(1)}° to ${pull.timingMax.toFixed(1)}°`],
    ["Fuel pressure min", pull.fpMin === null ? "—" : `${Math.round(pull.fpMin).toLocaleString()} psi`],
    ["Injector duty", pull.dutyMax === null ? "—" : `${pull.dutyMax.toFixed(1)}%`],
    ["Manifold / oil", `${pull.manifold === null ? "—" : `${pull.manifold.toFixed(0)}°F`} / ${pull.oil === null ? "—" : `${pull.oil.toFixed(0)}°F`}`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {facts.map(([label, value]) => (
        <div key={label} className="border-t border-border pt-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-mono text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stat({ label, value, detail, health = "good" }: { label: string; value: string; detail: string; health?: Health }) {
  return (
    <div className={`rounded-xl border-2 px-3 py-3 ${healthBorder(health)}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-lg tracking-tight">{value}</dd>
      <dd className="text-xs text-muted-foreground">{detail}</dd>
    </div>
  );
}

function rpmBins(pulls: Pull[], turbo: boolean) {
  const buckets = new Map<number, { afr: number[]; cmd: number[]; boost: number[]; timing: number[] }>();
  for (const pull of pulls) {
    for (const point of pull.points) {
      if (turbo ? point.boost < 12 || point.accel < 90 : point.accel < 90) continue;
      const rpm = Math.floor(point.rpm / 250) * 250;
      const bucket = buckets.get(rpm) ?? { afr: [], cmd: [], boost: [], timing: [] };
      if (point.afr > 8) bucket.afr.push(point.afr);
      if (point.cmd > 8) bucket.cmd.push(point.cmd);
      bucket.boost.push(point.boost);
      bucket.timing.push(point.timing);
      buckets.set(rpm, bucket);
    }
  }
  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.afr.length >= 5)
    .sort((a, b) => a[0] - b[0])
    .map(([rpm, bucket]) => ({
      rpm,
      afr: median(bucket.afr),
      afrMax: Math.max(...bucket.afr),
      cmd: bucket.cmd.length ? median(bucket.cmd) : 0,
      boost: Math.max(...bucket.boost),
      timing: median(bucket.timing),
    }));
}

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
}

function maxNum(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? Math.max(...present) : null;
}

function minNum(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? Math.min(...present) : null;
}
