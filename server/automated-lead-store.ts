import { canonicalJson } from "../lib/ingestion/policy.ts";
import type {
  AutomatedLeadRecord,
  OwnerEnrichment,
} from "../lib/automation/lead-contracts.ts";
import type { D1Database } from "./d1.ts";

type StoredLead = {
  id: string;
  organization_id: string;
  source_identity: string;
  source_record_id: string;
  source_fingerprint: string;
  source_retrieved_at: string;
  provider: AutomatedLeadRecord["provider"];
  provider_property_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  estimated_value: number | null;
  owner_names_json: string;
  owner_type: string | null;
  owner_mailing_address_json: string | null;
  owner_occupied: number | null;
  enrichment_status: string;
  created_at: string;
  updated_at: string;
};

type StoredAttempt = {
  id: string;
  organization_id: string;
  lead_id: string;
  provider: string;
  request_hash: string;
  status: string;
  response_status: number | null;
  error_code: string | null;
  started_at: string;
  completed_at: string | null;
  next_attempt_at: string | null;
};

export type AutomatedLeadInput = AutomatedLeadRecord & {
  organizationId: string;
  sourceIdentity: string;
  sourceRecordId: string;
  sourceFingerprint: string;
  sourceRetrievedAt: string;
};

export type AutomatedLead = AutomatedLeadInput & {
  id: string;
  enrichmentStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type EnrichmentAttemptInput = {
  organizationId: string;
  leadId: string;
  provider: string;
  requestHash: string;
  status: "started" | "succeeded" | "failed" | "skipped";
  responseStatus?: number | null;
  errorCode?: string | null;
  startedAt: string;
  completedAt?: string | null;
  nextAttemptAt?: string | null;
};

export type EnrichmentAttempt = EnrichmentAttemptInput & { id: string };

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function parseNames(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseObject<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function leadFromRow(row: StoredLead): AutomatedLead {
  return {
    organizationId: row.organization_id,
    sourceIdentity: row.source_identity,
    sourceRecordId: row.source_record_id,
    sourceFingerprint: row.source_fingerprint,
    sourceRetrievedAt: row.source_retrieved_at,
    provider: row.provider,
    providerPropertyId: row.provider_property_id,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    estimatedValue: row.estimated_value,
    ownerNames: parseNames(row.owner_names_json),
    ownerType: row.owner_type,
    ownerMailingAddress: parseObject(row.owner_mailing_address_json),
    ownerOccupied: row.owner_occupied === null ? null : Boolean(row.owner_occupied),
    id: row.id,
    enrichmentStatus: row.enrichment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attemptFromRow(row: StoredAttempt): EnrichmentAttempt {
  return {
    organizationId: row.organization_id,
    leadId: row.lead_id,
    provider: row.provider,
    requestHash: row.request_hash,
    status: row.status as EnrichmentAttemptInput["status"],
    responseStatus: row.response_status,
    errorCode: row.error_code,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    nextAttemptAt: row.next_attempt_at,
    id: row.id,
  };
}

function ownerJson(input: AutomatedLeadInput & { provider: "rentcast" }): string {
  const owner: OwnerEnrichment = {
    provider: input.provider,
    providerPropertyId: input.providerPropertyId,
    ownerNames: input.ownerNames,
    ownerType: input.ownerType,
    ownerMailingAddress: input.ownerMailingAddress,
    ownerOccupied: input.ownerOccupied,
  };
  return canonicalJson(owner);
}

export async function upsertAutomatedLead(
  db: D1Database,
  input: AutomatedLeadInput,
  now = new Date(),
): Promise<{ lead: AutomatedLead; created: boolean; changed: boolean }> {
  if (!input.organizationId.trim()) throw new Error("organizationId is required");
  if (!input.sourceIdentity.trim() || !input.sourceRecordId.trim()) throw new Error("lead source identity is required");
  const existing = await db.prepare(
    "SELECT * FROM automated_leads WHERE organization_id = ? AND source_identity = ? AND source_record_id = ? LIMIT 1",
  ).bind(input.organizationId, input.sourceIdentity, input.sourceRecordId).first<StoredLead>();
  const timestamp = now.toISOString();
  const id = existing?.id ?? newId("lead");
  const changed = existing ? existing.source_fingerprint !== input.sourceFingerprint : false;
  const status = input.ownerNames.length > 0 || input.ownerMailingAddress ? "available" : "needs_enrichment";
  const values = [
    id, input.organizationId, input.sourceIdentity, input.sourceRecordId, input.sourceFingerprint,
    input.sourceRetrievedAt, input.provider, input.providerPropertyId, input.address, input.city,
    input.state, input.zip, input.estimatedValue, canonicalJson(input.ownerNames), input.ownerType,
    input.ownerMailingAddress ? canonicalJson(input.ownerMailingAddress) : null,
    input.ownerOccupied === null ? null : input.ownerOccupied ? 1 : 0, status,
    existing?.created_at ?? timestamp, timestamp,
  ];
  await db.prepare(
    `INSERT INTO automated_leads
      (id, organization_id, source_identity, source_record_id, source_fingerprint, source_retrieved_at,
       provider, provider_property_id, address, city, state, zip, estimated_value, owner_names_json,
       owner_type, owner_mailing_address_json, owner_occupied, enrichment_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (organization_id, source_identity, source_record_id) DO UPDATE SET
       source_fingerprint = excluded.source_fingerprint,
       source_retrieved_at = excluded.source_retrieved_at,
       provider = excluded.provider,
       provider_property_id = excluded.provider_property_id,
       address = excluded.address,
       city = excluded.city,
       state = excluded.state,
       zip = excluded.zip,
       estimated_value = excluded.estimated_value,
       owner_names_json = excluded.owner_names_json,
       owner_type = excluded.owner_type,
       owner_mailing_address_json = excluded.owner_mailing_address_json,
       owner_occupied = excluded.owner_occupied,
       enrichment_status = excluded.enrichment_status,
       updated_at = excluded.updated_at`,
  ).bind(...values).run();

  const lead = await db.prepare("SELECT * FROM automated_leads WHERE id = ? LIMIT 1").bind(id).first<StoredLead>();
  if (!lead) throw new Error("automated lead was not persisted");
  if (input.provider === "rentcast") {
    await db.prepare(
      `INSERT INTO lead_owner_profiles (id, organization_id, lead_id, provider, provider_property_id, owner_json, observed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, lead_id, provider) DO UPDATE SET
         provider_property_id = excluded.provider_property_id,
         owner_json = excluded.owner_json,
         observed_at = excluded.observed_at`,
    ).bind(newId("owner"), input.organizationId, id, input.provider, input.providerPropertyId, ownerJson({ ...input, provider: "rentcast" }), timestamp).run();
  }
  return { lead: leadFromRow(lead), created: !existing, changed };
}

export async function getAutomatedLead(
  db: D1Database,
  organizationId: string,
  id: string,
): Promise<AutomatedLead | null> {
  const row = await db.prepare(
    "SELECT * FROM automated_leads WHERE organization_id = ? AND id = ? LIMIT 1",
  ).bind(organizationId, id).first<StoredLead>();
  return row ? leadFromRow(row) : null;
}

export async function getAutomatedLeadBySource(
  db: D1Database,
  organizationId: string,
  sourceIdentity: string,
  sourceRecordId: string,
): Promise<AutomatedLead | null> {
  const row = await db.prepare(
    "SELECT * FROM automated_leads WHERE organization_id = ? AND source_identity = ? AND source_record_id = ? LIMIT 1",
  ).bind(organizationId, sourceIdentity, sourceRecordId).first<StoredLead>();
  return row ? leadFromRow(row) : null;
}

export async function listAutomatedLeads(
  db: D1Database,
  organizationId: string,
  options: { limit?: number; offset?: number; status?: string } = {},
): Promise<AutomatedLead[]> {
  const limit = Math.max(1, Math.min(100, Number.isInteger(options.limit) ? options.limit as number : 25));
  const offset = Math.max(0, Math.min(10_000, Number.isInteger(options.offset) ? options.offset as number : 0));
  const status = options.status?.trim();
  const statement = status
    ? db.prepare("SELECT * FROM automated_leads WHERE organization_id = ? AND enrichment_status = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?").bind(organizationId, status, limit, offset)
    : db.prepare("SELECT * FROM automated_leads WHERE organization_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?").bind(organizationId, limit, offset);
  const result = await statement.all<StoredLead>();
  return result.results.map(leadFromRow);
}

export async function recordEnrichmentAttempt(
  db: D1Database,
  input: EnrichmentAttemptInput,
): Promise<{ attempt: EnrichmentAttempt; existing: boolean }> {
  const existing = await db.prepare(
    "SELECT * FROM lead_enrichment_attempts WHERE organization_id = ? AND lead_id = ? AND provider = ? AND request_hash = ? LIMIT 1",
  ).bind(input.organizationId, input.leadId, input.provider, input.requestHash).first<StoredAttempt>();
  if (existing) return { attempt: attemptFromRow(existing), existing: true };
  const id = newId("enrichment");
  try {
    await db.prepare(
      `INSERT INTO lead_enrichment_attempts
        (id, organization_id, lead_id, provider, request_hash, status, response_status, error_code,
         started_at, completed_at, next_attempt_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, input.organizationId, input.leadId, input.provider, input.requestHash, input.status,
      input.responseStatus ?? null, input.errorCode ?? null, input.startedAt,
      input.completedAt ?? null, input.nextAttemptAt ?? null,
    ).run();
  } catch (error) {
    const raced = await db.prepare(
      "SELECT * FROM lead_enrichment_attempts WHERE organization_id = ? AND lead_id = ? AND provider = ? AND request_hash = ? LIMIT 1",
    ).bind(input.organizationId, input.leadId, input.provider, input.requestHash).first<StoredAttempt>();
    if (raced) return { attempt: attemptFromRow(raced), existing: true };
    throw error;
  }
  const attempt = await db.prepare("SELECT * FROM lead_enrichment_attempts WHERE id = ? LIMIT 1").bind(id).first<StoredAttempt>();
  if (!attempt) throw new Error("enrichment attempt was not persisted");
  return { attempt: attemptFromRow(attempt), existing: false };
}

export async function completeEnrichmentAttempt(
  db: D1Database,
  input: {
    id: string;
    status: EnrichmentAttemptInput["status"];
    responseStatus?: number | null;
    errorCode?: string | null;
    completedAt: string;
    nextAttemptAt?: string | null;
  },
): Promise<EnrichmentAttempt> {
  await db.prepare(
    "UPDATE lead_enrichment_attempts SET status = ?, response_status = ?, error_code = ?, completed_at = ?, next_attempt_at = ? WHERE id = ?",
  ).bind(
    input.status,
    input.responseStatus ?? null,
    input.errorCode ?? null,
    input.completedAt,
    input.nextAttemptAt ?? null,
    input.id,
  ).run();
  const attempt = await db.prepare("SELECT * FROM lead_enrichment_attempts WHERE id = ? LIMIT 1").bind(input.id).first<StoredAttempt>();
  if (!attempt) throw new Error("enrichment attempt was not found");
  return attemptFromRow(attempt);
}

export async function getEnrichmentStatus(
  db: D1Database,
  organizationId: string,
  leadId: string,
): Promise<EnrichmentAttempt[]> {
  const result = await db.prepare(
    "SELECT * FROM lead_enrichment_attempts WHERE organization_id = ? AND lead_id = ? ORDER BY started_at DESC LIMIT 50",
  ).bind(organizationId, leadId).all<StoredAttempt>();
  return result.results.map(attemptFromRow);
}
