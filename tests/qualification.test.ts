import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultBuyBox,
  normalizeBuyBox,
  qualifyDeal,
  rankResearchQueue,
  type QualificationContext,
} from "../lib/qualification.ts";
import type {
  BuyBoxConfig,
  BuyerRecord,
  DataConfidence,
  DealRecord,
  ResearchRestrictionCode,
  SourceAssertion,
} from "../lib/types.ts";

const evaluationDate = new Date("2026-07-28T12:00:00Z");

function configuredBuyBox(
  overrides: Partial<BuyBoxConfig> = {},
): BuyBoxConfig {
  return {
    ...createDefaultBuyBox("2026-07-27T12:00:00.000Z"),
    states: ["MA"],
    markets: ["boston"],
    propertyTypes: ["single-family homes"],
    minPrice: 75_000,
    maxPrice: 500_000,
    rehabLevels: ["Light", "Moderate"],
    ...overrides,
  };
}

function assertion(
  overrides: Partial<SourceAssertion> = {},
): SourceAssertion {
  return {
    id: "assertion-1",
    source: "City assessor",
    sourceRecordId: "record-1",
    retrievedAt: "2026-07-20T00:00:00.000Z",
    usageClassification: "Public record",
    confidence: "Medium",
    lastVerifiedAt: "2026-07-20T00:00:00.000Z",
    importedAt: "2026-07-20T01:00:00.000Z",
    fingerprint: "fingerprint-1",
    facts: {
      state: "MA",
      address: "10 Harbor Way",
      city: "Boston",
      market: "Boston",
      propertyType: "Single-family homes",
      askingPrice: 300_000,
      rehabLevel: "Moderate",
      ownerContactStatus: "Not researched",
      nextAction: "Verify ownership",
      notes: "",
    },
    ...overrides,
  };
}

type DealOverrides = Partial<DealRecord> & {
  confidence?: DataConfidence;
  lastVerifiedAt?: string;
  restriction?: ResearchRestrictionCode;
};

function completeDeal(overrides: DealOverrides = {}): DealRecord {
  const {
    confidence,
    lastVerifiedAt,
    restriction,
    ...dealOverrides
  } = overrides;
  return {
    id: "deal-1",
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    state: "MA",
    address: "10 Harbor Way",
    city: "Boston",
    market: "Boston",
    propertyType: "Single-family homes",
    source: "City assessor",
    ownerContactStatus: "Not researched",
    stage: "Research",
    nextAction: "Verify ownership",
    notes: "",
    askingPrice: 300_000,
    rehabLevel: "Moderate",
    sourceAssertions: [
      assertion({
        confidence: confidence ?? "Medium",
        lastVerifiedAt:
          lastVerifiedAt ?? "2026-07-20T00:00:00.000Z",
      }),
    ],
    factConflicts: [],
    researchRestrictions: restriction
      ? [{
          id: "restriction-1",
          code: restriction,
          source: "Operator",
          sourceAssertionId: null,
          reason: "Recorded hold",
          createdAt: "2026-07-20T00:00:00.000Z",
          resolvedAt: null,
          resolutionNote: "",
        }]
      : [],
    strategies: [],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
    ...dealOverrides,
  };
}

function verifiedBuyer(overrides: Partial<BuyerRecord> = {}): BuyerRecord {
  return {
    id: "buyer-1",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    name: "Recorded buyer",
    company: "Buyer LLC",
    email: "",
    phone: "",
    states: ["MA"],
    markets: ["Boston"],
    propertyTypes: ["Single-family homes"],
    minPrice: 100_000,
    maxPrice: 500_000,
    rehabTolerance: ["Light", "Moderate"],
    strategies: ["Assignment"],
    proofOfFundsStatus: "Verified",
    proofOfFundsExpiresAt: "2026-12-31",
    lastVerifiedAt: "2026-07-20",
    ...overrides,
  };
}

function completeContext(
  overrides: Partial<QualificationContext> = {},
): QualificationContext {
  return {
    financial: {
      estimatedValue: 600_000,
      acquisitionPrice: 300_000,
      estimatedEquityPercent: 50,
      assignmentSpread: 30_000,
      buyerProfit: 40_000,
      wholesaleGrossMarginPercent: 10,
    },
    marketability: {
      comparableConfidence: 90,
      verifiedAt: "2026-07-24T00:00:00.000Z",
      source: "Operator-reviewed comparable set",
    },
    buyers: [verifiedBuyer()],
    sellerProvidedFit: {
      voluntarilyProvided: true,
      score: 80,
      verifiedAt: "2026-07-25T00:00:00.000Z",
      source: "Seller intake",
      positiveReasons: ["Seller supplied timing and property-condition facts."],
      negativeReasons: [],
    },
    ...overrides,
  };
}

test("default buy box contains the editable operating geography, types, thresholds, and six weights", () => {
  const result = createDefaultBuyBox("2026-07-28T12:00:00.000Z");

  assert.equal(result.configured, true);
  assert.equal(result.version, 1);
  assert.deepEqual(result.states, ["MA", "RI"]);
  assert.ok(result.markets.includes("bristol county"));
  assert.ok(result.markets.includes("providence"));
  assert.ok(result.markets.includes("fall river"));
  assert.ok(result.propertyTypes.includes("single-family homes"));
  assert.ok(result.propertyTypes.includes("small multifamily, 5–12 units — manual review"));
  assert.deepEqual(result.financialThresholds, {
    maximumEstimatedValue: 750_000,
    minimumEquityPercent: 30,
    preferredEquityPercent: 40,
    minimumAssignmentSpread: 15_000,
    preferredAssignmentSpread: 25_000,
    minimumBuyerProfit: 25_000,
    preferredBuyerProfit: 35_000,
    minimumWholesaleGrossMarginPercent: 8,
  });
  assert.deepEqual(result.weights, {
    propertyFit: 25,
    financialFeasibility: 25,
    marketability: 15,
    buyerDemand: 15,
    dataQuality: 10,
    sellerProvidedFit: 10,
  });
});

test("semantic saves normalize, dedupe, and increment only material changes", () => {
  const previous = configuredBuyBox({
    version: 7,
    states: ["MA", "RI"],
    markets: ["boston", "providence"],
    propertyTypes: ["duplexes", "single-family homes"],
  });
  const equivalent = normalizeBuyBox(
    {
      ...previous,
      states: [" ri ", "MA", "MA"] as BuyBoxConfig["states"],
      markets: [" Providence", "BOSTON ", "boston"],
      propertyTypes: [" Single-Family Homes ", "DUPLEXES"],
      rehabLevels: ["moderate", "LIGHT"] as unknown as BuyBoxConfig["rehabLevels"],
    },
    previous,
    evaluationDate,
  );
  assert.equal(equivalent.ok, true);
  if (!equivalent.ok) return;
  assert.equal(equivalent.value.version, 7);
  assert.equal(equivalent.value.updatedAt, previous.updatedAt);

  const changed = normalizeBuyBox(
    {
      ...equivalent.value,
      financialThresholds: {
        ...equivalent.value.financialThresholds,
        minimumAssignmentSpread: 20_000,
      },
    },
    equivalent.value,
    evaluationDate,
  );
  assert.equal(changed.ok, true);
  if (!changed.ok) return;
  assert.equal(changed.value.version, 8);
  assert.equal(changed.value.updatedAt, "2026-07-28T12:00:00.000Z");
});

test("configuration validation covers geography, types, prices, thresholds, confidence, freshness, and every weight", () => {
  const result = normalizeBuyBox(
    {
      ...configuredBuyBox(),
      states: ["CT"] as unknown as BuyBoxConfig["states"],
      markets: [" "],
      propertyTypes: [" "],
      minPrice: -1,
      maxPrice: Number.POSITIVE_INFINITY,
      rehabLevels: ["Cosmetic"] as unknown as BuyBoxConfig["rehabLevels"],
      minimumConfidence: "Certain" as DataConfidence,
      maxVerificationAgeDays: 366,
      financialThresholds: {
        maximumEstimatedValue: -1,
        minimumEquityPercent: 40,
        preferredEquityPercent: 30,
        minimumAssignmentSpread: Number.NaN,
        preferredAssignmentSpread: 10_000,
        minimumBuyerProfit: 30_000,
        preferredBuyerProfit: 20_000,
        minimumWholesaleGrossMarginPercent: -1,
      },
      weights: {
        propertyFit: -1,
        financialFeasibility: Number.NaN,
        marketability: -1,
        buyerDemand: -1,
        dataQuality: -1,
        sellerProvidedFit: -1,
      },
    },
    configuredBuyBox(),
    evaluationDate,
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  for (const expected of [
    /state/i,
    /market/i,
    /property type/i,
    /minimum price/i,
    /maximum price/i,
    /rehab/i,
    /confidence/i,
    /freshness/i,
    /maximum estimated value/i,
    /preferred equity/i,
    /assignment spread/i,
    /preferred buyer profit/i,
    /gross margin/i,
    /property fit weight/i,
    /financial feasibility weight/i,
    /marketability weight/i,
    /buyer demand weight/i,
    /data quality weight/i,
    /seller-provided fit weight/i,
  ]) {
    assert.match(result.errors.join("\n"), expected);
  }
});

test("missing nested configuration is rejected rather than crashing qualification", () => {
  const malformed = {
    ...configuredBuyBox(),
    financialThresholds: undefined,
    weights: undefined,
  } as unknown as BuyBoxConfig;
  const normalized = normalizeBuyBox(
    malformed,
    configuredBuyBox(),
    evaluationDate,
  );
  assert.equal(normalized.ok, false);

  const result = qualifyDeal(
    completeDeal(),
    malformed,
    evaluationDate,
    completeContext(),
  );
  assert.equal(result.status, "Disqualified");
  assert.match(result.disqualifiers.join(" "), /configuration/i);
});

test("unsupported components are Unassessed and never receive invented zeroes", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
  );

  assert.equal(result.status, "Needs data");
  assert.equal(result.score, null);
  assert.deepEqual(
    result.components.map(({ key, assessment, score }) => [
      key,
      assessment,
      score,
    ]),
    [
      ["propertyFit", "Assessed", 100],
      ["financialFeasibility", "Unassessed", null],
      ["marketability", "Unassessed", null],
      ["buyerDemand", "Unassessed", null],
      ["dataQuality", "Assessed", 90],
      ["sellerProvidedFit", "Unassessed", null],
    ],
  );
  assert.equal(result.sellerFit, "Unassessed");
  assert.match(result.missingInformation.join(" "), /financial/i);
  assert.match(result.missingInformation.join(" "), /buyer/i);
  assert.match(result.missingInformation.join(" "), /seller-provided/i);
});

test("complete supported evidence produces the exact six-component weighted result", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );

  assert.equal(result.status, "Scored");
  assert.equal(result.score, 96);
  assert.deepEqual(
    result.components.map(({ key, score }) => [key, score]),
    [
      ["propertyFit", 100],
      ["financialFeasibility", 100],
      ["marketability", 90],
      ["buyerDemand", 100],
      ["dataQuality", 90],
      ["sellerProvidedFit", 80],
    ],
  );
  assert.ok(result.positiveReasons.length > 0);
  assert.deepEqual(result.negativeReasons, []);
});

test("financial evidence stays Unassessed when any required real input is missing", () => {
  const context = completeContext();
  context.financial = {
    ...context.financial!,
    estimatedEquityPercent: null,
  };
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    context,
  );
  const financial = result.components.find(
    ({ key }) => key === "financialFeasibility",
  );

  assert.equal(financial?.assessment, "Unassessed");
  assert.equal(financial?.score, null);
  assert.match(financial?.missingInformation.join(" ") ?? "", /equity/i);
});

test("invalid financial evidence is missing data rather than an invented negative score", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      financial: {
        estimatedValue: Number.NaN,
        acquisitionPrice: -1,
        estimatedEquityPercent: 101,
        assignmentSpread: 30_000,
        buyerProfit: 40_000,
        wholesaleGrossMarginPercent: 10,
      },
    }),
  );
  const financial = result.components.find(
    ({ key }) => key === "financialFeasibility",
  );

  assert.equal(financial?.assessment, "Unassessed");
  assert.equal(financial?.score, null);
  assert.match(financial?.missingInformation.join(" ") ?? "", /estimated value/i);
  assert.match(financial?.missingInformation.join(" ") ?? "", /acquisition price/i);
  assert.match(financial?.missingInformation.join(" ") ?? "", /equity/i);
});

test("minimum spread and buyer-profit failures are hard disqualifiers with exact negative reasons", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      financial: {
        estimatedValue: 600_000,
        acquisitionPrice: 300_000,
        estimatedEquityPercent: 50,
        assignmentSpread: 14_999,
        buyerProfit: 24_999,
        wholesaleGrossMarginPercent: 10,
      },
    }),
  );

  assert.equal(result.status, "Disqualified");
  assert.equal(result.score, null);
  assert.match(result.disqualifiers.join(" "), /\$15,000/);
  assert.match(result.disqualifiers.join(" "), /\$25,000/);
  assert.match(result.negativeReasons.join(" "), /assignment spread/i);
  assert.match(result.negativeReasons.join(" "), /buyer profit/i);
});

test("configured manual-review property types and specialist strategies never auto-clear", () => {
  const manualType = "Small multifamily, 5–12 units — manual review";
  const propertyReview = qualifyDeal(
    completeDeal({ propertyType: manualType }),
    configuredBuyBox({ propertyTypes: [manualType] }),
    evaluationDate,
    completeContext(),
  );
  assert.equal(propertyReview.status, "Disqualified");
  assert.match(propertyReview.disqualifiers.join(" "), /manual review/i);

  const structureReview = qualifyDeal(
    completeDeal({ strategies: ["Novation"], attorneyReviewComplete: false }),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  assert.equal(structureReview.status, "Disqualified");
  assert.match(structureReview.disqualifiers.join(" "), /specialist legal review/i);
});

test("insufficient comparable confidence disqualifies without adjusting compliance", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      marketability: {
        comparableConfidence: 74,
        verifiedAt: "2026-07-24T00:00:00.000Z",
        source: "Operator-reviewed comparable set",
      },
    }),
  );

  assert.equal(result.status, "Disqualified");
  assert.match(result.disqualifiers.join(" "), /comparable confidence/i);
  assert.equal(result.compliance.outreach.eligible, false);
  assert.equal(result.compliance.outreach.status, "Human approval required");
});

test("buyer demand uses only current verified buyer evidence", () => {
  const noEvidence = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({ buyers: [] }),
  );
  const noDemand = noEvidence.components.find(
    ({ key }) => key === "buyerDemand",
  );
  assert.equal(noDemand?.assessment, "Unassessed");
  assert.equal(noDemand?.score, null);

  const expired = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      buyers: [verifiedBuyer({ proofOfFundsExpiresAt: "2026-07-01" })],
    }),
  );
  assert.equal(
    expired.components.find(({ key }) => key === "buyerDemand")?.assessment,
    "Unassessed",
  );

  const mismatch = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      buyers: [verifiedBuyer({ states: ["RI"] })],
    }),
  );
  const mismatchedDemand = mismatch.components.find(
    ({ key }) => key === "buyerDemand",
  );
  assert.equal(mismatchedDemand?.assessment, "Assessed");
  assert.equal(mismatchedDemand?.score, 0);
  assert.match(mismatch.negativeReasons.join(" "), /no verified buyer/i);
});

test("proof of funds remains current through its recorded expiry date", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      buyers: [verifiedBuyer({ proofOfFundsExpiresAt: "2026-07-28" })],
    }),
  );

  assert.equal(
    result.components.find(({ key }) => key === "buyerDemand")?.assessment,
    "Assessed",
  );
});

test("stale comparable evidence is Unassessed instead of silently current", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      marketability: {
        comparableConfidence: 90,
        verifiedAt: "2026-01-01T00:00:00.000Z",
        source: "Old comparable set",
      },
    }),
  );
  const marketability = result.components.find(
    ({ key }) => key === "marketability",
  );

  assert.equal(marketability?.assessment, "Unassessed");
  assert.equal(marketability?.score, null);
  assert.match(marketability?.missingInformation.join(" ") ?? "", /current/i);
});

test("seller fit is assessed only from explicit voluntary current evidence", () => {
  const withheld = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      sellerProvidedFit: {
        voluntarilyProvided: false,
        score: 100,
        verifiedAt: "2026-07-25T00:00:00.000Z",
        source: "Unconfirmed note",
        positiveReasons: ["Do not use"],
        negativeReasons: [],
      },
    }),
  );
  const seller = withheld.components.find(
    ({ key }) => key === "sellerProvidedFit",
  );
  assert.equal(seller?.assessment, "Unassessed");
  assert.equal(seller?.score, null);
  assert.equal(withheld.sellerFit, "Unassessed");
});

test("freshness, confidence, conflicts, restrictions, and disqualifiers remain explicit", () => {
  const deal = completeDeal({
    confidence: "Low",
    lastVerifiedAt: "2026-01-01",
    restriction: "Source restricted",
    factConflicts: [{
      id: "conflict-1",
      field: "market",
      canonicalValue: "Boston",
      assertedValue: "Providence",
      sourceAssertionId: "assertion-1",
      detectedAt: "2026-07-27T00:00:00.000Z",
      status: "Unresolved",
      resolution: null,
    }],
  });
  const result = qualifyDeal(
    deal,
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );

  assert.equal(result.dataFreshness.status, "Stale");
  assert.equal(result.sourceConfidence, "Low");
  assert.deepEqual(result.restrictions.map(({ code }) => code), [
    "Source restricted",
  ]);
  assert.match(result.disqualifiers.join(" "), /source restricted/i);
  assert.match(result.missingInformation.join(" "), /confidence/i);
  assert.match(result.missingInformation.join(" "), /conflict/i);
});

test("restricted source rights disqualify and block outreach even without a duplicate structured hold", () => {
  const deal = completeDeal({
    sourceAssertions: [
      assertion({ usageClassification: "Restricted — research only" }),
    ],
  });
  const result = qualifyDeal(
    deal,
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );

  assert.equal(result.status, "Disqualified");
  assert.match(result.disqualifiers.join(" "), /source rights/i);
  assert.equal(result.compliance.outreach.status, "Blocked");
});

test("DNC and identity holds block outreach while otherwise every production action retains approval gates", () => {
  const blocked = qualifyDeal(
    completeDeal({ restriction: "Do not contact" }),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  assert.equal(blocked.compliance.outreach.status, "Blocked");
  assert.equal(blocked.compliance.outreach.eligible, false);
  assert.match(blocked.recommendedAction, /do not contact/i);

  const review = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  assert.deepEqual(review.compliance, {
    outreach: {
      status: "Human approval required",
      eligible: false,
      reason: "First homeowner contact requires recorded human approval.",
    },
    offer: {
      status: "Human approval required",
      eligible: false,
      reason: "Offers and LOIs require recorded human approval.",
    },
    contract: {
      status: "Human approval required",
      eligible: false,
      reason: "Contracts and amendments require recorded human approval.",
    },
    marketing: {
      status: "Human approval required",
      eligible: false,
      reason: "Public marketing requires recorded human approval.",
    },
    funds: {
      status: "Human approval required",
      eligible: false,
      reason: "Earnest money, closing instructions, and funds require recorded human approval.",
    },
  });
});

test("status safety precedence remains unconfigured, disqualified, needs data, then scored", () => {
  const heldMissing = completeDeal({
    restriction: "Do not contact",
    sourceAssertions: [],
  });
  assert.equal(
    qualifyDeal(
      heldMissing,
      { ...configuredBuyBox(), configured: false },
      evaluationDate,
    ).status,
    "Unconfigured",
  );
  assert.equal(
    qualifyDeal(
      heldMissing,
      configuredBuyBox(),
      evaluationDate,
    ).status,
    "Disqualified",
  );
  assert.equal(
    qualifyDeal(
      completeDeal(),
      configuredBuyBox(),
      evaluationDate,
    ).status,
    "Needs data",
  );
  assert.equal(
    qualifyDeal(
      completeDeal(),
      configuredBuyBox(),
      evaluationDate,
      completeContext(),
    ).status,
    "Scored",
  );
});

test("research tasks are derived in legal, ownership, data, underwriting, buyer, time, score, and potential order", () => {
  const result = qualifyDeal(
    completeDeal({
      restriction: "Identity disputed",
      sourceAssertions: [],
    }),
    configuredBuyBox(),
    evaluationDate,
  );

  assert.deepEqual(
    result.researchTasks.map(({ priority, category }) => [
      priority,
      category,
    ]),
    [
      [1, "Legal/identity risk"],
      [2, "Ownership verification"],
      [3, "Data-quality impact"],
      [4, "Underwriting impact"],
      [5, "Buyer-match impact"],
      [6, "Time sensitivity"],
      [7, "Opportunity score"],
      [8, "Estimated transaction potential"],
    ],
  );
  assert.match(result.recommendedAction, /identity disputed/i);
});

test("research queue prioritizes legal risk before lower-impact tasks and keeps scored tie ordering stable", () => {
  const deals = [
    completeDeal({
      id: "score-b",
      updatedAt: "2026-07-20T00:00:00.000Z",
    }),
    completeDeal({
      id: "score-a",
      updatedAt: "2026-07-20T00:00:00.000Z",
    }),
    completeDeal({
      id: "legal-risk",
      restriction: "Identity disputed",
    }),
  ];
  const contexts: Record<string, QualificationContext> = {
    "score-a": completeContext(),
    "score-b": completeContext(),
    "legal-risk": completeContext(),
  };

  const ranked = rankResearchQueue(
    deals,
    configuredBuyBox(),
    evaluationDate,
    (deal) => contexts[deal.id],
  );
  assert.deepEqual(
    ranked.map(({ dealId, queue, rank, researchPriority }) => ({
      dealId,
      queue,
      rank,
      researchPriority,
    })),
    [
      {
        dealId: "legal-risk",
        queue: "Disqualified",
        rank: null,
        researchPriority: 1,
      },
      {
        dealId: "score-a",
        queue: "Scored",
        rank: 1,
        researchPriority: 2,
      },
      {
        dealId: "score-b",
        queue: "Scored",
        rank: 2,
        researchPriority: 2,
      },
    ],
  );
});
