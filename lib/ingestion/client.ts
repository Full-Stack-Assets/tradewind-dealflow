import type {
  IngestionRun,
  SourceImportAcknowledgement,
  SourceImportOutcomeCounts,
  StagedSourceRecord,
} from "./contracts.ts";
import type { SourcePolicy } from "./policy.ts";
import type { ApprovedPolicy } from "../../server/ingestion-store.ts";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json() as { error?: string } & T;
  if (!response.ok) throw new Error(body.error ?? `Source request failed (${response.status})`);
  return body;
}

export async function getSourcePolicy(): Promise<ApprovedPolicy | null> {
  return (await requestJson<{ policy: ApprovedPolicy | null }>("/api/sources/policy")).policy;
}

export async function approveSourcePolicy(policy: SourcePolicy): Promise<ApprovedPolicy> {
  return (await requestJson<{ policy: ApprovedPolicy }>("/api/sources/policy/approve", {
    method: "POST",
    body: JSON.stringify({ policy }),
  })).policy;
}

export async function startSourceRun(): Promise<IngestionRun> {
  return (await requestJson<{ run: IngestionRun }>("/api/sources/runs", {
    method: "POST",
    headers: { "idempotency-key": crypto.randomUUID() },
    body: "{}",
  })).run;
}

export async function getSourceRuns(limit = 5): Promise<IngestionRun[]> {
  return (await requestJson<{ runs: IngestionRun[] }>(`/api/sources/runs?limit=${limit}`)).runs;
}

export async function getSourceRecords(): Promise<StagedSourceRecord[]> {
  return (await requestJson<{ records: StagedSourceRecord[] }>("/api/sources/records")).records;
}

export async function acknowledgeImportedRecords(
  items: SourceImportAcknowledgement[],
): Promise<number> {
  let acknowledged = 0;
  for (let offset = 0; offset < items.length; offset += 500) {
    const snapshot = items.slice(offset, offset + 500);
    const outcomeCounts: SourceImportOutcomeCounts = {
      applied: snapshot.filter(({ outcome }) => outcome === "applied").length,
      changedSource: snapshot.filter(({ outcome }) => outcome === "changed-source").length,
      exactReimport: snapshot.filter(({ outcome }) => outcome === "exact-reimport").length,
      possiblePropertyMatch: snapshot.filter(({ outcome }) => outcome === "possible-property-match").length,
      excluded: snapshot.filter(({ outcome }) => outcome === "excluded").length,
    };
    const recordIds = snapshot
      .filter(({ outcome }) => outcome === "applied" || outcome === "changed-source" || outcome === "exact-reimport")
      .map(({ recordId }) => recordId);
    const result = await requestJson<{ acknowledged: number }>("/api/sources/records/imported", {
      method: "POST",
      body: JSON.stringify({ recordIds, outcomeCounts }),
    });
    if (result.acknowledged !== recordIds.length) {
      throw new Error("The server did not acknowledge the complete imported snapshot.");
    }
    acknowledged += result.acknowledged;
  }
  return acknowledged;
}

export async function acknowledgeAndRefreshImportedRecords(
  items: SourceImportAcknowledgement[],
  refresh: () => Promise<void>,
): Promise<{ acknowledged: number; refreshed: boolean }> {
  const acknowledged = await acknowledgeImportedRecords(items);
  try {
    await refresh();
    return { acknowledged, refreshed: true };
  } catch {
    return { acknowledged, refreshed: false };
  }
}
