import type { ParsedLog, RawSample } from "@/lib/parse-log";
import type { KnockEvent, LearningStep, LogSummary, OnBoost, Pull, Review } from "@/lib/types";

function percentile(values: number[], p: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.round((p / 100) * (ordered.length - 1))));
  return ordered[index];
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxOf(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? Math.max(...present) : null;
}

function minOf(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? Math.min(...present) : null;
}

function segments(samples: RawSample[], accelMin = 90, minDuration = 0.8): RawSample[][] {
  const groups: RawSample[][] = [];
  let current: RawSample[] = [];
  for (const sample of samples) {
    if (sample.accel >= accelMin) current.push(sample);
    else if (current.length) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups.filter((group) => group[group.length - 1].t - group[0].t >= minDuration);
}

function toPoint(sample: RawSample) {
  return {
    t: sample.t,
    rpm: sample.rpm,
    accel: sample.accel,
    boost: sample.boost,
    tgt: sample.tgt,
    afr: sample.afr,
    cmd: sample.cmd,
    timing: sample.timing,
    fp: sample.fp,
    duty: sample.duty,
    load: sample.load,
    maf: sample.maf,
    speed: sample.speed,
  };
}

function summarizeLog(log: ParsedLog, pullCount: number): LogSummary {
  const samples = log.samples;
  const boosts = samples.map((sample) => sample.boost);
  const boostMax = Math.max(...boosts);
  const coolantMax = maxOf(samples.map((sample) => sample.coolant));
  const cruise = samples.filter(
    (sample) =>
      sample.accel <= 20 &&
      sample.boost < 2 &&
      sample.rpm >= 1000 &&
      sample.rpm <= 3500 &&
      sample.afr >= 13 &&
      sample.afr <= 16.2,
  );
  const learn1 = samples.map((sample) => sample.learn1).filter((value): value is number => value !== null);
  const learn3 = samples.map((sample) => sample.learn3).filter((value): value is number => value !== null);
  let blurb = "Driving, no wide-open pull";
  if (coolantMax !== null && coolantMax < 140 && Math.max(...samples.map((sample) => sample.speed)) < 1) {
    blurb = "Cold idle";
  } else if (pullCount > 0) blurb = "Driving with wide-open pulls";
  else if (boostMax < 2) blurb = "Driving, little or no boost";
  return {
    id: log.name,
    blurb,
    seconds: samples[samples.length - 1].t - samples[0].t,
    samples: samples.length,
    boostMax,
    coolantMin: minOf(samples.map((sample) => sample.coolant)),
    coolantMax,
    oilMax: maxOf(samples.map((sample) => sample.oil)),
    manifoldMax: maxOf(samples.map((sample) => sample.manifold)),
    learn1Median: learn1.length ? percentile(learn1, 50) : null,
    learn3Start: learn3.length ? learn3[0] : null,
    learn3End: learn3.length ? learn3[learn3.length - 1] : null,
    cruiseAfr: cruise.length ? percentile(cruise.map((sample) => sample.afr), 50) : null,
    map: log.map,
  };
}

function knockEvents(log: ParsedLog, turbo: boolean): KnockEvent[] {
  const hits = log.samples.filter((sample) => sample.fk !== 0);
  if (!hits.length) return [];
  const groups: RawSample[][] = [];
  let current: RawSample[] = [];
  for (const sample of hits) {
    if (!current.length || sample.t - current[current.length - 1].t < 0.3) current.push(sample);
    else {
      groups.push(current);
      current = [sample];
    }
  }
  if (current.length) groups.push(current);
  return groups.map((group) => {
    const underLoad = group.some((sample) =>
      turbo ? sample.boost >= 5 && sample.accel >= 80 : sample.accel >= 90 && sample.rpm >= 3500,
    );
    return {
      log: log.name,
      count: group.length,
      t0: group[0].t,
      t1: group[group.length - 1].t,
      seconds: group[group.length - 1].t - group[0].t,
      fk: Math.min(...group.map((sample) => sample.fk)),
      rpmMin: Math.min(...group.map((sample) => sample.rpm)),
      rpmMax: Math.max(...group.map((sample) => sample.rpm)),
      boostMin: Math.min(...group.map((sample) => sample.boost)),
      boostMax: Math.max(...group.map((sample) => sample.boost)),
      accel: percentile(group.map((sample) => sample.accel), 50),
      gear: group[0].gear,
      afr: percentile(group.map((sample) => sample.afr), 50),
      timing: percentile(group.map((sample) => sample.timing), 50),
      ks2Max: maxOf(group.map((sample) => sample.ks2)),
      underLoad,
    };
  });
}

export function analyze(logs: ParsedLog[]): Review {
  const warnings: string[] = [];
  const all = logs.flatMap((log) => log.samples.map((sample) => ({ log: log.name, sample })));
  const peakBoost = all.length ? Math.max(...all.map((row) => row.sample.boost)) : null;
  const turbo = (peakBoost ?? 0) >= 4;
  if (!logs.some((log) => log.samples.some((sample) => sample.afr > 0))) {
    warnings.push("No wideband AFR column was found. AFR charts will be empty.");
  }
  if (!logs.some((log) => log.samples.some((sample) => sample.load !== null || sample.maf !== null))) {
    warnings.push("No Calculated Load or mass-airflow column. Crank horsepower cannot be estimated from airflow.");
  }

  const onBoostRows = all.filter(({ sample }) =>
    turbo ? sample.accel >= 80 && sample.boost >= 10 && sample.afr > 0 : sample.accel >= 90 && sample.rpm >= 3000 && sample.afr > 8 && sample.afr < 16,
  );
  let onBoost: OnBoost | null = null;
  if (onBoostRows.length) {
    const afrs = onBoostRows.map((row) => row.sample.afr);
    const withCmd = onBoostRows.filter((row) => row.sample.cmd > 8);
    const deltas = withCmd.map((row) => row.sample.afr - row.sample.cmd);
    const leanestRow = onBoostRows.reduce((best, row) => (row.sample.afr > best.sample.afr ? row : best));
    onBoost = {
      samples: onBoostRows.length,
      afrMin: Math.min(...afrs),
      afrMax: Math.max(...afrs),
      afrMedian: percentile(afrs, 50),
      cmdMedian: withCmd.length ? percentile(withCmd.map((row) => row.sample.cmd), 50) : null,
      deltaMean: deltas.length ? mean(deltas) : null,
      deltaMax: deltas.length ? Math.max(...deltas) : null,
      deltaMin: deltas.length ? Math.min(...deltas) : null,
      above115: afrs.filter((afr) => afr > 11.5).length,
      above12: afrs.filter((afr) => afr > 12).length,
      leanest: {
        log: leanestRow.log,
        t: leanestRow.sample.t,
        afr: leanestRow.sample.afr,
        cmd: leanestRow.sample.cmd,
        rpm: leanestRow.sample.rpm,
        boost: leanestRow.sample.boost,
        gear: leanestRow.sample.gear,
      },
    };
  }

  const pulls: Pull[] = [];
  const logSummaries: LogSummary[] = [];
  for (const log of logs) {
    const groups = segments(log.samples);
    let count = 0;
    for (const group of groups) {
      const gears = new Set(group.map((sample) => sample.gear));
      if (gears.size !== 1) continue;
      const gear = group[0].gear;
      if (gear <= 0) continue;
      const rpmGain = group[group.length - 1].rpm - group[0].rpm;
      if (rpmGain < 400) continue;
      const loaded = turbo ? group.filter((sample) => sample.boost >= 8) : group.filter((sample) => sample.rpm >= 2500);
      if (loaded.length < 8) continue;
      const onTarget = turbo ? loaded.filter((sample) => sample.boost >= 10) : loaded;
      const afrSource = onTarget.length >= 8 ? onTarget : loaded;
      const afrs = afrSource.map((sample) => sample.afr).filter((afr) => afr > 8);
      if (!afrs.length) continue;
      const cmds = afrSource.map((sample) => sample.cmd).filter((cmd) => cmd > 8);
      const deltas = afrSource.filter((sample) => sample.afr > 8 && sample.cmd > 8).map((sample) => sample.afr - sample.cmd);
      const timing = (turbo ? loaded.filter((sample) => sample.boost >= 12) : loaded).map((sample) => sample.timing);
      const fp = afrSource.map((sample) => sample.fp).filter((value) => value > 200);
      count += 1;
      pulls.push({
        id: `${log.name}-g${gear}-t${Math.round(group[0].t)}`,
        log: log.name,
        gear,
        t0: group[0].t,
        t1: group[group.length - 1].t,
        rpm0: Math.round(group[0].rpm),
        rpm1: Math.round(group[group.length - 1].rpm),
        speed0: Math.round(group[0].speed),
        speed1: Math.round(group[group.length - 1].speed),
        boostMax: Math.max(...group.map((sample) => sample.boost)),
        afrMin: Math.min(...afrs),
        afrMax: Math.max(...afrs),
        afrMean: mean(afrs),
        cmdMean: cmds.length ? mean(cmds) : 0,
        deltaMin: deltas.length ? Math.min(...deltas) : 0,
        deltaMax: deltas.length ? Math.max(...deltas) : 0,
        deltaMean: deltas.length ? mean(deltas) : 0,
        timingMin: timing.length ? Math.min(...timing) : 0,
        timingMax: timing.length ? Math.max(...timing) : 0,
        fpMin: fp.length ? Math.min(...fp) : null,
        dutyMax: Math.max(...group.map((sample) => sample.duty)) || null,
        oil: maxOf(group.map((sample) => sample.oil)),
        manifold: maxOf(group.map((sample) => sample.manifold)),
        points: group.map(toPoint),
      });
    }
    logSummaries.push(summarizeLog(log, count));
  }

  const knocks = logs.flatMap((log) => knockEvents(log, turbo));
  const wotKnockEvents = knocks.filter((event) => event.underLoad).length;
  const knock = knocks.find((event) => event.underLoad) ?? knocks[0] ?? null;

  const dams = all.map((row) => row.sample.dam).filter((value): value is number => value !== null);
  const learn1 = all.map((row) => row.sample.learn1).filter((value): value is number => value !== null);
  const steps: LearningStep[] = [];
  let learningLog: string | null = null;
  let widest = 0;
  for (const log of logs) {
    let previous: number | null = null;
    const logSteps: LearningStep[] = [];
    for (const sample of log.samples) {
      if (sample.learn3 === null) continue;
      if (previous === null || Math.abs(sample.learn3 - previous) >= 0.4) {
        logSteps.push({ log: log.name, t: sample.t, value: sample.learn3 });
        previous = sample.learn3;
      }
    }
    if (logSteps.length >= 2) {
      const span = Math.abs(logSteps[logSteps.length - 1].value - logSteps[0].value);
      if (span >= widest) {
        widest = span;
        learningLog = log.name;
        steps.splice(0, steps.length, ...logSteps);
      }
    }
  }
  const learn3Values = all.map((row) => row.sample.learn3).filter((value): value is number => value !== null);
  const dts = all.slice(1, 80).map((row, index) => row.sample.t - all[index].sample.t).filter((dt) => dt > 0);
  const rough = maxOf(all.map((row) => row.sample.rough));
  const maps = [...new Set(logs.map((log) => log.map).filter((map): map is string => Boolean(map)))];

  let targetAtPeak: number | null = null;
  if (peakBoost !== null) {
    const atPeak = all.filter((row) => row.sample.boost >= peakBoost - 0.05);
    targetAtPeak = atPeak.length ? percentile(atPeak.map((row) => row.sample.tgt), 50) : null;
  }

  return {
    turbo,
    sampleHz: dts.length ? Math.round(1 / percentile(dts, 50)) : 0,
    maps,
    onBoost,
    damMin: dams.length ? Math.min(...dams) : null,
    damMax: dams.length ? Math.max(...dams) : null,
    wotKnockEvents,
    knock,
    roughMax: rough,
    peakBoost,
    targetAtPeak,
    learning1Median: learn1.length ? percentile(learn1, 50) : null,
    learning3Final: learn3Values.length ? learn3Values[learn3Values.length - 1] : null,
    learningSteps: steps,
    learningLog,
    logs: logSummaries,
    pulls,
    warnings,
    hasAir: logs.some((log) => log.samples.some((sample) => sample.load !== null || sample.maf !== null)),
    hasSpeed: logs.some((log) => log.samples.some((sample) => sample.speed > 1)),
  };
}
