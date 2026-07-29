import assert from "node:assert/strict";
import test from "node:test";

import type { SourcePolicy } from "../lib/ingestion/policy.ts";
import { createRun, approvePolicy, listRecords } from "../server/ingestion-store.ts";
import { runIngestion } from "../server/ingestion-runner.ts";
import { closeTestD1, createTestD1 } from "./helpers/d1.ts";

const NOW = "2026-07-29T12:00:00.000Z";

function validPolicy(overrides: Partial<SourcePolicy> = {}): SourcePolicy {
  return {
    adapter: "massgis-parcels-v1",
    endpoint: "https://services1.arcgis.com/hGdibHYSPO59RG1h/ArcGIS/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0/query",
    townIds: [95],
    outFields: [
      "OBJECTID", "GlobalID", "MAP_PAR_ID", "LOC_ID", "TOWN_ID", "PROP_ID",
      "TOTAL_VAL", "FY", "LS_DATE", "LS_PRICE", "USE_CODE", "SITE_ADDR", "CITY",
      "ZIP", "YEAR_BUILT", "BLD_AREA", "UNITS",
    ],
    useCodes: ["101", "104", "105", "111"],
    unitCounts: [1, 2, 3, 4],
    maximumAssessedValue: 750_000,
    maximumYearBuilt: 1990,
    minimumLastSaleAgeYears: null,
    pageSize: 50,
    maxRecordsPerRun: 500,
    scheduleEnabled: true,
    scheduleTimeZone: "America/New_York",
    scheduleHour: 2,
    scheduleMinute: 0,
    ...overrides,
  };
}

function feature(id: number, overrides: Record<string, unknown> = {}) {
  return {
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
      ...overrides,
    },
  };
}

function fixtureFetch(count: number, overrides: Record<number, Record<string, unknown>> = {}) {
  return async (input: string | URL | Request) => {
    const url = new URL(input.toString());
    const offset = Number(url.searchParams.get("resultOffset"));
    const requested = Number(url.searchParams.get("resultRecordCount"));
    const remaining = Math.max(0, count - offset);
    const size = Math.min(requested, remaining);
    const features = Array.from({ length: size }, (_, index) => {
      const id = offset + index + 1;
      return feature(id, overrides[id]);
    });
    return new Response(JSON.stringify({ features }), { status: 200 });
  };
}

async function withDb<T>(work: (db: Awaited<ReturnType<typeof createTestD1>>) => Promise<T>): Promise<T> {
  const db = await createTestD1();
  try {
    return await work(db);
  } finally {
    await closeTestD1(db);
  }
}

async function runFixture(trigger: "operator" | "schedule", count = 125) {
  return withDb(async (db) => {
    const policy = await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    const result = await runIngestion({
      db,
      policy,
      trigger,
      idempotencyKey: `${trigger}-${count}`,
      actorId: "actor",
      signal: new AbortController().signal,
      fetchOptions: { fetch: fixtureFetch(count), retrievedAt: NOW },
    });
    const records = await listRecords(db);
    return {
      result,
      fingerprints: records.map((record) => record.normalizedFingerprint).sort(),
      counts: {
        safe: result.safeCount,
        duplicate: result.duplicateCount,
        changed: result.changedCount,
        exception: result.exceptionCount,
      },
    };
  });
}

test("manual and scheduled triggers produce identical classifications", async () => {
  const manual = await runFixture("operator");
  const scheduled = await runFixture("schedule");
  assert.deepEqual(manual.fingerprints, scheduled.fingerprints);
  assert.deepEqual(manual.counts, scheduled.counts);
});

test("125 safe records create no per-record approval rows", async () => {
  const result = await runFixture("operator", 125);
  assert.equal(result.result.status, "staged");
  assert.equal(result.counts.safe, 125);
  assert.equal(result.counts.exception, 0);
});

test("exact rerun counts duplicates without creating new source records", async () => {
  await withDb(async (db) => {
    const policy = await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    const shared = {
      db,
      policy,
      trigger: "operator" as const,
      actorId: "actor",
      signal: new AbortController().signal,
      fetchOptions: { fetch: fixtureFetch(125), retrievedAt: NOW },
    };
    const first = await runIngestion({ ...shared, idempotencyKey: "first" });
    const second = await runIngestion({ ...shared, idempotencyKey: "second" });
    assert.equal(first.safeCount, 125);
    assert.equal(second.duplicateCount, 125);
    assert.equal((await listRecords(db)).length, 125);
  });
});

test("changed fingerprints stage conflicts and invalid records become exceptions", async () => {
  await withDb(async (db) => {
    const policy = await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    await runIngestion({
      db, policy, trigger: "operator", idempotencyKey: "before", actorId: "actor",
      signal: new AbortController().signal,
      fetchOptions: { fetch: fixtureFetch(2), retrievedAt: NOW },
    });
    const changed = await runIngestion({
      db, policy, trigger: "operator", idempotencyKey: "after", actorId: "actor",
      signal: new AbortController().signal,
      fetchOptions: {
        fetch: fixtureFetch(2, { 1: { TOTAL_VAL: 425_000 }, 2: { OWNER1: "denied" } }),
        retrievedAt: "2026-07-29T13:00:00.000Z",
      },
    });
    assert.equal(changed.changedCount, 1);
    assert.equal(changed.exceptionCount, 1);
    assert.equal((await listRecords(db, "changed"))[0].reasonCode, "source-conflict");
  });
});

test("record cap, transient retry, permanent failure, cancellation, and overlap fail safely", async () => {
  await withDb(async (db) => {
    const policy = await approvePolicy(db, validPolicy({ pageSize: 60, maxRecordsPerRun: 100 }), "actor", new Date(NOW));
    const capped = await runIngestion({
      db, policy, trigger: "operator", idempotencyKey: "cap", actorId: "actor",
      signal: new AbortController().signal,
      fetchOptions: { fetch: fixtureFetch(150), retrievedAt: NOW },
    });
    assert.equal(capped.retrievedCount, 100);

    let attempts = 0;
    const transient = await runIngestion({
      db, policy, trigger: "operator", idempotencyKey: "transient", actorId: "actor",
      signal: new AbortController().signal,
      fetchOptions: {
        fetch: async (input) => {
          attempts += 1;
          if (attempts < 3) return new Response("busy", { status: 503 });
          return fixtureFetch(0)(input);
        },
        retrievedAt: NOW,
      },
    });
    assert.equal(transient.status, "staged");
    assert.equal(attempts, 3);

    const failed = await runIngestion({
      db, policy, trigger: "operator", idempotencyKey: "failed", actorId: "actor",
      signal: new AbortController().signal,
      fetchOptions: { fetch: async () => new Response("no", { status: 403 }), retrievedAt: NOW },
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.lastErrorCode, "source-failure");

    const cancelledController = new AbortController();
    cancelledController.abort();
    const cancelled = await runIngestion({
      db, policy, trigger: "operator", idempotencyKey: "cancelled", actorId: "actor",
      signal: cancelledController.signal,
      fetchOptions: { fetch: fixtureFetch(1), retrievedAt: NOW },
    });
    assert.equal(cancelled.status, "cancelled");

    await createRun(db, policy, "operator", "open-run", "actor", new Date(NOW));
    await assert.rejects(
      () => runIngestion({
        db, policy, trigger: "schedule", idempotencyKey: "overlap", actorId: "actor",
        signal: new AbortController().signal,
        fetchOptions: { fetch: fixtureFetch(0), retrievedAt: NOW },
      }),
      /already in progress/i,
    );
  });
});

