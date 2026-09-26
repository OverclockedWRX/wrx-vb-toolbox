import { useId, useMemo, useState } from "react";
import { lookupObd, originLabel, originNote } from "@/lib/obd-codes";

export function ObdLookup() {
  const inputId = useId();
  const [raw, setRaw] = useState("");
  const [open, setOpen] = useState(false);
  const result = useMemo(() => lookupObd(raw), [raw]);
  const hasCode = result.status !== "empty";
  const detailsOpen = hasCode && open;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/60 px-4 py-4">
      <div>
        <p className="text-sm font-medium">OBD2 code lookup</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Type a code from a scanner or the dash, such as P0301. Codes marked Subaru were named in a 2022 WRX service
          bulletin or in Subaru direct-injection documentation. Published WRX lists found online cover 2022–2024. A
          separate 2025–2026 catalog was not available, and the FA24 engine family is the same. Every other match uses
          generic SAE wording, which may not match Subaru’s own phrase.
        </p>
      </div>
      <label className="flex flex-col gap-1" htmlFor={inputId}>
        <span className="text-sm">Code</span>
        <input
          id={inputId}
          value={raw}
          maxLength={8}
          spellCheck={false}
          autoComplete="off"
          placeholder="e.g. P0301"
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setRaw(next);
            if (lookupObd(next).status !== "empty") setOpen(true);
            else setOpen(false);
          }}
          className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-sm tracking-wide uppercase"
        />
        <span className="text-xs text-muted-foreground">Powertrain, chassis, body, and network codes. The P is optional.</span>
      </label>

      <details
        className="rounded-lg border border-border bg-card/40"
        open={detailsOpen}
        onToggle={(event) => {
          const next = (event.currentTarget as HTMLDetailsElement).open;
          if (!hasCode) {
            event.currentTarget.open = false;
            setOpen(false);
            return;
          }
          setOpen(next);
        }}
      >
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
          Code details
          {result.status === "known" ? (
            <span className="ml-2 font-normal text-muted-foreground">· {result.entry.code}</span>
          ) : null}
          {result.status === "unknown" ? (
            <span className="ml-2 font-normal text-muted-foreground">· {result.code}</span>
          ) : null}
        </summary>
        <div className="border-t border-border px-3 py-3">
          {result.status === "empty" ? (
            <p className="text-sm text-muted-foreground">Enter a code to expand this table.</p>
          ) : result.status === "invalid" ? (
            <p className="text-sm text-destructive">
              {result.raw} is not a 5-character OBD-II code. Use a letter P, C, B, or U, then four characters, such as P0420.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {result.status === "known" ? (
                    <>
                      <Row label="Code" value={result.entry.code} mono />
                      <Row label="Meaning" value={result.entry.meaning} />
                      <Row label="Source" value={originLabel(result.entry.origin)} />
                      <Row label="Note" value={originNote(result.entry.origin)} />
                    </>
                  ) : (
                    <>
                      <Row label="Code" value={result.code} mono />
                      <Row label="Meaning" value="No stored definition." />
                      <Row label="Source" value="Not in this list" />
                      <Row label="Note" value={result.family} />
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-3 py-2 align-top text-muted-foreground">{label}</td>
      <td className={`px-3 py-2 align-top ${mono ? "font-mono text-xs sm:text-sm" : ""}`}>{value}</td>
    </tr>
  );
}
