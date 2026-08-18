import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  uniqueIndex("ingestion_runs_one_active_per_policy")
    .on(table.policyId)
    .where(sql`${table.status} IN ('queued', 'running')`),
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

export const automatedLeads = sqliteTable("automated_leads", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  sourceIdentity: text("source_identity").notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  sourceFingerprint: text("source_fingerprint").notNull(),
  sourceRetrievedAt: text("source_retrieved_at").notNull(),
  provider: text("provider").notNull(),
  providerPropertyId: text("provider_property_id").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  estimatedValue: real("estimated_value"),
  ownerNamesJson: text("owner_names_json").notNull(),
  ownerType: text("owner_type"),
  ownerMailingAddressJson: text("owner_mailing_address_json"),
  ownerOccupied: integer("owner_occupied", { mode: "boolean" }),
  enrichmentStatus: text("enrichment_status").notNull().default("available"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("automated_leads_org_source_unique").on(table.organizationId, table.sourceIdentity, table.sourceRecordId),
  uniqueIndex("automated_leads_org_provider_unique").on(table.organizationId, table.provider, table.providerPropertyId),
  index("automated_leads_org_status_idx").on(table.organizationId, table.enrichmentStatus, table.updatedAt),
  index("automated_leads_org_location_idx").on(table.organizationId, table.state, table.city, table.zip),
]);

export const leadOwnerProfiles = sqliteTable("lead_owner_profiles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  leadId: text("lead_id").notNull().references(() => automatedLeads.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  providerPropertyId: text("provider_property_id").notNull(),
  ownerJson: text("owner_json").notNull(),
  observedAt: text("observed_at").notNull(),
}, (table) => [
  uniqueIndex("lead_owner_profiles_lead_provider_unique").on(table.organizationId, table.leadId, table.provider),
]);

export const leadEnrichmentAttempts = sqliteTable("lead_enrichment_attempts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  leadId: text("lead_id").notNull().references(() => automatedLeads.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  requestHash: text("request_hash").notNull(),
  status: text("status").notNull(),
  responseStatus: integer("response_status"),
  errorCode: text("error_code"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  nextAttemptAt: text("next_attempt_at"),
}, (table) => [
  uniqueIndex("lead_enrichment_attempts_idempotency_unique").on(table.organizationId, table.leadId, table.provider, table.requestHash),
  index("lead_enrichment_attempts_retry_idx").on(table.organizationId, table.status, table.nextAttemptAt),
]);

export const promotedOpportunities = sqliteTable("promoted_opportunities", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  sourceLeadId: text("source_lead_id"),
  dealId: text("deal_id").notNull(),
  dealJson: text("deal_json").notNull(),
  workspaceJson: text("workspace_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("promoted_opportunities_org_lead_unique").on(table.organizationId, table.sourceLeadId),
  uniqueIndex("promoted_opportunities_org_deal_unique").on(table.organizationId, table.dealId),
  index("promoted_opportunities_org_updated_idx").on(table.organizationId, table.updatedAt),
]);
