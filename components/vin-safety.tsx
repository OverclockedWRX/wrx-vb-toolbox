import { useEffect, useState, type ReactNode } from "react";
import {
  lookupBulletinDocuments,
  lookupVinSafety,
  vehicleQueryFromVin,
  type VinBulletin,
  type VinBulletinDocument,
  type VinRecall,
  type VinSafety,
} from "@/lib/vin-safety";
import type { VinDecodeResult } from "@/lib/vin";

export function VinSafetyNotices({ result, decoding }: { result: VinDecodeResult | null; decoding: boolean }) {
  const query = vehicleQueryFromVin(result);
  const queryKey = query ? `${query.year}|${query.make}|${query.model}` : "";
  const [loadedKey, setLoadedKey] = useState("");
  const [safety, setSafety] = useState<VinSafety | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Record<string, VinBulletinDocument[] | "missing" | "error">>({});
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const next = vehicleQueryFromVin(result);
    if (!next) return;
    const key = `${next.year}|${next.make}|${next.model}`;
    let cancelled = false;
    const controller = new AbortController();
    void lookupVinSafety(next, controller.signal)
      .then((found) => {
        if (cancelled) return;
        setSafety(found);
        setError(null);
        setLoadedKey(key);
      })
      .catch(() => {
        if (cancelled || controller.signal.aborted) return;
        setSafety(null);
        setError("NHTSA could not be reached, so recalls and service bulletins were not loaded. If a lookup just succeeded, wait a minute and try the VIN again.");
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attempt, result]);

  const ready = Boolean(query && safety && loadedKey === queryKey && !error);
  const failed = Boolean(query && error && loadedKey === queryKey);
  const loading = Boolean(query) && !ready && !failed;

  async function openBulletin(id: string) {
    const known = documents[id];
    if (Array.isArray(known) && known[0]) {
      window.open(known[0].url, "_blank", "noopener,noreferrer");
      return;
    }
    setOpeningId(id);
    try {
      const found = await lookupBulletinDocuments(id);
      setDocuments((current) => ({ ...current, [id]: found.length ? found : "missing" }));
      if (found[0]) window.open(found[0].url, "_blank", "noopener,noreferrer");
    } catch {
      setDocuments((current) => ({ ...current, [id]: "error" }));
    } finally {
      setOpeningId((current) => (current === id ? null : current));
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-background/60 px-4 py-4">
      <div>
        <p className="text-sm font-medium">Recalls and service bulletins</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          NHTSA lists these for the decoded year, make, and model. A campaign may not include every VIN, and this page cannot tell whether a recall repair is already finished. Confirm open recalls with a Subaru retailer.
        </p>
      </div>

      {!result?.vin && !decoding ? (
        <p className="text-sm text-muted-foreground">Enter a VIN in the decoder below to look these up.</p>
      ) : null}
      {loading || (decoding && !ready) ? (
        <p className="text-sm text-muted-foreground">Looking up NHTSA recalls and service bulletins…</p>
      ) : null}
      {result?.vin && !query && !decoding ? (
        <p className="text-sm text-muted-foreground">This VIN did not decode to a year, make, and model, so recalls and bulletins cannot be looked up.</p>
      ) : null}
      {failed ? (
        <p className="text-sm text-destructive">
          {error}{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => {
              setError(null);
              setLoadedKey("");
              setAttempt((current) => current + 1);
            }}
          >
            Try again
          </button>
        </p>
      ) : null}

      {ready && query && safety ? (
        <div className="space-y-4">
          <NoticeGroup
            title="Recalls"
            tone="recall"
            count={safety.recalls.length}
            empty={`NHTSA returned no recalls for ${query.year} ${query.make} ${query.model}.`}
          >
            {safety.recalls.map((recall) => (
              <RecallCard key={recall.id} recall={recall} />
            ))}
          </NoticeGroup>
          <NoticeGroup
            title="Service bulletins"
            tone="bulletin"
            count={safety.bulletins.length}
            empty={`NHTSA returned no service bulletins for ${query.year} ${query.make} ${query.model}.`}
          >
            {safety.bulletins.map((bulletin) => (
              <BulletinCard
                key={bulletin.id}
                bulletin={bulletin}
                documents={documents[bulletin.id]}
                opening={openingId === bulletin.id}
                onOpen={() => void openBulletin(bulletin.id)}
              />
            ))}
          </NoticeGroup>
        </div>
      ) : null}
    </section>
  );
}

function NoticeGroup({
  title,
  tone,
  count,
  empty,
  children,
}: {
  title: string;
  tone: "recall" | "bulletin";
  count: number;
  empty: string;
  children: ReactNode;
}) {
  const frame = tone === "recall" ? "border-red-600/70 bg-red-500/10" : "border-yellow-500/80 bg-yellow-400/15";
  const heading = tone === "recall" ? "text-red-800 dark:text-red-200" : "text-yellow-900 dark:text-yellow-100";
  return (
    <div className={`rounded-lg border px-3 py-3 ${frame}`}>
      <p className={`text-sm font-semibold ${heading}`}>
        {title}
        <span className="ml-2 font-normal">{count}</span>
      </p>
      {count === 0 ? <p className="mt-2 text-sm">{empty}</p> : <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">{children}</div>}
    </div>
  );
}

function RecallCard({ recall }: { recall: VinRecall }) {
  return (
    <article className="rounded-md border border-red-700/50 bg-red-600/10 px-3 py-2 text-sm text-red-950 dark:text-red-50">
      <p className="font-medium">
        {recall.campaign}
        {recall.makerCampaign ? <span className="font-normal"> · {recall.makerCampaign}</span> : null}
        {recall.date ? <span className="font-normal"> · {recall.date}</span> : null}
      </p>
      {recall.component ? <p className="mt-1 text-xs">{recall.component}</p> : null}
      {recall.summary ? <p className="mt-1 text-xs leading-5">{recall.summary}</p> : null}
      {recall.consequence ? <p className="mt-1 text-xs leading-5">Consequence: {recall.consequence}</p> : null}
      {recall.remedy ? <p className="mt-1 text-xs leading-5">Remedy: {recall.remedy}</p> : null}
    </article>
  );
}

function BulletinCard({
  bulletin,
  documents,
  opening,
  onOpen,
}: {
  bulletin: VinBulletin;
  documents: VinBulletinDocument[] | "missing" | "error" | undefined;
  opening: boolean;
  onOpen: () => void;
}) {
  return (
    <article className="rounded-md border border-yellow-600/70 bg-yellow-300/30 px-3 py-2 text-sm text-yellow-950 dark:border-yellow-400/60 dark:bg-yellow-400/15 dark:text-yellow-50">
      <p className="font-medium">
        {bulletin.number}
        {bulletin.date ? <span className="font-normal"> · {bulletin.date}</span> : null}
      </p>
      {bulletin.component ? <p className="mt-1 text-xs">{bulletin.component}</p> : null}
      {bulletin.summary ? <p className="mt-1 text-xs leading-5">{bulletin.summary}</p> : null}
      {Array.isArray(documents) && documents.length ? (
        <ul className="mt-1 space-y-1">
          {documents.map((document) => (
            <li key={document.url}>
              <a href={document.url} target="_blank" rel="noreferrer" className="text-xs font-medium underline underline-offset-2">
                {document.name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs">
          <button type="button" className="font-medium underline underline-offset-2" onClick={onOpen} disabled={opening}>
            {opening ? "Opening NHTSA bulletin…" : "Open NHTSA bulletin"}
          </button>
          {documents === "missing" ? <span> NHTSA did not publish a file for this bulletin.</span> : null}
          {documents === "error" ? <span> The document link could not be loaded. Try again.</span> : null}
        </p>
      )}
    </article>
  );
}
