import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { appendAuditEvent } from "../lib/ingestion/audit.ts";
import {
  hashPolicy,
  type SourcePolicy,
  validatePolicy,
} from "../lib/ingestion/policy.ts";
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

test("migration creates only the four ingestion tables", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  assert.deepEqual(await tableNames(db), [
    "audit_events",
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

test("import acknowledgement counts only real safe records and audits local outcomes", async (t) => {
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
      "INSERT INTO source_records (id, run_id, source_identity, source_record_id, retrieved_at, raw_json, normalized_json, raw_fingerprint, normalized_fingerprint, classification, reason_code, imported_at) VALUES (?, ?, ?, ?, ?, '{}', '{}', ?, ?, 'exception', 'invalid-record', NULL)",
    ).bind("record-exception", run.id, "exception-identity", "exception-source", now.toISOString(), "raw-exception", "normalized-exception"),
  ]);
  const outcomeCounts = {
    applied: 1,
    changedSource: 0,
    exactReimport: 0,
    possiblePropertyMatch: 0,
    excluded: 2,
  };

  const acknowledged = await markRecordsImported(
    db,
    ["record-safe", "record-exception", "record-missing"],
    "actor",
    now,
    outcomeCounts,
  );

  assert.equal(acknowledged, 1);
  assert.equal(
    (await db.prepare("SELECT imported_count FROM ingestion_runs WHERE id = ?").bind(run.id).first<{ imported_count: number }>())?.imported_count,
    1,
  );
  const event = await db.prepare(
    "SELECT metadata_json FROM audit_events WHERE event_type = 'source-records-imported'",
  ).first<{ metadata_json: string }>();
  assert.deepEqual(JSON.parse(event?.metadata_json ?? "null"), {
    outcomeCounts,
    recordIds: ["record-safe"],
  });
});
