import { useMemo, useState } from "react";
import { TireCompareGraphic } from "@/components/tire-compare-graphic";
import {
  compareSetup,
  parseTireSize,
  type CompareResult,
  type FitmentLevel,
} from "@/lib/wheel-math";
import {
  CENTER_BORE_MM,
  COMMON_TIRE_SIZES,
  LUG_THREAD,
  PCD,
  STOCK_PACKAGES,
  formatTire,
  formatWheel,
  resolveStockPackage,
  type StockPackage,
  type TireSpec,
  type WheelSpec,
} from "@/lib/stock-wheels";

type Props = {
  presetYear: number | null;
  presetTrim: string | null;
  vinYear: number | null;
  vinTrim: string | null;
};

type Draft = {
  tireText: string;
  widthIn: string;
  diameterIn: string;
  offsetMm: string;
  tireWidth: string;
  aspect: string;
  rimIn: string;
};

function packageToDraft(pkg: StockPackage): Draft {
  return {
    tireText: formatTire(pkg.tire),
    widthIn: String(pkg.wheel.widthIn),
    diameterIn: String(pkg.wheel.diameterIn),
    offsetMm: String(pkg.wheel.offsetMm),
    tireWidth: String(pkg.tire.widthMm),
    aspect: String(pkg.tire.aspect),
    rimIn: String(pkg.tire.rimIn),
  };
}

function draftToTire(draft: Draft): TireSpec | null {
  const fromText = parseTireSize(draft.tireText);
  if (fromText) return fromText;
  const widthMm = Number(draft.tireWidth);
  const aspect = Number(draft.aspect);
  const rimIn = Number(draft.rimIn);
  if (![widthMm, aspect, rimIn].every((n) => Number.isFinite(n) && n > 0)) return null;
  return { widthMm, aspect, rimIn };
}

function draftToWheel(draft: Draft): WheelSpec | null {
  const widthIn = Number(draft.widthIn);
  const diameterIn = Number(draft.diameterIn);
  const offsetMm = Number(draft.offsetMm);
  if (![widthIn, diameterIn, offsetMm].every((n) => Number.isFinite(n))) return null;
  if (widthIn <= 0 || diameterIn <= 0) return null;
  return { widthIn, diameterIn, offsetMm };
}

function syncTireText(draft: Draft): Draft {
  const widthMm = Number(draft.tireWidth);
  const aspect = Number(draft.aspect);
  const rimIn = Number(draft.rimIn);
  if (![widthMm, aspect, rimIn].every((n) => Number.isFinite(n) && n > 0)) return draft;
  return { ...draft, tireText: formatTire({ widthMm, aspect, rimIn }) };
}

function applyTireText(draft: Draft, text: string): Draft {
  const parsed = parseTireSize(text);
  if (!parsed) return { ...draft, tireText: text };
  return {
    ...draft,
    tireText: text,
    tireWidth: String(parsed.widthMm),
    aspect: String(parsed.aspect),
    rimIn: String(parsed.rimIn),
    diameterIn: String(parsed.rimIn),
  };
}

export function WheelTireCalculator({ presetYear, presetTrim, vinYear, vinTrim }: Props) {
  const autoPackage = useMemo(() => {
    const fromVin = resolveStockPackage(vinYear, vinTrim);
    if (fromVin && (vinYear || vinTrim)) {
      return {
        pkg: fromVin,
        sourceLabel: [vinYear, vinTrim].filter(Boolean).join(" ") || "VIN",
        kind: "vin" as const,
      };
    }
    const fromPreset = resolveStockPackage(presetYear, presetTrim);
    if (fromPreset && (presetYear || presetTrim)) {
      return {
        pkg: fromPreset,
        sourceLabel: [presetYear, presetTrim].filter(Boolean).join(" ") || "Car preset",
        kind: "preset" as const,
      };
    }
    return {
      pkg: STOCK_PACKAGES.premium18,
      sourceLabel: "Default · Premium / Limited / GT 18″",
      kind: "default" as const,
    };
  }, [presetTrim, presetYear, vinTrim, vinYear]);

  const [manualStock, setManualStock] = useState<Draft | null>(null);
  const [manualPackageId, setManualPackageId] = useState<string | null>(null);
  const [proposed, setProposed] = useState<Draft>(() => packageToDraft(STOCK_PACKAGES.premium18));

  const stock = manualStock ?? packageToDraft(autoPackage.pkg);
  const activePackageId = manualPackageId ?? autoPackage.pkg.id;
  const usingAuto = manualStock === null;

  const stockTire = draftToTire(stock);
  const stockWheel = draftToWheel(stock);
  const proposedTire = draftToTire(proposed);
  const proposedWheel = draftToWheel(proposed);

  const comparison: CompareResult | null =
    stockTire && stockWheel && proposedTire && proposedWheel
      ? compareSetup(stockTire, stockWheel, proposedTire, proposedWheel)
      : null;

  function useAutoStock() {
    setManualStock(null);
    setManualPackageId(null);
  }

  function loadPackage(id: string) {
    const pkg = Object.values(STOCK_PACKAGES).find((item) => item.id === id);
    if (!pkg) return;
    setManualPackageId(id);
    setManualStock(packageToDraft(pkg));
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background/60 px-4 py-4">
      <div>
        <p className="text-sm font-medium">Wheel / tire offset calculator</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Compare a proposed wheel and tire to stock. Stock size comes from the VIN decoder or the car
          preset above when available. Every number can also be typed by hand. Bolt pattern {PCD}, center
          bore {CENTER_BORE_MM} mm, lug thread {LUG_THREAD}.
        </p>
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-950 dark:text-amber-100">
          Sizes that fit are for <strong className="font-semibold">stock ride height only</strong>. Lowered
          cars are not considered.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Stock reference:</span>
        <button type="button" className={chipClass(usingAuto)} onClick={useAutoStock}>
          Auto ({autoPackage.kind === "vin" ? "VIN · " : autoPackage.kind === "preset" ? "Preset · " : ""}
          {autoPackage.sourceLabel})
        </button>
        {Object.values(STOCK_PACKAGES).map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            className={chipClass(!usingAuto && activePackageId === pkg.id)}
            onClick={() => loadPackage(pkg.id)}
          >
            {pkg.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{autoPackage.pkg.note}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <SetupCard
          title="Stock"
          draft={stock}
          onChange={(next) => {
            setManualStock(next);
            setManualPackageId(null);
          }}
        />
        <SetupCard
          title="Proposed"
          draft={proposed}
          onChange={setProposed}
          onCopyStock={
            stockTire && stockWheel
              ? () =>
                  setProposed(
                    packageToDraft({
                      id: "copy",
                      label: "copy",
                      tire: stockTire,
                      wheel: stockWheel,
                      note: "",
                    }),
                  )
              : undefined
          }
        />
      </div>

      {comparison ? (
        <div className="space-y-3">
          <TireCompareGraphic
            stockTire={stockTire!}
            stockWheel={stockWheel!}
            proposedTire={proposedTire!}
            proposedWheel={proposedWheel!}
          />
          <Results
            comparison={comparison}
            stockTire={stockTire!}
            stockWheel={stockWheel!}
            proposedTire={proposedTire!}
            proposedWheel={proposedWheel!}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter a full tire size and wheel width / diameter / offset on both sides to compare.
        </p>
      )}
    </div>
  );
}

function SetupCard({
  title,
  draft,
  onChange,
  onCopyStock,
}: {
  title: string;
  draft: Draft;
  onChange: (next: Draft) => void;
  onCopyStock?: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {onCopyStock ? (
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={onCopyStock}>
            Copy stock → proposed
          </button>
        ) : null}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm">Tire size (list)</span>
        <select
          value={dropdownValue(draft.tireText)}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return;
            onChange(applyTireText(draft, value));
          }}
          className={fieldClass}
        >
          {!COMMON_TIRE_SIZES.some((item) => item.size === normalizeTireKey(draft.tireText)) ? (
            <option value="">Custom — {draft.tireText || "type below"}</option>
          ) : null}
          {COMMON_TIRE_SIZES.map((item) => (
            <option key={item.size} value={item.size}>
              {item.size} · {item.note}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">Pick a common WRX size, or type any size below.</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">Tire size (manual)</span>
        <input
          value={draft.tireText}
          placeholder="245/40R18"
          spellCheck={false}
          onChange={(event) => onChange(applyTireText(draft, event.target.value))}
          className={fieldClass}
        />
        <span className="text-xs text-muted-foreground">Type a size like 245/40R18, or edit the numbers below.</span>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <NumField
          label="Width mm"
          value={draft.tireWidth}
          onChange={(value) => onChange(syncTireText({ ...draft, tireWidth: value }))}
        />
        <NumField
          label="Aspect %"
          value={draft.aspect}
          onChange={(value) => onChange(syncTireText({ ...draft, aspect: value }))}
        />
        <NumField
          label="Rim ″"
          value={draft.rimIn}
          onChange={(value) =>
            onChange(
              syncTireText({
                ...draft,
                rimIn: value,
                diameterIn: value || draft.diameterIn,
              }),
            )
          }
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <NumField label="Wheel width ″" value={draft.widthIn} onChange={(value) => onChange({ ...draft, widthIn: value })} step="0.5" />
        <NumField label="Wheel dia ″" value={draft.diameterIn} onChange={(value) => onChange({ ...draft, diameterIn: value })} />
        <NumField label="Offset ET mm" value={draft.offsetMm} onChange={(value) => onChange({ ...draft, offsetMm: value })} />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}

function Results({
  comparison,
  stockTire,
  stockWheel,
  proposedTire,
  proposedWheel,
}: {
  comparison: CompareResult;
  stockTire: TireSpec;
  stockWheel: WheelSpec;
  proposedTire: TireSpec;
  proposedWheel: WheelSpec;
}) {
  const { fitment } = comparison;
  return (
    <div className="space-y-3">
      <div className={`rounded-lg border px-3 py-2 text-sm ${toneBox(fitment.overall)}`}>
        <p className="font-medium">{overallLabel(fitment.overall)}</p>
        <p className="mt-1 text-xs leading-5 opacity-90">{fitment.disclaimer}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Measure</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Proposed</th>
              <th className="px-3 py-2 font-medium">Delta</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Tire" stock={formatTire(stockTire)} proposed={formatTire(proposedTire)} delta="—" />
            <Row label="Wheel" stock={formatWheel(stockWheel)} proposed={formatWheel(proposedWheel)} delta="—" />
            <Row
              label="Overall diameter"
              stock={`${(comparison.stockDiameterMm / 25.4).toFixed(2)}″ (${comparison.stockDiameterMm.toFixed(0)} mm)`}
              proposed={`${(comparison.proposedDiameterMm / 25.4).toFixed(2)}″ (${comparison.proposedDiameterMm.toFixed(0)} mm)`}
              delta={`${signed(comparison.diameterDeltaMm, 0)} mm · ${signed(comparison.diameterDeltaPct, 2)}%`}
            />
            <Row
              label="Sidewall"
              stock={`${comparison.stockSidewallMm.toFixed(0)} mm`}
              proposed={`${comparison.proposedSidewallMm.toFixed(0)} mm`}
              delta={`${signed(comparison.sidewallDeltaMm, 0)} mm`}
            />
            <Row
              label="Outer lip (poke)"
              stock={`${comparison.stockOuterMm.toFixed(1)} mm from hub`}
              proposed={`${comparison.proposedOuterMm.toFixed(1)} mm from hub`}
              delta={`${signed(comparison.pokeDeltaMm, 1)} mm (${comparison.pokeDeltaMm > 0 ? "more poke" : comparison.pokeDeltaMm < 0 ? "more inset" : "same"})`}
            />
            <Row
              label="Inner lip"
              stock={`${comparison.stockInnerMm.toFixed(1)} mm from hub`}
              proposed={`${comparison.proposedInnerMm.toFixed(1)} mm from hub`}
              delta={`${signed(comparison.innerDeltaMm, 1)} mm (${comparison.innerDeltaMm > 0 ? "closer to suspension" : comparison.innerDeltaMm < 0 ? "more clearance inside" : "same"})`}
            />
            <Row
              label="Speedo at 60 mph true"
              stock="60.0 mph"
              proposed={`${comparison.speedAt60.toFixed(1)} mph indicated`}
              delta={comparison.speedAt60 === 60 ? "—" : `${signed(comparison.speedAt60 - 60, 1)} mph`}
            />
          </tbody>
        </table>
      </div>

      <ul className="space-y-2">
        {fitment.checks.map((check) => (
          <li key={check.title} className={`rounded-md border px-3 py-2 text-sm ${toneBox(check.level)}`}>
            <p className="font-medium">
              {check.title} · {levelWord(check.level)}
            </p>
            <p className="mt-0.5 text-xs leading-5 opacity-90">{check.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, stock, proposed, delta }: { label: string; stock: string; proposed: string; delta: string }) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-3 py-2 align-top text-muted-foreground">{label}</td>
      <td className="px-3 py-2 align-top font-mono text-xs sm:text-sm">{stock}</td>
      <td className="px-3 py-2 align-top font-mono text-xs sm:text-sm">{proposed}</td>
      <td className="px-3 py-2 align-top font-mono text-xs sm:text-sm">{delta}</td>
    </tr>
  );
}

function signed(value: number, digits: number) {
  const text = value.toFixed(digits);
  return value > 0 ? `+${text}` : text;
}

function levelWord(level: FitmentLevel) {
  if (level === "ok") return "looks fine at stock height";
  if (level === "caution") return "caution at stock height";
  return "outside usual stock-height range";
}

function overallLabel(level: FitmentLevel) {
  if (level === "ok") return "Within common stock-height fitment";
  if (level === "caution") return "Usable with caveats at stock height";
  return "Outside usual stock-height fitment";
}

function toneBox(level: FitmentLevel) {
  if (level === "ok") return "border-emerald-500/40 bg-emerald-500/10";
  if (level === "caution") return "border-amber-500/40 bg-amber-500/10";
  return "border-destructive/40 bg-destructive/10";
}

function chipClass(active: boolean) {
  return `rounded-md border px-2.5 py-1 ${active ? "border-foreground bg-accent" : "border-border bg-background hover:bg-accent/60"}`;
}

const fieldClass = "h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-sm";

function normalizeTireKey(raw: string) {
  return parseTireSize(raw)?.raw.replace(/^P/, "").replace("ZR", "R") ?? raw.trim().toUpperCase();
}

function dropdownValue(tireText: string) {
  const key = normalizeTireKey(tireText);
  const match = COMMON_TIRE_SIZES.find((item) => item.size === key || item.size === tireText.trim().toUpperCase());
  return match?.size ?? "";
}
