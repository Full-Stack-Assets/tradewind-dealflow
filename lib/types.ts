export type StateCode = "MA" | "RI";
export type ParticipationPath = "principal" | "licensed";

export const PIPELINE_STAGES = [
  "Research",
  "Qualified",
  "Contact Approved",
  "Conversation",
  "Offer",
  "Contract",
  "Disposition",
  "Closing",
  "Closed",
  "Archived",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type RehabLevel = "Light" | "Moderate" | "Heavy";
export type SourceUsageClassification =
  | "Public record"
  | "Licensed provider"
  | "Direct submission"
  | "Authorized CRM"
  | "Operator research"
  | "Restricted — research only";
export type DataConfidence = "Low" | "Medium" | "High";
export type ProofOfFundsStatus =
  | "Not provided"
  | "Pending review"
  | "Verified"
  | "Expired";

export type DealStrategy =
  | "Direct acquisition"
  | "Assignment"
  | "Double closing"
  | "Wholetail"
  | "Novation"
  | "Seller financing"
  | "Subject-to"
  | "Buy-and-hold"
  | "Rehab/resale"
  | "Listing/referral"
  | "No-deal/resource";

export type DealRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  state: StateCode;
  address: string;
  city: string;
  zip: string;
  market: string;
  propertyType: string;
  source: string;
  ownerContactStatus: string;
  stage: PipelineStage;
  nextAction: string;
  notes: string;
  askingPrice: number | null;
  rehabLevel: RehabLevel | null;
  sourceAssertions: SourceAssertion[];
  factConflicts: FactConflict[];
  researchRestrictions: ResearchRestriction[];
  strategies: DealStrategy[];
  executedAgreement: boolean;
  equitableInterestRecorded: boolean;
  legalTitleDisclosureReady: boolean;
  attorneyReviewComplete: boolean;
};

export type PropertyFactSnapshot = {
  state: StateCode;
  address: string;
  city: string;
  zip: string;
  market: string;
  propertyType: string;
  askingPrice: number | null;
  rehabLevel: RehabLevel | null;
  ownerContactStatus: string;
  nextAction: string;
  notes: string;
};

export type SourceAssertion = {
  id: string;
  source: string;
  sourceRecordId: string;
  retrievedAt: string;
  usageClassification: SourceUsageClassification;
  confidence: DataConfidence | null;
  lastVerifiedAt: string | null;
  importedAt: string;
  fingerprint: string;
  facts: PropertyFactSnapshot;
};

export type FactConflict = {
  id: string;
  field: keyof PropertyFactSnapshot;
  canonicalValue: string | number | null;
  assertedValue: string | number | null;
  sourceAssertionId: string;
  detectedAt: string;
  status: "Unresolved" | "Resolved";
  resolution: null | {
    selectedSide: "Canonical" | "Asserted";
    basis: string;
    resolvedAt: string;
  };
};

export type ResearchRestrictionCode =
  | "Do not contact"
  | "Identity disputed"
  | "Ownership stale"
  | "Source restricted"
  | "Specialist review";

export type ResearchRestriction = {
  id: string;
  code: ResearchRestrictionCode;
  source: "Operator" | "Migration" | "Source assertion" | "System";
  sourceAssertionId: string | null;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string;
};

export type BuyBoxConfig = {
  configured: boolean;
  version: number;
  updatedAt: string;
  states: StateCode[];
  marketsByState: Record<StateCode, string[]>;
  propertyTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  rehabLevels: RehabLevel[];
  minimumConfidence: DataConfidence;
  maxVerificationAgeDays: number;
  financialThresholds: {
    maximumEstimatedValue: number;
    minimumEquityPercent: number;
    preferredEquityPercent: number;
    minimumAssignmentSpread: number;
    preferredAssignmentSpread: number;
    minimumBuyerProfit: number;
    preferredBuyerProfit: number;
    minimumWholesaleGrossMarginPercent: number;
  };
  weights: {
    propertyFit: number;
    financialFeasibility: number;
    marketability: number;
    buyerDemand: number;
    dataQuality: number;
    sellerProvidedFit: number;
  };
};

export type BuyerRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  states: StateCode[];
  markets: string[];
  propertyTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  rehabTolerance: RehabLevel[];
  strategies: DealStrategy[];
  proofOfFundsStatus: ProofOfFundsStatus;
  proofOfFundsExpiresAt: string;
  lastVerifiedAt: string;
};

export type DealAnalysis = {
  id: string;
  dealId: string | null;
  propertyLabel: string;
  state: StateCode | null;
  createdAt: string;
  updatedAt: string;
  arv: number;
  repairs: number;
  holdingClosingCosts: number;
  buyerProfit: number;
  wholesaleFee: number;
  mao: number;
  targetPrice: number | null;
  heuristicPercent: number;
  heuristicValue: number;
  compEvidence: string;
  repairEvidence: string;
  riskNotes: string;
};

export type CancellationWindowRecord = {
  startDate: string;
  verifiedHolidays: string[];
  holidayCalendarVerified: boolean;
  attorneyConfirmed: boolean;
};

export type ComplianceState = {
  sellerWindow: CancellationWindowRecord;
  assigneeWindow: CancellationWindowRecord;
  outreachChecks: Record<string, boolean>;
  marketingChecks: Record<string, boolean>;
};

export type DealDeskDraft = {
  dealId: string;
  submitterName: string;
  submitterEmail: string;
  summary: string;
  requestedStructure: string;
  qualificationChecks: Record<string, boolean>;
  consentToReview: boolean;
};

export type SellerWorkspaceDocumentContractStatus =
  | "Draft"
  | "Pending review"
  | "Approved"
  | "Needs revision"
  | "Rejected";

export type SellerWorkspaceReviewDraftStatus =
  | "Draft"
  | "Ready for approval"
  | "Needs human update"
  | "Approved for local export";

export type SellerWorkspaceApprovalRequestStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Needs revision";

export type SellerConversationActor = "Seller" | "Operator" | "Team";
export type SellerConversationChannel =
  | "Call"
  | "Text"
  | "Email"
  | "Video"
  | "Meeting"
  | "In-person";

export type SellerWorkspaceProvenance = {
  source: string;
  reference: string;
  collectedAt: string;
  confidence: DataConfidence;
  verifiedAt: string | null;
  notes: string;
};

export type SellerConversationLog = {
  id: string;
  propertyRecordId: string;
  loggedAt: string;
  actor: SellerConversationActor;
  channel: SellerConversationChannel;
  summary: string;
  nextAction: string;
  followUpAt: string;
  provenance: SellerWorkspaceProvenance;
};

export type SellerWorkspaceTask = {
  id: string;
  propertyRecordId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  dueAt: string;
  notes: string;
};

export type SellerComparableRange = {
  id: string;
  propertyRecordId: string;
  comparableAddress: string;
  soldPrice: number | null;
  soldDate: string;
  lowEstimate: number | null;
  highEstimate: number | null;
  adjustmentNotes: string;
  provenance: SellerWorkspaceProvenance;
  updatedAt: string;
};

export type SellerRepairRange = {
  id: string;
  propertyRecordId: string;
  workItem: string;
  lowEstimate: number | null;
  highEstimate: number | null;
  evidenceSummary: string;
  provenance: SellerWorkspaceProvenance;
  updatedAt: string;
};

export type SellerDocumentContract = {
  id: string;
  propertyRecordId: string;
  title: string;
  category: "Comparable packet" | "Repair analysis" | "Conversation packet" | "Property fact sheet" | "Other";
  storageMode: "metadata-only";
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  notes: string;
  status: SellerWorkspaceDocumentContractStatus;
  provenance: SellerWorkspaceProvenance;
  createdAt: string;
  updatedAt: string;
};

export type SellerReviewDraft = {
  id: string;
  propertyRecordId: string;
  title: string;
  summary: string;
  includeComparableRangeIds: string[];
  includeRepairRangeIds: string[];
  includeDocumentIds: string[];
  status: SellerWorkspaceReviewDraftStatus;
  createdAt: string;
  updatedAt: string;
};

export type SellerApprovalRequest = {
  id: string;
  propertyRecordId: string;
  reviewDraftId: string;
  requestType: "Document publish" | "Range publish" | "Fact-sheet export";
  requestedAt: string;
  requestedBy: string;
  status: SellerWorkspaceApprovalRequestStatus;
  reviewedAt: string | null;
  reviewer: string;
  reason: string;
};

export type SellerPropertyWorkspace = {
  conversationLogs: SellerConversationLog[];
  tasks: SellerWorkspaceTask[];
  comparableRanges: SellerComparableRange[];
  repairRanges: SellerRepairRange[];
  documents: SellerDocumentContract[];
  reviewDrafts: SellerReviewDraft[];
  approvalRequests: SellerApprovalRequest[];
};

export type DealFlowData = {
  schemaVersion: 2;
  revision: number;
  updatedAt: string;
  preferences: {
    selectedState: StateCode | null;
    participationPath: ParticipationPath | null;
  };
  buyBox: BuyBoxConfig;
  deals: DealRecord[];
  buyers: BuyerRecord[];
  analyses: DealAnalysis[];
  curriculum: Record<string, boolean>;
  weekProgress: Record<string, boolean>;
  readinessChecks: Record<string, boolean>;
  compliance: ComplianceState;
  dealDeskDraft: DealDeskDraft;
  sellerPropertyWorkspace: SellerPropertyWorkspace;
};

export type MarketingReadinessInput = {
  state: StateCode | null;
  participationPath: ParticipationPath | null;
  executedAgreement: boolean;
  equitableInterestRecorded: boolean;
  legalTitleDisclosureReady: boolean;
  attorneyReviewComplete: boolean;
  sellerWindowReady?: boolean;
  assigneeWindowReady?: boolean;
};
