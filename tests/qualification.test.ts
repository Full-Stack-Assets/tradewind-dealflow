import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultBuyBox,
  labelResearchPriority,
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
    marketsByState: { MA: ["boston"], RI: [] },
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
    strategies: ["Assignment"],
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
      source: "Operator-reviewed underwriting",
      verifiedAt: "2026-07-24T00:00:00.000Z",
      confidence: "High",
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
  assert.ok(result.marketsByState.MA.includes("bristol county"));
  assert.ok(result.marketsByState.RI.includes("providence"));
  assert.ok(result.marketsByState.MA.includes("fall river"));
  assert.equal(result.marketsByState.RI.includes("fall river"), false);
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
    marketsByState: { MA: ["boston"], RI: ["providence"] },
    propertyTypes: ["duplexes", "single-family homes"],
  });
  const equivalent = normalizeBuyBox(
    {
      ...previous,
      states: [" ri ", "MA", "MA"] as BuyBoxConfig["states"],
      marketsByState: {
        MA: ["BOSTON ", "boston"],
        RI: [" Providence"],
      },
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
      marketsByState: { MA: [" "], RI: [] },
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
  assert.equal(result.score, 97);
  assert.equal(result.scoreLabel, "Preliminary score");
  assert.match(result.scoreExplanation, /assessed positive weights/i);
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

test("blank configured-market facts are missing property fit rather than an outside-market disqualifier", () => {
  const result = qualifyDeal(
    completeDeal({ market: "", city: "" }),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  const propertyFit = result.components.find(
    ({ key }) => key === "propertyFit",
  );

  assert.equal(propertyFit?.assessment, "Unassessed");
  assert.equal(propertyFit?.score, null);
  assert.match(propertyFit?.missingInformation.join(" ") ?? "", /market|city/i);
  assert.doesNotMatch(result.disqualifiers.join(" "), /outside.*market/i);
});

test("state-specific markets never match a label configured for another state", () => {
  const result = qualifyDeal(
    completeDeal({ state: "RI", market: "Boston", city: "Boston" }),
    configuredBuyBox({
      states: ["MA", "RI"],
      marketsByState: { MA: ["boston"], RI: ["providence"] },
    }),
    evaluationDate,
    completeContext(),
  );

  assert.equal(result.status, "Disqualified");
  assert.match(result.disqualifiers.join(" "), /outside.*market/i);
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
  assert.equal(result.scoreLabel, "Qualification score");
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

test("component subfactors disclose supported evidence and missing target categories without invented points", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  const byKey = new Map(result.components.map((component) => [
    component.key,
    component.subfactors,
  ]));
  assert.ok(result.components.every(({ subfactors }) => subfactors.length > 0));

  assert.deepEqual(
    byKey.get("propertyFit")?.map(({ label, targetPoints }) => [
      label,
      targetPoints,
    ]),
    [
      ["Geography", 25],
      ["Property type", 25],
      ["Price", 20],
      ["Repair", 15],
      ["Ownership/property suitability", 15],
    ],
  );
  assert.deepEqual(
    byKey.get("financialFeasibility")?.map(({ label, targetPoints }) => [
      label,
      targetPoints,
    ]),
    [
      ["Equity", 20],
      ["Spread", 25],
      ["Buyer profit", 25],
      ["Costs", 15],
      ["Sensitivity", 15],
    ],
  );
  assert.deepEqual(
    byKey.get("marketability")?.map(({ label, targetPoints }) => [
      label,
      targetPoints,
    ]),
    [
      ["Comparable evidence", 25],
      ["Market activity", 20],
      ["Days to commitment", 20],
      ["Property-type demand", 20],
      ["Exit diversity", 15],
    ],
  );
  assert.deepEqual(
    byKey.get("buyerDemand")?.map(({ label, targetPoints }) => [
      label,
      targetPoints,
    ]),
    [
      ["Exact matches", 30],
      ["Valid proof of funds", 25],
      ["Recent active buyer evidence", 20],
      ["Closing performance", 15],
      ["Price competition", 10],
    ],
  );
  assert.deepEqual(
    byKey.get("dataQuality")?.map(({ label, targetPoints }) => [
      label,
      targetPoints,
    ]),
    [
      ["Property identity", 20],
      ["Ownership", 20],
      ["Current value", 15],
      ["Comparable evidence", 15],
      ["Repair evidence", 15],
      ["Usage rights", 10],
      ["Contact evidence", 5],
    ],
  );
  assert.equal(
    byKey.get("financialFeasibility")?.find(({ label }) => label === "Costs")
      ?.assessment,
    "Missing",
  );
  assert.equal(
    byKey.get("buyerDemand")?.find(
      ({ label }) => label === "Closing performance",
    )?.pointsAwarded,
    null,
  );
  assert.equal(
    byKey.get("dataQuality")?.find(({ label }) => label === "Current value")
      ?.assessment,
    "Supported",
  );
  assert.equal(
    byKey.get("dataQuality")?.find(
      ({ label }) => label === "Comparable evidence",
    )?.assessment,
    "Supported",
  );
});

test("preliminary scoring never converts an entirely missing weighted set to zero", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox({
      weights: {
        propertyFit: 0,
        financialFeasibility: 0,
        marketability: 0,
        buyerDemand: 0,
        dataQuality: 0,
        sellerProvidedFit: 10,
      },
    }),
    evaluationDate,
  );

  assert.equal(result.status, "Needs data");
  assert.equal(result.score, null);
  assert.equal(result.scoreLabel, "Preliminary score");
  assert.match(result.scoreExplanation, /no assessed positive-weight/i);
  assert.equal(result.compliance.state, "Clear for research");
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

test("absent financial evidence lists provenance and trust gaps", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({ financial: undefined }),
  );
  const financial = result.components.find(
    ({ key }) => key === "financialFeasibility",
  );

  assert.equal(financial?.assessment, "Unassessed");
  assert.match(financial?.missingInformation.join(" ") ?? "", /source/i);
  assert.match(financial?.missingInformation.join(" ") ?? "", /verification/i);
  assert.match(financial?.missingInformation.join(" ") ?? "", /confidence/i);
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
        source: "Operator-reviewed underwriting",
        verifiedAt: "2026-07-24T00:00:00.000Z",
        confidence: "High",
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

test("stale, unsourced, or low-confidence financial evidence cannot score or disqualify", () => {
  for (const financial of [
    {
      ...completeContext().financial!,
      source: "",
    },
    {
      ...completeContext().financial!,
      verifiedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      ...completeContext().financial!,
      confidence: "Low" as const,
      assignmentSpread: 1,
      buyerProfit: 1,
    },
  ]) {
    const result = qualifyDeal(
      completeDeal(),
      configuredBuyBox(),
      evaluationDate,
      completeContext({ financial }),
    );
    const component = result.components.find(
      ({ key }) => key === "financialFeasibility",
    );

    assert.equal(component?.assessment, "Unassessed");
    assert.equal(component?.score, null);
    assert.doesNotMatch(
      result.disqualifiers.join(" "),
      /assignment spread|buyer profit/i,
    );
    assert.match(
      component?.missingInformation.join(" ") ?? "",
      /source|fresh|confidence/i,
    );
  }
});

test("untrusted financial evidence retains its recorded facts without scoring", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      financial: {
        ...completeContext().financial!,
        confidence: "Low",
      },
    }),
  );
  const financial = result.components.find(
    ({ key }) => key === "financialFeasibility",
  );

  assert.equal(financial?.assessment, "Unassessed");
  assert.match(financial?.inputFacts.join(" ") ?? "", /Operator-reviewed underwriting/);
  assert.match(financial?.inputFacts.join(" ") ?? "", /2026-07-24/);
  assert.match(financial?.inputFacts.join(" ") ?? "", /Low/);
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
        source: "Operator-reviewed underwriting",
        verifiedAt: "2026-07-24T00:00:00.000Z",
        confidence: "High",
      },
    }),
  );

  assert.equal(result.status, "Disqualified");
  assert.equal(result.score, 87);
  assert.equal(result.scoreLabel, "Qualification score");
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
  assert.equal(
    structureReview.compliance.state,
    "Transaction specialist review",
  );
});

test("insufficient comparable confidence blocks offer eligibility without blocking first-contact review", () => {
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
  assert.equal(result.compliance.state, "Offer blocked");
  assert.equal(result.compliance.outreach.status, "Outreach review required");
  assert.equal(result.compliance.offer.status, "Offer blocked");
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

test("missing deal match facts keep verified buyer demand Unassessed with exact gaps", () => {
  for (const [overrides, gap] of [
    [{ propertyType: "" }, /property type/i],
    [{ askingPrice: null }, /asking price/i],
    [{ rehabLevel: null }, /rehab/i],
    [{ market: "", city: "" }, /market|city/i],
    [{ strategies: [] }, /exit strategy/i],
  ] as Array<[Partial<DealRecord>, RegExp]>) {
    const result = qualifyDeal(
      completeDeal(overrides),
      configuredBuyBox(),
      evaluationDate,
      completeContext(),
    );
    const demand = result.components.find(({ key }) => key === "buyerDemand");

    assert.equal(demand?.assessment, "Unassessed");
    assert.equal(demand?.score, null);
    assert.match(demand?.missingInformation.join(" ") ?? "", gap);
  }
});

test("incomplete verified buyer criteria stay Unassessed instead of becoming no-demand zero", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      buyers: [verifiedBuyer({
        states: [],
        propertyTypes: [],
        minPrice: null,
        maxPrice: null,
        rehabTolerance: [],
      })],
    }),
  );
  const demand = result.components.find(({ key }) => key === "buyerDemand");

  assert.equal(demand?.assessment, "Unassessed");
  assert.equal(demand?.score, null);
  assert.match(demand?.missingInformation.join(" ") ?? "", /buyer geography/i);
  assert.match(demand?.missingInformation.join(" ") ?? "", /buyer property type/i);
  assert.match(demand?.missingInformation.join(" ") ?? "", /buyer price/i);
  assert.match(demand?.missingInformation.join(" ") ?? "", /buyer rehab/i);
});

test("one incomplete verified buyer keeps demand Unassessed even beside a complete mismatch", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      buyers: [
        verifiedBuyer({
          id: "complete-mismatch",
          propertyTypes: ["Duplexes"],
        }),
        verifiedBuyer({
          id: "incomplete-candidate",
          propertyTypes: [],
        }),
      ],
    }),
  );
  const demand = result.components.find(({ key }) => key === "buyerDemand");

  assert.equal(demand?.assessment, "Unassessed");
  assert.equal(demand?.score, null);
  assert.match(demand?.missingInformation.join(" ") ?? "", /buyer property type/i);
});

test("supported exit strategy participates in exact buyer matching", () => {
  const result = qualifyDeal(
    completeDeal({ strategies: ["Double closing"] }),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  const demand = result.components.find(({ key }) => key === "buyerDemand");

  assert.equal(demand?.assessment, "Assessed");
  assert.equal(demand?.score, 0);
  assert.match(demand?.negativeReasons.join(" ") ?? "", /no verified buyer/i);
});

test("buyer-demand explanations retain supported match facts, POF, economics, and unsupported gaps", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  const demand = result.components.find(({ key }) => key === "buyerDemand");

  assert.equal(demand?.assessment, "Assessed");
  assert.match(demand?.inputFacts.join(" "), /single-family homes/i);
  assert.match(demand?.inputFacts.join(" "), /300000/);
  assert.match(demand?.inputFacts.join(" "), /Moderate/);
  assert.match(demand?.inputFacts.join(" "), /Assignment/);
  assert.match(demand?.inputFacts.join(" "), /POF.*Verified/i);
  assert.match(demand?.inputFacts.join(" "), /2026-12-31/);
  assert.match(demand?.inputFacts.join(" "), /buyer profit.*40000/i);
  assert.match(demand?.inputFacts.join(" "), /assignment spread.*30000/i);
  assert.match(
    demand?.unsupportedInformation.join(" ") ?? "",
    /profit preference|yield|closing speed|performance|responsiveness/i,
  );
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

test("seller fit cannot be assessed from an unexplained numeric score", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      sellerProvidedFit: {
        voluntarilyProvided: true,
        score: 80,
        verifiedAt: "2026-07-25T00:00:00.000Z",
        source: "Seller intake",
        positiveReasons: [],
        negativeReasons: [],
      },
    }),
  );
  const seller = result.components.find(
    ({ key }) => key === "sellerProvidedFit",
  );

  assert.equal(seller?.assessment, "Unassessed");
  assert.equal(seller?.score, null);
  assert.match(seller?.missingInformation.join(" ") ?? "", /reason/i);
});

test("assessed seller fit preserves its source, date, score, and exact reasons", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  const seller = result.components.find(
    ({ key }) => key === "sellerProvidedFit",
  );

  assert.equal(seller?.assessment, "Assessed");
  assert.match(seller?.inputFacts.join(" "), /Seller intake/);
  assert.match(seller?.inputFacts.join(" "), /2026-07-25/);
  assert.match(seller?.inputFacts.join(" "), /80/);
  assert.deepEqual(seller?.positiveReasons, [
    "Seller supplied timing and property-condition facts.",
  ]);
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
  const quality = result.components.find(({ key }) => key === "dataQuality");
  assert.equal(quality?.assessment, "Unassessed");
  assert.equal(quality?.score, null);
  assert.equal(quality?.calculatedSubtotal, 45);
  assert.match(quality?.explanation ?? "", /45\/100/);
});

test("data quality cannot borrow completeness from an older assertion", () => {
  const result = qualifyDeal(
    completeDeal({
      sourceAssertions: [
        assertion({
          id: "older-complete",
          lastVerifiedAt: "2026-07-20T00:00:00.000Z",
        }),
        assertion({
          id: "newer-incomplete",
          sourceRecordId: "",
          lastVerifiedAt: "2026-07-25T00:00:00.000Z",
        }),
      ],
    }),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  const quality = result.components.find(({ key }) => key === "dataQuality");

  assert.equal(quality?.assessment, "Unassessed");
  assert.equal(quality?.score, null);
  assert.match(quality?.missingInformation.join(" ") ?? "", /source record id/i);
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
  assert.equal(result.compliance.state, "Outreach blocked");
  assert.equal(result.compliance.outreach.status, "Outreach blocked");
  assert.equal(result.compliance.marketing.status, "Marketing blocked");
});

test("owner contact opt-out and identity-dispute status block qualification without relying on structured holds", () => {
  for (const ownerContactStatus of [
    "Owner opted out",
    "Owner opt-out",
    "OptOut",
    "Do not contact",
    "Identity disputed",
    "Identity-dispute",
  ]) {
    const result = qualifyDeal(
      completeDeal({ ownerContactStatus, researchRestrictions: [] }),
      configuredBuyBox(),
      evaluationDate,
      completeContext(),
    );
    assert.equal(result.status, "Disqualified", ownerContactStatus);
    assert.equal(
      result.compliance.state,
      /identity/i.test(ownerContactStatus) ? "Legal hold" : "Do not contact",
    );
    assert.equal(
      result.compliance.outreach.status,
      /identity/i.test(ownerContactStatus) ? "Legal hold" : "Do not contact",
    );
    assert.match(result.disqualifiers.join(" "), /contact|identity/i);
  }
});

test("DNC and identity holds block outreach while otherwise every production action retains approval gates", () => {
  const blocked = qualifyDeal(
    completeDeal({ restriction: "Do not contact" }),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  assert.equal(blocked.compliance.state, "Do not contact");
  assert.equal(blocked.compliance.outreach.status, "Do not contact");
  assert.equal(blocked.compliance.outreach.eligible, false);
  assert.match(blocked.recommendedAction, /do not contact/i);

  const review = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );
  assert.deepEqual(review.compliance, {
    state: "Clear for manual review",
    outreach: {
      status: "Outreach review required",
      eligible: false,
      reason: "First homeowner contact requires recorded human approval.",
    },
    offer: {
      status: "Clear for manual review",
      eligible: false,
      reason: "Offers and LOIs require recorded human approval.",
    },
    contract: {
      status: "Clear for manual review",
      eligible: false,
      reason: "Contracts and amendments require recorded human approval.",
    },
    marketing: {
      status: "Clear for manual review",
      eligible: false,
      reason: "Public marketing requires recorded human approval.",
    },
    funds: {
      status: "Clear for manual review",
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

test("complete evidence still requires explicit ownership verification research", () => {
  const result = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  );

  assert.deepEqual(
    result.researchTasks.map(({ priority, category }) => [
      priority,
      category,
    ]),
    [[2, "Ownership verification"]],
  );
  assert.match(result.recommendedAction, /verify ownership/i);
  assert.notEqual(result.researchPriority.label, "Deferred");
  assert.ok(result.researchPriority.score > 0);
});

test("fully assessed disqualification emits only evidence-backed remediation tasks", () => {
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
  assert.equal(result.score, 93);
  assert.equal(result.scoreLabel, "Qualification score");
  assert.deepEqual(
    result.researchTasks.map(({ priority, category }) => [
      priority,
      category,
    ]),
    [
      [2, "Ownership verification"],
      [4, "Underwriting impact"],
    ],
  );
  assert.doesNotMatch(
    result.researchTasks.map(({ reason }) => reason).join(" "),
    /missing qualification facts/i,
  );
});

test("research priority is separate, disclosed, and uses the exact label bands", () => {
  assert.deepEqual(
    [0, 24, 25, 49, 50, 74, 75, 89, 90, 100].map(labelResearchPriority),
    [
      "Deferred",
      "Deferred",
      "Low",
      "Low",
      "Medium",
      "Medium",
      "High",
      "High",
      "Critical",
      "Critical",
    ],
  );

  const critical = qualifyDeal(
    completeDeal({ restriction: "Identity disputed" }),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  ).researchPriority;
  assert.equal(critical.label, "Critical");
  assert.ok(critical.score >= 90 && critical.score <= 100);
  assert.match(critical.explanation, /not predicted transaction value/i);
  assert.ok(
    Object.values(critical.factors).some(
      ({ source }) => source === "Conservative task default",
    ),
  );

  const staleOwnership = qualifyDeal(
    completeDeal({ restriction: "Ownership stale" }),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  ).researchPriority;
  assert.equal(staleOwnership.label, "Critical");
  assert.ok(staleOwnership.score >= 90 && staleOwnership.score <= 100);

  const high = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext({
      marketability: {
        comparableConfidence: 90,
        verifiedAt: "2026-01-01T00:00:00.000Z",
        source: "Stale comparable set",
      },
    }),
  ).researchPriority;
  assert.equal(high.label, "High");
  assert.ok(high.score >= 75 && high.score <= 89);

  const ownershipResearch = qualifyDeal(
    completeDeal(),
    configuredBuyBox(),
    evaluationDate,
    completeContext(),
  ).researchPriority;
  assert.equal(ownershipResearch.label, "Low");
  assert.ok(
    ownershipResearch.score >= 25 && ownershipResearch.score <= 49,
  );
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
    ranked.map(({
      dealId,
      queue,
      rank,
      researchPriority,
      researchPriorityLabel,
      researchTaskOrder,
    }) => ({
      dealId,
      queue,
      rank,
      researchPriority,
      researchPriorityLabel,
      researchTaskOrder,
    })),
    [
      {
        dealId: "legal-risk",
        queue: "Disqualified",
        rank: null,
        researchPriority: 95,
        researchPriorityLabel: "Critical",
        researchTaskOrder: 1,
      },
      {
        dealId: "score-a",
        queue: "Scored",
        rank: 1,
        researchPriority: 41,
        researchPriorityLabel: "Low",
        researchTaskOrder: 2,
      },
      {
        dealId: "score-b",
        queue: "Scored",
        rank: 2,
        researchPriority: 41,
        researchPriorityLabel: "Low",
        researchTaskOrder: 2,
      },
    ],
  );
});
