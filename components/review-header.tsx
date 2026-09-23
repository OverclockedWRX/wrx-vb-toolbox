import { gradeTone, healthBorder, type Health } from "@/lib/assess";
import type { SessionReview } from "@/lib/session";
import { tuneTitle } from "@/lib/tune";
import { DISCLAIMER_TEXT } from "@/components/disclaimer-gate";

export function ReviewHeader({ session }: { session: SessionReview }) {
  const tune = session.tunes[0];
  const names = [...new Set(session.tunes.map((item) => tuneTitle(item)))];
  const tuners = [...new Set(session.tunes.map((item) => item.tuner).filter((value): value is string => Boolean(value)))];
  const vehicle = tune?.vehicle ?? "2022–2026 WRX";
  const year = tune?.year;
  const health = session.grade.health;
  const overall: Health = session.grade.letter === "F" ? "bad" : session.grade.letter === "B" ? "warn" : "good";

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl border-2 border-amber-500/70 bg-amber-500/15 px-4 py-4 text-base leading-7 font-medium text-amber-950 dark:text-amber-50">
        {DISCLAIMER_TEXT}
      </p>
      {session.sampleData ? (
        <p className="rounded-xl border border-border bg-accent px-4 py-3 text-sm font-medium">
          Sample data. These logs are made up. They are not from a real car or a real tune.
        </p>
      ) : null}
      <section className={`rounded-xl border-2 px-4 py-4 sm:px-5 ${healthBorder("good")}`}>
        <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">Tune loaded</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{names.join(" · ")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {year && !vehicle.includes(String(year)) ? `${year} ` : ""}
          {vehicle}
          {tune?.accessport ? ` · ${tune.accessport}` : ""}
        </p>
        {tuners.length ? (
          <p className="mt-3 text-sm leading-6">
            <span className="font-medium">Likely tuner: {tuners.join(", ")}.</span>{" "}
            <span className="text-muted-foreground">
              That name was read from the Accessport log header. Confirm it with the map file or your tuner before you treat it as fact.
            </span>
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            No known tuner name was found in the log header. The map string above still comes from the Accessport header, so verify it against the file on your Accessport.
          </p>
        )}
        <p className="mt-3 text-sm leading-6">
          Preferred wide-open AFR for {session.limits.octane} octane at {session.limits.boostPsi.toFixed(0)} psi is{" "}
          <span className="font-mono">
            {session.limits.preferredMin.toFixed(2)}–{session.limits.preferredMax.toFixed(2)}
          </span>
          . Stop the pull if it goes leaner than <span className="font-mono">{session.limits.absoluteMax.toFixed(2)}</span> or richer than{" "}
          <span className="font-mono">{session.limits.absoluteMin.toFixed(2)}</span>.
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{session.windowNote}</p>
      </section>

      {session.alerts.length ? (
        <section className={`rounded-xl border-2 px-4 py-4 sm:px-5 ${healthBorder("bad")}`}>
          <h2 className="font-mono text-xs tracking-[0.16em] text-red-700 uppercase dark:text-red-300">Alert</h2>
          <ul className="mt-3 flex flex-col gap-4">
            {session.alerts.map((alert) => (
              <li key={alert.title} className="space-y-1">
                <p className="font-medium">{alert.title}</p>
                <p className="text-sm leading-6">{alert.problem}</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">What to do. </span>
                  {alert.remedy}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`rounded-xl border-2 px-4 py-4 sm:px-5 ${healthBorder(overall)}`}>
        {session.headgaskets ? (
          <p className="mb-3 text-xl font-bold tracking-tight text-red-700 dark:text-red-300 sm:text-2xl">HEADGASKETS HAVE LEFT THE CHAT!</p>
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div
            className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 font-mono ${gradeTone(session.grade.letter)}`}
            aria-label={`${session.grade.letter} tier, score ${session.grade.score} out of 100`}
          >
            <span className="text-4xl font-semibold">{session.grade.letter}</span>
            <span className="text-[10px] tracking-wide uppercase opacity-80">{session.grade.score}/100</span>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                {session.grade.letter} tier
              </p>
              <p className="mt-1 text-sm leading-6 font-medium">{session.grade.blurb}</p>
              <p className="mt-2 text-sm leading-6">{session.grade.summary}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">What the review noticed</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-6">
                  {session.grade.noticed.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">What should change</p>
                {session.grade.changes.length ? (
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-6">
                    {session.grade.changes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Nothing required from this log. Keep an eye on it after hardware or fuel changes.</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <HealthChip label="AFR" health={health.afr} />
              <HealthChip label="Knock" health={health.knock} />
              <HealthChip label="Trims" health={health.trims} />
              <HealthChip label="Boost" health={health.boost} />
              <HealthChip label="Delivery" health={health.delivery} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HealthChip({ label, health }: { label: string; health: Health }) {
  const tone =
    health === "good"
      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100"
      : health === "warn"
        ? "border-amber-400/80 bg-amber-400/15 text-amber-950 dark:text-amber-50"
        : "border-red-500/70 bg-red-500/15 text-red-800 dark:text-red-100";
  return <span className={`rounded-md border px-2 py-1 font-mono text-[10px] tracking-wide uppercase ${tone}`}>{label}</span>;
}
