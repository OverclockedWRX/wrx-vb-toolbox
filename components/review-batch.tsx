import { useState } from "react";
import { LogReview } from "@/components/log-review";
import { PullCharts, type Trace } from "@/components/pull-chart";
import { Refusal } from "@/components/refusal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gradeTone } from "@/lib/assess";
import type { SessionResult } from "@/lib/session";
import { gearLabel, type PowerSettings } from "@/lib/types";

const FILE_COLORS = ["#f0a202", "#7eb6c9", "#e07a5f", "#c6d36a", "#d4a574", "#c9a0dc"];
const COMPARE = "compare-pulls";

export type FileSession = {
  id: string;
  name: string;
  session: SessionResult;
};

export function ReviewBatch({
  files,
  settings,
  smoothing,
  onSmoothing,
}: {
  files: FileSession[];
  settings: PowerSettings;
  smoothing: number;
  onSmoothing: (value: number) => void;
}) {
  const [active, setActive] = useState(files[0]?.id ?? "");

  if (!files.length) return null;

  if (files.length === 1) {
    return <FilePanel item={files[0]} settings={settings} smoothing={smoothing} onSmoothing={onSmoothing} />;
  }

  return (
    <Tabs value={active} onValueChange={(value) => setActive(String(value))} className="relative z-0 gap-0">
      <div className="relative z-0 border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 pb-4 sm:px-6">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            {files.length} logs · one review per file
          </p>
          <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1 overflow-visible rounded-none bg-transparent p-0 pb-1">
            <TabsTrigger
              value={COMPARE}
              className="h-auto max-w-full flex-none gap-2 rounded-md border border-transparent px-3 py-2 data-active:border-border"
            >
              <span className="font-mono text-xs">Compare pulls</span>
            </TabsTrigger>
            {files.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="h-auto max-w-full flex-none gap-2 rounded-md border border-transparent px-3 py-2 data-active:border-border"
              >
                <span className="max-w-[14rem] truncate font-mono text-xs">{item.name}</span>
                <TabGrade session={item.session} />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>
      <TabsContent value={COMPARE} className="relative z-0 mt-0">
        <CrossFilePulls files={files} settings={settings} smoothing={smoothing} />
      </TabsContent>
      {files.map((item) => (
        <TabsContent key={item.id} value={item.id} className="relative z-0 mt-0">
          <FilePanel item={item} settings={settings} smoothing={smoothing} onSmoothing={onSmoothing} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CrossFilePulls({
  files,
  settings,
  smoothing,
}: {
  files: FileSession[];
  settings: PowerSettings;
  smoothing: number;
}) {
  const ready = files.flatMap((file) => (file.session.ok ? [{ name: file.name, session: file.session }] : []));
  const pulls = ready.flatMap((file, fileIndex) =>
    file.session.review.pulls.map((pull) => ({ pull, name: file.name, color: FILE_COLORS[fileIndex % FILE_COLORS.length] })),
  );
  const gears = [...new Set(pulls.map((item) => item.pull.gear))].sort((a, b) => a - b);
  const [gear, setGear] = useState(gears.includes(3) ? 3 : (gears[0] ?? 0));
  const inGear = pulls.filter((item) => item.pull.gear === gear);
  const traces: Trace[] = inGear.map((item) => ({
    id: `${item.name}-${item.pull.id}`,
    label: `${item.name} · ${gearLabel(item.pull.gear)}`,
    color: item.color,
    points: item.pull.points,
  }));
  const limits = ready[0]?.session.limits ?? null;
  const mixedOctane = new Set(ready.map((file) => file.session.limits.octane)).size > 1;

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Compare pulls</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Wide-open pulls from every loaded log, drawn on one chart for the gear you pick. Each color is one file. Peak HP on each file’s own tab is an airflow estimate, not a dyno.
        </p>
      </div>
      {gears.length ? (
        <div className="flex flex-wrap gap-2">
          {gears.map((item) => (
            <Button key={item} size="sm" variant={item === gear ? "default" : "outline"} onClick={() => setGear(item)}>
              {gearLabel(item)} gear
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">None of these logs has a wide-open pull to overlay.</p>
      )}
      {ready.length ? (
        <ul className="flex flex-wrap gap-3 text-xs">
          {ready.map((file, index) => (
            <li key={file.name} className="flex items-center gap-2 font-mono">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FILE_COLORS[index % FILE_COLORS.length] }} />
              {file.name}
            </li>
          ))}
        </ul>
      ) : null}
      {traces.length && limits ? (
        <PullCharts
          traces={traces}
          showCommand={false}
          boostPoints={null}
          settings={settings}
          smoothing={smoothing}
          turbo={ready.some((file) => file.session.review.turbo)}
          band={{
            min: limits.preferredMin,
            max: limits.preferredMax,
            label: mixedOctane
              ? "Files name more than one octane. The band is from the first log."
              : `${limits.octane} octane · ${limits.preferredMin.toFixed(2)}–${limits.preferredMax.toFixed(2)}`,
          }}
        />
      ) : null}
    </section>
  );
}

function FilePanel({
  item,
  settings,
  smoothing,
  onSmoothing,
}: {
  item: FileSession;
  settings: PowerSettings;
  smoothing: number;
  onSmoothing: (value: number) => void;
}) {
  if (item.session.ok) {
    return <LogReview session={item.session} settings={settings} smoothing={smoothing} onSmoothing={onSmoothing} />;
  }
  return <Refusal session={item.session} />;
}

function TabGrade({ session }: { session: SessionResult }) {
  if (!session.ok) {
    return (
      <span className="rounded border border-red-500/60 bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-red-800 uppercase dark:text-red-100">
        Stop
      </span>
    );
  }
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${gradeTone(session.grade.letter)}`}>
      {session.grade.letter}
    </span>
  );
}
