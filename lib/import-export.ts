import type {
  BuyerRecord,
  CancellationWindowRecord,
  ComplianceState,
  DealAnalysis,
  DealDeskDraft,
  DealFlowData,
  DealRecord,
  DealStrategy,
  ParticipationPath,
  PipelineStage,
  ProofOfFundsStatus,
  RehabLevel,
  StateCode,
} from "./types.ts";
import { PIPELINE_STAGES } from "./types.ts";

export const LOCAL_DATA_KEY = "tradewind-dealflow:v1";

export function createEmptyData(
  now = new Date().toISOString(),
): DealFlowData {
  return {
    schemaVersion: 1,
    updatedAt: now,
    preferences: {
      selectedState: null,
      participationPath: null,
    },
    deals: [],
    buyers: [],
    analyses: [],
    curriculum: {},
    weekProgress: {},
    readinessChecks: {},
    compliance: {
      sellerWindow: {
        startDate: "",
        verifiedHolidays: [],
        holidayCalendarVerified: false,
        attorneyConfirmed: false,
      },
      assigneeWindow: {
        startDate: "",
        verifiedHolidays: [],
        holidayCalendarVerified: false,
        attorneyConfirmed: false,
      },
      outreachChecks: {},
      marketingChecks: {},
    },
    dealDeskDraft: {
      dealId: "",
      submitterName: "",
      submitterEmail: "",
      summary: "",
      requestedStructure: "",
      qualificationChecks: {},
      consentToReview: false,
    },
  };
}

type ImportResult =
  | { ok: true; data: DealFlowData }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredTopLevelFieldsExist(value: Record<string, unknown>): boolean {
  return (
    isRecord(value.preferences) &&
    Array.isArray(value.deals) &&
    Array.isArray(value.buyers) &&
    Array.isArray(value.analyses) &&
    isRecord(value.curriculum) &&
    isRecord(value.weekProgress) &&
    isRecord(value.readinessChecks) &&
    isRecord(value.compliance) &&
    isRecord(value.dealDeskDraft) &&
    typeof value.updatedAt === "string"
  );
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validState(value: unknown): value is StateCode {
  return value === "MA" || value === "RI";
}

function validParticipationPath(value: unknown): value is ParticipationPath {
  return value === "principal" || value === "licensed";
}

function validRehab(value: unknown): value is RehabLevel {
  return value === "Light" || value === "Moderate" || value === "Heavy";
}

const DEAL_STRATEGIES: DealStrategy[] = [
  "Direct acquisition",
  "Assignment",
  "Double closing",
  "Wholetail",
  "Novation",
  "Seller financing",
  "Subject-to",
  "Buy-and-hold",
  "Rehab/resale",
  "Listing/referral",
  "No-deal/resource",
];

const PROOF_OF_FUNDS_STATUSES: ProofOfFundsStatus[] = [
  "Not provided",
  "Pending review",
  "Verified",
  "Expired",
];

function validStrategy(value: unknown): value is DealStrategy {
  return DEAL_STRATEGIES.includes(value as DealStrategy);
}

function validProofOfFundsStatus(
  value: unknown,
): value is ProofOfFundsStatus {
  return PROOF_OF_FUNDS_STATUSES.includes(value as ProofOfFundsStatus);
}

function validStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every(
    (item) => typeof item === "boolean",
  );
}

function validNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validDeal(raw: unknown): raw is DealRecord {
  if (!isRecord(raw)) return false;
  return (
    typeof raw.id === "string" &&
    typeof raw.createdAt === "string" &&
    typeof raw.updatedAt === "string" &&
    validState(raw.state) &&
    typeof raw.address === "string" &&
    typeof raw.city === "string" &&
    typeof raw.propertyType === "string" &&
    typeof raw.source === "string" &&
    typeof raw.ownerContactStatus === "string" &&
    PIPELINE_STAGES.includes(raw.stage as PipelineStage) &&
    typeof raw.nextAction === "string" &&
    typeof raw.notes === "string" &&
    (raw.askingPrice === null ||
      validNonnegativeNumber(raw.askingPrice)) &&
    validRehab(raw.rehabLevel) &&
    Array.isArray(raw.strategies) &&
    raw.strategies.every(validStrategy) &&
    typeof raw.executedAgreement === "boolean" &&
    typeof raw.equitableInterestRecorded === "boolean" &&
    typeof raw.legalTitleDisclosureReady === "boolean" &&
    typeof raw.attorneyReviewComplete === "boolean"
  );
}

function validBuyer(raw: unknown): raw is BuyerRecord {
  if (!isRecord(raw)) return false;
  return (
    typeof raw.id === "string" &&
    typeof raw.createdAt === "string" &&
    typeof raw.updatedAt === "string" &&
    typeof raw.name === "string" &&
    typeof raw.company === "string" &&
    typeof raw.email === "string" &&
    typeof raw.phone === "string" &&
    Array.isArray(raw.states) &&
    raw.states.every(validState) &&
    validStringArray(raw.markets) &&
    validStringArray(raw.propertyTypes) &&
    (raw.minPrice === null ||
      validNonnegativeNumber(raw.minPrice)) &&
    (raw.maxPrice === null ||
      validNonnegativeNumber(raw.maxPrice)) &&
    Array.isArray(raw.rehabTolerance) &&
    raw.rehabTolerance.every(validRehab) &&
    Array.isArray(raw.strategies) &&
    raw.strategies.every(validStrategy) &&
    validProofOfFundsStatus(raw.proofOfFundsStatus) &&
    typeof raw.proofOfFundsExpiresAt === "string" &&
    typeof raw.lastVerifiedAt === "string"
  );
}

function validAnalysis(raw: unknown): raw is DealAnalysis {
  if (!isRecord(raw)) return false;
  return (
    typeof raw.id === "string" &&
    (raw.dealId === null || typeof raw.dealId === "string") &&
    typeof raw.propertyLabel === "string" &&
    (raw.state === null || validState(raw.state)) &&
    typeof raw.createdAt === "string" &&
    typeof raw.updatedAt === "string" &&
    validNonnegativeNumber(raw.arv) &&
    validNonnegativeNumber(raw.repairs) &&
    validNonnegativeNumber(raw.holdingClosingCosts) &&
    validNonnegativeNumber(raw.buyerProfit) &&
    validNonnegativeNumber(raw.wholesaleFee) &&
    validFiniteNumber(raw.mao) &&
    (raw.targetPrice === null || validNonnegativeNumber(raw.targetPrice)) &&
    validNonnegativeNumber(raw.heuristicPercent) &&
    raw.heuristicPercent <= 100 &&
    validFiniteNumber(raw.heuristicValue) &&
    typeof raw.compEvidence === "string" &&
    typeof raw.repairEvidence === "string" &&
    typeof raw.riskNotes === "string"
  );
}

function validCancellationWindow(
  raw: unknown,
): raw is CancellationWindowRecord {
  if (!isRecord(raw)) return false;
  return (
    typeof raw.startDate === "string" &&
    validStringArray(raw.verifiedHolidays) &&
    typeof raw.holidayCalendarVerified === "boolean" &&
    typeof raw.attorneyConfirmed === "boolean"
  );
}

function validCompliance(raw: unknown): raw is ComplianceState {
  if (!isRecord(raw)) return false;
  return (
    validCancellationWindow(raw.sellerWindow) &&
    validCancellationWindow(raw.assigneeWindow) &&
    validBooleanRecord(raw.outreachChecks) &&
    validBooleanRecord(raw.marketingChecks)
  );
}

function validDealDeskDraft(raw: unknown): raw is DealDeskDraft {
  if (!isRecord(raw)) return false;
  return (
    typeof raw.dealId === "string" &&
    typeof raw.submitterName === "string" &&
    typeof raw.submitterEmail === "string" &&
    typeof raw.summary === "string" &&
    typeof raw.requestedStructure === "string" &&
    validBooleanRecord(raw.qualificationChecks) &&
    typeof raw.consentToReview === "boolean"
  );
}

function validPreferences(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  return (
    (raw.selectedState === null || validState(raw.selectedState)) &&
    (raw.participationPath === null ||
      validParticipationPath(raw.participationPath))
  );
}

function normalizeDeal(deal: DealRecord): DealRecord {
  return {
    ...deal,
    address: trimmed(deal.address),
    city: trimmed(deal.city),
    propertyType: trimmed(deal.propertyType),
    source: trimmed(deal.source),
    ownerContactStatus: trimmed(deal.ownerContactStatus),
    nextAction: trimmed(deal.nextAction),
    notes: trimmed(deal.notes),
    strategies: deal.strategies.map((strategy) => strategy.trim()) as DealRecord["strategies"],
  };
}

function normalizeBuyer(buyer: BuyerRecord): BuyerRecord {
  return {
    ...buyer,
    name: trimmed(buyer.name),
    company: trimmed(buyer.company),
    email: trimmed(buyer.email).toLowerCase(),
    phone: trimmed(buyer.phone),
    markets: buyer.markets.map((market) => trimmed(market)).filter(Boolean),
    propertyTypes: buyer.propertyTypes
      .map((propertyType) => trimmed(propertyType))
      .filter(Boolean),
  };
}

export function validateImport(value: unknown): ImportResult {
  if (!isRecord(value)) {
    return { ok: false, errors: ["The selected file does not contain a data object."] };
  }

  const errors: string[] = [];
  if (value.schemaVersion !== 1) {
    errors.push(
      `This file uses schema version ${String(value.schemaVersion)}; Tradewind DealFlow supports version 1.`,
    );
  }
  if (!requiredTopLevelFieldsExist(value)) {
    errors.push("The import is missing required top-level fields.");
  }
  if (errors.length > 0) return { ok: false, errors };

  const data = value as unknown as DealFlowData;
  if (!validPreferences(data.preferences)) {
    errors.push("Workspace preferences are malformed.");
  }
  if (!data.deals.every(validDeal)) {
    errors.push("One or more deal records are malformed.");
  }
  if (!data.buyers.every(validBuyer)) {
    errors.push("One or more buyer records are malformed.");
  }
  if (!data.analyses.every(validAnalysis)) {
    errors.push("One or more deal analyses are malformed.");
  }
  if (!validBooleanRecord(data.curriculum)) {
    errors.push("Curriculum progress is malformed.");
  }
  if (!validBooleanRecord(data.weekProgress)) {
    errors.push("Execution-plan progress is malformed.");
  }
  if (!validBooleanRecord(data.readinessChecks)) {
    errors.push("Readiness progress is malformed.");
  }
  if (!validCompliance(data.compliance)) {
    errors.push("Compliance records are malformed.");
  }
  if (!validDealDeskDraft(data.dealDeskDraft)) {
    errors.push("The Deal Desk draft is malformed.");
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      ...structuredClone(data),
      schemaVersion: 1,
      deals: data.deals.map(normalizeDeal),
      buyers: data.buyers.map(normalizeBuyer),
    },
  };
}

export function parseImportText(text: string): ImportResult {
  try {
    return validateImport(JSON.parse(text));
  } catch {
    return { ok: false, errors: ["The selected file is not valid JSON."] };
  }
}

export function serializeData(data: DealFlowData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializePipelineCsv(deals: DealRecord[]): string {
  const header = [
    "State",
    "Property address",
    "City",
    "Property type",
    "Source",
    "Owner contact status",
    "Stage",
    "Asking price",
    "Next action",
    "Notes",
  ];
  const rows = deals.map((deal) => [
    deal.state,
    deal.address,
    deal.city,
    deal.propertyType,
    deal.source,
    deal.ownerContactStatus,
    deal.stage,
    deal.askingPrice,
    deal.nextAction,
    deal.notes,
  ]);
  return [header, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\n");
}
