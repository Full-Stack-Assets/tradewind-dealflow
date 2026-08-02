import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyData } from "../lib/import-export.ts";
import type { StagedSourceRecord } from "../lib/ingestion/contracts.ts";
import { importSafeRecords } from "../lib/ingestion/import-safe.ts";
import { normalizeMassGisRecord } from "../lib/ingestion/massgis.ts";

const NOW = new Date("2026-07-29T12:00:00.000Z");

function emptyWorkspace() {
  return createEmptyData(NOW.toISOString());
}

function staged(id: number, overrides: Partial<StagedSourceRecord> = {}): StagedSourceRecord {
  const candidate = normalizeMassGisRecord({
    attributes: {
      OBJECTID: id,
      GlobalID: `parcel-${id}`,
      MAP_PAR_ID: `map-${id}`,
      LOC_ID: `loc-${id}`,
      TOWN_ID: 95,
      PROP_ID: `prop-${id}`,
      TOTAL_VAL: 400_000,
      FY: 2025,
      LS_DATE: 1_704_067_200_000,
      LS_PRICE: 350_000,
      USE_CODE: "101",
      SITE_ADDR: `${id} Main St`,
      CITY: "Fall River",
      ZIP: "02720",
      YEAR_BUILT: 1975,
      BLD_AREA: 1_800,
      UNITS: 1,
    },
  }, NOW.toISOString());
  return {
    id: `record-${id}`,
    runId: "run-1",
    sourceIdentity: candidate.sourceIdentity,
    sourceRecordId: candidate.sourceRecordId,
    retrievedAt: candidate.retrievedAt,
    rawJson: JSON.stringify(candidate),
    normalizedJson: JSON.stringify(candidate),
    rawFingerprint: candidate.rawFingerprint,
    normalizedFingerprint: candidate.normalizedFingerprint,
    classification: "safe",
    reasonCode: null,
    importedAt: null,
    ...overrides,
  };
}

function safeRecords(count: number) {
  return Array.from({ length: count }, (_, index) => staged(index + 1));
}

test("one action imports 125 safe records into Research", () => {
  const result = importSafeRecords(emptyWorkspace(), safeRecords(125), NOW);
  assert.equal(result.error, null);
  assert.equal(result.data.deals.length, 125);
  assert.equal(result.data.deals.every((deal) => deal.stage === "Research"), true);
  assert.equal(result.outcomes.filter((item) => item === "applied").length, 125);
});

test("retry after lost server acknowledgement creates no duplicates", () => {
  const records = safeRecords(2);
  const first = importSafeRecords(emptyWorkspace(), records, NOW);
  const second = importSafeRecords(first.data, records, NOW);
  assert.equal(second.data.deals.length, 2);
  assert.deepEqual(second.outcomes, ["exact-reimport", "exact-reimport"]);
});

test("changed source preserves a conflict and exceptions never enter the batch", () => {
  const firstRecord = staged(1);
  const first = importSafeRecords(emptyWorkspace(), [firstRecord], NOW);
  const changedCandidate = JSON.parse(firstRecord.normalizedJson);
  changedCandidate.address = "1 Changed St";
  changedCandidate.normalizedFingerprint = "changed-fingerprint";
  const changed = {
    ...firstRecord,
    id: "record-changed",
    classification: "changed" as const,
    reasonCode: "source-conflict",
    normalizedJson: JSON.stringify(changedCandidate),
    normalizedFingerprint: "changed-fingerprint",
  };
  const exception = staged(2, { classification: "exception", reasonCode: "invalid-record" });
  const result = importSafeRecords(first.data, [changed, exception], NOW);
  assert.deepEqual(result.outcomes, ["changed-source", "excluded"]);
  assert.equal(result.data.deals.length, 1);
  assert.equal(result.data.deals[0].factConflicts.some((conflict) => conflict.field === "address"), true);
});
