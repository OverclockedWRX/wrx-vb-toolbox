import type { VinDecodeResult } from "@/lib/vin";

export type VinRecall = {
  id: string;
  campaign: string;
  makerCampaign: string;
  date: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
};

export type VinBulletinDocument = {
  name: string;
  url: string;
};

export type VinBulletin = {
  id: string;
  number: string;
  date: string;
  component: string;
  summary: string;
};

export type VehicleQuery = {
  make: string;
  model: string;
  year: string;
};

export type VinSafety = {
  recalls: VinRecall[];
  bulletins: VinBulletin[];
};

type SafetyPayload = {
  results?: Array<{
    safetyIssues?: {
      recalls?: unknown[];
      manufacturerCommunications?: unknown[];
    };
  }>;
};

function text(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value.trim() : "";
}

function dateLabel(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : raw;
}

function componentLabel(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const name = text((item as { name?: unknown }).name);
      return name;
    })
    .filter(Boolean)
    .join(", ");
}

function isIndexBulletin(number: string, summary: string) {
  const hay = `${number} ${summary}`.toLowerCase();
  return hay.includes("article locator") || hay.includes("newsletter locator") || hay.includes("techtips newsletter");
}

/** Year, make, and model NHTSA can search. The VIN itself is not a recall key. */
export function vehicleQueryFromVin(result: VinDecodeResult | null): VehicleQuery | null {
  if (!result || result.vin.length !== 17) return null;
  const field = (key: string) => result.fields.find((item) => item.key === key)?.value?.trim() ?? "";
  const year = field("ModelYear");
  if (!/^\d{4}$/.test(year)) return null;
  const makeRaw = field("Make") || field("Manufacturer");
  const modelRaw = field("Model");
  const wrx =
    /wrx/i.test(modelRaw) ||
    /wrx/i.test(field("Chassis")) ||
    /wrx/i.test(field("MakeLine"));
  const subaru = /subaru/i.test(makeRaw) || wrx;
  if (!subaru) {
    if (!makeRaw || !modelRaw) return null;
    return { make: makeRaw, model: modelRaw, year };
  }
  const model = /wrx/i.test(modelRaw) ? modelRaw : "WRX";
  return { make: makeRaw || "subaru", model, year };
}

export function mapVehicleSafety(payload: unknown): VinSafety {
  const rows = (payload as SafetyPayload | null)?.results ?? [];
  const recalls: VinRecall[] = [];
  const bulletins: VinBulletin[] = [];
  const seenRecalls = new Set<string>();
  const seenBulletins = new Set<string>();

  for (const row of rows) {
    for (const item of row.safetyIssues?.recalls ?? []) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const campaign = text(record.nhtsaCampaignNumber);
      if (!campaign || seenRecalls.has(campaign)) continue;
      seenRecalls.add(campaign);
      recalls.push({
        id: campaign,
        campaign,
        makerCampaign: text(record.mfrCampaignNumber),
        date: dateLabel(record.reportReceivedDate),
        component: componentLabel(record.components),
        summary: text(record.summary),
        consequence: text(record.consequence),
        remedy: text(record.correctiveAction),
      });
    }

    for (const item of row.safetyIssues?.manufacturerCommunications ?? []) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const id = text(record.nhtsaIdNumber);
      const number = text(record.manufacturerCommunicationNumber);
      const summary = text(record.summary) || text(record.subject);
      if (!id || seenBulletins.has(id) || isIndexBulletin(number, summary)) continue;
      seenBulletins.add(id);
      bulletins.push({
        id,
        number: number || id,
        date: dateLabel(record.communicationDate),
        component: componentLabel(record.components),
        summary,
      });
    }
  }

  bulletins.sort((a, b) => b.date.localeCompare(a.date));
  return { recalls, bulletins };
}

/** PDF links live on the per-bulletin record, not on the year/make/model list. */
export function documentsFromBulletinPayload(payload: unknown): VinBulletinDocument[] {
  const rows = (payload as { results?: Array<{ manufacturerCommunications?: Array<{ associatedDocuments?: unknown }> }> } | null)
    ?.results?.[0]?.manufacturerCommunications;
  const documents = rows?.[0]?.associatedDocuments;
  if (!Array.isArray(documents)) return [];
  const found: VinBulletinDocument[] = [];
  for (const item of documents) {
    if (!item || typeof item !== "object") continue;
    const url = text((item as { url?: unknown }).url);
    if (!url.startsWith("https://")) continue;
    const name = text((item as { fileName?: unknown }).fileName) || "NHTSA bulletin";
    found.push({ name, url });
  }
  return found;
}

const documentCache = new Map<string, VinBulletinDocument[]>();
const safetyCache = new Map<string, VinSafety>();

function safetyKey(query: VehicleQuery) {
  return `${query.year}|${query.make.toLowerCase()}|${query.model.toLowerCase()}`;
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function lookupBulletinDocuments(nhtsaId: string): Promise<VinBulletinDocument[]> {
  const cached = documentCache.get(nhtsaId);
  if (cached) return cached;
  const url = new URL("https://api.nhtsa.gov/safetyIssues/byNhtsaId");
  url.searchParams.set("nhtsaId", nhtsaId);
  url.searchParams.set("filter", "issueType");
  url.searchParams.set("filterValue", "manufacturerCommunications");
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`NHTSA returned ${response.status}`);
  const documents = documentsFromBulletinPayload(await response.json());
  documentCache.set(nhtsaId, documents);
  return documents;
}

export async function lookupVinSafety(query: VehicleQuery, signal?: AbortSignal): Promise<VinSafety> {
  const key = safetyKey(query);
  const cached = safetyCache.get(key);
  if (cached) return cached;

  const url = new URL("https://api.nhtsa.gov/vehicles/byYmmt");
  url.searchParams.set("make", query.make);
  url.searchParams.set("model", query.model);
  url.searchParams.set("modelYear", query.year);
  url.searchParams.set("productDetail", "all");

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url.toString(), { signal });
      if ((response.status === 403 || response.status === 429 || response.status >= 500) && attempt === 0) {
        await delay(1500, signal);
        continue;
      }
      if (!response.ok) throw new Error(`NHTSA returned ${response.status}`);
      const mapped = mapVehicleSafety(await response.json());
      safetyCache.set(key, mapped);
      return mapped;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (attempt === 0) {
        await delay(1500, signal);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("NHTSA could not be reached");
}
