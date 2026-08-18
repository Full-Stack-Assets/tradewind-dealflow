import { sha256Hex } from "./sha256.ts";
import type {
  DataConfidence,
  DealRecord,
  PropertyFactSnapshot,
  SourceAssertion,
  SourceUsageClassification,
  StateCode,
} from "./types.ts";

export type PromotableLead = {
  id: string;
  source: {
    identity: string;
    recordId: string;
    retrievedAt: string;
  };
  provider: "massgis" | "rentcast";
  providerPropertyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  estimatedValue: number | null;
  ownerNames: string[];
  ownerType: string | null;
  ownerOccupied: boolean | null;
  enrichmentStatus: string;
};

export type LeadConversionSuccess = {
  ok: true;
  deal: DealRecord;
  reused: boolean;
};

export type LeadConversionFailure = {
  ok: false;
  error: string;
};

export type LeadConversionResult = LeadConversionSuccess | LeadConversionFailure;

const STATES: readonly StateCode[] = ["MA", "RI"];
const MARKET_BY_STATE: Record<StateCode, string> = {
  MA: "Bristol County",
  RI: "Providence County",
};

export function promotedDealId(lead: Pick<PromotableLead, "source">): string {
  return `deal-${sha256Hex(`${lead.source.identity}:${lead.source.recordId}`).slice(0, 16)}`;
}

export function findExistingPromotedDeal(
  deals: DealRecord[],
  lead: Pick<PromotableLead, "source">,
): DealRecord | null {
  const source = lead.source.identity.trim();
  const recordId = lead.source.recordId.trim();
  return (
    deals.find((deal) =>
      deal.sourceAssertions.some(
        (assertion) => assertion.source === source && assertion.sourceRecordId === recordId,
      ),
    ) ?? null
  );
}

export function convertAutomatedLeadToDeal(
  lead: PromotableLead,
  now: Date,
  existingDeals: DealRecord[] = [],
): LeadConversionResult {
  const existing = findExistingPromotedDeal(existingDeals, lead);
  if (existing) {
    return { ok: true, deal: existing, reused: true };
  }

  const state = lead.state.trim().toUpperCase();
  if (!STATES.includes(state as StateCode)) {
    return { ok: false, error: "Automated leads can only be promoted for Massachusetts or Rhode Island." };
  }
  const address = lead.address.trim();
  const city = lead.city.trim();
  const zip = lead.zip.trim();
  const sourceIdentity = lead.source.identity.trim();
  const sourceRecordId = lead.source.recordId.trim();
  const retrievedAt = lead.source.retrievedAt.trim();
  if (!address || !city || !zip || !sourceIdentity || !sourceRecordId || !retrievedAt) {
    return { ok: false, error: "Automated lead is missing required property identity or source provenance." };
  }
  if (Number.isNaN(Date.parse(retrievedAt))) {
    return { ok: false, error: "Automated lead retrieval time is not a valid timestamp." };
  }

  const importedAt = now.toISOString();
  const typedState = state as StateCode;
  const ownerRecorded = lead.ownerNames.some((name) => name.trim().length > 0);
  const ownerContactStatus = ownerRecorded
    ? "Owner recorded — contact not authorized"
    : "Not researched";
  const facts: PropertyFactSnapshot = {
    state: typedState,
    address,
    city,
    zip,
    market: MARKET_BY_STATE[typedState],
    propertyType: "",
    askingPrice: null,
    rehabLevel: null,
    ownerContactStatus,
    nextAction: "Research property facts and confirm source eligibility.",
    notes: "Promoted from automated MassGIS lead. Estimated value is not an asking price.",
  };

  const assertions: SourceAssertion[] = [
    createAssertion({
      source: sourceIdentity,
      sourceRecordId,
      retrievedAt,
      importedAt,
      usageClassification: "Public record",
      confidence: "Medium",
      facts,
    }),
  ];

  if (ownerRecorded) {
    assertions.push(
      createAssertion({
        source: "rentcast",
        sourceRecordId: lead.providerPropertyId.trim() || sourceRecordId,
        retrievedAt,
        importedAt,
        usageClassification: "Licensed provider",
        confidence: lead.enrichmentStatus === "available" ? "High" : "Medium",
        facts: {
          ...facts,
          notes: "Owner facts remain on the D1 lead record. Contact is not authorized.",
        },
      }),
    );
  }

  const deal: DealRecord = {
    id: promotedDealId(lead),
    createdAt: importedAt,
    updatedAt: importedAt,
    state: typedState,
    address,
    city,
    zip,
    market: facts.market,
    propertyType: "",
    source: sourceIdentity,
    ownerContactStatus,
    stage: "Research",
    nextAction: facts.nextAction,
    notes: facts.notes,
    askingPrice: null,
    rehabLevel: null,
    sourceAssertions: assertions,
    factConflicts: [],
    researchRestrictions: [],
    strategies: [],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
  };

  return { ok: true, deal, reused: false };
}

function createAssertion(input: {
  source: string;
  sourceRecordId: string;
  retrievedAt: string;
  importedAt: string;
  usageClassification: SourceUsageClassification;
  confidence: DataConfidence;
  facts: PropertyFactSnapshot;
}): SourceAssertion {
  const fingerprint = sha256Hex(
    JSON.stringify({
      source: input.source,
      sourceRecordId: input.sourceRecordId,
      retrievedAt: input.retrievedAt,
      facts: input.facts,
    }),
  );
  return {
    id: `assertion-${fingerprint.slice(0, 16)}`,
    source: input.source,
    sourceRecordId: input.sourceRecordId,
    retrievedAt: input.retrievedAt,
    usageClassification: input.usageClassification,
    confidence: input.confidence,
    lastVerifiedAt: input.retrievedAt,
    importedAt: input.importedAt,
    fingerprint,
    facts: input.facts,
  };
}
