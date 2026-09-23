import { requirementList } from "@/lib/columns";
import type { SessionRefusal } from "@/lib/session";

export function Refusal({ session }: { session: SessionRefusal }) {
  const files = [...new Set(session.missing.map((item) => item.file))];
  const required = requirementList();
  const missingLabels = new Set(session.missing.map((item) => item.label));

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="max-w-3xl space-y-3">
        <p className="font-mono text-xs tracking-[0.16em] text-destructive uppercase">Review stopped</p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{session.title}</h2>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">{session.lead}</p>
        {session.tuneSummary ? <p className="text-sm leading-6">Header read: {session.tuneSummary}</p> : null}
      </div>

      {session.needsOctane ? (
        <div className="rounded-xl border border-border bg-card px-4 py-4 text-sm leading-6">
          Set <span className="font-medium">Fuel octane</span> to 87, 89, 91, 92, or 93, then start the review again. The safe AFR window is different at each octane, and it also moves with the boost target in the tune name.
        </div>
      ) : null}

      {session.blockers.length ? (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight">Why these files were rejected</h3>
          <ul className="flex flex-col gap-2">
            {session.blockers.map((blocker) => (
              <li key={`${blocker.file}-${blocker.detail}`} className="rounded-lg border border-border px-3 py-2 text-sm leading-6">
                <span className="font-mono text-xs">{blocker.file}</span>
                <span className="mt-1 block">{blocker.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {files.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border">
            <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">Required for a review</h3>
            <ul className="flex flex-col">
              {required.map((column) => {
                const absent = missingLabels.has(column.label);
                return (
                  <li key={column.label} className="border-b border-border/70 px-4 py-3 text-sm leading-6 last:border-0">
                    <span className={absent ? "font-medium text-destructive" : "font-medium"}>{column.label}</span>
                    {absent ? <span className="ml-2 font-mono text-[10px] tracking-wide text-destructive uppercase">Missing</span> : null}
                    <span className="mt-0.5 block text-muted-foreground">{column.why}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rounded-xl border border-destructive/40">
            <h3 className="border-b border-destructive/30 px-4 py-3 text-sm font-semibold">Missing from these logs</h3>
            <div className="flex flex-col">
              {files.map((file) => (
                <div key={file} className="border-b border-border/70 last:border-0">
                  <p className="px-4 pt-3 font-mono text-xs">{file}</p>
                  <ul className="px-4 pt-1 pb-3">
                    {session.missing
                      .filter((item) => item.file === file)
                      .map((item) => (
                        <li key={`${file}-${item.label}`} className="py-1.5 text-sm leading-6">
                          <span className="font-medium text-destructive">{item.label}</span>
                          {blankNote(item.why) ? <span className="mt-0.5 block text-muted-foreground">{item.why}</span> : null}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function blankNote(why: string) {
  return why.startsWith("The column is present");
}
