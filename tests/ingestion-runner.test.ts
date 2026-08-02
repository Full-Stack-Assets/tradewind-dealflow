import assert from "node:assert/strict";
import test from "node:test";

import { appendAuditEvent } from "../lib/ingestion/audit.ts";
import type { SourcePolicy } from "../lib/ingestion/policy.ts";
import { handleIngestionApi } from "../server/ingestion-api.ts";
import type { D1Database } from "../server/d1.ts";
import { runDuePolicies } from "../server/ingestion-scheduler.ts";
import { createRun, approvePolicy, listRecords, listRuns } from "../server/ingestion-store.ts";
import { runIngestion } from "../server/ingestion-runner.ts";
import { applyTestD1Migrations, closeTestD1, createTestD1 } from "./helpers/d1.ts";

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

test("source API rejects cross-origin requests before storage access", async () => {
  let storageAccessed = false;
  const db = {
    prepare() {
      storageAccessed = true;
      throw new Error("storage must not be accessed");
    },
    async batch() {
      storageAccessed = true;
      throw new Error("storage must not be accessed");
    },
  } as D1Database;
  const response = await handleIngestionApi(new Request("https://dealflow.test/api/sources/policy", {
    headers: {
      "oai-authenticated-user-email": "operator@example.com",
      origin: "https://cross-origin.example",
    },
  }), { DB: db });

  assert.equal(response?.status, 403);
  assert.equal(storageAccessed, false);
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

test("identical attributes retrieved later remain exact duplicates", async () => {
  await withDb(async (db) => {
    const policy = await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    const shared = {
      db,
      policy,
      trigger: "operator" as const,
      actorId: "actor",
      signal: new AbortController().signal,
    };
    const first = await runIngestion({
      ...shared,
      idempotencyKey: "retrieved-first",
      fetchOptions: { fetch: fixtureFetch(1), retrievedAt: NOW },
    });
    const second = await runIngestion({
      ...shared,
      idempotencyKey: "retrieved-later",
      fetchOptions: {
        fetch: fixtureFetch(1),
        retrievedAt: "2026-07-30T12:00:00.000Z",
      },
    });

    assert.equal(first.safeCount, 1);
    assert.equal(second.duplicateCount, 1);
    assert.equal(second.changedCount, 0);
    assert.equal((await listRecords(db)).length, 1);
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

test("a later source schema change preserves safe pages with its distinct reason", async () => {
  await withDb(async (db) => {
    const policy = await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    const result = await runIngestion({
      db,
      policy,
      trigger: "operator",
      idempotencyKey: "schema-change",
      actorId: "actor",
      signal: new AbortController().signal,
      fetchOptions: {
        fetch: async (input) => {
          const url = new URL(input.toString());
          if (url.searchParams.get("resultOffset") === "0") return fixtureFetch(50)(input);
          return new Response(JSON.stringify({
            features: [feature(51, { NEW_SOURCE_FIELD: "changed schema" })],
          }), { status: 200 });
        },
        retrievedAt: NOW,
      },
    });

    assert.equal(result.status, "partial");
    assert.equal(result.safeCount, 50);
    assert.equal(result.lastErrorCode, "source-schema-change");
    assert.equal((await listRecords(db)).length, 50);
  });
});

test("an hourly scheduler tick outside the approved daily window creates no run", async () => {
  await withDb(async (db) => {
    await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fixtureFetch(0) as typeof globalThis.fetch;
    try {
      await runDuePolicies({ DB: db }, new Date("2026-07-29T19:00:00.000Z"));
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal((await listRuns(db)).length, 0);
  });
});

test("simultaneous same-key admissions return one stored run", async () => {
  await withDb(async (db) => {
    const policy = await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    const inputs = ["first", "second"].map(() =>
      createRun(db, policy, "operator", "shared-key", "actor", new Date(NOW))
    );
    const [first, second] = await Promise.all(inputs);

    assert.equal(first.run.id, second.run.id);
    assert.equal((await listRuns(db)).length, 1);
  });
});

test("simultaneous distinct-key admissions allow only one active run per policy", async () => {
  await withDb(async (db) => {
    const policy = await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    const outcomes = await Promise.allSettled([
      createRun(db, policy, "operator", "distinct-a", "actor", new Date(NOW)),
      createRun(db, policy, "operator", "distinct-b", "actor", new Date(NOW)),
    ]);

    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    const rejection = outcomes.find((outcome) => outcome.status === "rejected");
    assert.match(String(rejection?.status === "rejected" ? rejection.reason : ""), /already in progress/i);
    assert.equal((await listRuns(db)).length, 1);
  });
});

test("run admission rejects a policy superseded before its insert", async () => {
  await withDb(async (db) => {
    const stalePolicy = await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    await approvePolicy(
      db,
      validPolicy({ maximumAssessedValue: 700_000 }),
      "actor",
      new Date("2026-07-29T12:01:00.000Z"),
    );

    await assert.rejects(
      () => createRun(db, stalePolicy, "operator", "stale-policy", "actor", new Date(NOW)),
      /no longer active/i,
    );
    assert.equal((await listRuns(db)).length, 0);
  });
});

test("migration remediates duplicate active runs without deleting history", async () => {
  const db = await createTestD1({ throughMigration: 0 });
  try {
    const policy = await approvePolicy(db, validPolicy(), "actor", new Date(NOW));
    await db.batch([
      db.prepare(
        "INSERT INTO ingestion_runs (id, policy_id, policy_hash, trigger, status, idempotency_key, requested_at, started_at) VALUES (?, ?, ?, 'operator', 'running', ?, ?, ?)",
      ).bind(
        "run-canonical",
        policy.id,
        policy.policyHash,
        "migration-canonical",
        "2026-07-29T10:00:00.000Z",
        "2026-07-29T10:00:00.000Z",
      ),
      db.prepare(
        "INSERT INTO ingestion_runs (id, policy_id, policy_hash, trigger, status, idempotency_key, requested_at, started_at) VALUES (?, ?, ?, 'schedule', 'queued', ?, ?, NULL)",
      ).bind(
        "run-duplicate",
        policy.id,
        policy.policyHash,
        "migration-duplicate",
        "2026-07-29T11:00:00.000Z",
      ),
      db.prepare(
        "INSERT INTO source_records (id, run_id, source_identity, source_record_id, retrieved_at, raw_json, normalized_json, raw_fingerprint, normalized_fingerprint, classification, reason_code, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'safe', NULL, NULL)",
      ).bind(
        "record-on-duplicate",
        "run-duplicate",
        "parcel-migration-history",
        "99",
        "2026-07-29T11:00:00.000Z",
        "{}",
        "{}",
        "raw-migration-history",
        "normalized-migration-history",
      ),
    ]);
    await appendAuditEvent(
      db,
      db.prepare("UPDATE ingestion_runs SET status = status WHERE id = ?").bind("run-duplicate"),
      {
        id: "audit-run-duplicate",
        occurredAt: "2026-07-29T11:00:00.000Z",
        actorId: "actor",
        eventType: "ingestion-run-started",
        aggregateType: "ingestion-run",
        aggregateId: "run-duplicate",
        metadataJson: "{}",
      },
    );
    const auditBefore = await db.prepare(
      "SELECT id, previous_hash, event_hash FROM audit_events ORDER BY sequence",
    ).all<{ id: string; previous_hash: string; event_hash: string }>();

    await assert.doesNotReject(() => applyTestD1Migrations(db, { fromMigration: 1 }));

    const runs = await db.prepare(
      "SELECT id, status, completed_at, failed_count, last_error_code FROM ingestion_runs ORDER BY requested_at, rowid",
    ).all<{
      id: string;
      status: string;
      completed_at: string | null;
      failed_count: number;
      last_error_code: string | null;
    }>();
    assert.deepEqual(runs.results[0], {
      id: "run-canonical",
      status: "running",
      completed_at: null,
      failed_count: 0,
      last_error_code: null,
    });
    assert.equal(runs.results[1]?.id, "run-duplicate");
    assert.equal(runs.results[1]?.status, "failed");
    assert.match(runs.results[1]?.completed_at ?? "", /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(runs.results[1]?.failed_count, 1);
    assert.equal(runs.results[1]?.last_error_code, "migration-duplicate-active-run");
    assert.equal(runs.results.length, 2);

    const active = await db.prepare(
      "SELECT id FROM ingestion_runs WHERE policy_id = ? AND status IN ('queued', 'running')",
    ).bind(policy.id).all<{ id: string }>();
    assert.deepEqual(active.results, [{ id: "run-canonical" }]);
    assert.equal(
      (await db.prepare("SELECT run_id FROM source_records WHERE id = 'record-on-duplicate'").first<{ run_id: string }>())?.run_id,
      "run-duplicate",
    );
    const auditAfter = await db.prepare(
      "SELECT id, previous_hash, event_hash FROM audit_events ORDER BY sequence",
    ).all<{ id: string; previous_hash: string; event_hash: string }>();
    assert.deepEqual(auditAfter.results, auditBefore.results);
    assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all<Record<string, unknown>>()).results, []);
  } finally {
    await closeTestD1(db);
  }
});

test("identical ID-less rejections on separate pages do not roll back safe siblings", async () => {
  await withDb(async (db) => {
    const policy = await approvePolicy(
      db,
      validPolicy({ pageSize: 2 }),
      "actor",
      new Date(NOW),
    );
    const malformed = feature(0, { OBJECTID: "not-an-id" });
    const pages = [
      [feature(1), malformed],
      [feature(2), malformed],
      [],
    ];
    const result = await runIngestion({
      db,
      policy,
      trigger: "operator",
      idempotencyKey: "repeated-rejection",
      actorId: "actor",
      signal: new AbortController().signal,
      fetchOptions: {
        fetch: async (input) => {
          const url = new URL(input.toString());
          const page = Number(url.searchParams.get("resultOffset")) / 2;
          return new Response(JSON.stringify({ features: pages[page] }), { status: 200 });
        },
        retrievedAt: NOW,
      },
    });

    const records = await listRecords(db);
    assert.equal(result.status, "staged");
    assert.equal(result.safeCount, 2);
    assert.equal(result.exceptionCount, 2);
    assert.equal(records.filter((record) => record.classification === "safe").length, 2);
    assert.equal(records.filter((record) => record.classification === "exception").length, 2);
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
