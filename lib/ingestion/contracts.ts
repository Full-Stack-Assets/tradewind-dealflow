export type IngestionRun = {
  id: string;
  policyId: string;
  policyHash: string;
  trigger: "operator" | "schedule" | "retry";
  status: "queued" | "running" | "staged" | "completed" | "partial" | "failed" | "cancelled";
  idempotencyKey: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  retrievedCount: number;
  safeCount: number;
  duplicateCount: number;
  changedCount: number;
  exceptionCount: number;
  importedCount: number;
  failedCount: number;
  lastErrorCode: string | null;
};

export type StagedSourceRecord = {
  id: string;
  runId: string;
  sourceIdentity: string;
  sourceRecordId: string;
  retrievedAt: string;
  rawJson: string;
  normalizedJson: string;
  rawFingerprint: string;
  normalizedFingerprint: string;
  classification: "safe" | "exact-duplicate" | "changed" | "exception";
  reasonCode: string | null;
  importedAt: string | null;
};

export type SourceImportOutcomeCounts = {
  applied: number;
  changedSource: number;
  exactReimport: number;
  possiblePropertyMatch: number;
  excluded: number;
};

export type SourceImportOutcome =
  | "applied"
  | "exact-reimport"
  | "changed-source"
  | "possible-property-match"
  | "excluded";

export type SourceImportAcknowledgement = {
  recordId: string;
  outcome: SourceImportOutcome;
};

export type AuditEvent = {
  sequence: number;
  id: string;
  occurredAt: string;
  actorId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  metadataJson: string;
  previousHash: string;
  eventHash: string;
};
