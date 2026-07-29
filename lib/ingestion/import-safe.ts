import {
  applyLeadImportPlan,
  holdPossibleDuplicate,
  planLeadImport,
  type LeadImportCandidate,
} from "../lead-ingestion.ts";
import type { DealFlowData } from "../types.ts";
import type { StagedSourceRecord } from "./contracts.ts";
import type { MassGisCandidate } from "./massgis.ts";

export type SafeImportOutcome =
  | "applied"
  | "exact-reimport"
  | "changed-source"
  | "possible-property-match"
  | "excluded";

export type SafeImportResult = {
  data: DealFlowData;
  outcomes: SafeImportOutcome[];
  importedRecordIds: string[];
  error: string | null;
};

function candidateFromRecord(record: StagedSourceRecord): LeadImportCandidate | null {
  if (record.classification !== "safe" || record.importedAt !== null) return null;
  let value: MassGisCandidate;
  try {
    value = JSON.parse(record.normalizedJson) as MassGisCandidate;
  } catch {
    return null;
  }
  if (
    !value
    || typeof value.sourceRecordId !== "string"
    || typeof value.retrievedAt !== "string"
    || typeof value.address !== "string"
    || typeof value.city !== "string"
    || typeof value.zip !== "string"
    || typeof value.propertyType !== "string"
  ) return null;
  return {
    source: "MassGIS Property Tax Parcels",
    sourceRecordId: value.sourceRecordId,
    retrievedAt: value.retrievedAt,
    state: "MA",
    address: value.address,
    city: value.city,
    zip: value.zip,
    market: value.city,
    propertyType: value.propertyType,
    askingPrice: null,
    rehabLevel: null,
    ownerContactStatus: null,
    nextAction: "Research property facts and confirm source eligibility.",
    notes: null,
    usageClassification: "Public record",
    confidence: "Medium",
    lastVerifiedAt: value.retrievedAt,
  };
}

export function importSafeRecords(
  data: DealFlowData,
  records: StagedSourceRecord[],
  now: Date,
): SafeImportResult {
  const candidates: LeadImportCandidate[] = [];
  const inputIndexes: number[] = [];
  const outcomes: SafeImportOutcome[] = records.map(() => "excluded");
  records.forEach((record, index) => {
    const candidate = candidateFromRecord(record);
    if (!candidate) return;
    candidates.push(candidate);
    inputIndexes.push(index);
  });
  if (candidates.length === 0) {
    return { data, outcomes, importedRecordIds: [], error: null };
  }

  let plan = planLeadImport(data, candidates);
  const rowOutcome = new Map<number, SafeImportOutcome>();
  for (const item of plan.newRows) rowOutcome.set(item.rowNumber, "applied");
  for (const item of plan.changedSourceRows) rowOutcome.set(item.rowNumber, "changed-source");
  for (const item of plan.exactReimports) rowOutcome.set(item.rowNumber, "exact-reimport");
  for (const item of plan.sameFileDuplicates) rowOutcome.set(item.rowNumber, "excluded");
  for (const item of plan.rejected) rowOutcome.set(item.rowNumber, "excluded");
  for (const item of [...plan.possibleDuplicates]) {
    rowOutcome.set(item.rowNumber, "possible-property-match");
    plan = holdPossibleDuplicate(plan, item.rowNumber);
  }

  const applied = applyLeadImportPlan(data, plan, now);
  if (!applied.ok) {
    return { data, outcomes, importedRecordIds: [], error: applied.error };
  }
  const importedRecordIds: string[] = [];
  inputIndexes.forEach((inputIndex, candidateIndex) => {
    const outcome = rowOutcome.get(candidateIndex + 2) ?? "excluded";
    outcomes[inputIndex] = outcome;
    if (outcome === "applied" || outcome === "changed-source" || outcome === "exact-reimport") {
      importedRecordIds.push(records[inputIndex].id);
    }
  });
  return { data: applied.data, outcomes, importedRecordIds, error: null };
}

