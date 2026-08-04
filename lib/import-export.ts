import type {
  BuyerRecord,
  BuyBoxConfig,
  CancellationWindowRecord,
  ComplianceState,
  DataConfidence,
  DealAnalysis,
  DealDeskDraft,
  SellerWorkspaceProvenance,
  SellerComparableRange,
  SellerConversationChannel,
  SellerConversationLog,
  SellerConversationActor,
  SellerDocumentContract,
  SellerPropertyWorkspace,
  SellerRepairRange,
  SellerReviewDraft,
  SellerApprovalRequest,
  SellerWorkspaceTask,
  DealFlowData,
  DealRecord,
  DealStrategy,
  FactConflict,
  ParticipationPath,
  PipelineStage,
  SellerWorkspaceDocumentContractStatus,
  SellerWorkspaceReviewDraftStatus,
  SellerWorkspaceApprovalRequestStatus,
  ProofOfFundsStatus,
  PropertyFactSnapshot,
  RehabLevel,
  ResearchRestriction,
  ResearchRestrictionCode,
  SourceAssertion,
  SourceUsageClassification,
  StateCode,
} from "./types.ts";
import { PIPELINE_STAGES } from "./types.ts";
import {
  createDefaultBuyBox,
  normalizeBuyBox,
} from "./qualification.ts";
import { normalizeLaunchBuyBox } from "./launch-qualification.ts";

const MAX_ARRAY_LENGTH = 500;
const MAX_STRING_LENGTH = 10_000;

const DEAL_STRATEGIES: DealStrategy[] = [
  "Direct acquisition", "Assignment", "Double closing", "Wholetail",
  "Novation", "Seller financing", "Subject-to", "Buy-and-hold",
  "Rehab/resale", "Listing/referral", "No-deal/resource",
];
const PROOF_OF_FUNDS_STATUSES: ProofOfFundsStatus[] = [
  "Not provided", "Pending review", "Verified", "Expired",
];
const SOURCE_USAGE_CLASSIFICATIONS: SourceUsageClassification[] = [
  "Public record", "Licensed provider", "Direct submission", "Authorized CRM",
  "Operator research", "Restricted — research only",
];
const SELLER_CONVERSATION_ACTORS: SellerConversationActor[] = ["Seller", "Operator", "Team"];
const SELLER_CONVERSATION_CHANNELS: SellerConversationChannel[] = [
  "Call", "Text", "Email", "Video", "Meeting", "In-person",
];
const SELLER_TASK_STATUSES = ["todo", "in_progress", "done"] as const;
const SELLER_DOCUMENT_STATUSES: SellerWorkspaceDocumentContractStatus[] = [
  "Draft", "Pending review", "Approved", "Needs revision", "Rejected",
];
const SELLER_REVIEW_DRAFT_STATUSES: SellerWorkspaceReviewDraftStatus[] = [
  "Draft", "Ready for approval", "Needs human update", "Approved for local export",
];
const SELLER_APPROVAL_STATUSES: SellerWorkspaceApprovalRequestStatus[] = [
  "Pending", "Approved", "Rejected", "Needs revision",
];
const SELLER_REQUEST_TYPES = ["Document publish", "Range publish", "Fact-sheet export"] as const;
const SELLER_DOCUMENT_CATEGORIES = [
  "Comparable packet",
  "Repair analysis",
  "Conversation packet",
  "Property fact sheet",
  "Other",
] as const;
const DATA_CONFIDENCES: DataConfidence[] = ["Low", "Medium", "High"];
const STATES_FOR_IMPORT: StateCode[] = ["MA", "RI"];
const RESTRICTION_CODES: ResearchRestrictionCode[] = [
  "Do not contact", "Identity disputed", "Ownership stale", "Source restricted",
  "Specialist review",
];
const LEGACY_MARKETS_BY_STATE: Record<StateCode, Set<string>> = {
  MA: new Set([
    "bristol county",
    "plymouth county",
    "norfolk county",
    "worcester county",
    "providence-border communities",
    "fall river",
    "new bedford",
    "taunton",
    "attleboro",
    "brockton",
    "wareham",
    "dartmouth",
    "fairhaven",
    "seekonk",
    "swansea",
    "somerset",
    "rehoboth",
  ]),
  RI: new Set([
    "providence county",
    "kent county",
    "bristol county",
    "providence",
    "pawtucket",
    "central falls",
    "cranston",
    "warwick",
    "east providence",
    "woonsocket",
    "johnston",
    "north providence",
    "west warwick",
    "coventry",
    "bristol",
    "warren",
  ]),
};

type DealRecordV1 = Omit<DealRecord, "zip" | "market" | "sourceAssertions" | "factConflicts" | "researchRestrictions"> & {
  rehabLevel: RehabLevel;
};

type DealFlowDataV1 = Omit<DealFlowData, "schemaVersion" | "revision" | "buyBox" | "deals"> & {
  schemaVersion: 1;
  deals: DealRecordV1[];
  sellerPropertyWorkspace?: SellerPropertyWorkspace;
};

export type ImportResult =
  | { ok: true; data: DealFlowData }
  | { ok: false; errors: string[] };

export function createEmptyData(now = new Date().toISOString()): DealFlowData {
  return {
    schemaVersion: 2,
    revision: 0,
    updatedAt: now,
    preferences: { selectedState: null, participationPath: null },
    buyBox: createDefaultBuyBox(now),
    deals: [], buyers: [], analyses: [], curriculum: {}, weekProgress: {}, readinessChecks: {},
    compliance: {
      sellerWindow: { startDate: "", verifiedHolidays: [], holidayCalendarVerified: false, attorneyConfirmed: false },
      assigneeWindow: { startDate: "", verifiedHolidays: [], holidayCalendarVerified: false, attorneyConfirmed: false },
      outreachChecks: {}, marketingChecks: {},
    },
    dealDeskDraft: {
      dealId: "", submitterName: "", submitterEmail: "", summary: "",
      requestedStructure: "", qualificationChecks: {}, consentToReview: false,
    },
    sellerPropertyWorkspace: {
      conversationLogs: [],
      tasks: [],
      comparableRanges: [],
      repairRanges: [],
      documents: [],
      reviewDrafts: [],
      approvalRequests: [],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function unsupportedKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function validString(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_STRING_LENGTH;
}

function trimmed(value: string): string {
  return value.trim();
}

function reconstructSellerWorkspaceProvenance(raw: unknown): SellerWorkspaceProvenance | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["source", "reference", "collectedAt", "confidence", "verifiedAt", "notes"])) return null;
  if (!validString(raw.source) || !validString(raw.reference) || !validString(raw.collectedAt) || !validIsoTimestamp(raw.collectedAt) || !validConfidence(raw.confidence) || (raw.verifiedAt !== null && raw.verifiedAt !== undefined && !validSourceTimestamp(raw.verifiedAt, new Date())) || !validString(raw.notes)) return null;
  return {
    source: trimmed(raw.source),
    reference: trimmed(raw.reference),
    collectedAt: raw.collectedAt,
    confidence: raw.confidence,
    verifiedAt: raw.verifiedAt ?? null,
    notes: trimmed(raw.notes),
  };
}

function validArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length <= MAX_ARRAY_LENGTH;
}
function validSellerConversationActor(value: unknown): value is SellerConversationActor {
  return SELLER_CONVERSATION_ACTORS.includes(value as SellerConversationActor);
}
function validSellerConversationChannel(value: unknown): value is SellerConversationChannel {
  return SELLER_CONVERSATION_CHANNELS.includes(value as SellerConversationChannel);
}
function validSellerTaskStatus(value: unknown): value is SellerWorkspaceTask["status"] {
  return SELLER_TASK_STATUSES.includes(value as SellerWorkspaceTask["status"]);
}
function validSellerDocumentCategory(value: unknown): value is SellerDocumentContract["category"] {
  return SELLER_DOCUMENT_CATEGORIES.includes(value as SellerDocumentContract["category"]);
}
function validSellerDocumentStatus(value: unknown): value is SellerWorkspaceDocumentContractStatus {
  return SELLER_DOCUMENT_STATUSES.includes(value as SellerWorkspaceDocumentContractStatus);
}
function validSellerReviewDraftStatus(value: unknown): value is SellerWorkspaceReviewDraftStatus {
  return SELLER_REVIEW_DRAFT_STATUSES.includes(value as SellerWorkspaceReviewDraftStatus);
}
function validSellerApprovalStatus(value: unknown): value is SellerWorkspaceApprovalRequestStatus {
  return SELLER_APPROVAL_STATUSES.includes(value as SellerWorkspaceApprovalRequestStatus);
}
function validSellerApprovalRequestType(value: unknown): value is SellerApprovalRequest["requestType"] {
  return SELLER_REQUEST_TYPES.includes(value as SellerApprovalRequest["requestType"]);
}

function validState(value: unknown): value is StateCode { return value === "MA" || value === "RI"; }
function validParticipationPath(value: unknown): value is ParticipationPath { return value === "principal" || value === "licensed"; }
function validRehab(value: unknown): value is RehabLevel { return value === "Light" || value === "Moderate" || value === "Heavy"; }
function validStrategy(value: unknown): value is DealStrategy { return DEAL_STRATEGIES.includes(value as DealStrategy); }
function validProofOfFundsStatus(value: unknown): value is ProofOfFundsStatus { return PROOF_OF_FUNDS_STATUSES.includes(value as ProofOfFundsStatus); }
function validConfidence(value: unknown): value is DataConfidence { return DATA_CONFIDENCES.includes(value as DataConfidence); }
function validNullableConfidence(value: unknown): value is DataConfidence | null {
  return value === null || validConfidence(value);
}
function validUsageClassification(value: unknown): value is SourceUsageClassification { return SOURCE_USAGE_CLASSIFICATIONS.includes(value as SourceUsageClassification); }
function validRestrictionCode(value: unknown): value is ResearchRestrictionCode { return RESTRICTION_CODES.includes(value as ResearchRestrictionCode); }
function validPipelineStage(value: unknown): value is PipelineStage { return PIPELINE_STAGES.includes(value as PipelineStage); }
function validNonnegativeNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function validFiniteNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function validNonnegativeInteger(value: unknown): value is number { return Number.isInteger(value) && validNonnegativeNumber(value); }
function validNullableNonnegativeNumber(value: unknown): value is number | null { return value === null || validNonnegativeNumber(value); }
function validScalar(value: unknown): value is string | number | null { return value === null || validString(value) || validFiniteNumber(value); }
function validIsoTimestamp(value: unknown): value is string {
  if (!validString(value)) return false;
  const timestamp =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/u
      .exec(value);
  if (timestamp === null) return false;
  const year = Number(timestamp[1]);
  const month = Number(timestamp[2]);
  const day = Number(timestamp[3]);
  const hour = Number(timestamp[4]);
  const minute = Number(timestamp[5]);
  const second = Number(timestamp[6] ?? "0");
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const validCalendar =
    calendar.getUTCFullYear() === year
    && calendar.getUTCMonth() === month - 1
    && calendar.getUTCDate() === day;
  return validCalendar
    && hour <= 23
    && minute <= 59
    && second <= 59
    && Number.isFinite(Date.parse(value));
}

function validSourceTimestamp(value: unknown, now: Date): value is string {
  return validIsoTimestamp(value) && Date.parse(value) <= now.getTime();
}

function reconstructStringArray(raw: unknown): string[] | null {
  if (!validArray(raw) || !raw.every(validString)) return null;
  return raw.map(trimmed).filter(Boolean);
}

function reconstructBooleanRecord(raw: unknown): Record<string, boolean> | null {
  if (!isRecord(raw) || Object.keys(raw).length > MAX_ARRAY_LENGTH) return null;
  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!validString(key) || typeof value !== "boolean") return null;
    result[key] = value;
  }
  return result;
}

function reconstructPreferences(raw: unknown): DealFlowData["preferences"] | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["selectedState", "participationPath"])) return null;
  if ((raw.selectedState !== null && !validState(raw.selectedState)) || (raw.participationPath !== null && !validParticipationPath(raw.participationPath))) return null;
  return { selectedState: raw.selectedState, participationPath: raw.participationPath };
}

function reconstructDealV1(raw: unknown): DealRecordV1 | null {
  const fields = ["id", "createdAt", "updatedAt", "state", "address", "city", "propertyType", "source", "ownerContactStatus", "stage", "nextAction", "notes", "askingPrice", "rehabLevel", "strategies", "executedAgreement", "equitableInterestRecorded", "legalTitleDisclosureReady", "attorneyReviewComplete"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields)) return null;
  if (!validString(raw.id) || !validString(raw.createdAt) || !validString(raw.updatedAt) || !validState(raw.state) || !validString(raw.address) || !validString(raw.city) || !validString(raw.propertyType) || !validString(raw.source) || !validString(raw.ownerContactStatus) || !validPipelineStage(raw.stage) || !validString(raw.nextAction) || !validString(raw.notes) || !validNullableNonnegativeNumber(raw.askingPrice) || !validRehab(raw.rehabLevel) || !validArray(raw.strategies) || !raw.strategies.every(validStrategy) || typeof raw.executedAgreement !== "boolean" || typeof raw.equitableInterestRecorded !== "boolean" || typeof raw.legalTitleDisclosureReady !== "boolean" || typeof raw.attorneyReviewComplete !== "boolean") return null;
  return {
    id: raw.id, createdAt: raw.createdAt, updatedAt: raw.updatedAt, state: raw.state,
    address: trimmed(raw.address), city: trimmed(raw.city), propertyType: trimmed(raw.propertyType), source: trimmed(raw.source),
    ownerContactStatus: trimmed(raw.ownerContactStatus), stage: raw.stage, nextAction: trimmed(raw.nextAction), notes: trimmed(raw.notes),
    askingPrice: raw.askingPrice, rehabLevel: raw.rehabLevel, strategies: raw.strategies.slice(),
    executedAgreement: raw.executedAgreement, equitableInterestRecorded: raw.equitableInterestRecorded,
    legalTitleDisclosureReady: raw.legalTitleDisclosureReady, attorneyReviewComplete: raw.attorneyReviewComplete,
  };
}

function reconstructPropertyFacts(raw: unknown): PropertyFactSnapshot | null {
  const fields = ["state", "address", "city", "zip", "market", "propertyType", "askingPrice", "rehabLevel", "ownerContactStatus", "nextAction", "notes"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields)) return null;
  const zip = raw.zip === undefined ? "" : raw.zip;
  if (!validState(raw.state) || !validString(raw.address) || !validString(raw.city) || !validString(zip) || !validString(raw.market) || !validString(raw.propertyType) || !validNullableNonnegativeNumber(raw.askingPrice) || (raw.rehabLevel !== null && !validRehab(raw.rehabLevel)) || !validString(raw.ownerContactStatus) || !validString(raw.nextAction) || !validString(raw.notes)) return null;
  return {
    state: raw.state, address: trimmed(raw.address), city: trimmed(raw.city), zip: trimmed(zip), market: trimmed(raw.market), propertyType: trimmed(raw.propertyType),
    askingPrice: raw.askingPrice, rehabLevel: raw.rehabLevel, ownerContactStatus: trimmed(raw.ownerContactStatus), nextAction: trimmed(raw.nextAction), notes: trimmed(raw.notes),
  };
}

function reconstructSourceAssertion(
  raw: unknown,
  now: Date,
): SourceAssertion | null {
  const fields = ["id", "source", "sourceRecordId", "retrievedAt", "usageClassification", "confidence", "lastVerifiedAt", "importedAt", "fingerprint", "facts"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields)) return null;
  const facts = reconstructPropertyFacts(raw.facts);
  if (!validString(raw.id) || !validString(raw.source) || !validString(raw.sourceRecordId) || !validSourceTimestamp(raw.retrievedAt, now) || !validUsageClassification(raw.usageClassification) || !validNullableConfidence(raw.confidence) || (raw.lastVerifiedAt !== null && !validSourceTimestamp(raw.lastVerifiedAt, now)) || !validSourceTimestamp(raw.importedAt, now) || !validString(raw.fingerprint) || facts === null) return null;
  return { id: raw.id, source: trimmed(raw.source), sourceRecordId: trimmed(raw.sourceRecordId), retrievedAt: raw.retrievedAt, usageClassification: raw.usageClassification, confidence: raw.confidence, lastVerifiedAt: raw.lastVerifiedAt, importedAt: raw.importedAt, fingerprint: raw.fingerprint, facts };
}

function reconstructFactConflict(raw: unknown): FactConflict | null {
  const fields = ["id", "field", "canonicalValue", "assertedValue", "sourceAssertionId", "detectedAt", "status", "resolution"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || !validString(raw.field) || !["state", "address", "city", "zip", "market", "propertyType", "askingPrice", "rehabLevel", "ownerContactStatus", "nextAction", "notes"].includes(raw.field) || !validScalar(raw.canonicalValue) || !validScalar(raw.assertedValue) || !validString(raw.sourceAssertionId) || !validString(raw.detectedAt) || (raw.status !== "Unresolved" && raw.status !== "Resolved")) return null;
  if (raw.resolution === null) return { id: raw.id, field: raw.field as keyof PropertyFactSnapshot, canonicalValue: raw.canonicalValue, assertedValue: raw.assertedValue, sourceAssertionId: raw.sourceAssertionId, detectedAt: raw.detectedAt, status: raw.status, resolution: null };
  if (!isRecord(raw.resolution) || !hasOnlyKeys(raw.resolution, ["selectedSide", "basis", "resolvedAt"]) || (raw.resolution.selectedSide !== "Canonical" && raw.resolution.selectedSide !== "Asserted") || !validString(raw.resolution.basis) || !validString(raw.resolution.resolvedAt)) return null;
  return { id: raw.id, field: raw.field as keyof PropertyFactSnapshot, canonicalValue: raw.canonicalValue, assertedValue: raw.assertedValue, sourceAssertionId: raw.sourceAssertionId, detectedAt: raw.detectedAt, status: raw.status, resolution: { selectedSide: raw.resolution.selectedSide, basis: trimmed(raw.resolution.basis), resolvedAt: raw.resolution.resolvedAt } };
}

function reconstructResearchRestriction(raw: unknown): ResearchRestriction | null {
  const fields = ["id", "code", "source", "sourceAssertionId", "reason", "createdAt", "resolvedAt", "resolutionNote"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || !validRestrictionCode(raw.code) || !["Operator", "Migration", "Source assertion", "System"].includes(raw.source as string) || (raw.sourceAssertionId !== null && !validString(raw.sourceAssertionId)) || !validString(raw.reason) || !validString(raw.createdAt) || (raw.resolvedAt !== null && !validString(raw.resolvedAt)) || !validString(raw.resolutionNote)) return null;
  if (raw.source === "Source assertion" && raw.sourceAssertionId === null) return null;
  return { id: raw.id, code: raw.code, source: raw.source as ResearchRestriction["source"], sourceAssertionId: raw.sourceAssertionId, reason: trimmed(raw.reason), createdAt: raw.createdAt, resolvedAt: raw.resolvedAt, resolutionNote: trimmed(raw.resolutionNote) };
}

function reconstructDealV2(raw: unknown, now: Date): DealRecord | null {
  const fields = ["id", "createdAt", "updatedAt", "state", "address", "city", "zip", "market", "propertyType", "source", "ownerContactStatus", "stage", "nextAction", "notes", "askingPrice", "rehabLevel", "sourceAssertions", "factConflicts", "researchRestrictions", "strategies", "executedAgreement", "equitableInterestRecorded", "legalTitleDisclosureReady", "attorneyReviewComplete"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields)) return null;
  const zip = raw.zip === undefined ? "" : raw.zip;
  if (!validString(raw.id) || !validString(raw.createdAt) || !validString(raw.updatedAt) || !validState(raw.state) || !validString(raw.address) || !validString(raw.city) || !validString(zip) || !validString(raw.market) || !validString(raw.propertyType) || !validString(raw.source) || !validString(raw.ownerContactStatus) || !validPipelineStage(raw.stage) || !validString(raw.nextAction) || !validString(raw.notes) || !validNullableNonnegativeNumber(raw.askingPrice) || (raw.rehabLevel !== null && !validRehab(raw.rehabLevel)) || !validArray(raw.sourceAssertions) || !validArray(raw.factConflicts) || !validArray(raw.researchRestrictions) || !validArray(raw.strategies) || !raw.strategies.every(validStrategy) || typeof raw.executedAgreement !== "boolean" || typeof raw.equitableInterestRecorded !== "boolean" || typeof raw.legalTitleDisclosureReady !== "boolean" || typeof raw.attorneyReviewComplete !== "boolean") return null;
  const sourceAssertions = raw.sourceAssertions.map((assertion) =>
    reconstructSourceAssertion(assertion, now)
  );
  const factConflicts = raw.factConflicts.map(reconstructFactConflict);
  const researchRestrictions = raw.researchRestrictions.map(reconstructResearchRestriction);
  if (sourceAssertions.some((item) => item === null) || factConflicts.some((item) => item === null) || researchRestrictions.some((item) => item === null)) return null;
  const requiredRestriction = contactStatusRestrictionCode(raw.ownerContactStatus);
  if (
    requiredRestriction !== null
    && !(researchRestrictions as ResearchRestriction[]).some(
      ({ code, resolvedAt }) =>
        code === requiredRestriction && resolvedAt === null,
    )
  ) return null;
  return {
    id: raw.id, createdAt: raw.createdAt, updatedAt: raw.updatedAt, state: raw.state, address: trimmed(raw.address), city: trimmed(raw.city), zip: trimmed(zip), market: trimmed(raw.market), propertyType: trimmed(raw.propertyType), source: trimmed(raw.source), ownerContactStatus: trimmed(raw.ownerContactStatus), stage: raw.stage, nextAction: trimmed(raw.nextAction), notes: trimmed(raw.notes), askingPrice: raw.askingPrice, rehabLevel: raw.rehabLevel,
    sourceAssertions: sourceAssertions as SourceAssertion[], factConflicts: factConflicts as FactConflict[], researchRestrictions: researchRestrictions as ResearchRestriction[], strategies: raw.strategies.slice(),
    executedAgreement: raw.executedAgreement, equitableInterestRecorded: raw.equitableInterestRecorded, legalTitleDisclosureReady: raw.legalTitleDisclosureReady, attorneyReviewComplete: raw.attorneyReviewComplete,
  };
}

function contactStatusRestrictionCode(
  value: string,
): "Do not contact" | "Identity disputed" | null {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
  const compact = normalized.replace(/[^\p{L}\p{N}]+/gu, "");
  if (
    compact.includes("donotcontact")
    || compact.includes("optout")
    || compact.includes("optedout")
    || /\bdnc\b/u.test(normalized)
  ) return "Do not contact";
  if (
    compact.includes("identitydisputed")
    || compact.includes("identitydispute")
  ) return "Identity disputed";
  return null;
}

function reconstructBuyer(raw: unknown): BuyerRecord | null {
  const fields = ["id", "createdAt", "updatedAt", "name", "company", "email", "phone", "states", "markets", "propertyTypes", "minPrice", "maxPrice", "rehabTolerance", "strategies", "proofOfFundsStatus", "proofOfFundsExpiresAt", "lastVerifiedAt"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || !validString(raw.createdAt) || !validString(raw.updatedAt) || !validString(raw.name) || !validString(raw.company) || !validString(raw.email) || !validString(raw.phone) || !validArray(raw.states) || !raw.states.every(validState) || !validNullableNonnegativeNumber(raw.minPrice) || !validNullableNonnegativeNumber(raw.maxPrice) || !validArray(raw.rehabTolerance) || !raw.rehabTolerance.every(validRehab) || !validArray(raw.strategies) || !raw.strategies.every(validStrategy) || !validProofOfFundsStatus(raw.proofOfFundsStatus) || !validString(raw.proofOfFundsExpiresAt) || !validString(raw.lastVerifiedAt)) return null;
  const markets = reconstructStringArray(raw.markets);
  const propertyTypes = reconstructStringArray(raw.propertyTypes);
  if (markets === null || propertyTypes === null) return null;
  return { id: raw.id, createdAt: raw.createdAt, updatedAt: raw.updatedAt, name: trimmed(raw.name), company: trimmed(raw.company), email: trimmed(raw.email).toLowerCase(), phone: trimmed(raw.phone), states: raw.states.slice(), markets, propertyTypes, minPrice: raw.minPrice, maxPrice: raw.maxPrice, rehabTolerance: raw.rehabTolerance.slice(), strategies: raw.strategies.slice(), proofOfFundsStatus: raw.proofOfFundsStatus, proofOfFundsExpiresAt: raw.proofOfFundsExpiresAt, lastVerifiedAt: raw.lastVerifiedAt };
}

function reconstructAnalysis(raw: unknown): DealAnalysis | null {
  const fields = ["id", "dealId", "propertyLabel", "state", "createdAt", "updatedAt", "arv", "repairs", "holdingClosingCosts", "buyerProfit", "wholesaleFee", "mao", "targetPrice", "heuristicPercent", "heuristicValue", "compEvidence", "repairEvidence", "riskNotes"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || (raw.dealId !== null && !validString(raw.dealId)) || !validString(raw.propertyLabel) || (raw.state !== null && !validState(raw.state)) || !validString(raw.createdAt) || !validString(raw.updatedAt) || !validNonnegativeNumber(raw.arv) || !validNonnegativeNumber(raw.repairs) || !validNonnegativeNumber(raw.holdingClosingCosts) || !validNonnegativeNumber(raw.buyerProfit) || !validNonnegativeNumber(raw.wholesaleFee) || !validFiniteNumber(raw.mao) || !validNullableNonnegativeNumber(raw.targetPrice) || !validNonnegativeNumber(raw.heuristicPercent) || raw.heuristicPercent > 100 || !validFiniteNumber(raw.heuristicValue) || !validString(raw.compEvidence) || !validString(raw.repairEvidence) || !validString(raw.riskNotes)) return null;
  return { id: raw.id, dealId: raw.dealId, propertyLabel: trimmed(raw.propertyLabel), state: raw.state, createdAt: raw.createdAt, updatedAt: raw.updatedAt, arv: raw.arv, repairs: raw.repairs, holdingClosingCosts: raw.holdingClosingCosts, buyerProfit: raw.buyerProfit, wholesaleFee: raw.wholesaleFee, mao: raw.mao, targetPrice: raw.targetPrice, heuristicPercent: raw.heuristicPercent, heuristicValue: raw.heuristicValue, compEvidence: trimmed(raw.compEvidence), repairEvidence: trimmed(raw.repairEvidence), riskNotes: trimmed(raw.riskNotes) };
}

function reconstructCancellationWindow(raw: unknown): CancellationWindowRecord | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["startDate", "verifiedHolidays", "holidayCalendarVerified", "attorneyConfirmed"]) || !validString(raw.startDate) || typeof raw.holidayCalendarVerified !== "boolean" || typeof raw.attorneyConfirmed !== "boolean") return null;
  const verifiedHolidays = reconstructStringArray(raw.verifiedHolidays);
  return verifiedHolidays === null ? null : { startDate: raw.startDate, verifiedHolidays, holidayCalendarVerified: raw.holidayCalendarVerified, attorneyConfirmed: raw.attorneyConfirmed };
}

function reconstructCompliance(raw: unknown): ComplianceState | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["sellerWindow", "assigneeWindow", "outreachChecks", "marketingChecks"])) return null;
  const sellerWindow = reconstructCancellationWindow(raw.sellerWindow);
  const assigneeWindow = reconstructCancellationWindow(raw.assigneeWindow);
  const outreachChecks = reconstructBooleanRecord(raw.outreachChecks);
  const marketingChecks = reconstructBooleanRecord(raw.marketingChecks);
  return sellerWindow === null || assigneeWindow === null || outreachChecks === null || marketingChecks === null ? null : { sellerWindow, assigneeWindow, outreachChecks, marketingChecks };
}

function reconstructDealDeskDraft(raw: unknown): DealDeskDraft | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["dealId", "submitterName", "submitterEmail", "summary", "requestedStructure", "qualificationChecks", "consentToReview"]) || !validString(raw.dealId) || !validString(raw.submitterName) || !validString(raw.submitterEmail) || !validString(raw.summary) || !validString(raw.requestedStructure) || typeof raw.consentToReview !== "boolean") return null;
  const qualificationChecks = reconstructBooleanRecord(raw.qualificationChecks);
  return qualificationChecks === null ? null : { dealId: raw.dealId, submitterName: trimmed(raw.submitterName), submitterEmail: trimmed(raw.submitterEmail), summary: trimmed(raw.summary), requestedStructure: trimmed(raw.requestedStructure), qualificationChecks, consentToReview: raw.consentToReview };
}

function reconstructSellerConversationLog(raw: unknown): SellerConversationLog | null {
  const fields = [
    "id", "propertyRecordId", "loggedAt", "actor", "channel",
    "summary", "nextAction", "followUpAt", "provenance",
  ];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || !validString(raw.propertyRecordId) || !validSourceTimestamp(raw.loggedAt, new Date()) || !validSellerConversationActor(raw.actor) || !validSellerConversationChannel(raw.channel) || !validString(raw.summary) || !validString(raw.nextAction) || !validSourceTimestamp(raw.followUpAt, new Date())) return null;
  const provenance = reconstructSellerWorkspaceProvenance(raw.provenance);
  if (provenance === null) return null;
  return {
    id: raw.id, propertyRecordId: raw.propertyRecordId, loggedAt: raw.loggedAt,
    actor: raw.actor, channel: raw.channel, summary: trimmed(raw.summary),
    nextAction: trimmed(raw.nextAction), followUpAt: raw.followUpAt,
    provenance,
  };
}

function reconstructSellerTask(raw: unknown): SellerWorkspaceTask | null {
  const fields = ["id", "propertyRecordId", "createdAt", "updatedAt", "title", "status", "dueAt", "notes"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || !validString(raw.propertyRecordId) || !validString(raw.createdAt) || !validSourceTimestamp(raw.updatedAt, new Date()) || !validString(raw.title) || !validSellerTaskStatus(raw.status) || !validString(raw.dueAt) || !validString(raw.notes)) return null;
  return {
    id: raw.id,
    propertyRecordId: raw.propertyRecordId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    title: trimmed(raw.title),
    status: raw.status,
    dueAt: raw.dueAt,
    notes: trimmed(raw.notes),
  };
}

function reconstructSellerComparableRange(raw: unknown): SellerComparableRange | null {
  const fields = [
    "id", "propertyRecordId", "comparableAddress", "soldPrice", "soldDate",
    "lowEstimate", "highEstimate", "adjustmentNotes", "provenance", "updatedAt",
  ];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || !validString(raw.propertyRecordId) || !validString(raw.comparableAddress) || !validSourceTimestamp(raw.soldDate, new Date()) || !validNullableNonnegativeNumber(raw.soldPrice) || !validNullableNonnegativeNumber(raw.lowEstimate) || !validNullableNonnegativeNumber(raw.highEstimate) || !validString(raw.adjustmentNotes) || !validSourceTimestamp(raw.updatedAt, new Date())) return null;
  if (raw.lowEstimate !== null && raw.highEstimate !== null && raw.lowEstimate > raw.highEstimate) return null;
  const provenance = reconstructSellerWorkspaceProvenance(raw.provenance);
  if (provenance === null) return null;
  return {
    id: raw.id,
    propertyRecordId: raw.propertyRecordId,
    comparableAddress: trimmed(raw.comparableAddress),
    soldPrice: raw.soldPrice,
    soldDate: raw.soldDate,
    lowEstimate: raw.lowEstimate,
    highEstimate: raw.highEstimate,
    adjustmentNotes: trimmed(raw.adjustmentNotes),
    provenance,
    updatedAt: raw.updatedAt,
  };
}

function reconstructSellerRepairRange(raw: unknown): SellerRepairRange | null {
  const fields = [
    "id", "propertyRecordId", "workItem", "lowEstimate", "highEstimate",
    "evidenceSummary", "provenance", "updatedAt",
  ];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || !validString(raw.propertyRecordId) || !validString(raw.workItem) || !validString(raw.evidenceSummary) || !validSourceTimestamp(raw.updatedAt, new Date()) || !validNullableNonnegativeNumber(raw.lowEstimate) || !validNullableNonnegativeNumber(raw.highEstimate)) return null;
  if (raw.lowEstimate !== null && raw.highEstimate !== null && raw.lowEstimate > raw.highEstimate) return null;
  const provenance = reconstructSellerWorkspaceProvenance(raw.provenance);
  if (provenance === null) return null;
  return {
    id: raw.id,
    propertyRecordId: raw.propertyRecordId,
    workItem: trimmed(raw.workItem),
    lowEstimate: raw.lowEstimate,
    highEstimate: raw.highEstimate,
    evidenceSummary: trimmed(raw.evidenceSummary),
    provenance,
    updatedAt: raw.updatedAt,
  };
}

function reconstructSellerDocumentContract(raw: unknown): SellerDocumentContract | null {
  const fields = [
    "id", "propertyRecordId", "title", "category", "storageMode", "fileName",
    "mimeType", "fileSizeBytes", "notes", "status", "provenance", "createdAt", "updatedAt",
  ];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || !validString(raw.propertyRecordId) || !validString(raw.title) || !validSellerDocumentCategory(raw.category) || raw.storageMode !== "metadata-only" || !validString(raw.fileName) || !validString(raw.mimeType) || !validNonnegativeInteger(raw.fileSizeBytes) || !validString(raw.notes) || !validSellerDocumentStatus(raw.status) || !validSourceTimestamp(raw.createdAt, new Date()) || !validSourceTimestamp(raw.updatedAt, new Date())) return null;
  const provenance = reconstructSellerWorkspaceProvenance(raw.provenance);
  if (provenance === null) return null;
  return {
    id: raw.id,
    propertyRecordId: raw.propertyRecordId,
    title: trimmed(raw.title),
    category: raw.category,
    storageMode: "metadata-only",
    fileName: trimmed(raw.fileName),
    mimeType: trimmed(raw.mimeType),
    fileSizeBytes: raw.fileSizeBytes,
    notes: trimmed(raw.notes),
    status: raw.status,
    provenance,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function reconstructSellerReviewDraft(raw: unknown): SellerReviewDraft | null {
  const fields = [
    "id", "propertyRecordId", "title", "summary", "includeComparableRangeIds", "includeRepairRangeIds", "includeDocumentIds", "status", "createdAt", "updatedAt",
  ];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields)) return null;
  const includeComparableRangeIds = reconstructStringArray(raw.includeComparableRangeIds);
  const includeRepairRangeIds = reconstructStringArray(raw.includeRepairRangeIds);
  const includeDocumentIds = reconstructStringArray(raw.includeDocumentIds);
  if (!validString(raw.id) || !validString(raw.propertyRecordId) || !validString(raw.title) || !validString(raw.summary) || includeComparableRangeIds === null || includeRepairRangeIds === null || includeDocumentIds === null || !validSellerReviewDraftStatus(raw.status) || !validSourceTimestamp(raw.createdAt, new Date()) || !validSourceTimestamp(raw.updatedAt, new Date())) return null;
  return {
    id: raw.id,
    propertyRecordId: raw.propertyRecordId,
    title: trimmed(raw.title),
    summary: trimmed(raw.summary),
    includeComparableRangeIds,
    includeRepairRangeIds,
    includeDocumentIds,
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function reconstructSellerApprovalRequest(raw: unknown): SellerApprovalRequest | null {
  const fields = [
    "id", "propertyRecordId", "reviewDraftId", "requestType", "requestedAt", "requestedBy", "status", "reviewedAt", "reviewer", "reason",
  ];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validString(raw.id) || !validString(raw.propertyRecordId) || !validString(raw.reviewDraftId) || !validSellerApprovalRequestType(raw.requestType) || !validSourceTimestamp(raw.requestedAt, new Date()) || !validString(raw.requestedBy) || !validSellerApprovalStatus(raw.status) || !validString(raw.reviewer) || !validString(raw.reason)) return null;
  if (raw.reviewedAt !== null && !validSourceTimestamp(raw.reviewedAt, new Date())) return null;
  return {
    id: raw.id,
    propertyRecordId: raw.propertyRecordId,
    reviewDraftId: raw.reviewDraftId,
    requestType: raw.requestType,
    requestedAt: raw.requestedAt,
    requestedBy: trimmed(raw.requestedBy),
    status: raw.status,
    reviewedAt: raw.reviewedAt ?? null,
    reviewer: trimmed(raw.reviewer),
    reason: trimmed(raw.reason),
  };
}

function reconstructSellerPropertyWorkspace(raw: unknown): SellerPropertyWorkspace | null {
  const fields = [
    "conversationLogs", "tasks", "comparableRanges", "repairRanges", "documents", "reviewDrafts", "approvalRequests",
  ];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || !validArray(raw.conversationLogs) || !validArray(raw.tasks) || !validArray(raw.comparableRanges) || !validArray(raw.repairRanges) || !validArray(raw.documents) || !validArray(raw.reviewDrafts) || !validArray(raw.approvalRequests)) return null;

  const conversationLogs = raw.conversationLogs.map(reconstructSellerConversationLog);
  const tasks = raw.tasks.map(reconstructSellerTask);
  const comparableRanges = raw.comparableRanges.map(reconstructSellerComparableRange);
  const repairRanges = raw.repairRanges.map(reconstructSellerRepairRange);
  const documents = raw.documents.map(reconstructSellerDocumentContract);
  const reviewDrafts = raw.reviewDrafts.map(reconstructSellerReviewDraft);
  const approvalRequests = raw.approvalRequests.map(reconstructSellerApprovalRequest);

  if (
    conversationLogs.some((item) => item === null)
    || tasks.some((item) => item === null)
    || comparableRanges.some((item) => item === null)
    || repairRanges.some((item) => item === null)
    || documents.some((item) => item === null)
    || reviewDrafts.some((item) => item === null)
    || approvalRequests.some((item) => item === null)
  ) {
    return null;
  }

  return {
    conversationLogs: conversationLogs as SellerConversationLog[],
    tasks: tasks as SellerWorkspaceTask[],
    comparableRanges: comparableRanges as SellerComparableRange[],
    repairRanges: repairRanges as SellerRepairRange[],
    documents: documents as SellerDocumentContract[],
    reviewDrafts: reviewDrafts as SellerReviewDraft[],
    approvalRequests: approvalRequests as SellerApprovalRequest[],
  };
}

function reconstructBuyBox(raw: unknown): BuyBoxConfig | null {
  const fields = ["configured", "version", "updatedAt", "states", "markets", "marketsByState", "propertyTypes", "minPrice", "maxPrice", "rehabLevels", "minimumConfidence", "maxVerificationAgeDays", "financialThresholds", "weights"];
  if (!isRecord(raw) || !hasOnlyKeys(raw, fields) || typeof raw.configured !== "boolean" || !validNonnegativeInteger(raw.version) || !validIsoTimestamp(raw.updatedAt) || !validArray(raw.states) || !raw.states.every(validState) || !validNullableNonnegativeNumber(raw.minPrice) || !validNullableNonnegativeNumber(raw.maxPrice) || !validArray(raw.rehabLevels) || !raw.rehabLevels.every(validRehab) || !validConfidence(raw.minimumConfidence) || !validNonnegativeInteger(raw.maxVerificationAgeDays) || !isRecord(raw.weights)) return null;
  const propertyTypes = reconstructStringArray(raw.propertyTypes);
  if (propertyTypes === null) return null;
  const defaults = createDefaultBuyBox(raw.updatedAt);
  const hasCurrentMarkets = raw.marketsByState !== undefined && raw.markets === undefined;
  const hasLegacyMarkets = raw.markets !== undefined && raw.marketsByState === undefined;
  if (!hasCurrentMarkets && !hasLegacyMarkets) return null;
  let marketsByState: BuyBoxConfig["marketsByState"];
  if (hasCurrentMarkets) {
    if (!isRecord(raw.marketsByState) || !hasOnlyKeys(raw.marketsByState, ["MA", "RI"])) return null;
    const ma = reconstructStringArray(raw.marketsByState.MA);
    const ri = reconstructStringArray(raw.marketsByState.RI);
    if (ma === null || ri === null) return null;
    marketsByState = { MA: ma, RI: ri };
  } else {
    const legacyMarkets = reconstructStringArray(raw.markets);
    if (legacyMarkets === null) return null;
    const migratedMarkets = migrateLegacyMarketsByState(
      legacyMarkets,
      raw.states as StateCode[],
      defaults,
    );
    if (migratedMarkets === null) return null;
    marketsByState = migratedMarkets;
  }
  const rawWeights = raw.weights as Record<string, unknown>;
  const legacyWeightKeys = ["geography", "propertyType", "price", "rehab", "dataQuality"];
  const currentWeightKeys = ["propertyFit", "financialFeasibility", "marketability", "buyerDemand", "dataQuality", "sellerProvidedFit"];
  const legacyWeights = hasOnlyKeys(rawWeights, legacyWeightKeys) && legacyWeightKeys.every((key) => validFiniteNumber(rawWeights[key]));
  const currentWeights = hasOnlyKeys(rawWeights, currentWeightKeys) && currentWeightKeys.every((key) => validFiniteNumber(rawWeights[key]));
  if (!legacyWeights && !currentWeights) return null;
  let financialThresholds = defaults.financialThresholds;
  if (raw.financialThresholds !== undefined) {
    const thresholdKeys = ["maximumEstimatedValue", "minimumEquityPercent", "preferredEquityPercent", "minimumAssignmentSpread", "preferredAssignmentSpread", "minimumBuyerProfit", "preferredBuyerProfit", "minimumWholesaleGrossMarginPercent"];
    if (!isRecord(raw.financialThresholds)) return null;
    const rawThresholds = raw.financialThresholds;
    if (!hasOnlyKeys(rawThresholds, thresholdKeys) || !thresholdKeys.every((key) => validFiniteNumber(rawThresholds[key]))) return null;
    financialThresholds = {
      maximumEstimatedValue: raw.financialThresholds.maximumEstimatedValue as number,
      minimumEquityPercent: raw.financialThresholds.minimumEquityPercent as number,
      preferredEquityPercent: raw.financialThresholds.preferredEquityPercent as number,
      minimumAssignmentSpread: raw.financialThresholds.minimumAssignmentSpread as number,
      preferredAssignmentSpread: raw.financialThresholds.preferredAssignmentSpread as number,
      minimumBuyerProfit: raw.financialThresholds.minimumBuyerProfit as number,
      preferredBuyerProfit: raw.financialThresholds.preferredBuyerProfit as number,
      minimumWholesaleGrossMarginPercent: raw.financialThresholds.minimumWholesaleGrossMarginPercent as number,
    };
  } else if (!legacyWeights) {
    return null;
  }
  const weights: BuyBoxConfig["weights"] = currentWeights
    ? {
        propertyFit: rawWeights.propertyFit as number,
        financialFeasibility: rawWeights.financialFeasibility as number,
        marketability: rawWeights.marketability as number,
        buyerDemand: rawWeights.buyerDemand as number,
        dataQuality: rawWeights.dataQuality as number,
        sellerProvidedFit: rawWeights.sellerProvidedFit as number,
      }
    : defaults.weights;
  const reconstructed: BuyBoxConfig = {
    configured: raw.configured,
    version: raw.version,
    updatedAt: raw.updatedAt,
    states: raw.states.slice(),
    marketsByState,
    propertyTypes,
    minPrice: raw.minPrice,
    maxPrice: raw.maxPrice,
    rehabLevels: raw.rehabLevels.slice(),
    minimumConfidence: raw.minimumConfidence,
    maxVerificationAgeDays: raw.maxVerificationAgeDays,
    financialThresholds,
    weights,
  };
  const validation = normalizeBuyBox(
    reconstructed,
    reconstructed,
    new Date(raw.updatedAt),
  );
  if (!validation.ok) return null;
  const normalized = {
    ...validation.value,
    configured: reconstructed.configured,
    version: reconstructed.version,
    updatedAt: reconstructed.updatedAt,
  };
  if (!normalized.configured) return normalized;

  const launchValidation = normalizeLaunchBuyBox(
    normalized,
    normalized,
    new Date(raw.updatedAt),
  );
  if (!launchValidation.ok) return null;
  return {
    ...launchValidation.value,
    version: reconstructed.version,
    updatedAt: reconstructed.updatedAt,
  };
}

function migrateLegacyMarketsByState(
  markets: string[],
  states: StateCode[],
  defaults: BuyBoxConfig,
): BuyBoxConfig["marketsByState"] | null {
  const result: BuyBoxConfig["marketsByState"] = { MA: [], RI: [] };
  const defaultSets = {
    MA: new Set([
      ...defaults.marketsByState.MA,
      ...LEGACY_MARKETS_BY_STATE.MA,
    ]),
    RI: new Set([
      ...defaults.marketsByState.RI,
      ...LEGACY_MARKETS_BY_STATE.RI,
    ]),
  };
  for (const rawMarket of markets) {
    const market = rawMarket.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
    let assigned = false;
    for (const state of STATES_FOR_IMPORT) {
      if (states.includes(state) && defaultSets[state].has(market)) {
        result[state].push(market);
        assigned = true;
      }
    }
    if (!assigned) {
      if (states.length !== 1) return null;
      result[states[0]].push(market);
    }
  }
  result.MA = [...new Set(result.MA)].sort();
  result.RI = [...new Set(result.RI)].sort();
  return result;
}

function uniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function relationshipsAreValid(data: DealFlowData): boolean {
  if (!uniqueIds(data.deals) || !uniqueIds(data.buyers) || !uniqueIds(data.analyses)) return false;
  const dealIds = new Set(data.deals.map((deal) => deal.id));
  if (data.analyses.some((analysis) => analysis.dealId !== null && !dealIds.has(analysis.dealId))) return false;
  if (data.dealDeskDraft.dealId !== "" && !dealIds.has(data.dealDeskDraft.dealId)) return false;
  for (const deal of data.deals) {
    if (!uniqueIds(deal.sourceAssertions) || !uniqueIds(deal.factConflicts) || !uniqueIds(deal.researchRestrictions)) return false;
    const assertionIds = new Set(deal.sourceAssertions.map((assertion) => assertion.id));
    if (deal.factConflicts.some((conflict) => !assertionIds.has(conflict.sourceAssertionId))) return false;
    if (deal.researchRestrictions.some((restriction) => restriction.sourceAssertionId !== null && !assertionIds.has(restriction.sourceAssertionId))) return false;
  }
  const comparableIds = new Set(data.sellerPropertyWorkspace.comparableRanges.map((entry) => entry.id));
  const repairIds = new Set(data.sellerPropertyWorkspace.repairRanges.map((entry) => entry.id));
  const documentIds = new Set(data.sellerPropertyWorkspace.documents.map((entry) => entry.id));
  const reviewDraftIds = new Set(data.sellerPropertyWorkspace.reviewDrafts.map((draft) => draft.id));
  if (
    !uniqueIds(data.sellerPropertyWorkspace.conversationLogs)
    || !uniqueIds(data.sellerPropertyWorkspace.tasks)
    || !uniqueIds(data.sellerPropertyWorkspace.comparableRanges)
    || !uniqueIds(data.sellerPropertyWorkspace.repairRanges)
    || !uniqueIds(data.sellerPropertyWorkspace.documents)
    || !uniqueIds(data.sellerPropertyWorkspace.reviewDrafts)
    || !uniqueIds(data.sellerPropertyWorkspace.approvalRequests)
  ) return false;
  if (data.sellerPropertyWorkspace.conversationLogs.some((entry) => !dealIds.has(entry.propertyRecordId))) return false;
  if (data.sellerPropertyWorkspace.tasks.some((task) => !dealIds.has(task.propertyRecordId))) return false;
  if (data.sellerPropertyWorkspace.comparableRanges.some((entry) => !dealIds.has(entry.propertyRecordId))) return false;
  if (data.sellerPropertyWorkspace.repairRanges.some((entry) => !dealIds.has(entry.propertyRecordId))) return false;
  if (data.sellerPropertyWorkspace.documents.some((entry) => !dealIds.has(entry.propertyRecordId))) return false;
  if (data.sellerPropertyWorkspace.reviewDrafts.some((draft) => !dealIds.has(draft.propertyRecordId))) return false;
  if (data.sellerPropertyWorkspace.approvalRequests.some((request) => !reviewDraftIds.has(request.reviewDraftId) || !dealIds.has(request.propertyRecordId))) return false;
  for (const draft of data.sellerPropertyWorkspace.reviewDrafts) {
    if (draft.includeComparableRangeIds.some((id) => !comparableIds.has(id))) return false;
    if (draft.includeRepairRangeIds.some((id) => !repairIds.has(id))) return false;
    if (draft.includeDocumentIds.some((id) => !documentIds.has(id))) return false;
    const propertyRecordId = draft.propertyRecordId;
    if (draft.includeComparableRangeIds.some((id) =>
      data.sellerPropertyWorkspace.comparableRanges.find((entry) => entry.id === id)?.propertyRecordId !== propertyRecordId
    )) return false;
    if (draft.includeRepairRangeIds.some((id) =>
      data.sellerPropertyWorkspace.repairRanges.find((entry) => entry.id === id)?.propertyRecordId !== propertyRecordId
    )) return false;
    if (draft.includeDocumentIds.some((id) =>
      data.sellerPropertyWorkspace.documents.find((entry) => entry.id === id)?.propertyRecordId !== propertyRecordId
    )) return false;
  }
  return true;
}

function reconstructV1(value: Record<string, unknown>): DealFlowDataV1 | null {
  const fields = ["schemaVersion", "updatedAt", "preferences", "deals", "buyers", "analyses", "curriculum", "weekProgress", "readinessChecks", "compliance", "dealDeskDraft"];
  if (!hasOnlyKeys(value, fields) || value.schemaVersion !== 1 || !validString(value.updatedAt) || !validArray(value.deals) || !validArray(value.buyers) || !validArray(value.analyses)) return null;
  const preferences = reconstructPreferences(value.preferences);
  const deals = value.deals.map(reconstructDealV1);
  const buyers = value.buyers.map(reconstructBuyer);
  const analyses = value.analyses.map(reconstructAnalysis);
  const curriculum = reconstructBooleanRecord(value.curriculum);
  const weekProgress = reconstructBooleanRecord(value.weekProgress);
  const readinessChecks = reconstructBooleanRecord(value.readinessChecks);
  const compliance = reconstructCompliance(value.compliance);
  const dealDeskDraft = reconstructDealDeskDraft(value.dealDeskDraft);
  if (preferences === null || deals.some((item) => item === null) || buyers.some((item) => item === null) || analyses.some((item) => item === null) || curriculum === null || weekProgress === null || readinessChecks === null || compliance === null || dealDeskDraft === null) return null;
  const result: DealFlowDataV1 = {
    schemaVersion: 1,
    updatedAt: value.updatedAt,
    preferences,
    deals: deals as DealRecordV1[],
    buyers: buyers as BuyerRecord[],
    analyses: analyses as DealAnalysis[],
    curriculum,
    weekProgress,
    readinessChecks,
    compliance,
    dealDeskDraft,
    sellerPropertyWorkspace: createEmptyData(value.updatedAt).sellerPropertyWorkspace,
  };
  const ids = new Set(result.deals.map((deal) => deal.id));
  return uniqueIds(result.deals) && uniqueIds(result.buyers) && uniqueIds(result.analyses) && result.analyses.every((analysis) => analysis.dealId === null || ids.has(analysis.dealId)) && (result.dealDeskDraft.dealId === "" || ids.has(result.dealDeskDraft.dealId)) ? result : null;
}

function migrationRestriction(status: string, dealId: string, createdAt: string): ResearchRestriction | null {
  const normalized = status.trim().toLocaleLowerCase();
  const definitions: Array<[string, ResearchRestrictionCode]> = [
    ["do not contact", "Do not contact"], ["opt out", "Do not contact"],
    ["identity disputed", "Identity disputed"], ["ownership stale", "Ownership stale"],
    ["specialist review", "Specialist review"],
  ];
  const match = definitions.find(([phrase]) => normalized.includes(phrase));
  return match === undefined ? null : {
    id: `migration:${dealId}:${match[1].toLocaleLowerCase().replaceAll(" ", "-")}`,
    code: match[1], source: "Migration", sourceAssertionId: null,
    reason: `Migrated from legacy owner contact status: ${status.trim()}.`,
    createdAt, resolvedAt: null, resolutionNote: "",
  };
}

export function migrateV1(value: DealFlowDataV1, now: Date): DealFlowData {
  const migratedDeals: DealRecord[] = value.deals.map((deal) => {
    const restriction = migrationRestriction(
      deal.ownerContactStatus,
      deal.id,
      deal.updatedAt,
    );
    return {
      id: deal.id, createdAt: deal.createdAt, updatedAt: deal.updatedAt, state: deal.state,
      address: deal.address, city: deal.city, zip: "", market: "", propertyType: deal.propertyType,
      source: deal.source, ownerContactStatus: deal.ownerContactStatus, stage: deal.stage,
      nextAction: deal.nextAction, notes: deal.notes, askingPrice: deal.askingPrice,
      rehabLevel: deal.rehabLevel, sourceAssertions: [], factConflicts: [],
      researchRestrictions: restriction === null ? [] : [restriction], strategies: deal.strategies.slice(),
      executedAgreement: deal.executedAgreement, equitableInterestRecorded: deal.equitableInterestRecorded,
      legalTitleDisclosureReady: deal.legalTitleDisclosureReady, attorneyReviewComplete: deal.attorneyReviewComplete,
    };
  });
  return {
    schemaVersion: 2, revision: 0, updatedAt: value.updatedAt, preferences: value.preferences,
    buyBox: createEmptyData(now.toISOString()).buyBox, deals: migratedDeals, buyers: value.buyers,
    analyses: value.analyses, curriculum: value.curriculum, weekProgress: value.weekProgress,
    readinessChecks: value.readinessChecks, compliance: value.compliance, dealDeskDraft: value.dealDeskDraft,
    sellerPropertyWorkspace: value.sellerPropertyWorkspace ?? createEmptyData(now.toISOString()).sellerPropertyWorkspace,
  };
}

function reconstructV2(
  value: Record<string, unknown>,
  now: Date,
): DealFlowData | null {
  const fields = ["schemaVersion", "revision", "updatedAt", "preferences", "buyBox", "deals", "buyers", "analyses", "curriculum", "weekProgress", "readinessChecks", "compliance", "dealDeskDraft", "sellerPropertyWorkspace"];
  if (!hasOnlyKeys(value, fields) || value.schemaVersion !== 2 || !validNonnegativeInteger(value.revision) || !validString(value.updatedAt) || !validArray(value.deals) || !validArray(value.buyers) || !validArray(value.analyses)) return null;
  const preferences = reconstructPreferences(value.preferences);
  const buyBox = reconstructBuyBox(value.buyBox);
  const deals = value.deals.map((deal) => reconstructDealV2(deal, now));
  const buyers = value.buyers.map(reconstructBuyer);
  const analyses = value.analyses.map(reconstructAnalysis);
  const curriculum = reconstructBooleanRecord(value.curriculum);
  const weekProgress = reconstructBooleanRecord(value.weekProgress);
  const readinessChecks = reconstructBooleanRecord(value.readinessChecks);
  const compliance = reconstructCompliance(value.compliance);
  const dealDeskDraft = reconstructDealDeskDraft(value.dealDeskDraft);
  const sellerPropertyWorkspace = reconstructSellerPropertyWorkspace(value.sellerPropertyWorkspace);
  if (preferences === null || buyBox === null || deals.some((item) => item === null) || buyers.some((item) => item === null) || analyses.some((item) => item === null) || curriculum === null || weekProgress === null || readinessChecks === null || compliance === null || dealDeskDraft === null || sellerPropertyWorkspace === null) return null;
  const data: DealFlowData = {
    schemaVersion: 2,
    revision: value.revision,
    updatedAt: value.updatedAt,
    preferences,
    buyBox,
    deals: deals as DealRecord[],
    buyers: buyers as BuyerRecord[],
    analyses: analyses as DealAnalysis[],
    curriculum,
    weekProgress,
    readinessChecks,
    compliance,
    dealDeskDraft,
    sellerPropertyWorkspace,
  };
  return relationshipsAreValid(data) ? data : null;
}

export function validateImport(value: unknown, now = new Date()): ImportResult {
  if (!isRecord(value)) return { ok: false, errors: ["The selected file does not contain a data object."] };
  const v1TopLevel = ["schemaVersion", "updatedAt", "preferences", "deals", "buyers", "analyses", "curriculum", "weekProgress", "readinessChecks", "compliance", "dealDeskDraft"];
  const v2TopLevel = ["schemaVersion", "revision", "updatedAt", "preferences", "buyBox", "deals", "buyers", "analyses", "curriculum", "weekProgress", "readinessChecks", "compliance", "dealDeskDraft", "sellerPropertyWorkspace"];
  const allowed = value.schemaVersion === 1 ? v1TopLevel : value.schemaVersion === 2 ? v2TopLevel : v2TopLevel;
  const extras = unsupportedKeys(value, allowed);
  if (extras.length > 0) return { ok: false, errors: [`The workspace contains unsupported top-level fields: ${extras.join(", ")}.`] };
  if (value.schemaVersion === 1) {
    const v1 = reconstructV1(value);
    return v1 === null ? { ok: false, errors: ["The import contains malformed version-1 workspace data."] } : { ok: true, data: migrateV1(v1, now) };
  }
  if (value.schemaVersion === 2) {
    const v2 = reconstructV2(value, now);
    return v2 === null ? { ok: false, errors: ["The import contains malformed version-2 workspace data."] } : { ok: true, data: v2 };
  }
  return { ok: false, errors: [`This file uses schema version ${String(value.schemaVersion)}; Tradewind DealFlow supports versions 1 and 2.`, "The import is missing required top-level fields."] };
}

export function parseImportText(text: string, now = new Date()): ImportResult {
  try { return validateImport(JSON.parse(text), now); }
  catch { return { ok: false, errors: ["The selected file is not valid JSON."] }; }
}

export function serializeData(data: DealFlowData): string { return `${JSON.stringify(data, null, 2)}\n`; }

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function serializePipelineCsv(deals: DealRecord[]): string {
  const header = ["State", "Property address", "City", "ZIP", "Property type", "Source", "Owner contact status", "Stage", "Asking price", "Next action", "Notes"];
  const rows = deals.map((deal) => [deal.state, deal.address, deal.city, deal.zip, deal.propertyType, deal.source, deal.ownerContactStatus, deal.stage, deal.askingPrice, deal.nextAction, deal.notes]);
  return [header, ...rows].map((row) => row.map((value) => csvCell(value)).join(",")).join("\n");
}
