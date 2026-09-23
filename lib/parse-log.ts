import type { PullPoint } from "@/lib/types";

export type RawSample = PullPoint & {
  gear: number;
  throttle: number;
  dam: number | null;
  fk: number;
  fkl: number;
  learn1: number | null;
  learn3: number | null;
  corr: number | null;
  coolant: number | null;
  oil: number | null;
  manifold: number | null;
  ks2: number | null;
  rough: number | null;
  baro: number | null;
  tgv: number | null;
};

export type ParsedLog = {
  name: string;
  headers: string[];
  map: string | null;
  samples: RawSample[];
  parseError: string | null;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((fields) => fields.some((field) => field.trim() !== ""));
}

function norm(header: string) {
  return header.toLowerCase().replace(/\s+/g, " ").trim();
}

function findColumn(headers: string[], test: (header: string) => boolean): number {
  return headers.findIndex((header) => test(norm(header)));
}

function num(fields: string[], index: number): number | null {
  if (index < 0 || index >= fields.length) return null;
  const value = Number(fields[index]);
  return Number.isFinite(value) ? value : null;
}

export function parseLog(name: string, text: string): ParsedLog {
  const label = name.replace(/\.csv$/i, "");
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  const headerIndex = table.findIndex((row) => row.some((cell) => norm(cell).startsWith("time")));
  if (headerIndex < 0) {
    return {
      name: label,
      headers: [],
      map: null,
      samples: [],
      parseError: `${label} does not look like an Accessport CSV. The header row needs a Time column.`,
    };
  }
  const headers = table[headerIndex];
  const rpmIndex = findColumn(headers, (header) => header.startsWith("rpm"));
  const timeIndex = findColumn(headers, (header) => header.startsWith("time"));
  const mapHeader = headers.find((header) => norm(header).startsWith("ap info")) ?? null;
  if (rpmIndex < 0 || timeIndex < 0) {
    return { name: label, headers, map: mapHeader, samples: [], parseError: null };
  }

  const columns = {
    accel: findColumn(headers, (header) => header.includes("accel position")),
    throttle: findColumn(headers, (header) => header.includes("throttle pos")),
    gear: findColumn(headers, (header) => header.includes("gear position")),
    boost: findColumn(headers, (header) => header === "boost (psi)" || header === "boost"),
    tgt: findColumn(headers, (header) => header.includes("target boost")),
    afr: findColumn(headers, (header) => header.includes("af sens 1")),
    cmd: findColumn(headers, (header) => header.includes("comm fuel final") || header.includes("fuel final")),
    timing: findColumn(headers, (header) => header.startsWith("ignition timing")),
    fp: findColumn(
      headers,
      (header) => header.includes("fuel pressure") && !header.includes("target"),
    ),
    duty: findColumn(headers, (header) => header.includes("inj duty")),
    load: findColumn(headers, (header) => header.includes("calculated load")),
    maf: findColumn(
      headers,
      (header) =>
        (header.includes("mass airflow") || header === "maf (g/s)" || header.includes("maf (g/s)")) &&
        !header.includes("freq"),
    ),
    speed: findColumn(headers, (header) => header.includes("vehicle speed")),
    dam: findColumn(headers, (header) => header.includes("dyn adv")),
    fk: findColumn(headers, (header) => header.includes("feedback knock")),
    fkl: findColumn(headers, (header) => header.includes("fine knock")),
    learn1: findColumn(headers, (header) => header.includes("af learning 1")),
    learn3: findColumn(headers, (header) => header.includes("af learning 3")),
    corr: findColumn(headers, (header) => header.includes("af correction 1")),
    coolant: findColumn(headers, (header) => header.includes("coolant")),
    oil: findColumn(headers, (header) => header.includes("oil temp")),
    manifold: findColumn(headers, (header) => header.includes("intake temp manifold")),
    ks2: findColumn(headers, (header) => header.includes("ks noise cyl 2")),
    rough1: findColumn(headers, (header) => header.includes("roughness cyl 1")),
    rough2: findColumn(headers, (header) => header.includes("roughness cyl 2")),
    rough3: findColumn(headers, (header) => header.includes("roughness cyl 3")),
    rough4: findColumn(headers, (header) => header.includes("roughness cyl 4")),
    baro: findColumn(headers, (header) => header.includes("baro")),
    tgv: findColumn(headers, (header) => header.includes("tgv")),
  };

  const samples: RawSample[] = [];
  for (const fields of table.slice(headerIndex + 1)) {
    const rpm = num(fields, rpmIndex);
    const t = num(fields, timeIndex);
    if (rpm === null || t === null) continue;
    const roughs = [columns.rough1, columns.rough2, columns.rough3, columns.rough4]
      .map((index) => num(fields, index))
      .filter((value): value is number => value !== null);
    samples.push({
      t,
      rpm,
      accel: num(fields, columns.accel) ?? num(fields, columns.throttle) ?? 0,
      throttle: num(fields, columns.throttle) ?? 0,
      gear: Math.round(num(fields, columns.gear) ?? 0),
      boost: num(fields, columns.boost) ?? 0,
      tgt: num(fields, columns.tgt) ?? 0,
      afr: num(fields, columns.afr) ?? 0,
      cmd: num(fields, columns.cmd) ?? 0,
      timing: num(fields, columns.timing) ?? 0,
      fp: num(fields, columns.fp) ?? 0,
      duty: num(fields, columns.duty) ?? 0,
      load: num(fields, columns.load),
      maf: num(fields, columns.maf),
      speed: num(fields, columns.speed) ?? 0,
      dam: num(fields, columns.dam),
      fk: num(fields, columns.fk) ?? 0,
      fkl: num(fields, columns.fkl) ?? 0,
      learn1: num(fields, columns.learn1),
      learn3: num(fields, columns.learn3),
      corr: num(fields, columns.corr),
      coolant: num(fields, columns.coolant),
      oil: num(fields, columns.oil),
      manifold: num(fields, columns.manifold),
      ks2: num(fields, columns.ks2),
      rough: roughs.length ? Math.max(...roughs) : null,
      baro: num(fields, columns.baro),
      tgv: num(fields, columns.tgv),
    });
  }
  if (samples.length < 2) {
    return {
      name: label,
      headers,
      map: mapHeader,
      samples,
      parseError: `${label} has no usable data rows after the header.`,
    };
  }
  return { name: label, headers, map: mapHeader, samples, parseError: null };
}
