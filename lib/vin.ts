/** VIN normalize, check-digit, local structure decode, and NHTSA vPIC lookup. */

export type VinField = {
  key: string;
  label: string;
  value: string;
};

export type VinDecodeResult = {
  vin: string;
  ok: boolean;
  checkDigitOk: boolean;
  source: "nhtsa" | "local" | "none";
  summary: string | null;
  fields: VinField[];
  error: string | null;
};

const TRANSLITERATION: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

const YEAR_CODES: Record<string, number> = {
  A: 2010,
  B: 2011,
  C: 2012,
  D: 2013,
  E: 2014,
  F: 2015,
  G: 2016,
  H: 2017,
  J: 2018,
  K: 2019,
  L: 2020,
  M: 2021,
  N: 2022,
  P: 2023,
  R: 2024,
  S: 2025,
  T: 2026,
  V: 2027,
  W: 2028,
  X: 2029,
  Y: 2030,
  "1": 2031,
  "2": 2032,
  "3": 2033,
  "4": 2034,
  "5": 2035,
  "6": 2036,
  "7": 2037,
  "8": 2038,
  "9": 2039,
};

const WMI: Record<string, { country: string; manufacturer: string; vehicleType: string }> = {
  JF1: { country: "Japan", manufacturer: "Subaru Corporation", vehicleType: "Passenger car" },
  JF2: { country: "Japan", manufacturer: "Subaru Corporation", vehicleType: "MPV / crossover" },
  "4S3": { country: "United States", manufacturer: "Subaru of Indiana Automotive", vehicleType: "Passenger car" },
  "4S4": { country: "United States", manufacturer: "Subaru of Indiana Automotive", vehicleType: "MPV / crossover" },
};

const SUBARU_PLANT: Record<string, string> = {
  "8": "Main plant, Ōta, Gunma, Japan (often CVT on WRX)",
  "9": "Main plant, Ōta, Gunma, Japan (often 6MT on WRX)",
  C: "Subaru of Indiana Automotive, Lafayette, Indiana, USA",
  G: "Subaru of Indiana Automotive, Lafayette, Indiana, USA",
};

/** Preferred NHTSA field order for the details table. */
const PRIORITY_KEYS = [
  "Make",
  "Model",
  "ModelYear",
  "Trim",
  "Trim2",
  "Series",
  "Series2",
  "BodyClass",
  "VehicleType",
  "DriveType",
  "TransmissionStyle",
  "TransmissionSpeeds",
  "DisplacementL",
  "DisplacementCC",
  "EngineCylinders",
  "EngineHP",
  "EngineModel",
  "Turbo",
  "FuelTypePrimary",
  "Doors",
  "Seats",
  "SeatRows",
  "CurbWeightLB",
  "GVWR",
  "WheelBaseShort",
  "PlantCity",
  "PlantState",
  "PlantCountry",
  "PlantCompanyName",
  "Manufacturer",
  "Note",
  "OtherRestraintSystemInfo",
  "VehicleDescriptor",
  "VIN",
  "ErrorText",
];

const SKIP_KEYS = new Set([
  "ErrorCode",
  "AdditionalErrorText",
  "SuggestedVIN",
  "PossibleValues",
  "ErrorText",
]);

const EMPTY = new Set(["", "0", "not applicable", "null", "undefined"]);

export function normalizeVin(raw: string) {
  return raw.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
}

export function isValidVinCharset(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

export function vinCheckDigit(vin: string) {
  const upper = vin.toUpperCase();
  if (upper.length !== 17) return null;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const value = TRANSLITERATION[upper[i]];
    if (value === undefined) return null;
    sum += value * WEIGHTS[i];
  }
  const rem = sum % 11;
  return rem === 10 ? "X" : String(rem);
}

export function vinCheckDigitOk(vin: string) {
  const expected = vinCheckDigit(vin);
  return expected !== null && expected === vin[8];
}

function modelYearFromCode(code: string) {
  return YEAR_CODES[code] ?? null;
}

function labelize(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\bLb\b/g, "lb")
    .replace(/\bHp\b/g, "HP")
    .replace(/\bId\b/g, "ID")
    .replace(/\bVin\b/g, "VIN")
    .replace(/\bGvwr\b/g, "GVWR")
    .replace(/\bAbs\b/g, "ABS")
    .replace(/\bEsc\b/g, "ESC")
    .replace(/\bTpms\b/g, "TPMS");
}

function localFields(vin: string): VinField[] {
  const wmi = vin.slice(0, 3);
  const wmiInfo = WMI[wmi];
  const year = modelYearFromCode(vin[9]);
  const plant = SUBARU_PLANT[vin[10]];
  const series = vin[3];
  const body = vin[4];
  const fields: VinField[] = [
    { key: "VIN", label: "VIN", value: vin },
    { key: "CheckDigit", label: "Check digit", value: vinCheckDigitOk(vin) ? `Valid (${vin[8]})` : `Mismatch (got ${vin[8]}, expected ${vinCheckDigit(vin) ?? "?"})` },
    { key: "WMI", label: "WMI (positions 1–3)", value: wmi },
  ];
  if (wmiInfo) {
    fields.push(
      { key: "Country", label: "Country of manufacture", value: wmiInfo.country },
      { key: "Manufacturer", label: "Manufacturer", value: wmiInfo.manufacturer },
      { key: "VehicleType", label: "Vehicle type (WMI)", value: wmiInfo.vehicleType },
    );
  }
  if (series === "V") {
    fields.push({ key: "MakeLine", label: "Make / line (position 4)", value: "Subaru WRX family" });
  }
  if (body === "A") {
    fields.push({ key: "BodyLocal", label: "Body (position 5)", value: "Sedan" });
  } else if (body === "B") {
    fields.push({ key: "BodyLocal", label: "Body (position 5)", value: "Sedan / VB-series descriptor" });
  }
  if (vin[3] === "V" && vin[4] === "B") {
    fields.push({ key: "Chassis", label: "Chassis generation", value: "VB (2022–present WRX)" });
  } else if (vin[3] === "V" && vin[4] === "A") {
    fields.push({ key: "Chassis", label: "Chassis generation", value: "VA (2015–2021 WRX / STI)" });
  }
  if (year) fields.push({ key: "ModelYear", label: "Model year", value: String(year) });
  fields.push({ key: "PlantCode", label: "Plant code (position 11)", value: vin[10] });
  if (plant) fields.push({ key: "Plant", label: "Assembly plant", value: plant });
  fields.push({ key: "Serial", label: "Serial (positions 12–17)", value: vin.slice(11) });
  fields.push({ key: "VDS", label: "VDS (positions 4–9)", value: vin.slice(3, 9) });
  fields.push({ key: "VIS", label: "VIS (positions 10–17)", value: vin.slice(9) });
  return fields;
}

function nhtsaFields(raw: Record<string, string>, vin: string): VinField[] {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (SKIP_KEYS.has(key)) continue;
    const text = String(value ?? "").trim();
    if (!text || EMPTY.has(text.toLowerCase())) continue;
    cleaned[key] = text;
  }
  if (!cleaned.VIN) cleaned.VIN = vin;
  cleaned.CheckDigit = vinCheckDigitOk(vin) ? `Valid (${vin[8]})` : `Mismatch (got ${vin[8]}, expected ${vinCheckDigit(vin) ?? "?"})`;

  const ordered: VinField[] = [];
  const seen = new Set<string>();
  for (const key of ["VIN", "CheckDigit", ...PRIORITY_KEYS]) {
    if (!(key in cleaned) || seen.has(key)) continue;
    ordered.push({ key, label: labelize(key), value: cleaned[key] });
    seen.add(key);
  }
  for (const key of Object.keys(cleaned).sort((a, b) => a.localeCompare(b))) {
    if (seen.has(key)) continue;
    ordered.push({ key, label: labelize(key), value: cleaned[key] });
    seen.add(key);
  }
  return ordered;
}

function summaryFrom(fields: VinField[]) {
  const get = (key: string) => fields.find((field) => field.key === key)?.value;
  const year = get("ModelYear");
  const make = get("Make") ?? (get("MakeLine") ? "Subaru" : null);
  const model = get("Model") ?? (get("Chassis")?.includes("WRX") ? "WRX" : null);
  const trim = get("Trim");
  const parts = [year, make, model, trim].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

async function fetchNhtsa(vin: string): Promise<Record<string, string> | null> {
  const year = modelYearFromCode(vin[9]);
  const url = new URL(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}`);
  url.searchParams.set("format", "json");
  if (year) url.searchParams.set("modelyear", String(year));
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`NHTSA returned ${response.status}`);
  const payload = (await response.json()) as { Results?: Record<string, string>[] };
  const row = payload.Results?.[0];
  return row ?? null;
}

function nhtsaLooksUseful(row: Record<string, string>) {
  const error = String(row.ErrorCode ?? "");
  // 0 = clean, 1 = check digit issue but still often has make/model, 6 = incomplete VIN, etc.
  const make = String(row.Make ?? "").trim();
  const model = String(row.Model ?? "").trim();
  if (make || model) return true;
  if (error === "0") return true;
  return false;
}

export async function decodeVin(raw: string): Promise<VinDecodeResult> {
  const vin = normalizeVin(raw);
  if (!vin) {
    return { vin: "", ok: false, checkDigitOk: false, source: "none", summary: null, fields: [], error: null };
  }
  if (vin.length !== 17) {
    return {
      vin,
      ok: false,
      checkDigitOk: false,
      source: "none",
      summary: null,
      fields: [],
      error: `A VIN needs 17 characters. This one has ${vin.length}.`,
    };
  }
  if (!isValidVinCharset(vin)) {
    return {
      vin,
      ok: false,
      checkDigitOk: false,
      source: "none",
      summary: null,
      fields: [],
      error: "VIN characters can only be A–Z and 0–9, and I, O, and Q are never used.",
    };
  }

  const checkDigitOk = vinCheckDigitOk(vin);
  const local = localFields(vin);

  try {
    const remote = await fetchNhtsa(vin);
    if (remote && nhtsaLooksUseful(remote)) {
      const fields = nhtsaFields(remote, vin);
      // Keep local chassis / plant notes when NHTSA left them blank.
      for (const field of local) {
        if (!fields.some((item) => item.key === field.key)) fields.push(field);
      }
      const errorText = String(remote.ErrorText ?? "").trim();
      return {
        vin,
        ok: true,
        checkDigitOk,
        source: "nhtsa",
        summary: summaryFrom(fields),
        fields,
        error: checkDigitOk ? null : errorText || "Check digit does not match. Details below may still be useful.",
      };
    }
  } catch {
    // Fall through to local decode when offline or the API is unreachable.
  }

  return {
    vin,
    ok: local.length > 0,
    checkDigitOk,
    source: "local",
    summary: summaryFrom(local),
    fields: local,
    error: checkDigitOk
      ? "Online VIN database was unavailable. Showing the structural decode from the VIN characters."
      : "Check digit does not match, and the online VIN database was unavailable. Showing what the VIN characters still imply.",
  };
}
