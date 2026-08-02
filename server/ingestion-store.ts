import { appendAuditEvent } from "../lib/ingestion/audit.ts";
import type { IngestionRun, SourceImportOutcomeCounts, StagedSourceRecord } from "../lib/ingestion/contracts.ts";
import type { MassGisCandidate, MassGisRecordRejection } from "../lib/ingestion/massgis.ts";
import { canonicalJson, hashPolicy, validatePolicy, type SourcePolicy } from "../lib/ingestion/policy.ts";
import type { D1Database, D1PreparedStatement } from "./d1.ts";

export type ApprovedPolicy = {
  id: string;
  version: number;
  status: "active";
  policy: SourcePolicy;
  policyHash: string;
  approvedBy: string;
  approvedAt: string;
  nextRunAt: string | null;
};

type StoredPolicy = {
  id: string;
  version: number;
  status: string;
  policy_json: string;
  policy_hash: string;
  approved_by: string | null;
  approved_at: string | null;
  next_run_at: string | null;
};

type StoredRun = {
  id: string;
  policy_id: string;
  policy_hash: string;
  trigger: IngestionRun["trigger"];
  status: IngestionRun["status"];
  idempotency_key: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  retrieved_count: number;
  safe_count: number;
  duplicate_count: number;
  changed_count: number;
  exception_count: number;
  imported_count: number;
  failed_count: number;
  last_error_code: string | null;
};

type StoredSourceRecord = {
  id: string;
  run_id: string;
  source_identity: string;
  source_record_id: string;
  retrieved_at: string;
  raw_json: string;
  normalized_json: string;
  raw_fingerprint: string;
  normalized_fingerprint: string;
  classification: StagedSourceRecord["classification"];
  reason_code: string | null;
  imported_at: string | null;
};

export type RunCounts = {
  retrieved: number;
  safe: number;
  duplicate: number;
  changed: number;
  exception: number;
};

function runFromRow(row: StoredRun): IngestionRun {
  return {
    id: row.id,
    policyId: row.policy_id,
    policyHash: row.policy_hash,
    trigger: row.trigger,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    retrievedCount: row.retrieved_count,
    safeCount: row.safe_count,
    duplicateCount: row.duplicate_count,
    changedCount: row.changed_count,
    exceptionCount: row.exception_count,
    importedCount: row.imported_count,
    failedCount: row.failed_count,
    lastErrorCode: row.last_error_code,
  };
}

function recordFromRow(row: StoredSourceRecord): StagedSourceRecord {
  return {
    id: row.id,
    runId: row.run_id,
    sourceIdentity: row.source_identity,
    sourceRecordId: row.source_record_id,
    retrievedAt: row.retrieved_at,
    rawJson: row.raw_json,
    normalizedJson: row.normalized_json,
    rawFingerprint: row.raw_fingerprint,
    normalizedFingerprint: row.normalized_fingerprint,
    classification: row.classification,
    reasonCode: row.reason_code,
    importedAt: row.imported_at,
  };
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseApprovedPolicy(row: StoredPolicy | null): ApprovedPolicy | null {
  if (!row || row.status !== "active" || !row.approved_by || !row.approved_at) return null;
  const parsed = JSON.parse(row.policy_json) as unknown;
  const validated = validatePolicy(parsed);
  if (!validated.ok) throw new Error(`stored policy is invalid: ${validated.error}`);
  return {
    id: row.id,
    version: row.version,
    status: "active",
    policy: validated.value,
    policyHash: row.policy_hash,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    nextRunAt: row.next_run_at,
  };
}

export async function getActivePolicy(db: D1Database): Promise<ApprovedPolicy | null> {
  return parseApprovedPolicy(await db.prepare(
    "SELECT id, version, status, policy_json, policy_hash, approved_by, approved_at, next_run_at FROM source_policies WHERE status = 'active' LIMIT 1",
  ).first<StoredPolicy>());
}

export async function approvePolicy(
  db: D1Database,
  policy: SourcePolicy,
  actorId: string,
  now = new Date(),
): Promise<ApprovedPolicy> {
  const validated = validatePolicy(policy);
  if (!validated.ok) throw new Error(validated.error);
  const policyHash = await hashPolicy(validated.value);
  const timestamp = now.toISOString();
  const versionRow = await db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM source_policies")
    .first<{ version: number }>();
  const version = (versionRow?.version ?? 0) + 1;
  const id = newId("policy");
  const statements: D1PreparedStatement[] = [
    db.prepare("UPDATE source_policies SET status = 'superseded' WHERE status = 'active'"),
    db.prepare(
      "INSERT INTO source_policies (id, version, status, policy_json, policy_hash, approved_by, approved_at, next_run_at, created_at) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?)",
    ).bind(id, version, canonicalJson(validated.value), policyHash, actorId, timestamp, null, timestamp),
  ];
  await appendAuditEvent(db, statements, {
    id: newId("audit"),
    occurredAt: timestamp,
    actorId,
    eventType: "source-policy-approved",
    aggregateType: "source-policy",
    aggregateId: id,
    metadataJson: canonicalJson({ version, policyHash }),
  });
  const active = await getActivePolicy(db);
  if (!active) throw new Error("approved policy was not persisted");
  return active;
}

export async function getRunByIdempotencyKey(db: D1Database, key: string): Promise<IngestionRun | null> {
  const row = await db.prepare(
    "SELECT * FROM ingestion_runs WHERE idempotency_key = ? LIMIT 1",
  ).bind(key).first<StoredRun>();
  return row ? runFromRow(row) : null;
}

export async function getRun(db: D1Database, id: string): Promise<IngestionRun | null> {
  const row = await db.prepare("SELECT * FROM ingestion_runs WHERE id = ? LIMIT 1")
    .bind(id).first<StoredRun>();
  return row ? runFromRow(row) : null;
}

export async function createRun(
  db: D1Database,
  policy: ApprovedPolicy,
  trigger: "operator" | "schedule",
  idempotencyKey: string,
  actorId: string,
  now = new Date(),
): Promise<{ run: IngestionRun; existing: boolean }> {
  const existing = await getRunByIdempotencyKey(db, idempotencyKey);
  if (existing) return { run: existing, existing: true };
  const overlap = await db.prepare(
    "SELECT id FROM ingestion_runs WHERE policy_id = ? AND status IN ('queued', 'running') LIMIT 1",
  ).bind(policy.id).first<{ id: string }>();
  if (overlap) throw new Error("an ingestion run is already in progress");
  const id = newId("run");
  const timestamp = now.toISOString();
  const insert = db.prepare(
    "INSERT INTO ingestion_runs (id, policy_id, policy_hash, trigger, status, idempotency_key, requested_at, started_at) VALUES (?, ?, ?, ?, 'running', ?, ?, ?)",
  ).bind(id, policy.id, policy.policyHash, trigger, idempotencyKey, timestamp, timestamp);
  try {
    await appendAuditEvent(db, insert, {
      id: newId("audit"),
      occurredAt: timestamp,
      actorId,
      eventType: "ingestion-run-started",
      aggregateType: "ingestion-run",
      aggregateId: id,
      metadataJson: canonicalJson({ policyHash: policy.policyHash, trigger }),
    });
  } catch (error) {
    const idempotent = await getRunByIdempotencyKey(db, idempotencyKey);
    if (idempotent) return { run: idempotent, existing: true };
    const admitted = await db.prepare(
      "SELECT id FROM ingestion_runs WHERE policy_id = ? AND status IN ('queued', 'running') LIMIT 1",
    ).bind(policy.id).first<{ id: string }>();
    if (admitted) throw new Error("an ingestion run is already in progress");
    const active = await getActivePolicy(db);
    if (!active || active.id !== policy.id || active.policyHash !== policy.policyHash) {
      throw new Error("approved policy is no longer active");
    }
    throw error;
  }
  const run = await getRun(db, id);
  if (!run) throw new Error("ingestion run was not persisted");
  return { run, existing: false };
}

export async function persistPage(
  db: D1Database,
  runId: string,
  pageOrdinal: number,
  records: MassGisCandidate[],
  rejections: MassGisRecordRejection[],
  actorId: string,
  now = new Date(),
): Promise<RunCounts> {
  const counts: RunCounts = {
    retrieved: records.length + rejections.length,
    safe: 0,
    duplicate: 0,
    changed: 0,
    exception: rejections.length,
  };
  const statements: D1PreparedStatement[] = [];
  for (const candidate of records) {
    const prior = await db.prepare(
      "SELECT normalized_fingerprint FROM source_records WHERE source_identity = ? ORDER BY retrieved_at DESC LIMIT 1",
    ).bind(candidate.sourceIdentity).first<{ normalized_fingerprint: string }>();
    if (prior?.normalized_fingerprint === candidate.normalizedFingerprint) {
      counts.duplicate += 1;
      continue;
    }
    const classification: StagedSourceRecord["classification"] = prior ? "changed" : "safe";
    counts[classification] += 1;
    const json = canonicalJson(candidate);
    statements.push(db.prepare(
      "INSERT INTO source_records (id, run_id, source_identity, source_record_id, retrieved_at, raw_json, normalized_json, raw_fingerprint, normalized_fingerprint, classification, reason_code, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
    ).bind(
      newId("record"), runId, candidate.sourceIdentity, candidate.sourceRecordId,
      candidate.retrievedAt, json, json, candidate.rawFingerprint,
      candidate.normalizedFingerprint, classification,
      classification === "changed" ? "source-conflict" : null,
    ));
  }
  for (let index = 0; index < rejections.length; index += 1) {
    const rejection = rejections[index];
    const json = canonicalJson(rejection);
    const fingerprint = await digest(`${runId}:${pageOrdinal}:${index}:${json}`);
    statements.push(db.prepare(
      "INSERT INTO source_records (id, run_id, source_identity, source_record_id, retrieved_at, raw_json, normalized_json, raw_fingerprint, normalized_fingerprint, classification, reason_code, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'exception', 'invalid-record', NULL)",
    ).bind(
      newId("record"), runId, `massgis-rejection:${runId}:${pageOrdinal}:${index}:${fingerprint}`,
      rejection.sourceRecordId ?? "", now.toISOString(), "{}", json, fingerprint, fingerprint,
    ));
  }
  statements.push(db.prepare(
    "UPDATE ingestion_runs SET retrieved_count = retrieved_count + ?, safe_count = safe_count + ?, duplicate_count = duplicate_count + ?, changed_count = changed_count + ?, exception_count = exception_count + ? WHERE id = ?",
  ).bind(counts.retrieved, counts.safe, counts.duplicate, counts.changed, counts.exception, runId));
  await appendAuditEvent(db, statements, {
    id: newId("audit"),
    occurredAt: now.toISOString(),
    actorId,
    eventType: "ingestion-page-staged",
    aggregateType: "ingestion-run",
    aggregateId: runId,
    metadataJson: canonicalJson(counts),
  });
  return counts;
}

export async function finishRun(
  db: D1Database,
  runId: string,
  status: IngestionRun["status"],
  actorId: string,
  lastErrorCode: string | null,
  now = new Date(),
): Promise<IngestionRun> {
  const timestamp = now.toISOString();
  const update = db.prepare(
    "UPDATE ingestion_runs SET status = ?, completed_at = ?, last_error_code = ?, failed_count = failed_count + ? WHERE id = ?",
  ).bind(status, timestamp, lastErrorCode, status === "failed" || status === "partial" ? 1 : 0, runId);
  await appendAuditEvent(db, update, {
    id: newId("audit"),
    occurredAt: timestamp,
    actorId,
    eventType: `ingestion-run-${status}`,
    aggregateType: "ingestion-run",
    aggregateId: runId,
    metadataJson: canonicalJson({ lastErrorCode }),
  });
  const run = await getRun(db, runId);
  if (!run) throw new Error("completed ingestion run was not found");
  return run;
}

export async function listRuns(db: D1Database, limit = 5): Promise<IngestionRun[]> {
  const result = await db.prepare(
    "SELECT * FROM ingestion_runs ORDER BY requested_at DESC LIMIT ?",
  ).bind(Math.max(1, Math.min(100, limit))).all<StoredRun>();
  return result.results.map(runFromRow);
}

export async function listRecords(
  db: D1Database,
  classification?: StagedSourceRecord["classification"],
): Promise<StagedSourceRecord[]> {
  const statement = classification
    ? db.prepare("SELECT * FROM source_records WHERE classification = ? ORDER BY retrieved_at DESC").bind(classification)
    : db.prepare("SELECT * FROM source_records ORDER BY retrieved_at DESC");
  const result = await statement.all<StoredSourceRecord>();
  return result.results.map(recordFromRow);
}

export async function markRecordsImported(
  db: D1Database,
  recordIds: string[],
  actorId: string,
  now = new Date(),
  outcomeCounts?: SourceImportOutcomeCounts,
): Promise<number> {
  const uniqueIds = [...new Set(recordIds)].slice(0, 500);
  if (uniqueIds.length === 0 && !outcomeCounts) return 0;
  const recognized = uniqueIds.length === 0
    ? { results: [] as Array<{ id: string }> }
    : await db.prepare(
      `SELECT id FROM source_records WHERE classification IN ('safe', 'changed') AND id IN (${uniqueIds.map(() => "?").join(", ")})`,
    ).bind(...uniqueIds).all<{ id: string }>();
  const recognizedIds = new Set(recognized.results.map(({ id }) => id));
  const eligibleIds = uniqueIds.filter((id) => recognizedIds.has(id));
  const timestamp = now.toISOString();
  const updates = eligibleIds.flatMap((id) => [
    db.prepare(
      "UPDATE ingestion_runs SET imported_count = imported_count + 1 WHERE id = (SELECT run_id FROM source_records WHERE id = ? AND classification IN ('safe', 'changed') AND imported_at IS NULL)",
    ).bind(id),
    db.prepare(
      "UPDATE source_records SET imported_at = COALESCE(imported_at, ?) WHERE id = ? AND classification IN ('safe', 'changed')",
    ).bind(timestamp, id),
  ]);
  await appendAuditEvent(db, updates, {
    id: newId("audit"),
    occurredAt: timestamp,
    actorId,
    eventType: "source-records-imported",
    aggregateType: "source-record-batch",
    aggregateId: newId("import"),
    metadataJson: canonicalJson({ outcomeCounts: outcomeCounts ?? null, recordIds: eligibleIds }),
  });
  return eligibleIds.length;
}
