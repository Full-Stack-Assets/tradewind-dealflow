import type { IngestionRun } from "../lib/ingestion/contracts.ts";
import { fetchMassGisRecords, type FetchMassGisRecordsOptions } from "../lib/ingestion/massgis.ts";
import { hashPolicy } from "../lib/ingestion/policy.ts";
import type { D1Database } from "./d1.ts";
import {
  createRun,
  finishRun,
  getActivePolicy,
  persistPage,
  type ApprovedPolicy,
} from "./ingestion-store.ts";

export type RunIngestionInput = {
  db: D1Database;
  policy: ApprovedPolicy;
  trigger: "operator" | "schedule";
  idempotencyKey: string;
  actorId: string;
  signal: AbortSignal;
  fetchOptions?: Omit<FetchMassGisRecordsOptions, "signal" | "onPage">;
  now?: Date;
};

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && error.name === "AbortError");
}

export async function runIngestion(input: RunIngestionInput): Promise<IngestionRun> {
  const active = await getActivePolicy(input.db);
  const computedHash = await hashPolicy(input.policy.policy);
  if (
    !active
    || active.id !== input.policy.id
    || active.policyHash !== input.policy.policyHash
    || computedHash !== input.policy.policyHash
  ) {
    throw new Error("approved policy is no longer active");
  }
  const created = await createRun(
    input.db,
    input.policy,
    input.trigger,
    input.idempotencyKey,
    input.actorId,
    input.now,
  );
  if (created.existing) return created.run;
  let persistedPages = 0;
  try {
    await fetchMassGisRecords(input.policy.policy, {
      ...input.fetchOptions,
      signal: input.signal,
      onPage: async (page) => {
        await persistPage(input.db, created.run.id, page.records, page.rejections, input.actorId);
        persistedPages += 1;
      },
    });
    return await finishRun(input.db, created.run.id, "staged", input.actorId, null);
  } catch (error) {
    if (isAbort(error, input.signal)) {
      return finishRun(input.db, created.run.id, "cancelled", input.actorId, null);
    }
    return finishRun(
      input.db,
      created.run.id,
      persistedPages > 0 ? "partial" : "failed",
      input.actorId,
      "source-failure",
    );
  }
}

