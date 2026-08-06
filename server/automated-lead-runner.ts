import type { AutomatedLeadRecord } from "../lib/automation/lead-contracts.ts";
import { canonicalJson } from "../lib/ingestion/policy.ts";
import type { MassGisCandidate } from "../lib/ingestion/massgis.ts";
import type { D1Bindings } from "./d1.ts";
import {
  completeEnrichmentAttempt,
  getAutomatedLeadBySource,
  recordEnrichmentAttempt,
  upsertAutomatedLead,
} from "./automated-lead-store.ts";
import { runIngestion } from "./ingestion-runner.ts";
import { getActivePolicy, type ApprovedPolicy } from "./ingestion-store.ts";
import type { RentCastProvider } from "./providers/rentcast.ts";
import { isRentCastActivated, type ProviderEnvironment } from "./providers/provider-config.ts";

type StoredSourceRecord = {
  source_identity: string;
  source_record_id: string;
  retrieved_at: string;
  normalized_json: string;
  normalized_fingerprint: string;
  classification: "safe" | "changed";
};

export type AutomatedLeadRunnerEnvironment = D1Bindings & ProviderEnvironment & {
  DEALFLOW_ORGANIZATION_ID?: string;
};

export type AutomatedLeadCycleInput = {
  env: AutomatedLeadRunnerEnvironment;
  policy: ApprovedPolicy;
  organizationId: string;
  actorId: string;
  idempotencyKey: string;
  signal?: AbortSignal;
  now?: Date;
  fetchOptions?: Parameters<typeof runIngestion>[0]["fetchOptions"];
  rentCastProvider?: RentCastProvider;
};

export type AutomatedLeadCycleResult = {
  ingestionRunId: string;
  staged: number;
  leadsUpserted: number;
  enriched: number;
  enrichmentSkipped: number;
  enrichmentFailed: number;
};

function massGisLead(record: MassGisCandidate): AutomatedLeadRecord {
  return {
    provider: "massgis",
    providerPropertyId: `massgis:${record.sourceIdentity}:${record.sourceRecordId}`,
    address: record.address,
    city: record.city,
    state: "MA",
    zip: record.zip,
    estimatedValue: record.assessedValue,
    ownerNames: [],
    ownerType: null,
    ownerMailingAddress: null,
    ownerOccupied: null,
  };
}

function parseCandidate(value: string): MassGisCandidate | null {
  try {
    const parsed = JSON.parse(value) as Partial<MassGisCandidate>;
    if (
      typeof parsed.sourceIdentity !== "string"
      || typeof parsed.sourceRecordId !== "string"
      || typeof parsed.retrievedAt !== "string"
      || typeof parsed.address !== "string"
      || typeof parsed.city !== "string"
      || typeof parsed.zip !== "string"
      || typeof parsed.rawFingerprint !== "string"
      || typeof parsed.normalizedFingerprint !== "string"
    ) return null;
    return parsed as MassGisCandidate;
  } catch {
    return null;
  }
}

function addressKey(value: string): string {
  return value.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
}

function providerMatches(candidate: MassGisCandidate, providerRecord: AutomatedLeadRecord): boolean {
  return addressKey(candidate.address) === addressKey(providerRecord.address)
    && candidate.city.trim().toUpperCase() === providerRecord.city.trim().toUpperCase()
    && candidate.zip.trim() === providerRecord.zip.trim();
}

async function requestHash(candidate: MassGisCandidate): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson({
      provider: "rentcast",
      address: candidate.address,
      city: candidate.city,
      state: "MA",
      zip: candidate.zip,
    })),
  );
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function stagedRecords(env: AutomatedLeadRunnerEnvironment, runId: string): Promise<StoredSourceRecord[]> {
  const result = await env.DB.prepare(
    "SELECT source_identity, source_record_id, retrieved_at, normalized_json, normalized_fingerprint, classification FROM source_records WHERE run_id = ? AND classification IN ('safe', 'changed') ORDER BY retrieved_at ASC",
  ).bind(runId).all<StoredSourceRecord>();
  return result.results;
}

export async function runAutomatedLeadCycle(input: AutomatedLeadCycleInput): Promise<AutomatedLeadCycleResult> {
  const ingestionRun = await runIngestion({
    db: input.env.DB,
    policy: input.policy,
    trigger: "schedule",
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    signal: input.signal ?? new AbortController().signal,
    fetchOptions: input.fetchOptions,
    now: input.now,
  });
  const records = await stagedRecords(input.env, ingestionRun.id);
  let leadsUpserted = 0;
  let enriched = 0;
  let enrichmentSkipped = 0;
  let enrichmentFailed = 0;
  for (const stored of records) {
    const candidate = parseCandidate(stored.normalized_json);
    if (!candidate) continue;
    const existing = await getAutomatedLeadBySource(
      input.env.DB,
      input.organizationId,
      stored.source_identity,
      stored.source_record_id,
    );
    if (!existing || existing.sourceFingerprint !== stored.normalized_fingerprint) {
      await upsertAutomatedLead(input.env.DB, {
        ...massGisLead(candidate),
        organizationId: input.organizationId,
        sourceIdentity: stored.source_identity,
        sourceRecordId: stored.source_record_id,
        sourceFingerprint: stored.normalized_fingerprint,
        sourceRetrievedAt: stored.retrieved_at,
      }, input.now);
      leadsUpserted += 1;
    }

    if (existing?.enrichmentStatus === "available" || !input.rentCastProvider || !isRentCastActivated(input.env)) {
      enrichmentSkipped += 1;
      continue;
    }
    const hash = await requestHash(candidate);
    const attempt = await recordEnrichmentAttempt(input.env.DB, {
      organizationId: input.organizationId,
      leadId: existing?.id ?? (await getAutomatedLeadBySource(input.env.DB, input.organizationId, stored.source_identity, stored.source_record_id))?.id ?? "",
      provider: "rentcast",
      requestHash: hash,
      status: "started",
      startedAt: input.now?.toISOString() ?? new Date().toISOString(),
    });
    if (!attempt.attempt.leadId) {
      enrichmentFailed += 1;
      continue;
    }
    const completedAt = input.now?.toISOString() ?? new Date().toISOString();
    try {
      const result = await input.rentCastProvider.searchProperties({
        address: candidate.address,
        city: candidate.city,
        state: "MA",
        zipCode: candidate.zip,
        limit: 5,
      }, input.signal);
      const match = result.properties.find((property) => providerMatches(candidate, property));
      if (!match) {
        await completeEnrichmentAttempt(input.env.DB, {
          id: attempt.attempt.id,
          status: "failed",
          responseStatus: 200,
          errorCode: "no-matching-property",
          completedAt,
        });
        enrichmentFailed += 1;
        continue;
      }
      await upsertAutomatedLead(input.env.DB, {
        ...match,
        organizationId: input.organizationId,
        sourceIdentity: stored.source_identity,
        sourceRecordId: stored.source_record_id,
        sourceFingerprint: stored.normalized_fingerprint,
        sourceRetrievedAt: stored.retrieved_at,
      }, input.now);
      await completeEnrichmentAttempt(input.env.DB, {
        id: attempt.attempt.id,
        status: "succeeded",
        responseStatus: 200,
        completedAt,
      });
      enriched += 1;
    } catch {
      await completeEnrichmentAttempt(input.env.DB, {
        id: attempt.attempt.id,
        status: "failed",
        errorCode: "provider-request-failed",
        completedAt,
      });
      enrichmentFailed += 1;
    }
  }
  return {
    ingestionRunId: ingestionRun.id,
    staged: records.length,
    leadsUpserted,
    enriched,
    enrichmentSkipped,
    enrichmentFailed,
  };
}

function localParts(now: Date): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

export async function runDueAutomatedLeadCycles(
  env: AutomatedLeadRunnerEnvironment,
  now: Date,
  policyOverride?: Awaited<ReturnType<typeof getActivePolicy>>,
  rentCastProvider?: RentCastProvider,
): Promise<void> {
  const policy = policyOverride ?? await getActivePolicy(env.DB);
  if (!policy || !policy.policy.scheduleEnabled) return;
  const local = localParts(now);
  const targetMinutes = policy.policy.scheduleHour * 60 + policy.policy.scheduleMinute;
  const currentMinutes = local.hour * 60 + local.minute;
  if (currentMinutes < targetMinutes || currentMinutes >= targetMinutes + 60) return;
  await runAutomatedLeadCycle({
    env,
    policy,
    organizationId: env.DEALFLOW_ORGANIZATION_ID?.trim() || "default",
    actorId: "scheduler",
    idempotencyKey: `automated-leads:${policy.id}:${policy.version}:${local.date}`,
    now,
    rentCastProvider,
  });
}
