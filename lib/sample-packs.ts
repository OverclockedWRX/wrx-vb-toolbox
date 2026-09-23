export type SamplePack = {
  id: string;
  label: string;
  detail: string;
  files: string[];
};

export const SAMPLE_PACKS: SamplePack[] = [
  {
    id: "s",
    label: "S tier",
    detail: "Made-up clean 93-octane pull. The log is fictional.",
    files: ["sample-s-cruise.csv", "sample-s-pull.csv"],
  },
  {
    id: "a",
    label: "A tier",
    detail: "Made-up 93-octane pull with one small miss. The log is fictional.",
    files: ["sample-a-cruise.csv", "sample-a-pull.csv"],
  },
  {
    id: "b",
    label: "B tier",
    detail: "Made-up 91-octane pull with a large fuel trim. The log is fictional.",
    files: ["sample-b-cruise.csv", "sample-b-pull.csv"],
  },
  {
    id: "c",
    label: "B tier (busy)",
    detail: "Made-up 91-octane pull with trims and a few soft misses. The log is fictional.",
    files: ["sample-c-cruise.csv", "sample-c-pull.csv"],
  },
  {
    id: "boost",
    label: "F tier · 50 psi",
    detail: "Made-up pull. The wastegate left town and boost hit 50 psi. The log is fictional.",
    files: ["sample-50psi.csv"],
  },
  {
    id: "knock",
    label: "F tier · Knock choir",
    detail: "Made-up pull. DAM is absurd and feedback knock is loud. The log is fictional.",
    files: ["sample-knock.csv"],
  },
];

export function sampleFileAllowed(name: string) {
  return SAMPLE_PACKS.some((pack) => pack.files.includes(name));
}
