import assert from "node:assert/strict";
import { documentsFromBulletinPayload, mapVehicleSafety, vehicleQueryFromVin } from "../lib/vin-safety";
import type { VinDecodeResult } from "../lib/vin";

const decoded: VinDecodeResult = {
  vin: "JF1VBAL69N9801234",
  ok: true,
  checkDigitOk: true,
  source: "nhtsa",
  summary: "2022 SUBARU WRX",
  error: null,
  fields: [
    { key: "Make", label: "Make", value: "SUBARU" },
    { key: "Model", label: "Model", value: "WRX" },
    { key: "ModelYear", label: "Model year", value: "2022" },
  ],
};

assert.deepEqual(vehicleQueryFromVin(decoded), { make: "SUBARU", model: "WRX", year: "2022" });
assert.equal(vehicleQueryFromVin({ ...decoded, vin: "SHORT", fields: [] }), null);

const mapped = mapVehicleSafety({
  results: [
    {
      safetyIssues: {
        recalls: [
          {
            nhtsaCampaignNumber: "23V016000",
            mfrCampaignNumber: "WRA-23",
            reportReceivedDate: "2023-01-23T00:00:00Z",
            components: [{ name: "EQUIPMENT" }],
            summary: "Owner manual recall.",
            consequence: "Lights may be adjusted wrong.",
            correctiveAction: "Subaru will mail an insert.",
          },
          { nhtsaCampaignNumber: "23V016000", summary: "duplicate" },
        ],
        manufacturerCommunications: [
          {
            nhtsaIdNumber: 1,
            manufacturerCommunicationNumber: "Article Locator",
            summary: "Techtips newsletter locator index.",
            communicationDate: "2024-01-01",
          },
          {
            nhtsaIdNumber: 2,
            manufacturerCommunicationNumber: "02-196-26R",
            summary: "White smoke after startup.",
            communicationDate: "2026-08-20T14:08:44Z",
            components: [{ name: "ENGINE" }],
          },
        ],
      },
    },
  ],
});

assert.equal(mapped.recalls.length, 1);
assert.equal(mapped.recalls[0]?.campaign, "23V016000");
assert.equal(mapped.recalls[0]?.remedy, "Subaru will mail an insert.");
assert.equal(mapped.bulletins.length, 1);
assert.equal(mapped.bulletins[0]?.number, "02-196-26R");
assert.equal(mapped.bulletins[0]?.component, "ENGINE");

const documents = documentsFromBulletinPayload({
  results: [
    {
      manufacturerCommunications: [
        {
          associatedDocuments: [
            { fileName: "MC-11036811-0001.pdf", url: "https://static.nhtsa.gov/odi/tsbs/2026/MC-11036811-0001.pdf" },
            { fileName: "skip", url: "not-a-url" },
          ],
        },
      ],
    },
  ],
});
assert.equal(documents.length, 1);
assert.equal(documents[0]?.name, "MC-11036811-0001.pdf");

console.log("vin safety map ok");
