import { useCallback, useRef, useState, type ReactNode } from "react";
import { DisclaimerGate } from "@/components/disclaimer-gate";
import { ReviewBatch, type FileSession } from "@/components/review-batch";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VinDecoder, type VinVehicleHint } from "@/components/vin-decoder";
import { WheelTireCalculator } from "@/components/wheel-tire-calculator";
import { requirementList } from "@/lib/columns";
import { EMBEDDED_SAMPLES } from "@/lib/embedded-samples";
import { OCTANES, type Octane } from "@/lib/limits";
import { parseLog } from "@/lib/parse-log";
import { SAMPLE_PACKS, type SamplePack } from "@/lib/sample-packs";
import { buildFileSessions, type FuelChoice } from "@/lib/session";
import {
  applyCarPreset,
  DRIVER_LB,
  findPreset,
  MARKETS,
  presetLabel,
  presetsFor,
  yearsForMarket,
  type Market,
} from "@/lib/car-presets";
import { defaultSettings, type PowerSettings } from "@/lib/types";
import { APP_NAME, APP_VERSION } from "@/lib/version";

type MainTab = "logs" | "tires";

export function Dashboard() {
  const [mainTab, setMainTab] = useState<MainTab>("logs");
  const [files, setFiles] = useState<File[]>([]);
  const [settings, setSettings] = useState<PowerSettings>(defaultSettings);
  const [weightText, setWeightText] = useState("");
  const [smoothing, setSmoothing] = useState(5);
  const [reviews, setReviews] = useState<FileSession[] | null>(null);
  const [fuel, setFuel] = useState<FuelChoice>("tune");
  const [reviewId, setReviewId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const [market, setMarket] = useState<Market | "">("");
  const [carYear, setCarYear] = useState<number | "">("");
  const [carId, setCarId] = useState("");
  const [vinHint, setVinHint] = useState<VinVehicleHint | null>(null);
  const lastPack = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const selectedCar = findPreset(carId || null);
  const yearOptions = market ? yearsForMarket(market) : [];
  const trimOptions = market && carYear !== "" ? presetsFor(market, carYear) : [];
  const onVinHint = useCallback((hint: VinVehicleHint | null) => setVinHint(hint), []);

  function loadCarPreset(id: string) {
    setCarId(id);
    const car = findPreset(id);
    if (!car) return;
    const applied = applyCarPreset(car, settings);
    setSettings(applied.settings);
    setWeightText(String(applied.weightWithDriverLb));
  }

  function addFiles(list: FileList | File[]) {
    const incoming = [...list].filter((file) => file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv") || file.type === "");
    setFiles((current) => {
      const keys = new Set(current.map(fileKey));
      return [...current, ...incoming.filter((file) => !keys.has(fileKey(file)))];
    });
    setSampleNote(null);
    setError(null);
  }

  async function loadSamples() {
    setBusy(true);
    setError(null);
    const choices = SAMPLE_PACKS.filter((pack) => pack.id !== lastPack.current);
    const pack = choices[Math.floor(Math.random() * choices.length)] as SamplePack;
    lastPack.current = pack.id;
    try {
      const loaded = pack.files.map((name) => {
        const text = EMBEDDED_SAMPLES[name];
        if (!text) throw new Error(`Sample file ${name} is not bundled.`);
        return new File([text], name, { type: "text/csv" });
      });
      setFiles(loaded);
      setSampleNote(`${pack.label}. ${pack.detail}`);
      setReviews(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the sample logs.");
    } finally {
      setBusy(false);
    }
  }

  async function startReview() {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const parsed = [];
    for (const file of files) {
      try {
        const text = new TextDecoder("windows-1252").decode(await file.arrayBuffer());
        parsed.push(parseLog(file.name, text));
      } catch (cause) {
        parsed.push(parseLog(file.name, ""));
        const failed = parsed[parsed.length - 1];
        failed.parseError = cause instanceof Error ? cause.message : `${file.name} could not be read.`;
      }
    }
    const weight = weightText.trim() === "" ? null : Number(weightText);
    if (weight !== null && !Number.isFinite(weight)) {
      setError("Vehicle weight needs to be a number in pounds, or left blank.");
      setBusy(false);
      return;
    }
    setReviews(buildFileSessions(parsed, fuel));
    setReviewId((current) => current + 1);
    setError(null);
    setBusy(false);
    requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const needsOctane = Boolean(reviews?.some((item) => !item.session.ok && item.session.needsOctane));
  const presetYear = selectedCar?.year ?? (carYear === "" ? null : carYear);
  const presetTrim = selectedCar?.trim ?? null;

  return (
    <DisclaimerGate>
      <div className="min-h-full">
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6">
            <div className="space-y-3">
              <div className="flex justify-end">
                <ThemeToggle />
              </div>
              <div className="mx-auto max-w-3xl space-y-2 text-center">
                <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">VB WRX · 2022–2026</p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{APP_NAME}</h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Two tools in one page. Use the tabs below to switch between log review and the wheel / tire calculator. Nothing is uploaded.
                </p>
              </div>
            </div>

            <Tabs
              value={mainTab}
              onValueChange={(value) => setMainTab(value as MainTab)}
              className="relative z-0 gap-6"
            >
              <TabsList
                variant="default"
                className="relative z-0 grid h-auto min-h-16 w-full grid-cols-2 items-stretch gap-1 overflow-hidden rounded-xl border border-border bg-muted/80 p-1.5 shadow-sm"
              >
                <TabsTrigger
                  value="logs"
                  className="h-14 min-h-14 after:hidden rounded-lg px-3 text-base font-semibold tracking-tight sm:h-16 sm:min-h-16 sm:text-lg data-active:shadow-md"
                >
                  <span className="flex flex-col items-center gap-0.5 leading-tight">
                    <span>Log review</span>
                    <span className="text-[11px] font-normal tracking-normal text-muted-foreground sm:text-xs">
                      Accessport CSV grade
                    </span>
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="tires"
                  className="h-14 min-h-14 after:hidden rounded-lg px-3 text-base font-semibold tracking-tight sm:h-16 sm:min-h-16 sm:text-lg data-active:shadow-md"
                >
                  <span className="flex flex-col items-center gap-0.5 leading-tight">
                    <span>Wheel / tire</span>
                    <span className="text-[11px] font-normal tracking-normal text-muted-foreground sm:text-xs">
                      Size & offset calc
                    </span>
                  </span>
                </TabsTrigger>
              </TabsList>

              <div className="relative z-0 space-y-4">
                <VinDecoder onVehicleHint={onVinHint} />
                <CarPresetBlock
                  market={market}
                  carYear={carYear}
                  carId={carId}
                  yearOptions={yearOptions}
                  trimOptions={trimOptions}
                  selectedCar={selectedCar}
                  onMarket={(next) => {
                    setMarket(next);
                    setCarYear("");
                    setCarId("");
                  }}
                  onYear={(next) => {
                    setCarYear(next);
                    setCarId("");
                  }}
                  onTrim={(id) => {
                    if (id) loadCarPreset(id);
                    else setCarId("");
                  }}
                />
              </div>

              <TabsContent value="logs" className="relative z-0 mt-0 space-y-6">
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    addFiles(event.dataTransfer.files);
                  }}
                  className={`rounded-xl border border-dashed px-4 py-8 text-center ${dragOver ? "border-foreground bg-accent" : "border-border bg-background"}`}
                >
                  <p className="text-sm">Drop CSV files here, or choose them.</p>
                  <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
                    Load sample logs picks a made-up set at random: S, A, B, a 50 psi F, or a knock F. Click again for a different fictional set.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                      Choose logs
                    </Button>
                    <Button type="button" variant="ghost" onClick={loadSamples} disabled={busy}>
                      Load sample logs
                    </Button>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files) addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>

                {files.length ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {files.map((file) => (
                      <li key={fileKey(file)} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5">
                        <span className="truncate font-mono text-xs">{file.name}</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          onClick={() => setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No files selected.</p>
                )}
                {sampleNote ? (
                  <p className="rounded-lg border border-border bg-accent px-3 py-2 text-sm font-medium">Sample data. {sampleNote}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    className="h-10 px-4 text-[0.9375rem]"
                    onClick={startReview}
                    disabled={!files.length || busy}
                  >
                    {busy ? "Reading logs…" : "Start review"}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="h-10 px-4 text-[0.9375rem]"
                    onClick={() => window.location.reload()}
                  >
                    Reset page
                  </Button>
                  {files.length ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setFiles([]);
                        setReviews(null);
                        setSampleNote(null);
                        setError(null);
                      }}
                    >
                      Clear logs
                    </Button>
                  ) : null}
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label="Fuel octane"
                    hint={
                      needsOctane
                        ? "Required. The tune name did not include an octane. E85 and other ethanol blends are not supported yet."
                        : "Leave this on the tune when the map name includes 87, 89, 91, 92, or 93. E85 and other ethanol blends are not supported yet."
                    }
                  >
                    <select
                      id="fuel-octane"
                      value={fuel === "tune" ? "tune" : String(fuel)}
                      onChange={(event) => setFuel(event.target.value === "tune" ? "tune" : (Number(event.target.value) as Octane))}
                      className={`${fieldClass} ${needsOctane ? "ring-2 ring-destructive" : ""}`}
                    >
                      <option value="tune">From the tune name</option>
                      {OCTANES.map((octane) => (
                        <option key={octane} value={octane}>
                          {octane}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Drivetrain loss %" hint="Preset fills this for MT vs CVT. AWD manuals are often 15–20%.">
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={settings.drivetrainLossPct}
                      onChange={(event) => setSettings({ ...settings, drivetrainLossPct: Number(event.target.value) })}
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Thermal efficiency %" hint="30% is a reasonable turbo gasoline guess. Raise it for a very efficient engine.">
                    <input
                      type="number"
                      min={15}
                      max={45}
                      value={settings.thermalEfficiencyPct}
                      onChange={(event) => setSettings({ ...settings, thermalEfficiencyPct: Number(event.target.value) })}
                      className={fieldClass}
                    />
                  </Field>
                  <Field
                    label="Weight with driver, lb"
                    hint={
                      selectedCar
                        ? `Preset curb ${selectedCar.curbWeightLb.toLocaleString()} lb plus ${DRIVER_LB} lb driver. Edit if your car is different.`
                        : "Optional. Use a car preset above, or type curb weight plus driver for road-load WHP."
                    }
                  >
                    <input
                      type="number"
                      min={800}
                      max={12000}
                      placeholder="Optional"
                      value={weightText}
                      onChange={(event) => {
                        setWeightText(event.target.value);
                        setCarId("");
                      }}
                      className={fieldClass}
                    />
                  </Field>
                </div>

                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer">Channels a full review needs</summary>
                  <ul className="mt-3 flex flex-col gap-2">
                    {requirementList().map((column) => (
                      <li key={column.label}>
                        <span className="text-foreground">{column.label}.</span> {column.why}
                      </li>
                    ))}
                  </ul>
                </details>

                <details className="text-sm text-muted-foreground" open={Boolean(selectedCar)}>
                  <summary className="cursor-pointer">Road-load assumptions</summary>
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <Field label="Drag coefficient" hint="0.32 for every VB WRX preset. Subaru does not list an official Cd.">
                      <input
                        type="number"
                        step="0.01"
                        min={0.15}
                        max={0.8}
                        value={settings.dragCd}
                        onChange={(event) => setSettings({ ...settings, dragCd: Number(event.target.value) })}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Frontal area, m²" hint="From catalog width × height × 0.84. Sedan 2.25, Sportswagon 2.26.">
                      <input
                        type="number"
                        step="0.05"
                        min={1}
                        max={4}
                        value={settings.frontalAreaM2}
                        onChange={(event) => setSettings({ ...settings, frontalAreaM2: Number(event.target.value) })}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Rolling resistance" hint="About 0.012–0.015 on street tires. Sticky tS tires use 0.014.">
                      <input
                        type="number"
                        step="0.001"
                        min={0.005}
                        max={0.03}
                        value={settings.rollingResistance}
                        onChange={(event) => setSettings({ ...settings, rollingResistance: Number(event.target.value) })}
                        className={fieldClass}
                      />
                    </Field>
                  </div>
                </details>

                <div ref={reviewRef} className="-mx-4 border-t border-border sm:-mx-6">
                  {reviews?.length ? (
                    <ReviewBatch
                      key={reviewId}
                      files={reviews}
                      settings={liveSettings(settings, weightText)}
                      smoothing={smoothing}
                      onSmoothing={setSmoothing}
                    />
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="tires" className="relative z-0 mt-0 space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  Compare a proposed wheel and tire to stock. Stock size follows the VIN or car preset above when set. Pick sizes from the lists or type them by hand. Fitment notes are for stock ride height only.
                </p>

                <WheelTireCalculator
                  presetYear={presetYear}
                  presetTrim={presetTrim}
                  vinYear={vinHint?.year ?? null}
                  vinTrim={vinHint?.trim ?? null}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="h-10 px-4 text-[0.9375rem]"
                    onClick={() => window.location.reload()}
                  >
                    Reset page
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-sm text-muted-foreground sm:px-6">
            <p>
              Created by Scott Myers · v{APP_VERSION} · MIT License ·{" "}
              <a
                href="https://github.com/OverclockedWRX/wrx-vb-toolbox"
                className="underline underline-offset-2 hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </p>
            <p className="text-xs leading-5">
              Not affiliated with Subaru of America, Subaru Corporation, or COBB Tuning. Subaru, WRX, Accessport, and
              COBB are trademarks of their respective owners.
            </p>
          </div>
        </footer>
      </div>
    </DisclaimerGate>
  );
}

function CarPresetBlock({
  market,
  carYear,
  carId,
  yearOptions,
  trimOptions,
  selectedCar,
  onMarket,
  onYear,
  onTrim,
}: {
  market: Market | "";
  carYear: number | "";
  carId: string;
  yearOptions: number[];
  trimOptions: ReturnType<typeof presetsFor>;
  selectedCar: ReturnType<typeof findPreset>;
  onMarket: (market: Market | "") => void;
  onYear: (year: number | "") => void;
  onTrim: (id: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/60 px-4 py-4">
      <div>
        <p className="text-sm font-medium">Car preset</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Pick market, year, and trim. Log review uses curb weight and road-load numbers. The wheel calculator uses the trim to set stock tire and wheel size.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Market" hint="Sales region for that year’s trim names.">
          <select
            value={market}
            onChange={(event) => onMarket(event.target.value as Market | "")}
            className={fieldClass}
          >
            <option value="">Choose market</option>
            {MARKETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Model year" hint="2022–2026 VB WRX only.">
          <select
            value={carYear === "" ? "" : String(carYear)}
            disabled={!market}
            onChange={(event) => onYear(event.target.value === "" ? "" : Number(event.target.value))}
            className={fieldClass}
          >
            <option value="">Choose year</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trim" hint="Includes transmission and body style.">
          <select
            value={carId}
            disabled={!market || carYear === ""}
            onChange={(event) => onTrim(event.target.value)}
            className={fieldClass}
          >
            <option value="">Choose trim</option>
            {trimOptions.map((car) => (
              <option key={car.id} value={car.id}>
                {presetLabel(car)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {selectedCar ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Loaded {selectedCar.year} {MARKETS.find((item) => item.id === selectedCar.market)?.label} {selectedCar.trim} ({selectedCar.transmission}
          {selectedCar.body === "wagon" ? ", wagon" : ""}). Curb {selectedCar.curbWeightLb.toLocaleString()} lb / {selectedCar.curbWeightKg} kg · with
          driver {selectedCar.curbWeightLb + DRIVER_LB} lb · Cd {selectedCar.dragCd} · frontal area {selectedCar.frontalAreaM2} m² · drivetrain loss{" "}
          {selectedCar.drivetrainLossPct}%. Source: {selectedCar.source}.
        </p>
      ) : null}
    </div>
  );
}

function liveSettings(settings: PowerSettings, weightText: string): PowerSettings {
  const weight = weightText.trim() === "" ? null : Number(weightText);
  return { ...settings, weightLb: weight !== null && Number.isFinite(weight) ? weight : null };
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

const fieldClass = "h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-sm";

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm">{label}</span>
      {children}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  );
}
