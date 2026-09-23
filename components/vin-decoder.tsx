import { useEffect, useId, useState } from "react";
import { decodeVin, normalizeVin, type VinDecodeResult } from "@/lib/vin";

export type VinVehicleHint = {
  year: number | null;
  trim: string | null;
  summary: string | null;
};

function hintFromResult(result: VinDecodeResult | null): VinVehicleHint | null {
  if (!result || !result.fields.length) return null;
  const yearRaw = result.fields.find((field) => field.key === "ModelYear")?.value;
  const year = yearRaw ? Number(yearRaw) : null;
  const trim = result.fields.find((field) => field.key === "Trim" || field.key === "Trim2")?.value ?? null;
  return {
    year: year !== null && Number.isFinite(year) ? year : null,
    trim,
    summary: result.summary,
  };
}

export function VinDecoder({ onVehicleHint }: { onVehicleHint?: (hint: VinVehicleHint | null) => void }) {
  const inputId = useId();
  const [raw, setRaw] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VinDecodeResult | null>(null);
  const cleaned = normalizeVin(raw);
  const hasVin = cleaned.length > 0;

  useEffect(() => {
    if (!cleaned) {
      onVehicleHint?.(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      void decodeVin(cleaned).then((decoded) => {
        if (cancelled) return;
        setResult(decoded);
        setBusy(false);
        setOpen(true);
        onVehicleHint?.(hintFromResult(decoded));
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cleaned, onVehicleHint]);

  const activeResult = hasVin ? result : null;
  const detailsOpen = hasVin && open;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/60 px-4 py-4">
      <div>
        <p className="text-sm font-medium">VIN decoder</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Optional. Paste a 17-character VIN to decode make, model, year, trim, plant, and other details. Uses the NHTSA vPIC database when online, with a local structural fallback offline.
        </p>
      </div>
      <label className="flex flex-col gap-1" htmlFor={inputId}>
        <span className="text-sm">VIN</span>
        <input
          id={inputId}
          value={raw}
          maxLength={20}
          spellCheck={false}
          autoComplete="off"
          placeholder="e.g. JF1VBAL69N9801234"
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setRaw(next);
            if (!normalizeVin(next)) {
              setResult(null);
              setBusy(false);
              setOpen(false);
              onVehicleHint?.(null);
            }
          }}
          className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-sm tracking-wide uppercase"
        />
        <span className="text-xs text-muted-foreground">Letters I, O, and Q are never used in a VIN.</span>
      </label>

      <details
        className="rounded-lg border border-border bg-card/40"
        open={detailsOpen}
        onToggle={(event) => {
          const next = (event.currentTarget as HTMLDetailsElement).open;
          if (!hasVin) {
            event.currentTarget.open = false;
            setOpen(false);
            return;
          }
          setOpen(next);
        }}
      >
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
          VIN decode details
          {activeResult?.summary ? <span className="ml-2 font-normal text-muted-foreground">· {activeResult.summary}</span> : null}
          {hasVin && busy ? <span className="ml-2 font-normal text-muted-foreground">· Decoding…</span> : null}
        </summary>
        <div className="border-t border-border px-3 py-3">
          {!hasVin ? (
            <p className="text-sm text-muted-foreground">Enter a VIN to expand this table.</p>
          ) : busy && !activeResult ? (
            <p className="text-sm text-muted-foreground">Decoding VIN…</p>
          ) : activeResult?.error && !activeResult.fields.length ? (
            <p className="text-sm text-destructive">{activeResult.error}</p>
          ) : activeResult?.fields.length ? (
            <div className="space-y-3">
              {activeResult.error ? <p className="text-sm text-amber-800 dark:text-amber-200">{activeResult.error}</p> : null}
              <p className="text-xs text-muted-foreground">
                Source: {activeResult.source === "nhtsa" ? "NHTSA vPIC" : activeResult.source === "local" ? "local VIN structure" : "none"}
                {activeResult.checkDigitOk ? " · check digit valid" : " · check digit mismatch"}
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeResult.fields.map((field) => (
                      <tr key={field.key} className="border-b border-border/70 last:border-0">
                        <td className="px-3 py-2 align-top text-muted-foreground">{field.label}</td>
                        <td className="px-3 py-2 align-top font-mono text-xs sm:text-sm">{field.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not decode this VIN.</p>
          )}
        </div>
      </details>
    </div>
  );
}
