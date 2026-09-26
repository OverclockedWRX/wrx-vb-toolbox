import {
  CAR_PRESETS,
  MARKETS,
  type Body,
  type CarPreset,
  type Market,
  type Transmission,
} from "@/lib/car-presets";
import type { VinDecodeResult, VinField } from "@/lib/vin";

export type VinPresetMatch =
  | { ok: true; preset: CarPreset; message: string }
  | { ok: false; message: string };

function field(fields: VinField[], key: string) {
  return fields.find((item) => item.key === key)?.value?.trim() || null;
}

function normTrim(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function marketLabel(market: Market) {
  return MARKETS.find((item) => item.id === market)?.label ?? market;
}

function transLabel(transmission: Transmission) {
  return transmission === "6MT" ? "6-speed manual" : "CVT";
}

function describe(car: CarPreset) {
  return `${marketLabel(car.market)} ${car.trim} (${transLabel(car.transmission)})`;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function usTrims(year: number) {
  return [...new Set(CAR_PRESETS.filter((car) => car.market === "US" && car.year === year).map((car) => car.trim))];
}

function yearFrom(fields: VinField[]) {
  const raw = field(fields, "ModelYear");
  if (!raw) return null;
  const year = Number(raw);
  return Number.isInteger(year) ? year : null;
}

function isWrx(fields: VinField[]) {
  const model = field(fields, "Model");
  const chassis = field(fields, "Chassis");
  const line = field(fields, "MakeLine");
  return [model, chassis, line].some((value) => value !== null && /wrx/i.test(value));
}

function vehicleName(fields: VinField[], year: number | null) {
  const make = field(fields, "Make") ?? field(fields, "Manufacturer");
  const model = field(fields, "Model");
  return [year, make, model].filter(Boolean).join(" ");
}

function transmissionFrom(value: string | null): Transmission | null {
  if (!value) return null;
  const text = value.toLowerCase();
  if (text.includes("cvt") || text.includes("continuously") || text.includes("variable")) return "CVT";
  if (text.includes("manual") || text.includes("standard")) return "6MT";
  if (text.includes("automatic")) return "CVT";
  return null;
}

function bodyFrom(value: string | null): Body | null {
  if (!value) return null;
  if (/wagon/i.test(value)) return "wagon";
  if (/sedan|saloon/i.test(value)) return "sedan";
  return null;
}

function withCheckDigit(result: VinDecodeResult, message: string) {
  if (result.checkDigitOk || result.vin.length !== 17) return message;
  return `${message} The check digit does not match, which often means a typo.`;
}

function knownTrimName(raw: string) {
  const key = normTrim(raw);
  return CAR_PRESETS.find((car) => normTrim(car.trim) === key)?.trim ?? raw.trim();
}

/**
 * Pick the single car preset implied by a VIN decode.
 * A match has to be unique. Market is not stored in the VIN, so shared trim
 * names (US and Canada GT, for example) stay unmatched.
 */
export function matchPresetFromVin(result: VinDecodeResult): VinPresetMatch {
  if (!result.vin || result.vin.length !== 17 || result.source === "none") {
    const detail = result.error ?? "The VIN is incomplete.";
    return {
      ok: false,
      message: `Car info cannot be determined from this VIN. ${detail} A preset can be chosen only from a 17-character VIN. A short entry or a character VINs never use (I, O, or Q) is a common reason.`,
    };
  }

  const fields = result.fields;
  const year = yearFrom(fields);
  const chassis = field(fields, "Chassis");
  const wrx = isWrx(fields);

  if (chassis?.includes("VA") || (wrx && year !== null && year < 2022)) {
    return {
      ok: false,
      message: withCheckDigit(
        result,
        `Car info cannot be determined from this VIN. It looks like a ${year ?? "pre-2022"} WRX from the VA generation (2015–2021). Presets only cover the 2022–2026 VB WRX.`,
      ),
    };
  }

  if (result.source === "local") {
    if (!wrx) {
      return {
        ok: false,
        message: withCheckDigit(
          result,
          "Car info cannot be determined from this VIN. The online database was unavailable, and the VIN characters do not show a Subaru WRX. Presets only cover the 2022–2026 WRX.",
        ),
      };
    }
    const plant = field(fields, "Plant") ?? field(fields, "PlantCode");
    const yearText = year ?? "that";
    return {
      ok: false,
      message: withCheckDigit(
        result,
        `Car info cannot be determined from this VIN. The online database was unavailable, so only the model year (${yearText}) and the WRX characters are known. Trim is not readable offline. A ${yearText} WRX can be several cars with different weights — for example a US Premium manual or a Canada Sport CVT — and Canada and Australia use different trim names than the US. ${plant ? `The plant note (${plant}) is only a rough transmission hint, ` : "The plant character is only a rough transmission hint, "}so it was not used to guess a preset.`,
      ),
    };
  }

  const named = vehicleName(fields, year);
  if (!wrx) {
    return {
      ok: false,
      message: withCheckDigit(
        result,
        `Car info cannot be determined from this VIN. It decodes as ${named || "a vehicle other than a WRX"}, and presets only cover the 2022–2026 Subaru WRX.`,
      ),
    };
  }

  if (year === null) {
    return {
      ok: false,
      message: withCheckDigit(
        result,
        "Car info cannot be determined from this VIN. The decode has no model year, and each preset is tied to a specific year from 2022 through 2026.",
      ),
    };
  }

  if (year < 2022 || year > 2026) {
    return {
      ok: false,
      message: withCheckDigit(
        result,
        `Car info cannot be determined from this VIN. It is a ${year} WRX, and presets only cover 2022–2026.`,
      ),
    };
  }

  const rawTrim = field(fields, "Trim");
  const examples = usTrims(year);
  const exampleText = examples.length ? joinList(examples) : "Base, Premium, Limited, or GT";
  if (!rawTrim) {
    return {
      ok: false,
      message: withCheckDigit(
        result,
        `Car info cannot be determined from this VIN. It is a ${year} Subaru WRX, but the decode has no trim. Trim is what sets the curb weight. A ${year} US WRX can be ${exampleText}, and Canada uses other names such as Sport and Sport-tech for the same platform. The VIN does not record the country where the car was sold.`,
      ),
    };
  }

  const trimName = knownTrimName(rawTrim);
  const transmission = transmissionFrom(field(fields, "TransmissionStyle"));
  if (!transmission) {
    return {
      ok: false,
      message: withCheckDigit(
        result,
        `Car info cannot be determined from this VIN. It is a ${year} ${trimName}, but the decode does not say whether it is a 6-speed manual or a CVT. Those presets use different curb weights and drivetrain loss. The plant character sometimes lines up with transmission (8 often CVT, 9 often manual) and was not used to guess.`,
      ),
    };
  }

  const body = bodyFrom(field(fields, "BodyClass") ?? field(fields, "BodyLocal"));
  const trimKey = normTrim(trimName);
  let candidates = CAR_PRESETS.filter((car) => car.year === year && normTrim(car.trim) === trimKey && car.transmission === transmission);
  if (body) {
    const bodied = candidates.filter((car) => car.body === body);
    if (candidates.length > 0 && bodied.length === 0) {
      return {
        ok: false,
        message: withCheckDigit(
          result,
          `Car info cannot be determined from this VIN. It decodes as a ${year} ${trimName} ${body} with a ${transLabel(transmission)}, and there is no ${body} preset with that name and transmission.`,
        ),
      };
    }
    if (bodied.length > 0) candidates = bodied;
  }

  if (candidates.length === 1) {
    const preset = candidates[0];
    return {
      ok: true,
      preset,
      message: withCheckDigit(
        result,
        `Filled the car preset from the VIN: ${preset.year} ${describe(preset)}.`,
      ),
    };
  }

  if (candidates.length > 1) {
    const plant = field(fields, "PlantCountry") ?? field(fields, "Plant");
    const built = plant ? ` It was built in ${plant}, which is not the country where it was sold.` : "";
    return {
      ok: false,
      message: withCheckDigit(
        result,
        `Car info cannot be determined from this VIN. It decodes as a ${year} ${trimName} with a ${transLabel(transmission)}, which matches more than one preset: ${joinList(candidates.map(describe))}.${built} Those markets share this trim name and use slightly different weights. Choose the market yourself.`,
      ),
    };
  }

  const sameTrim = CAR_PRESETS.filter((car) => car.year === year && normTrim(car.trim) === trimKey && (body === null || car.body === body));
  if (sameTrim.length > 0) {
    const offered = joinList([...new Set(sameTrim.map((car) => transLabel(car.transmission)))]);
    return {
      ok: false,
      message: withCheckDigit(
        result,
        `Car info cannot be determined from this VIN. It decodes as a ${year} ${trimName} with a ${transLabel(transmission)}, but the ${trimName} presets for ${year} are ${offered} only. A GT is CVT only in this list, and a US TR or tS is a 6-speed manual, so that combination was left blank.`,
      ),
    };
  }

  const anyTrim = CAR_PRESETS.some((car) => normTrim(car.trim) === trimKey);
  if (!anyTrim) {
    return {
      ok: false,
      message: withCheckDigit(
        result,
        `Car info cannot be determined from this VIN. The trim “${rawTrim.trim()}” is not in the preset list. US trims for ${year} include ${exampleText}. Canada and Australia use different names, and the VIN does not say which market the car was sold in.`,
      ),
    };
  }

  return {
    ok: false,
    message: withCheckDigit(
      result,
      `Car info cannot be determined from this VIN. A ${trimName} is not listed for ${year}. US trims that year include ${exampleText}.`,
    ),
  };
}
