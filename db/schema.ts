import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sourcePolicies = sqliteTable("source_policies", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  status: text("status", { enum: ["draft", "active", "paused", "superseded"] }).notNull(),
  policyJson: text("policy_json").notNull(),
  policyHash: text("policy_hash").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  nextRunAt: text("next_run_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("source_policies_version_unique").on(table.version),
  uniqueIndex("source_policies_one_active").on(table.status).where(sql`${table.status} = 'active'`),
]);

export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: text("id").primaryKey(),
  policyId: text("policy_id").notNull().references(() => sourcePolicies.id, { onDelete: "restrict" }),
  policyHash: text("policy_hash").notNull(),
  trigger: text("trigger", { enum: ["operator", "schedule", "retry"] }).notNull(),
  status: text("status", { enum: ["queued", "running", "staged", "completed", "partial", "failed", "cancelled"] }).notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestedAt: text("requested_at").notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  retrievedCount: integer("retrieved_count").notNull().default(0),
  safeCount: integer("safe_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  changedCount: integer("changed_count").notNull().default(0),
  exceptionCount: integer("exception_count").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  lastErrorCode: text("last_error_code"),
}, (table) => [
  uniqueIndex("ingestion_runs_idempotency_key_unique").on(table.idempotencyKey),
  index("ingestion_runs_policy_id_idx").on(table.policyId),
]);

export const sourceRecords = sqliteTable("source_records", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => ingestionRuns.id, { onDelete: "restrict" }),
  sourceIdentity: text("source_identity").notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  retrievedAt: text("retrieved_at").notNull(),
  rawJson: text("raw_json").notNull(),
  normalizedJson: text("normalized_json").notNull(),
  rawFingerprint: text("raw_fingerprint").notNull(),
  normalizedFingerprint: text("normalized_fingerprint").notNull(),
  classification: text("classification", { enum: ["safe", "exact-duplicate", "changed", "exception"] }).notNull(),
  reasonCode: text("reason_code"),
  importedAt: text("imported_at"),
}, (table) => [
  uniqueIndex("source_records_source_normalized_unique").on(table.sourceIdentity, table.normalizedFingerprint),
  index("source_records_run_id_idx").on(table.runId),
]);

export const auditEvents = sqliteTable("audit_events", {
  sequence: integer("sequence").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  occurredAt: text("occurred_at").notNull(),
  actorId: text("actor_id").notNull(),
  eventType: text("event_type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  metadataJson: text("metadata_json").notNull(),
  previousHash: text("previous_hash").notNull().unique(),
  eventHash: text("event_hash").notNull().unique(),
});
