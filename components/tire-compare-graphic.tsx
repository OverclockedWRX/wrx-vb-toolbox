import { useId, useState, type ReactNode } from "react";
import { Wheel3DView } from "@/components/wheel-3d-view";
import { outerLipFromHubMm, tireDiameterMm, tireSidewallMm } from "@/lib/wheel-math";
import { formatTire, type TireSpec, type WheelSpec } from "@/lib/stock-wheels";

type GraphicMode = "3d" | "diagram";
type ViewMode = "side-by-side" | "overlay";

type Props = {
  stockTire: TireSpec;
  stockWheel: WheelSpec;
  proposedTire: TireSpec;
  proposedWheel: WheelSpec;
};

export function TireCompareGraphic({ stockTire, stockWheel, proposedTire, proposedWheel }: Props) {
  const [graphic, setGraphic] = useState<GraphicMode>("3d");
  const [mode, setMode] = useState<ViewMode>("side-by-side");
  const uid = useId().replace(/:/g, "");

  const stockD = tireDiameterMm(stockTire);
  const propD = tireDiameterMm(proposedTire);
  const stockWall = tireSidewallMm(stockTire);
  const propWall = tireSidewallMm(proposedTire);
  const stockOuter = outerLipFromHubMm(stockWheel);
  const propOuter = outerLipFromHubMm(proposedWheel);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Visual comparison</p>
          <p className="text-xs text-muted-foreground">
            {graphic === "3d"
              ? "Drag to turn the wheels. The hub and axle stay put — offset slides each wheel along the axle."
              : "Side view shows overall diameter and sidewall. Front view shows section width and poke from the hub."}
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          <button type="button" className={chip(graphic === "3d")} onClick={() => setGraphic("3d")}>
            3D
          </button>
          <button type="button" className={chip(graphic === "diagram")} onClick={() => setGraphic("diagram")}>
            Diagrams
          </button>
          {graphic === "diagram" ? (
            <>
              <button type="button" className={chip(mode === "side-by-side")} onClick={() => setMode("side-by-side")}>
                Side by side
              </button>
              <button type="button" className={chip(mode === "overlay")} onClick={() => setMode("overlay")}>
                Overlay
              </button>
            </>
          ) : null}
        </div>
      </div>

      {graphic === "3d" ? (
        <Wheel3DView
          stockTire={stockTire}
          stockWheel={stockWheel}
          proposedTire={proposedTire}
          proposedWheel={proposedWheel}
        />
      ) : null}

      {graphic === "diagram" ? (
      <div className="grid gap-3 lg:grid-cols-2">
        <GraphicCard title="Side view · diameter & sidewall">
          {mode === "side-by-side" ? (
            <SideBySideSideView
              uid={uid}
              stockTire={stockTire}
              proposedTire={proposedTire}
              stockD={stockD}
              propD={propD}
              stockWall={stockWall}
              propWall={propWall}
            />
          ) : (
            <OverlaySideView
              uid={`${uid}-o`}
              stockTire={stockTire}
              proposedTire={proposedTire}
              stockD={stockD}
              propD={propD}
            />
          )}
        </GraphicCard>

        <GraphicCard title="Front view · width & poke">
          {mode === "side-by-side" ? (
            <SideBySideFrontView
              stockTire={stockTire}
              proposedTire={proposedTire}
              stockWheel={stockWheel}
              proposedWheel={proposedWheel}
              stockD={stockD}
              propD={propD}
              stockOuter={stockOuter}
              propOuter={propOuter}
            />
          ) : (
            <OverlayFrontView
              stockTire={stockTire}
              proposedTire={proposedTire}
              stockWheel={stockWheel}
              proposedWheel={proposedWheel}
              stockD={stockD}
              propD={propD}
              stockOuter={stockOuter}
              propOuter={propOuter}
            />
          )}
        </GraphicCard>
      </div>
      ) : null}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <Legend swatch="stock" label={`Stock · ${formatTire(stockTire)}`} />
        <Legend swatch="proposed" label={`Proposed · ${formatTire(proposedTire)}`} />
        <span>
          Diameter Δ {(propD - stockD >= 0 ? "+" : "") + (propD - stockD).toFixed(0)} mm · poke Δ{" "}
          {(propOuter - stockOuter >= 0 ? "+" : "") + (propOuter - stockOuter).toFixed(1)} mm
        </span>
      </div>
    </div>
  );
}

function GraphicCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background/80">
      <p className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="px-2 py-3">{children}</div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: "stock" | "proposed"; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${swatch === "stock" ? "bg-sky-500" : "bg-orange-500"}`} />
      {label}
    </span>
  );
}

function chip(active: boolean) {
  return `rounded-md border px-2.5 py-1 ${active ? "border-foreground bg-accent" : "border-border bg-background hover:bg-accent/60"}`;
}

function SideBySideSideView({
  uid,
  stockTire,
  proposedTire,
  stockD,
  propD,
  stockWall,
  propWall,
}: {
  uid: string;
  stockTire: TireSpec;
  proposedTire: TireSpec;
  stockD: number;
  propD: number;
  stockWall: number;
  propWall: number;
}) {
  const maxD = Math.max(stockD, propD);
  const scale = 110 / maxD;
  const ground = 128;
  const leftCx = 70;
  const rightCx = 190;

  return (
    <svg viewBox="0 0 260 150" className="mx-auto h-auto w-full max-w-md" role="img" aria-label="Side-by-side tire side view">
      <defs>
        <linearGradient id={`${uid}-stock`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${uid}-prop`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c2410c" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <line x1="12" y1={ground} x2="248" y2={ground} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <TireSide
        cx={leftCx}
        ground={ground}
        diameterMm={stockD}
        rimIn={stockTire.rimIn}
        wallMm={stockWall}
        scale={scale}
        fill={`url(#${uid}-stock)`}
        label="1"
      />
      <TireSide
        cx={rightCx}
        ground={ground}
        diameterMm={propD}
        rimIn={proposedTire.rimIn}
        wallMm={propWall}
        scale={scale}
        fill={`url(#${uid}-prop)`}
        label="2"
      />
      <text x={leftCx} y="12" textAnchor="middle" className="fill-muted-foreground" fontSize="9">
        Stock {(stockD / 25.4).toFixed(1)}″
      </text>
      <text x={rightCx} y="12" textAnchor="middle" className="fill-muted-foreground" fontSize="9">
        Proposed {(propD / 25.4).toFixed(1)}″
      </text>
    </svg>
  );
}

function OverlaySideView({
  uid,
  stockTire,
  proposedTire,
  stockD,
  propD,
}: {
  uid: string;
  stockTire: TireSpec;
  proposedTire: TireSpec;
  stockD: number;
  propD: number;
}) {
  const maxD = Math.max(stockD, propD);
  const scale = 120 / maxD;
  const ground = 132;
  const cx = 130;

  return (
    <svg viewBox="0 0 260 150" className="mx-auto h-auto w-full max-w-md" role="img" aria-label="Overlay tire side view">
      <defs>
        <linearGradient id={`${uid}-stock`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`${uid}-prop`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#c2410c" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <line x1="20" y1={ground} x2="240" y2={ground} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      {/* Draw larger first so smaller sits on top */}
      {stockD >= propD ? (
        <>
          <TireSide cx={cx} ground={ground} diameterMm={stockD} rimIn={stockTire.rimIn} wallMm={tireSidewallMm(stockTire)} scale={scale} fill={`url(#${uid}-stock)`} label="" />
          <TireSide cx={cx} ground={ground} diameterMm={propD} rimIn={proposedTire.rimIn} wallMm={tireSidewallMm(proposedTire)} scale={scale} fill={`url(#${uid}-prop)`} label="" />
        </>
      ) : (
        <>
          <TireSide cx={cx} ground={ground} diameterMm={propD} rimIn={proposedTire.rimIn} wallMm={tireSidewallMm(proposedTire)} scale={scale} fill={`url(#${uid}-prop)`} label="" />
          <TireSide cx={cx} ground={ground} diameterMm={stockD} rimIn={stockTire.rimIn} wallMm={tireSidewallMm(stockTire)} scale={scale} fill={`url(#${uid}-stock)`} label="" />
        </>
      )}
      <text x={cx} y="12" textAnchor="middle" className="fill-muted-foreground" fontSize="9">
        Overlay · Δ {(((propD - stockD) / stockD) * 100).toFixed(2)}%
      </text>
    </svg>
  );
}

function TireSide({
  cx,
  ground,
  diameterMm,
  rimIn,
  wallMm,
  scale,
  fill,
  label,
}: {
  cx: number;
  ground: number;
  diameterMm: number;
  rimIn: number;
  wallMm: number;
  scale: number;
  fill: string;
  label: string;
}) {
  const r = (diameterMm * scale) / 2;
  const cy = ground - r;
  const rimR = (rimIn * 25.4 * scale) / 2;
  const wall = wallMm * scale;

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={Math.max(rimR, 4)} fill="var(--background, #111)" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={Math.max(rimR - 6, 2)} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
      {/* sidewall tick */}
      <line x1={cx + rimR} y1={cy} x2={cx + rimR + wall} y2={cy} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
      {label ? (
        <text x={cx} y={cy + 3} textAnchor="middle" fontSize="10" fontWeight="600" className="fill-foreground">
          {label}
        </text>
      ) : null}
    </g>
  );
}

function SideBySideFrontView({
  stockTire,
  proposedTire,
  stockWheel,
  proposedWheel,
  stockD,
  propD,
  stockOuter,
  propOuter,
}: {
  stockTire: TireSpec;
  proposedTire: TireSpec;
  stockWheel: WheelSpec;
  proposedWheel: WheelSpec;
  stockD: number;
  propD: number;
  stockOuter: number;
  propOuter: number;
}) {
  const maxH = Math.max(stockD, propD);
  const maxW = Math.max(stockTire.widthMm, proposedTire.widthMm);
  const scale = Math.min(100 / maxH, 70 / maxW);
  const ground = 130;

  return (
    <svg viewBox="0 0 260 150" className="mx-auto h-auto w-full max-w-md" role="img" aria-label="Side-by-side tire front view">
      <line x1="12" y1={ground} x2="248" y2={ground} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <TireFront
        hubX={70}
        ground={ground}
        tire={stockTire}
        wheel={stockWheel}
        diameterMm={stockD}
        outerMm={stockOuter}
        scale={scale}
        color="#0ea5e9"
        label="1"
      />
      <TireFront
        hubX={190}
        ground={ground}
        tire={proposedTire}
        wheel={proposedWheel}
        diameterMm={propD}
        outerMm={propOuter}
        scale={scale}
        color="#f97316"
        label="2"
      />
      <text x={70} y="12" textAnchor="middle" className="fill-muted-foreground" fontSize="9">
        {stockTire.widthMm} mm · ET{stockWheel.offsetMm}
      </text>
      <text x={190} y="12" textAnchor="middle" className="fill-muted-foreground" fontSize="9">
        {proposedTire.widthMm} mm · ET{proposedWheel.offsetMm}
      </text>
    </svg>
  );
}

function OverlayFrontView({
  stockTire,
  proposedTire,
  stockWheel,
  proposedWheel,
  stockD,
  propD,
  stockOuter,
  propOuter,
}: {
  stockTire: TireSpec;
  proposedTire: TireSpec;
  stockWheel: WheelSpec;
  proposedWheel: WheelSpec;
  stockD: number;
  propD: number;
  stockOuter: number;
  propOuter: number;
}) {
  const maxH = Math.max(stockD, propD);
  const maxW = Math.max(stockTire.widthMm + Math.abs(stockOuter), proposedTire.widthMm + Math.abs(propOuter), 280);
  const scale = Math.min(110 / maxH, 160 / maxW);
  const ground = 132;
  const hubX = 130;

  return (
    <svg viewBox="0 0 260 150" className="mx-auto h-auto w-full max-w-md" role="img" aria-label="Overlay tire front view">
      <line x1="20" y1={ground} x2="240" y2={ground} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      {/* hub reference */}
      <line x1={hubX} y1={20} x2={hubX} y2={ground} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" strokeWidth="1" />
      <text x={hubX + 4} y="28" className="fill-muted-foreground" fontSize="8">
        hub
      </text>
      <TireFront
        hubX={hubX}
        ground={ground}
        tire={stockTire}
        wheel={stockWheel}
        diameterMm={stockD}
        outerMm={stockOuter}
        scale={scale}
        color="#0ea5e9"
        label=""
        opacity={0.45}
      />
      <TireFront
        hubX={hubX}
        ground={ground}
        tire={proposedTire}
        wheel={proposedWheel}
        diameterMm={propD}
        outerMm={propOuter}
        scale={scale}
        color="#f97316"
        label=""
        opacity={0.55}
      />
      <text x={hubX} y="12" textAnchor="middle" className="fill-muted-foreground" fontSize="9">
        Poke Δ {(propOuter - stockOuter >= 0 ? "+" : "") + (propOuter - stockOuter).toFixed(1)} mm
      </text>
    </svg>
  );
}

function TireFront({
  hubX,
  ground,
  tire,
  wheel,
  diameterMm,
  outerMm,
  scale,
  color,
  label,
  opacity = 0.85,
}: {
  hubX: number;
  ground: number;
  tire: TireSpec;
  wheel: WheelSpec;
  diameterMm: number;
  outerMm: number;
  scale: number;
  color: string;
  label: string;
  opacity?: number;
}) {
  const h = diameterMm * scale;
  const w = tire.widthMm * scale;
  const rimH = wheel.diameterIn * 25.4 * scale;
  // Mounting face at hubX; outer lip is to the right (outboard) by outerMm
  const outerX = hubX + outerMm * scale;
  const innerX = outerX - w;
  const top = ground - h;
  const rimTop = ground - (h + rimH) / 2;
  const rimW = Math.max(wheel.widthIn * 25.4 * scale * 0.85, 8);
  const rimOuter = hubX + outerLipFromHubMm(wheel) * scale;
  const rimLeft = rimOuter - rimW;

  return (
    <g opacity={opacity}>
      <rect
        x={innerX}
        y={top}
        width={w}
        height={h}
        rx={Math.min(w * 0.35, 14)}
        ry={Math.min(h * 0.08, 10)}
        fill={color}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <rect
        x={rimLeft}
        y={rimTop}
        width={rimW}
        height={rimH}
        rx={2}
        fill="var(--background, #111)"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      <line x1={hubX} y1={top + 4} x2={hubX} y2={ground - 4} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      {label ? (
        <text x={(innerX + outerX) / 2} y={top + h / 2 + 3} textAnchor="middle" fontSize="10" fontWeight="600" className="fill-foreground">
          {label}
        </text>
      ) : null}
    </g>
  );
}
