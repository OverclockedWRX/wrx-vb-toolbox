import { useState } from "react";
import { LogReview } from "@/components/log-review";
import { Refusal } from "@/components/refusal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gradeTone } from "@/lib/assess";
import type { SessionResult } from "@/lib/session";
import type { PowerSettings } from "@/lib/types";

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
      {files.map((item) => (
        <TabsContent key={item.id} value={item.id} className="relative z-0 mt-0">
          <FilePanel item={item} settings={settings} smoothing={smoothing} onSmoothing={onSmoothing} />
        </TabsContent>
      ))}
    </Tabs>
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
