import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { appendAuditEvent } from "../lib/ingestion/audit.ts";
import {
  hashPolicy,
  type SourcePolicy,
  validatePolicy,
} from "../lib/ingestion/policy.ts";
import * as policyModule from "../lib/ingestion/policy.ts";
import { approvePolicy, createRun, markRecordsImported } from "../server/ingestion-store.ts";
import { closeTestD1, createTestD1, tableNames } from "./helpers/d1.ts";

function validPolicy(overrides: Partial<SourcePolicy> = {}): SourcePolicy {
  return {
    adapter: "massgis-parcels-v1",
    endpoint: "https://services1.arcgis.com/hGdibHYSPO59RG1h/ArcGIS/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0/query",
    townIds: [35, 1],
    outFields: ["OBJECTID", "SITE_ADDR", "TOWN_ID"],
    useCodes: ["101"],
    unitCounts: [1],
    maximumAssessedValue: null,
    maximumYearBuilt: null,
    minimumLastSaleAgeYears: null,
    pageSize: 2000,
    maxRecordsPerRun: 5000,
    scheduleEnabled: true,
    scheduleTimeZone: "America/New_York",
    scheduleHour: 2,
    scheduleMinute: 0,
    ...overrides,
  };
}

test("migrations create the MassGIS and control-plane tables", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  assert.deepEqual(await tableNames(db), [
    "audit_events",
    "control_plane_actions",
    "control_plane_approval_decisions",
    "control_plane_approval_requests",
    "control_plane_authorities",
    "control_plane_envelopes",
    "control_plane_idempotency_claims",
    "control_plane_ledger_events",
    "control_plane_webhook_events",
    "ingestion_runs",
    "source_policies",
    "source_records",
  ]);
});

test("one material policy change invalidates approval", async () => {
  const approved = validPolicy({ maxRecordsPerRun: 5000 });
  const changed = validPolicy({ maxRecordsPerRun: 6000 });
  assert.notEqual(await hashPolicy(approved), await hashPolicy(changed));
});

test("policy rejects owner fields and arbitrary endpoints", () => {
  assert.equal(validatePolicy({ ...validPolicy(), outFields: ["OWNER1"] }).ok, false);
  assert.equal(
    validatePolicy({ ...validPolicy(), endpoint: "https://example.com/query" }).ok,
    false,
  );
});

test("policy hashes are unchanged by array order or duplicate values", async () => {
  const ordered = validPolicy({ townIds: [1, 35], useCodes: ["101", "104"], unitCounts: [1, 2] });
  const repeated = validPolicy({ townIds: [35, 1, 1], useCodes: ["104", "101", "101"], unitCounts: [2, 1, 1] });
  assert.equal(await hashPolicy(ordered), await hashPolicy(repeated));
});

test("policy enforces the configured numeric bounds", () => {
  assert.equal(validatePolicy(validPolicy({ townIds: [0] })).ok, false);
  assert.equal(validatePolicy(validPolicy({ pageSize: 2001 })).ok, false);
  assert.equal(validatePolicy(validPolicy({ maxRecordsPerRun: 99 })).ok, false);
});

test("hydration applies the real buy-box ceiling once without overwriting a later edit", () => {
  const sync = (policyModule as unknown as {
    syncInitialPolicyFromHydration?: (
      draft: SourcePolicy,
      ceiling: number,
      state: { hydrated: boolean; synced: boolean; edited: boolean },
    ) => { policy: SourcePolicy; synced: boolean };
  }).syncInitialPolicyFromHydration;
  assert.equal(typeof sync, "function");
  if (!sync) return;

  const first = sync(validPolicy({ maximumAssessedValue: 750_000 }), 425_000, {
    hydrated: true,
    synced: false,
    edited: false,
  });
  assert.equal(first.policy.maximumAssessedValue, 425_000);
  assert.equal(first.synced, true);

  const second = sync({ ...first.policy, maximumAssessedValue: 500_000 }, 300_000, {
    hydrated: true,
    synced: first.synced,
    edited: true,
  });
  assert.equal(second.policy.maximumAssessedValue, 500_000);
});

test("a stored source policy replaces an untouched draft but never an operator edit", () => {
  const applyStored = (policyModule as unknown as {
    applyStoredPolicyToDraft?: (
      draft: SourcePolicy,
      storedPolicy: SourcePolicy,
      edited: boolean,
    ) => SourcePolicy;
  }).applyStoredPolicyToDraft;
  assert.equal(typeof applyStored, "function");
  if (!applyStored) return;

  const draft = validPolicy({ maximumAssessedValue: 750_000 });
  const stored = validPolicy({ maximumAssessedValue: 325_000 });
  assert.equal(applyStored(draft, stored, false).maximumAssessedValue, 325_000);
  assert.equal(applyStored(draft, stored, true).maximumAssessedValue, 750_000);
});

test("buy-box hydration cannot overwrite a source policy already loaded from storage", () => {
  const sync = (policyModule as unknown as {
    syncInitialPolicyFromHydration?: (
      draft: SourcePolicy,
      ceiling: number,
      state: {
        hydrated: boolean;
        synced: boolean;
        edited: boolean;
        storedPolicyLoaded: boolean;
      },
    ) => { policy: SourcePolicy; synced: boolean };
  }).syncInitialPolicyFromHydration;
  assert.equal(typeof sync, "function");
  if (!sync) return;

  const stored = validPolicy({ maximumAssessedValue: 325_000 });
  const result = sync(stored, 425_000, {
    hydrated: true,
    synced: false,
    edited: false,
    storedPolicyLoaded: true,
  });
  assert.equal(result.policy.maximumAssessedValue, 325_000);
  assert.equal(result.synced, true);
});

test("audit event commits the state change and extends the hash chain", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  await db.prepare(
    "INSERT INTO source_policies (id, version, status, policy_json, policy_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind("policy-1", 1, "draft", "{}", "policy-hash", "2026-07-29T00:00:00.000Z").run();

  const event = {
    id: "event-1",
    occurredAt: "2026-07-29T01:00:00.000Z",
    actorId: "site-owner",
    eventType: "policy.activated",
    aggregateType: "source_policy",
    aggregateId: "policy-1",
    metadataJson: "{\"approved\":true}",
  };
  const first = await appendAuditEvent(
    db,
    db.prepare("UPDATE source_policies SET status = ? WHERE id = ?").bind("active", "policy-1"),
    event,
  );
  const policy = await db.prepare("SELECT status FROM source_policies WHERE id = ?").bind("policy-1").first<{ status: string }>();
  assert.equal(policy?.status, "active");
  assert.equal(first.previousHash, "0".repeat(64));
  assert.equal(
    first.eventHash,
    createHash("sha256").update(
      `${"0".repeat(64)}{"actorId":"site-owner","aggregateId":"policy-1","aggregateType":"source_policy","eventType":"policy.activated","id":"event-1","metadataJson":"{\\\"approved\\\":true}","occurredAt":"2026-07-29T01:00:00.000Z"}`,
    ).digest("hex"),
  );

  const second = await appendAuditEvent(
    db,
    db.prepare("UPDATE source_policies SET next_run_at = ? WHERE id = ?").bind("2026-07-30T02:00:00.000Z", "policy-1"),
    { ...event, id: "event-2", eventType: "policy.scheduled" },
  );
  assert.equal(second.previousHash, first.eventHash);
});

test("import acknowledgement counts only eligible safe or changed records and audits outcomes", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const now = new Date("2026-07-29T12:00:00.000Z");
  const policy = await approvePolicy(db, validPolicy(), "actor", now);
  const { run } = await createRun(db, policy, "operator", "ack-run", "actor", now);
  await db.batch([
    db.prepare(
      "INSERT INTO source_records (id, run_id, source_identity, source_record_id, retrieved_at, raw_json, normalized_json, raw_fingerprint, normalized_fingerprint, classification, reason_code, imported_at) VALUES (?, ?, ?, ?, ?, '{}', '{}', ?, ?, 'safe', NULL, NULL)",
    ).bind("record-safe", run.id, "safe-identity", "safe-source", now.toISOString(), "raw-safe", "normalized-safe"),
    db.prepare(
      "INSERT INTO source_records (id, run_id, source_identity, source_record_id, retrieved_at, raw_json, normalized_json, raw_fingerprint, normalized_fingerprint, classification, reason_code, imported_at) VALUES (?, ?, ?, ?, ?, '{}', '{}', ?, ?, 'changed', 'source-conflict', NULL)",
    ).bind("record-changed", run.id, "changed-identity", "changed-source", now.toISOString(), "raw-changed", "normalized-changed"),
    db.prepare(
      "INSERT INTO source_records (id, run_id, source_identity, source_record_id, retrieved_at, raw_json, normalized_json, raw_fingerprint, normalized_fingerprint, classification, reason_code, imported_at) VALUES (?, ?, ?, ?, ?, '{}', '{}', ?, ?, 'exception', 'invalid-record', NULL)",
    ).bind("record-exception", run.id, "exception-identity", "exception-source", now.toISOString(), "raw-exception", "normalized-exception"),
  ]);
  const outcomeCounts = {
    applied: 1,
    changedSource: 1,
    exactReimport: 0,
    possiblePropertyMatch: 0,
    excluded: 2,
  };

  const acknowledged = await markRecordsImported(
    db,
    ["record-safe", "record-changed", "record-exception", "record-missing"],
    "actor",
    now,
    outcomeCounts,
  );

  assert.equal(acknowledged, 2);
  assert.equal(
    (await db.prepare("SELECT imported_count FROM ingestion_runs WHERE id = ?").bind(run.id).first<{ imported_count: number }>())?.imported_count,
    2,
  );
  const event = await db.prepare(
    "SELECT metadata_json FROM audit_events WHERE event_type = 'source-records-imported'",
  ).first<{ metadata_json: string }>();
  assert.deepEqual(JSON.parse(event?.metadata_json ?? "null"), {
    outcomeCounts,
    recordIds: ["record-safe", "record-changed"],
  });
});

test("an outcome-only acknowledgement chunk is preserved in the audit chain", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const outcomeCounts = {
    applied: 0,
    changedSource: 0,
    exactReimport: 0,
    possiblePropertyMatch: 1,
    excluded: 1,
  };

  assert.equal(await markRecordsImported(db, [], "actor", new Date("2026-07-29T12:00:00.000Z"), outcomeCounts), 0);
  const event = await db.prepare(
    "SELECT metadata_json FROM audit_events WHERE event_type = 'source-records-imported'",
  ).first<{ metadata_json: string }>();
  assert.deepEqual(JSON.parse(event?.metadata_json ?? "null"), { outcomeCounts, recordIds: [] });
});
