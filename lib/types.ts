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
  propertyType: string;
  source: string;
  ownerContactStatus: string;
  stage: PipelineStage;
  nextAction: string;
  notes: string;
  askingPrice: number | null;
  rehabLevel: RehabLevel;
  strategies: DealStrategy[];
  executedAgreement: boolean;
  equitableInterestRecorded: boolean;
  legalTitleDisclosureReady: boolean;
  attorneyReviewComplete: boolean;
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

export type DealFlowData = {
  schemaVersion: 1;
  updatedAt: string;
  preferences: {
    selectedState: StateCode | null;
    participationPath: ParticipationPath | null;
  };
  deals: DealRecord[];
  buyers: BuyerRecord[];
  analyses: DealAnalysis[];
  curriculum: Record<string, boolean>;
  weekProgress: Record<string, boolean>;
  readinessChecks: Record<string, boolean>;
  compliance: ComplianceState;
  dealDeskDraft: DealDeskDraft;
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
