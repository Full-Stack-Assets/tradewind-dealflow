import type {
  BuyBoxConfig,
  BuyerRecord,
  DataConfidence,
  DealRecord,
  RehabLevel,
  ResearchRestriction,
  SourceAssertion,
  StateCode,
} from "./types.ts";

const DAY_MILLISECONDS = 86_400_000;
const STATES: StateCode[] = ["MA", "RI"];
const REHAB_LEVELS: RehabLevel[] = ["Light", "Moderate", "Heavy"];
const CONFIDENCE_LEVELS: DataConfidence[] = ["Low", "Medium", "High"];
const COMPONENT_KEYS = [
  "propertyFit",
  "financialFeasibility",
  "marketability",
  "buyerDemand",
  "dataQuality",
  "sellerProvidedFit",
] as const;
const COMPONENT_LABELS: Record<QualificationComponentKey, string> = {
  propertyFit: "Property fit",
  financialFeasibility: "Financial feasibility",
  marketability: "Marketability",
  buyerDemand: "Verified buyer demand",
  dataQuality: "Data quality",
  sellerProvidedFit: "Seller-provided fit",
};
const DEFAULT_MA_MARKETS = [
  "Bristol County",
];
const DEFAULT_RI_MARKETS = [
  "Providence County",
];
const DEFAULT_PROPERTY_TYPES = [
  "Single-family homes",
  "Duplexes",
  "Triplexes",
  "Four-unit residential",
];

export type QualificationStatus =
  | "Unconfigured"
  | "Disqualified"
  | "Needs data"
  | "Scored";
export type QualificationComponentKey = (typeof COMPONENT_KEYS)[number];
export type ComponentAssessment = "Assessed" | "Unassessed";
export type SubfactorAssessment = "Supported" | "Missing" | "Unsupported";

export type QualificationSubfactor = {
  label: string;
  targetPoints: number;
  assessment: SubfactorAssessment;
  inputFacts: string[];
  pointsAwarded: number | null;
  explanation: string;
};

export type QualificationComponent = {
  key: QualificationComponentKey;
  label: string;
  assessment: ComponentAssessment;
  score: number | null;
  weight: number;
  included: boolean;
  inputFacts: string[];
  positiveReasons: string[];
  negativeReasons: string[];
  missingInformation: string[];
  unsupportedInformation: string[];
  calculatedSubtotal: number | null;
  subfactors: QualificationSubfactor[];
  explanation: string;
};

export type FinancialQualificationEvidence = {
  estimatedValue: number | null;
  acquisitionPrice: number | null;
  estimatedEquityPercent: number | null;
  assignmentSpread: number | null;
  buyerProfit: number | null;
  wholesaleGrossMarginPercent: number | null;
  source: string;
  verifiedAt: string;
  confidence: DataConfidence;
};

type FinancialNumericEvidenceKey =
  | "estimatedValue"
  | "acquisitionPrice"
  | "estimatedEquityPercent"
  | "assignmentSpread"
  | "buyerProfit"
  | "wholesaleGrossMarginPercent";

export type MarketabilityEvidence = {
  comparableConfidence: number;
  verifiedAt: string;
  source: string;
};

export type SellerProvidedFitEvidence = {
  voluntarilyProvided: boolean;
  score: number;
  verifiedAt: string;
  source: string;
  positiveReasons: string[];
  negativeReasons: string[];
};

export type QualificationContext = {
  financial?: FinancialQualificationEvidence;
  marketability?: MarketabilityEvidence;
  buyers?: BuyerRecord[];
  sellerProvidedFit?: SellerProvidedFitEvidence;
};

export type ComplianceState =
  | "Clear for research"
  | "Clear for manual review"
  | "Outreach review required"
  | "Outreach blocked"
  | "Offer blocked"
  | "Marketing blocked"
  | "Transaction specialist review"
  | "Do not contact"
  | "Legal hold";

export type ComplianceActionGate = {
  status: ComplianceState;
  eligible: false;
  reason: string;
};

export type QualificationCompliance = {
  state: ComplianceState;
  outreach: ComplianceActionGate;
  offer: ComplianceActionGate;
  contract: ComplianceActionGate;
  marketing: ComplianceActionGate;
  funds: ComplianceActionGate;
};

export type DataFreshness = {
  status: "Fresh" | "Stale" | "Future" | "Missing";
  lastVerifiedAt: string | null;
  ageDays: number | null;
};

export type ResearchTaskCategory =
  | "Legal/identity risk"
  | "Ownership verification"
  | "Data-quality impact"
  | "Underwriting impact"
  | "Buyer-match impact"
  | "Time sensitivity"
  | "Opportunity score"
  | "Estimated transaction potential";

export type ResearchTask = {
  priority: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  category: ResearchTaskCategory;
  taskType: string;
  reason: string;
};

export type ResearchPriorityLabel =
  | "Critical"
  | "High"
  | "Medium"
  | "Low"
  | "Deferred";

export type ResearchPriorityFactor = {
  value: number;
  source: "Evidence" | "Conservative task default";
  explanation: string;
};

export type ResearchPriority = {
  score: number;
  label: ResearchPriorityLabel;
  factors: {
    opportunityPotential: ResearchPriorityFactor;
    informationImpact: ResearchPriorityFactor;
    timeSensitivity: ResearchPriorityFactor;
    confidenceGap: ResearchPriorityFactor;
  };
  explanation: string;
};

export type QualificationResult = {
  dealId: string;
  buyBoxVersion: number;
  evaluatedAt: string;
  status: QualificationStatus;
  score: number | null;
  scoreLabel:
    | "Qualification score"
    | "Preliminary score"
    | "Score unavailable";
  scoreExplanation: string;
  components: QualificationComponent[];
  reasons: string[];
  positiveReasons: string[];
  negativeReasons: string[];
  missingInformation: string[];
  unsupportedInformation: string[];
  dataFreshness: DataFreshness;
  sourceConfidence: DataConfidence | null;
  restrictions: ResearchRestriction[];
  disqualifiers: string[];
  sellerFit: "Unassessed" | "Assessed";
  recommendedAction: string;
  compliance: QualificationCompliance;
  researchTasks: ResearchTask[];
  researchPriority: ResearchPriority;
};

export type BuyBoxValidationResult =
  | { ok: true; value: BuyBoxConfig }
  | { ok: false; errors: string[] };

export type RankedResearchItem = {
  dealId: string;
  queue: QualificationStatus;
  rank: number | null;
  score: number | null;
  dataQualityScore: number | null;
  updatedAt: string;
  researchPriority: number;
  researchPriorityLabel: ResearchPriorityLabel;
  researchTaskOrder: ResearchTask["priority"] | null;
  recommendedAction: string;
  qualification: QualificationResult;
};

type NormalizedBuyBoxFields = Omit<
  BuyBoxConfig,
  "configured" | "version" | "updatedAt"
>;

type ComponentEvaluation = {
  component: QualificationComponent;
  disqualifiers: string[];
};

type DataQualityEvaluation = ComponentEvaluation & {
  selectedAssertion: SourceAssertion | null;
  freshness: DataFreshness;
  confidence: DataConfidence | null;
  unresolvedConflicts: number;
  missingProvenance: boolean;
};

export function createDefaultBuyBox(updatedAt: string): BuyBoxConfig {
  return {
    configured: true,
    version: 1,
    updatedAt,
    states: ["MA", "RI"],
    marketsByState: {
      MA: normalizeTextArray(DEFAULT_MA_MARKETS),
      RI: normalizeTextArray(DEFAULT_RI_MARKETS),
    },
    propertyTypes: normalizeTextArray(DEFAULT_PROPERTY_TYPES),
    minPrice: 75_000,
    maxPrice: 500_000,
    rehabLevels: ["Light", "Moderate"],
    minimumConfidence: "Medium",
    maxVerificationAgeDays: 90,
    financialThresholds: {
      maximumEstimatedValue: 750_000,
      minimumEquityPercent: 30,
      preferredEquityPercent: 40,
      minimumAssignmentSpread: 15_000,
      preferredAssignmentSpread: 25_000,
      minimumBuyerProfit: 25_000,
      preferredBuyerProfit: 35_000,
      minimumWholesaleGrossMarginPercent: 8,
    },
    weights: {
      propertyFit: 25,
      financialFeasibility: 25,
      marketability: 15,
      buyerDemand: 15,
      dataQuality: 10,
      sellerProvidedFit: 10,
    },
  };
}

export function normalizeBuyBox(
  input: BuyBoxConfig,
  previous: BuyBoxConfig | null,
  now: Date,
): BuyBoxValidationResult {
  const validated = validateBuyBoxFields(input);
  if (!validated.ok) return validated;
  const previousFields =
    previous === null ? null : validateBuyBoxFields(previous);
  const equivalent =
    previous !== null
    && previous.configured
    && previousFields?.ok === true
    && semanticJson(previousFields.value) === semanticJson(validated.value);

  return {
    ok: true,
    value: {
      configured: true,
      version: equivalent ? previous.version : (previous?.version ?? 0) + 1,
      updatedAt: equivalent ? previous.updatedAt : now.toISOString(),
      ...validated.value,
    },
  };
}

export function qualifyDeal(
  deal: DealRecord,
  buyBox: BuyBoxConfig,
  evaluationDate: Date,
  context: QualificationContext = {},
): QualificationResult {
  const activeRestrictions = deal.researchRestrictions.filter(
    ({ resolvedAt }) => resolvedAt === null,
  );
  const restrictedSourceRights = deal.sourceAssertions.some(
    ({ usageClassification }) =>
      usageClassification === "Restricted — research only",
  );
  const ownerStatusRestriction = restrictionCodeForOwnerStatus(
    deal.ownerContactStatus,
  );

  if (!buyBox.configured) {
    return finalizeResult({
      deal,
      buyBox,
      evaluationDate,
      status: "Unconfigured",
      components: emptyComponents(buyBox),
      disqualifiers: [],
      activeRestrictions,
      freshness: missingFreshness(),
      confidence: null,
      recommendedAction:
        "Configure and save the editable operating buy box before qualification.",
      compliance: evaluateCompliance(
        activeRestrictions,
        restrictedSourceRights,
        [],
        ownerStatusRestriction,
        "Unconfigured",
      ),
      researchTasks: [],
    });
  }

  const validated = validateBuyBoxFields(buyBox);
  if (!validated.ok) {
    return finalizeResult({
      deal,
      buyBox,
      evaluationDate,
      status: "Disqualified",
      components: emptyComponents(buyBox),
      disqualifiers: [
        "The saved buy-box configuration is malformed or contradictory.",
      ],
      activeRestrictions,
      freshness: missingFreshness(),
      confidence: null,
      recommendedAction:
        "Configure and save a valid buy box before reviewing this record.",
      compliance: evaluateCompliance(
        activeRestrictions,
        restrictedSourceRights,
        ["The saved buy-box configuration is malformed or contradictory."],
        ownerStatusRestriction,
        "Disqualified",
      ),
      researchTasks: [],
    });
  }

  const config = validated.value;
  const propertyFit = evaluatePropertyFit(deal, config);
  const financial = evaluateFinancial(
    context.financial,
    config,
    evaluationDate,
  );
  const marketability = evaluateMarketability(
    context.marketability,
    config,
    evaluationDate,
  );
  const buyerDemand = evaluateBuyerDemand(
    deal,
    context.buyers,
    context.financial,
    financial,
    config,
    evaluationDate,
  );
  const dataQuality = evaluateDataQuality(
    deal,
    config,
    evaluationDate,
    financial,
    marketability,
  );
  const sellerProvidedFit = evaluateSellerProvidedFit(
    context.sellerProvidedFit,
    config,
    evaluationDate,
  );
  const evaluations = [
    propertyFit,
    financial,
    marketability,
    buyerDemand,
    dataQuality,
    sellerProvidedFit,
  ];
  const components = evaluations.map(({ component }) => component);
  const restrictionDisqualifiers = activeRestrictions.map(
    ({ code }) => `Active ${code} restriction.`,
  );
  const unapprovedSpecialistStrategies = deal.strategies.filter(
    (strategy) =>
      ["Novation", "Seller financing", "Subject-to"].includes(strategy)
      && !deal.attorneyReviewComplete,
  );
  const disqualifiers = [
    ...restrictionDisqualifiers,
    ...(ownerStatusRestriction === "Do not contact"
      ? ["Owner contact status requires do not contact."]
      : ownerStatusRestriction === "Identity disputed"
        ? ["Owner contact status records an identity dispute."]
        : []),
    ...(restrictedSourceRights
      ? [
          "Source rights restrict this record to authorized research only.",
        ]
      : []),
    ...unapprovedSpecialistStrategies.map(
      (strategy) =>
        `${strategy} requires specialist legal review before progression.`,
    ),
    ...evaluations.flatMap(({ disqualifiers: items }) => items),
  ];
  const hasUnassessed = components.some(
    ({ assessment, weight }) => assessment === "Unassessed" && weight > 0,
  );
  const hasTrustGap =
    dataQuality.component.missingInformation.length > 0;
  const status: QualificationStatus =
    disqualifiers.length > 0
      ? "Disqualified"
      : hasUnassessed || hasTrustGap
        ? "Needs data"
        : "Scored";
  const recommendedAction = deriveRecommendedAction({
    activeRestrictions,
    dataQuality,
    financial,
    marketability,
    buyerDemand,
    sellerProvidedFit,
    propertyFit,
    restrictedSourceRights,
    unapprovedSpecialistStrategies,
    ownerStatusRestriction,
  });
  const compliance = evaluateCompliance(
    activeRestrictions,
    restrictedSourceRights,
    disqualifiers,
    ownerStatusRestriction,
    status,
  );
  const preliminary = finalizeResult({
    deal,
    buyBox,
    evaluationDate,
    status,
    components,
    disqualifiers,
    activeRestrictions,
    freshness: dataQuality.freshness,
    confidence: dataQuality.confidence,
    recommendedAction,
    compliance,
    researchTasks: [],
  });
  const scorePresentation = deriveScorePresentation(components);
  const withScore = { ...preliminary, ...scorePresentation };
  const withTasks = {
    ...withScore,
    researchTasks: deriveResearchTasks(
      withScore,
      propertyFit,
      dataQuality,
      financial,
      marketability,
      buyerDemand,
      sellerProvidedFit,
    ),
  };
  return {
    ...withTasks,
    researchPriority: deriveResearchPriority(withTasks, dataQuality),
  };
}

export function rankResearchQueue(
  deals: DealRecord[],
  buyBox: BuyBoxConfig,
  evaluationDate: Date,
  contextForDeal: (
    deal: DealRecord,
  ) => QualificationContext | undefined = () => undefined,
): RankedResearchItem[] {
  const base = deals.map((deal) => {
    const qualification = qualifyDeal(
      deal,
      buyBox,
      evaluationDate,
      contextForDeal(deal),
    );
    return {
      dealId: deal.id,
      queue: qualification.status,
      rank: null,
      score: qualification.score,
      dataQualityScore:
        qualification.components.find(({ key }) => key === "dataQuality")
          ?.score ?? null,
      updatedAt: deal.updatedAt,
      researchPriority: qualification.researchPriority.score,
      researchPriorityLabel: qualification.researchPriority.label,
      researchTaskOrder: qualification.researchTasks[0]?.priority ?? null,
      recommendedAction: qualification.recommendedAction,
      qualification,
    } satisfies RankedResearchItem;
  });
  const scoredOrder = base
    .filter(({ queue }) => queue === "Scored")
    .sort(compareOpportunity);
  const ranks = new Map(
    scoredOrder.map(({ dealId }, index) => [dealId, index + 1]),
  );

  return base
    .map((item) => ({ ...item, rank: ranks.get(item.dealId) ?? null }))
    .sort(compareResearchItems);
}

function validateBuyBoxFields(
  input: BuyBoxConfig,
): 
  | { ok: true; value: NormalizedBuyBoxFields }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const rawStates = Array.isArray(input.states) ? input.states : [];
  const rawMarketsByState = input.marketsByState as
    | Partial<Record<StateCode, unknown>>
    | undefined;
  const rawMaMarkets = Array.isArray(rawMarketsByState?.MA)
    ? rawMarketsByState.MA as string[]
    : [];
  const rawRiMarkets = Array.isArray(rawMarketsByState?.RI)
    ? rawMarketsByState.RI as string[]
    : [];
  const rawPropertyTypes = Array.isArray(input.propertyTypes)
    ? input.propertyTypes
    : [];
  const rawRehabLevels = Array.isArray(input.rehabLevels)
    ? input.rehabLevels
    : [];
  const states = normalizeStates(rawStates);
  const marketsByState = {
    MA: normalizeTextArray(rawMaMarkets),
    RI: normalizeTextArray(rawRiMarkets),
  };
  const propertyTypes = normalizeTextArray(rawPropertyTypes);
  const rehabLevels = normalizeRehabLevels(rawRehabLevels);
  if (
    states.length === 0
    || rawStates.some(
      (state) => !isStateCode(normalizeText(String(state)).toUpperCase()),
    )
  ) {
    errors.push("At least one valid state (MA or RI) is required.");
  }
  if (
    rawMarketsByState === undefined
    || !Array.isArray(rawMarketsByState.MA)
    || !Array.isArray(rawMarketsByState.RI)
  ) {
    errors.push("State-specific market configuration is required.");
  } else if (
    [...rawMaMarkets, ...rawRiMarkets].some(
      (market) => normalizeText(String(market)) === "",
    )
  ) {
    errors.push("State-specific market labels cannot be blank.");
  }
  if (
    propertyTypes.length === 0
    || rawPropertyTypes.some((value) => normalizeText(value) === "")
  ) {
    errors.push("At least one nonblank property type is required.");
  }
  validateOptionalMoney(input.minPrice, "Minimum price", errors);
  validateOptionalMoney(input.maxPrice, "Maximum price", errors);
  if (
    validOptionalMoney(input.minPrice)
    && validOptionalMoney(input.maxPrice)
    && input.minPrice !== null
    && input.maxPrice !== null
    && input.minPrice > input.maxPrice
  ) {
    errors.push("Minimum price cannot exceed maximum price.");
  }
  if (
    rehabLevels.length === 0
    || rawRehabLevels.some(
      (level) => normalizeRehabLevel(String(level)) === null,
    )
  ) {
    errors.push("At least one valid rehab level is required.");
  }
  if (!CONFIDENCE_LEVELS.includes(input.minimumConfidence)) {
    errors.push("Minimum confidence must be Low, Medium, or High.");
  }
  if (
    !Number.isInteger(input.maxVerificationAgeDays)
    || input.maxVerificationAgeDays < 1
    || input.maxVerificationAgeDays > 365
  ) {
    errors.push(
      "Verification freshness must be an integer from 1 through 365 days.",
    );
  }
  const thresholds = input.financialThresholds as
    | BuyBoxConfig["financialThresholds"]
    | undefined;
  if (thresholds === undefined || typeof thresholds !== "object") {
    errors.push("Financial thresholds are required.");
  } else {
    validateThresholds(thresholds, errors);
  }
  const weights = input.weights as BuyBoxConfig["weights"] | undefined;
  if (weights === undefined || typeof weights !== "object") {
    errors.push("Six qualification weights are required.");
  } else {
    for (const key of COMPONENT_KEYS) {
      const weight = weights[key];
      if (!Number.isFinite(weight) || weight < 0) {
        errors.push(
          `${COMPONENT_LABELS[key]} weight must be a finite nonnegative number.`,
        );
      }
    }
    if (
      COMPONENT_KEYS.every(
        (key) => Number.isFinite(weights[key]) && weights[key] === 0,
      )
    ) {
      errors.push("At least one qualification weight must be positive.");
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  if (thresholds === undefined || weights === undefined) {
    return { ok: false, errors: ["Complete qualification configuration is required."] };
  }
  return {
    ok: true,
    value: {
      states,
      marketsByState,
      propertyTypes,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      rehabLevels,
      minimumConfidence: input.minimumConfidence,
      maxVerificationAgeDays: input.maxVerificationAgeDays,
      financialThresholds: { ...thresholds },
      weights: { ...weights },
    },
  };
}

function validateThresholds(
  thresholds: BuyBoxConfig["financialThresholds"],
  errors: string[],
): void {
  const checks: Array<[keyof typeof thresholds, string]> = [
    ["maximumEstimatedValue", "Maximum estimated value"],
    ["minimumEquityPercent", "Minimum equity percent"],
    ["preferredEquityPercent", "Preferred equity percent"],
    ["minimumAssignmentSpread", "Minimum assignment spread"],
    ["preferredAssignmentSpread", "Preferred assignment spread"],
    ["minimumBuyerProfit", "Minimum buyer profit"],
    ["preferredBuyerProfit", "Preferred buyer profit"],
    [
      "minimumWholesaleGrossMarginPercent",
      "Minimum wholesale gross margin percent",
    ],
  ];
  for (const [key, label] of checks) {
    const value = thresholds[key];
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${label} must be a finite nonnegative number.`);
    }
  }
  if (thresholds.maximumEstimatedValue === 0) {
    errors.push("Maximum estimated value must be greater than zero.");
  }
  if (
    Number.isFinite(thresholds.preferredEquityPercent)
    && Number.isFinite(thresholds.minimumEquityPercent)
    && thresholds.preferredEquityPercent < thresholds.minimumEquityPercent
  ) {
    errors.push("Preferred equity percent cannot be below minimum equity percent.");
  }
  if (
    Number.isFinite(thresholds.preferredAssignmentSpread)
    && Number.isFinite(thresholds.minimumAssignmentSpread)
    && thresholds.preferredAssignmentSpread
      < thresholds.minimumAssignmentSpread
  ) {
    errors.push(
      "Preferred assignment spread cannot be below minimum assignment spread.",
    );
  }
  if (
    Number.isFinite(thresholds.preferredBuyerProfit)
    && Number.isFinite(thresholds.minimumBuyerProfit)
    && thresholds.preferredBuyerProfit < thresholds.minimumBuyerProfit
  ) {
    errors.push("Preferred buyer profit cannot be below minimum buyer profit.");
  }
}

function evaluatePropertyFit(
  deal: DealRecord,
  buyBox: NormalizedBuyBoxFields,
): ComponentEvaluation {
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];
  const missingInformation: string[] = [];
  const disqualifiers: string[] = [];
  const market = normalizeMatchText(deal.market);
  const city = normalizeMatchText(deal.city);
  const stateMatches = buyBox.states.includes(deal.state);
  const configuredMarkets = buyBox.marketsByState[deal.state];
  const marketFactsMissing =
    configuredMarkets.length > 0 && market === "" && city === "";
  const geographyMatches =
    stateMatches
    && !marketFactsMissing
    && (
      configuredMarkets.length === 0
      || configuredMarkets.includes(market)
      || configuredMarkets.includes(city)
    );
  if (marketFactsMissing && stateMatches) {
    missingInformation.push("Market or city for configured geography");
  } else if (geographyMatches) {
    positiveReasons.push("State and configured market geography match exactly.");
  } else {
    negativeReasons.push("State or configured market is outside the buy box.");
    disqualifiers.push("Property geography is outside the configured market.");
  }
  const propertyType = normalizeMatchText(deal.propertyType);
  if (propertyType === "") {
    missingInformation.push("Property type");
  } else if (buyBox.propertyTypes.includes(propertyType)) {
    positiveReasons.push("Property type matches the configured target types.");
    if (propertyType.includes("manual review")) {
      negativeReasons.push(
        "The configured property type is explicitly marked for manual review.",
      );
      disqualifiers.push(
        "Configured property type requires manual review before progression.",
      );
    }
  } else {
    negativeReasons.push("Property type is outside the configured target types.");
    disqualifiers.push("Property type is outside the configured buy box.");
  }
  if (deal.rehabLevel === null) {
    missingInformation.push("Recorded repair or rehab level");
  } else if (buyBox.rehabLevels.includes(deal.rehabLevel)) {
    positiveReasons.push("Recorded rehab level is within the configured limit.");
  } else {
    negativeReasons.push("Recorded rehab level requires manual buy-box review.");
    disqualifiers.push("Recorded rehab level is outside the configured buy box.");
  }
  const assessed = missingInformation.length === 0;
  const score =
    assessed ? (disqualifiers.length === 0 ? 100 : 0) : null;
  return {
    component: buildComponent(
      "propertyFit",
      buyBox.weights.propertyFit,
      score,
      [deal.state, deal.market, deal.city, deal.propertyType, deal.rehabLevel ?? "Not recorded"],
      positiveReasons,
      negativeReasons,
      missingInformation,
      {
        subfactors: propertySubfactors(
          deal,
          geographyMatches,
          propertyType,
          buyBox,
        ),
      },
    ),
    disqualifiers,
  };
}

function evaluateFinancial(
  evidence: FinancialQualificationEvidence | undefined,
  buyBox: NormalizedBuyBoxFields,
  evaluationDate: Date,
): ComponentEvaluation {
  const fields: Array<[FinancialNumericEvidenceKey, string]> = [
    ["estimatedValue", "Estimated value"],
    ["acquisitionPrice", "Acquisition price"],
    ["estimatedEquityPercent", "Estimated equity percent"],
    ["assignmentSpread", "Assignment spread"],
    ["buyerProfit", "Buyer profit"],
    ["wholesaleGrossMarginPercent", "Wholesale gross margin percent"],
  ];
  const missingInformation = fields
    .filter(([key]) => !validFinancialEvidenceValue(key, evidence?.[key]))
    .map(([, label]) => `Financial feasibility evidence: ${label}`);
  const inputFacts = evidence === undefined
    ? []
    : [
        ...fields.map(([key, label]) => `${label}: ${String(evidence[key])}`),
        `Source: ${evidence.source || "Not recorded"}`,
        `Verified: ${evidence.verifiedAt || "Not recorded"}`,
        `Confidence: ${evidence.confidence}`,
      ];
  if (!nonblank(evidence?.source ?? "")) {
    missingInformation.push("Financial evidence source");
  }
  if (
    evidence === undefined
    || !validCurrentDate(
      evidence.verifiedAt,
      evaluationDate,
      buyBox.maxVerificationAgeDays,
      false,
    )
  ) {
    missingInformation.push("Fresh financial evidence verification");
  }
  if (
    evidence === undefined
    || !CONFIDENCE_LEVELS.includes(evidence.confidence)
    || confidenceRank(evidence.confidence)
      < confidenceRank(buyBox.minimumConfidence)
  ) {
    missingInformation.push(
      `Financial evidence confidence at or above ${buyBox.minimumConfidence}`,
    );
  }
  if (evidence === undefined || missingInformation.length > 0) {
    return {
      component: buildComponent(
        "financialFeasibility",
        buyBox.weights.financialFeasibility,
        null,
        inputFacts,
        [],
        [],
        missingInformation.length > 0
          ? missingInformation
          : fields.map(
              ([, label]) => `Financial feasibility evidence: ${label}`,
            ),
        { subfactors: financialSubfactors(evidence, false) },
      ),
      disqualifiers: [],
    };
  }
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];
  const disqualifiers: string[] = [];
  const thresholds = buyBox.financialThresholds;
  const criterionScores: number[] = [];
  criterion(
    evidence.estimatedValue! <= thresholds.maximumEstimatedValue,
    1,
    "Estimated value is within the configured maximum.",
    "Estimated value exceeds the configured maximum.",
    positiveReasons,
    negativeReasons,
    criterionScores,
  );
  criterion(
    withinOptionalBounds(
      evidence.acquisitionPrice!,
      buyBox.minPrice,
      buyBox.maxPrice,
    ),
    1,
    "Acquisition price is within the preferred range.",
    "Acquisition price is outside the preferred range.",
    positiveReasons,
    negativeReasons,
    criterionScores,
  );
  tieredCriterion(
    evidence.estimatedEquityPercent!,
    thresholds.minimumEquityPercent,
    thresholds.preferredEquityPercent,
    "Estimated equity",
    positiveReasons,
    negativeReasons,
    criterionScores,
  );
  tieredCriterion(
    evidence.assignmentSpread!,
    thresholds.minimumAssignmentSpread,
    thresholds.preferredAssignmentSpread,
    "Assignment spread",
    positiveReasons,
    negativeReasons,
    criterionScores,
  );
  tieredCriterion(
    evidence.buyerProfit!,
    thresholds.minimumBuyerProfit,
    thresholds.preferredBuyerProfit,
    "Buyer profit",
    positiveReasons,
    negativeReasons,
    criterionScores,
  );
  criterion(
    evidence.wholesaleGrossMarginPercent!
      >= thresholds.minimumWholesaleGrossMarginPercent,
    1,
    "Wholesale gross margin meets the configured minimum.",
    "Wholesale gross margin is below the configured minimum.",
    positiveReasons,
    negativeReasons,
    criterionScores,
  );
  if (evidence.assignmentSpread! < thresholds.minimumAssignmentSpread) {
    disqualifiers.push(
      `Assignment spread is below the $${formatInteger(
        thresholds.minimumAssignmentSpread,
      )} minimum.`,
    );
  }
  if (evidence.buyerProfit! < thresholds.minimumBuyerProfit) {
    disqualifiers.push(
      `Buyer profit is below the $${formatInteger(
        thresholds.minimumBuyerProfit,
      )} minimum.`,
    );
  }
  return {
    component: buildComponent(
      "financialFeasibility",
      buyBox.weights.financialFeasibility,
      Math.round(
        criterionScores.reduce((sum, value) => sum + value, 0)
          / criterionScores.length
          * 100,
      ),
      [
        ...inputFacts,
      ],
      positiveReasons,
      negativeReasons,
      [],
      { subfactors: financialSubfactors(evidence, true) },
    ),
    disqualifiers,
  };
}

function evaluateMarketability(
  evidence: MarketabilityEvidence | undefined,
  buyBox: NormalizedBuyBoxFields,
  evaluationDate: Date,
): ComponentEvaluation {
  const valid =
    evidence !== undefined
    && Number.isFinite(evidence.comparableConfidence)
    && evidence.comparableConfidence >= 0
    && evidence.comparableConfidence <= 100
    && nonblank(evidence.source)
    && validCurrentDate(
      evidence.verifiedAt,
      evaluationDate,
      buyBox.maxVerificationAgeDays,
      false,
    );
  if (!valid || evidence === undefined) {
    return {
      component: buildComponent(
        "marketability",
        buyBox.weights.marketability,
        null,
        [],
        [],
        [],
        ["Current verified comparable confidence and source"],
        { subfactors: marketabilitySubfactors(evidence, false) },
      ),
      disqualifiers: [],
    };
  }
  const sufficient = evidence.comparableConfidence >= 75;
  return {
    component: buildComponent(
      "marketability",
      buyBox.weights.marketability,
      evidence.comparableConfidence,
      [
        `Comparable confidence: ${evidence.comparableConfidence}`,
        `Source: ${evidence.source}`,
        `Verified: ${evidence.verifiedAt}`,
      ],
      sufficient
        ? ["Comparable confidence meets the 75% offer-preparation threshold."]
        : [],
      sufficient
        ? []
        : ["Comparable confidence is below the 75% preparation threshold."],
      [],
      { subfactors: marketabilitySubfactors(evidence, true) },
    ),
    disqualifiers: sufficient
      ? []
      : ["Insufficient comparable confidence requires review before an offer."],
  };
}

function evaluateBuyerDemand(
  deal: DealRecord,
  buyers: BuyerRecord[] | undefined,
  financialEvidence: FinancialQualificationEvidence | undefined,
  financial: ComponentEvaluation,
  buyBox: NormalizedBuyBoxFields,
  evaluationDate: Date,
): ComponentEvaluation {
  const unsupportedInformation = [
    "Buyer profit preference is unsupported in the current local record.",
    "Buyer yield preference is unsupported in the current local record.",
    "Buyer closing speed is unsupported in the current local record.",
    "Buyer occupancy, tenant, and unit preferences are unsupported in the current local record.",
    "Buyer purchase performance is unsupported in the current local record.",
    "Buyer activity and responsiveness are unsupported in the current local record.",
  ];
  const inputFacts = [
    `Deal state: ${deal.state}`,
    `Deal market: ${deal.market || "Not recorded"}`,
    `Deal city: ${deal.city || "Not recorded"}`,
    `Deal property type: ${deal.propertyType || "Not recorded"}`,
    `Deal asking price: ${deal.askingPrice ?? "Not recorded"}`,
    `Deal rehab: ${deal.rehabLevel ?? "Not recorded"}`,
    `Deal exit strategies: ${deal.strategies.join(", ") || "Not recorded"}`,
    `Acquisition economics: ${financialEvidence?.acquisitionPrice ?? "Not recorded"}`,
    `Assignment spread economics: ${financialEvidence?.assignmentSpread ?? "Not recorded"}`,
    `Buyer profit economics: ${financialEvidence?.buyerProfit ?? "Not recorded"}`,
    `Wholesale gross margin economics: ${
      financialEvidence?.wholesaleGrossMarginPercent ?? "Not recorded"
    }`,
  ];
  const dealGaps: string[] = [];
  if (normalizeMatchText(deal.propertyType) === "") {
    dealGaps.push("Deal property type for buyer matching");
  }
  if (deal.askingPrice === null) {
    dealGaps.push("Deal asking price for buyer matching");
  }
  if (deal.rehabLevel === null) {
    dealGaps.push("Deal rehab level for buyer matching");
  }
  if (
    normalizeMatchText(deal.market) === ""
    && normalizeMatchText(deal.city) === ""
  ) {
    dealGaps.push("Deal market or city for buyer matching");
  }
  if (deal.strategies.length === 0) {
    dealGaps.push("Deal exit strategy for buyer matching");
  }
  if (financial.component.assessment !== "Assessed") {
    dealGaps.push("Current verified buyer economics evidence");
  }
  const verified = (buyers ?? []).filter((buyer) =>
    buyer.proofOfFundsStatus === "Verified"
    && validCurrentDate(
      buyer.proofOfFundsExpiresAt,
      evaluationDate,
      Number.POSITIVE_INFINITY,
      true,
    )
    && validCurrentDate(
      buyer.lastVerifiedAt,
      evaluationDate,
      buyBox.maxVerificationAgeDays,
      false,
    )
  );
  for (const buyer of buyers ?? []) {
    inputFacts.push(
      `Buyer ${buyer.id} POF: ${buyer.proofOfFundsStatus}; expires: ${
        buyer.proofOfFundsExpiresAt || "Not recorded"
      }; verified: ${buyer.lastVerifiedAt || "Not recorded"}`,
    );
  }
  if (verified.length === 0) {
    return {
      component: buildComponent(
        "buyerDemand",
        buyBox.weights.buyerDemand,
        null,
        inputFacts,
        [],
        [],
        [...dealGaps, "Current verified buyer proof of funds and criteria"],
        {
          unsupportedInformation,
          subfactors: buyerSubfactors(false, buyers ?? []),
        },
      ),
      disqualifiers: [],
    };
  }
  const buyerGaps = uniqueStrings(
    verified.flatMap((buyer) => buyerCriteriaGaps(buyer)),
  );
  if (dealGaps.length > 0 || buyerGaps.length > 0) {
    return {
      component: buildComponent(
        "buyerDemand",
        buyBox.weights.buyerDemand,
        null,
        inputFacts,
        [],
        [],
        [...dealGaps, ...buyerGaps],
        {
          unsupportedInformation,
          subfactors: buyerSubfactors(false, verified),
        },
      ),
      disqualifiers: [],
    };
  }
  for (const buyer of verified) {
    inputFacts.push(
      `Buyer ${buyer.id} supported criteria: states ${buyer.states.join(
        ", ",
      )}; markets ${buyer.markets.join(", ") || "state-level"}; property types ${
        buyer.propertyTypes.join(", ")
      }; price ${buyer.minPrice ?? "no minimum"}–${
        buyer.maxPrice ?? "no maximum"
      }; rehab ${buyer.rehabTolerance.join(", ")}; exits ${
        buyer.strategies.join(", ")
      }.`,
    );
  }
  const matches = verified.filter((buyer) =>
    buyerMatchesDeal(buyer, deal)
  );
  return {
    component: buildComponent(
      "buyerDemand",
      buyBox.weights.buyerDemand,
      matches.length > 0 ? 100 : 0,
      inputFacts,
      matches.length > 0
        ? [`${matches.length} verified buyer criteria record(s) match exactly.`]
        : [],
      matches.length === 0
        ? ["No verified buyer criteria record matches the supported facts."]
        : [],
      [],
      {
        unsupportedInformation,
        subfactors: buyerSubfactors(true, verified),
      },
    ),
    disqualifiers: [],
  };
}

function evaluateDataQuality(
  deal: DealRecord,
  buyBox: NormalizedBuyBoxFields,
  evaluationDate: Date,
  financial: ComponentEvaluation,
  marketability: ComponentEvaluation,
): DataQualityEvaluation {
  const eligible = deal.sourceAssertions.filter(
    ({ usageClassification }) =>
      usageClassification !== "Restricted — research only",
  );
  const selected = eligible.slice().sort(compareAssertions)[0] ?? null;
  const provenanceMissing = provenanceGaps(selected);
  const complete = provenanceMissing.length === 0;
  const freshness = evaluateFreshness(selected?.lastVerifiedAt, evaluationDate, buyBox.maxVerificationAgeDays);
  const confidence = selected?.confidence ?? null;
  const confidenceMeets =
    confidence !== null
    && confidenceRank(confidence) >= confidenceRank(buyBox.minimumConfidence);
  const unresolved = deal.factConflicts.filter(
    ({ status }) => status === "Unresolved",
  ).length;
  const missingInformation: string[] = [];
  missingInformation.push(...provenanceMissing);
  if (!confidenceMeets) {
    missingInformation.push(`Confidence at or above ${buyBox.minimumConfidence}`);
  }
  if (freshness.status !== "Fresh") {
    missingInformation.push("Fresh source verification");
  }
  if (unresolved > 0) {
    missingInformation.push(
      `${unresolved} unresolved fact ${unresolved === 1 ? "conflict" : "conflicts"}`,
    );
  }
  const confidencePoints =
    confidence === null ? 0 : { High: 25, Medium: 15, Low: 5 }[confidence];
  const subtotal =
    (complete ? 40 : 0)
    + confidencePoints
    + (freshness.status === "Fresh" ? 25 : 0)
    + (unresolved === 0 ? 10 : 0);
  const trustworthy =
    complete
    && confidenceMeets
    && freshness.status === "Fresh"
    && unresolved === 0;
  const score = trustworthy ? subtotal : null;
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];
  if (complete) positiveReasons.push("An eligible source has complete required provenance.");
  else negativeReasons.push("Complete eligible provenance is missing.");
  if (confidenceMeets) positiveReasons.push(`Source confidence meets ${buyBox.minimumConfidence}.`);
  else negativeReasons.push(`Source confidence is below ${buyBox.minimumConfidence} or missing.`);
  if (freshness.status === "Fresh") positiveReasons.push("Source verification is fresh.");
  else negativeReasons.push(`Source verification is ${freshness.status.toLowerCase()}.`);
  if (unresolved === 0) positiveReasons.push("No unresolved fact conflicts are recorded.");
  else negativeReasons.push(`${unresolved} unresolved fact conflict(s) remain.`);
  return {
    component: buildComponent(
      "dataQuality",
      buyBox.weights.dataQuality,
      score,
      [
        selected?.source ?? "No eligible source",
        confidence ?? "No confidence",
        selected?.lastVerifiedAt ?? "No verification date",
      ],
      positiveReasons,
      negativeReasons,
      missingInformation,
      {
        calculatedSubtotal: subtotal,
        explanation: trustworthy
          ? `Data quality is ${subtotal}/100 from the recorded trustworthy inputs.`
          : `Data quality is Unassessed; the explanatory subtotal is ${subtotal}/100, but provenance, confidence, freshness, or conflict gates are unresolved.`,
        subfactors: dataQualitySubfactors(
          deal,
          selected,
          financial,
          marketability,
        ),
      },
    ),
    disqualifiers: [],
    selectedAssertion: selected,
    freshness,
    confidence,
    unresolvedConflicts: unresolved,
    missingProvenance: !complete || !confidenceMeets,
  };
}

function evaluateSellerProvidedFit(
  evidence: SellerProvidedFitEvidence | undefined,
  buyBox: NormalizedBuyBoxFields,
  evaluationDate: Date,
): ComponentEvaluation {
  const hasExactReason =
    evidence !== undefined
    && [...evidence.positiveReasons, ...evidence.negativeReasons].some(
      nonblank,
    );
  const valid =
    evidence !== undefined
    && evidence.voluntarilyProvided
    && Number.isFinite(evidence.score)
    && evidence.score >= 0
    && evidence.score <= 100
    && nonblank(evidence.source)
    && hasExactReason
    && validCurrentDate(
      evidence.verifiedAt,
      evaluationDate,
      buyBox.maxVerificationAgeDays,
      false,
    );
  if (!valid || evidence === undefined) {
    const missing = ["Current voluntarily supplied seller-provided fit information"];
    if (evidence !== undefined && !hasExactReason) {
      missing.push("At least one exact seller-provided fit reason");
    }
    return {
      component: buildComponent(
        "sellerProvidedFit",
        buyBox.weights.sellerProvidedFit,
        null,
        evidence === undefined
          ? []
          : [
              `Source: ${evidence.source || "Not recorded"}`,
              `Verified: ${evidence.verifiedAt || "Not recorded"}`,
              `Recorded score: ${evidence.score}`,
            ],
        [],
        [],
        missing,
        { subfactors: sellerSubfactors(evidence, false) },
      ),
      disqualifiers: [],
    };
  }
  return {
    component: buildComponent(
      "sellerProvidedFit",
      buyBox.weights.sellerProvidedFit,
      evidence.score,
      [
        `Source: ${evidence.source}`,
        `Verified: ${evidence.verifiedAt}`,
        `Recorded score: ${evidence.score}`,
      ],
      evidence.positiveReasons.slice(),
      evidence.negativeReasons.slice(),
      [],
      { subfactors: sellerSubfactors(evidence, true) },
    ),
    disqualifiers: [],
  };
}

function propertySubfactors(
  deal: DealRecord,
  geographyMatches: boolean,
  propertyType: string,
  buyBox: NormalizedBuyBoxFields,
): QualificationSubfactor[] {
  const configuredMarkets = buyBox.marketsByState[deal.state];
  const geographyRecorded =
    buyBox.states.includes(deal.state)
    && (
      configuredMarkets.length === 0
      || normalizeMatchText(deal.market) !== ""
      || normalizeMatchText(deal.city) !== ""
    );
  return [
    subfactor(
      "Geography",
      25,
      geographyRecorded ? "Supported" : "Missing",
      [deal.state, deal.market, deal.city].filter(nonblank),
      geographyRecorded
        ? geographyMatches
          ? "Recorded state and state-specific market facts match."
          : "Recorded geography is available and does not match."
        : "State-specific market or city evidence is missing.",
    ),
    subfactor(
      "Property type",
      25,
      propertyType === "" ? "Missing" : "Supported",
      propertyType === "" ? [] : [deal.propertyType],
      propertyType === ""
        ? "Property type is missing."
        : "Recorded property type is available for exact buy-box comparison.",
    ),
    subfactor(
      "Price",
      20,
      deal.askingPrice === null ? "Missing" : "Supported",
      deal.askingPrice === null ? [] : [`Asking price: ${deal.askingPrice}`],
      deal.askingPrice === null
        ? "Recorded asking price is missing."
        : "Recorded asking price is available; this target is disclosed separately from financial underwriting.",
    ),
    subfactor(
      "Repair",
      15,
      deal.rehabLevel === null ? "Missing" : "Supported",
      deal.rehabLevel === null ? [] : [`Rehab level: ${deal.rehabLevel}`],
      deal.rehabLevel === null
        ? "Repair or rehab evidence is missing."
        : "Recorded rehab level is available for buy-box comparison.",
    ),
    subfactor(
      "Ownership/property suitability",
      15,
      "Missing",
      [],
      "Verified ownership duration, title suitability, and broader property-suitability evidence are not present in the current local record.",
    ),
  ];
}

function financialSubfactors(
  evidence: FinancialQualificationEvidence | undefined,
  trustworthy: boolean,
): QualificationSubfactor[] {
  const supported = trustworthy ? "Supported" : "Missing";
  return [
    subfactor(
      "Equity",
      20,
      supported,
      evidence === undefined
        ? []
        : [`Estimated equity percent: ${evidence.estimatedEquityPercent}`],
      trustworthy
        ? "Current sourced equity evidence is available."
        : "Current sourced equity evidence is incomplete or untrusted.",
    ),
    subfactor(
      "Spread",
      25,
      supported,
      evidence === undefined
        ? []
        : [`Assignment spread: ${evidence.assignmentSpread}`],
      trustworthy
        ? "Current sourced assignment-spread evidence is available."
        : "Current sourced assignment-spread evidence is incomplete or untrusted.",
    ),
    subfactor(
      "Buyer profit",
      25,
      supported,
      evidence === undefined ? [] : [`Buyer profit: ${evidence.buyerProfit}`],
      trustworthy
        ? "Current sourced buyer-profit evidence is available."
        : "Current sourced buyer-profit evidence is incomplete or untrusted.",
    ),
    subfactor(
      "Costs",
      15,
      "Missing",
      [],
      "Itemized acquisition, financing, holding, closing, and selling costs are not supported by this qualification context.",
    ),
    subfactor(
      "Sensitivity",
      15,
      "Missing",
      [],
      "Evidence-backed value, repair, timing, and cost sensitivity ranges are not present.",
    ),
  ];
}

function marketabilitySubfactors(
  evidence: MarketabilityEvidence | undefined,
  trustworthy: boolean,
): QualificationSubfactor[] {
  return [
    subfactor(
      "Comparable evidence",
      25,
      trustworthy ? "Supported" : "Missing",
      evidence === undefined
        ? []
        : [
            `Comparable confidence: ${evidence.comparableConfidence}`,
            `Source: ${evidence.source}`,
            `Verified: ${evidence.verifiedAt}`,
          ],
      trustworthy
        ? "Current sourced comparable confidence is available."
        : "Current sourced comparable evidence is missing or stale.",
    ),
    subfactor("Market activity", 20, "Missing", [], "Verified market-activity evidence is not present."),
    subfactor("Days to commitment", 20, "Missing", [], "Verified days-to-commitment evidence is not present."),
    subfactor("Property-type demand", 20, "Missing", [], "Verified property-type demand evidence is not present."),
    subfactor("Exit diversity", 15, "Missing", [], "Verified exit-diversity evidence is not present."),
  ];
}

function buyerSubfactors(
  assessed: boolean,
  buyers: BuyerRecord[],
): QualificationSubfactor[] {
  const pofFacts = buyers.map(
    (buyer) =>
      `${buyer.id}: ${buyer.proofOfFundsStatus}; expires ${buyer.proofOfFundsExpiresAt || "not recorded"}`,
  );
  return [
    subfactor(
      "Exact matches",
      30,
      assessed ? "Supported" : "Missing",
      [],
      assessed
        ? "Exact supported buyer criteria were evaluated."
        : "Exact matching cannot be completed from current verified criteria.",
    ),
    subfactor(
      "Valid proof of funds",
      25,
      pofFacts.length > 0 ? "Supported" : "Missing",
      pofFacts,
      pofFacts.length > 0
        ? "Recorded proof-of-funds status and dates are disclosed; scoring still requires current verification."
        : "No proof-of-funds evidence is recorded.",
    ),
    subfactor(
      "Recent active buyer evidence",
      20,
      "Unsupported",
      [],
      "Recent buyer activity is unsupported in the current local record.",
    ),
    subfactor(
      "Closing performance",
      15,
      "Unsupported",
      [],
      "Buyer closing performance is unsupported in the current local record.",
    ),
    subfactor(
      "Price competition",
      10,
      "Unsupported",
      [],
      "Evidence of price competition among verified buyers is unsupported.",
    ),
  ];
}

function dataQualitySubfactors(
  deal: DealRecord,
  assertion: SourceAssertion | null,
  financial: ComponentEvaluation,
  marketability: ComponentEvaluation,
): QualificationSubfactor[] {
  const contactRecorded =
    nonblank(deal.ownerContactStatus)
    && !["not researched", "unknown"].includes(
      normalizeMatchText(deal.ownerContactStatus),
    );
  return [
    subfactor(
      "Property identity",
      20,
      assertion !== null
        && nonblank(assertion.sourceRecordId)
        && nonblank(assertion.facts.address)
        ? "Supported"
        : "Missing",
      assertion === null
        ? []
        : [assertion.sourceRecordId, assertion.facts.address].filter(nonblank),
      "Property identity support uses only recorded source identity and address facts.",
    ),
    subfactor("Ownership", 20, "Missing", [], "Verified current ownership evidence is not present."),
    subfactor(
      "Current value",
      15,
      financial.component.assessment === "Assessed" ? "Supported" : "Missing",
      financial.component.inputFacts.filter((fact) =>
        /estimated value|source|verified|confidence/i.test(fact)
      ),
      financial.component.assessment === "Assessed"
        ? "Current sourced value evidence is available in the qualification context."
        : "Current sourced value evidence is missing or untrusted.",
    ),
    subfactor(
      "Comparable evidence",
      15,
      marketability.component.assessment === "Assessed"
        ? "Supported"
        : "Missing",
      marketability.component.inputFacts,
      marketability.component.assessment === "Assessed"
        ? "Current sourced comparable confidence is available."
        : "Current sourced comparable evidence is missing or stale.",
    ),
    subfactor(
      "Repair evidence",
      15,
      deal.rehabLevel === null ? "Missing" : "Supported",
      deal.rehabLevel === null ? [] : [deal.rehabLevel],
      deal.rehabLevel === null
        ? "Repair evidence is missing."
        : "A canonical repair or rehab level is recorded.",
    ),
    subfactor(
      "Usage rights",
      10,
      assertion !== null
        && assertion.usageClassification !== "Restricted — research only"
        ? "Supported"
        : "Missing",
      assertion === null ? [] : [assertion.usageClassification],
      "Only explicit non-restricted usage rights support this target.",
    ),
    subfactor(
      "Contact evidence",
      5,
      contactRecorded ? "Supported" : "Missing",
      contactRecorded ? [deal.ownerContactStatus] : [],
      contactRecorded
        ? "A factual owner-contact status is recorded; it does not grant outreach permission."
        : "Reliable contact status is not recorded.",
    ),
  ];
}

function sellerSubfactors(
  evidence: SellerProvidedFitEvidence | undefined,
  assessed: boolean,
): QualificationSubfactor[] {
  return [
    subfactor(
      "Voluntary seller-provided facts",
      100,
      assessed ? "Supported" : "Missing",
      evidence === undefined
        ? []
        : [
            `Source: ${evidence.source || "Not recorded"}`,
            `Verified: ${evidence.verifiedAt || "Not recorded"}`,
            ...evidence.positiveReasons,
            ...evidence.negativeReasons,
          ].filter(nonblank),
      assessed
        ? "Current voluntary seller-provided facts and exact reasons support this component."
        : "Current voluntary seller-provided facts with exact reasons are missing.",
    ),
  ];
}

function subfactor(
  label: string,
  targetPoints: number,
  assessment: SubfactorAssessment,
  inputFacts: string[],
  explanation: string,
): QualificationSubfactor {
  return {
    label,
    targetPoints,
    assessment,
    inputFacts,
    pointsAwarded: null,
    explanation,
  };
}

function buildComponent(
  key: QualificationComponentKey,
  weight: number,
  score: number | null,
  inputFacts: string[],
  positiveReasons: string[],
  negativeReasons: string[],
  missingInformation: string[],
  options: {
    unsupportedInformation?: string[];
    calculatedSubtotal?: number | null;
    explanation?: string;
    subfactors?: QualificationSubfactor[];
  } = {},
): QualificationComponent {
  const assessment: ComponentAssessment =
    score === null ? "Unassessed" : "Assessed";
  const explanation = options.explanation ?? (
    assessment === "Unassessed"
      ? `${COMPONENT_LABELS[key]} is Unassessed because required real inputs are missing or not current.`
      : `${COMPONENT_LABELS[key]} is ${score}/100 from the recorded inputs.`
  );
  return {
    key,
    label: COMPONENT_LABELS[key],
    assessment,
    score,
    weight,
    included: assessment === "Assessed" && weight > 0,
    inputFacts,
    positiveReasons,
    negativeReasons,
    missingInformation,
    unsupportedInformation: options.unsupportedInformation ?? [],
    calculatedSubtotal: options.calculatedSubtotal ?? null,
    subfactors: options.subfactors ?? [],
    explanation,
  };
}

function emptyComponents(buyBox: BuyBoxConfig): QualificationComponent[] {
  return COMPONENT_KEYS.map((key) =>
    buildComponent(
      key,
      safeWeight(buyBox, key),
      null,
      [],
      [],
      [],
      ["Valid configured buy box"],
    )
  );
}

function calculateWeightedScore(
  components: QualificationComponent[],
): number | null {
  const included = components.filter(
    ({ included, score }) => included && score !== null,
  );
  const totalWeight = included.reduce((sum, { weight }) => sum + weight, 0);
  if (totalWeight === 0) return null;
  const weighted = included.reduce(
    (sum, { score, weight }) => sum + (score ?? 0) * weight,
    0,
  );
  return Math.round(weighted / totalWeight);
}

function deriveScorePresentation(
  components: QualificationComponent[],
): Pick<QualificationResult, "score" | "scoreLabel" | "scoreExplanation"> {
  const hasWeightedGap = components.some(
    ({ assessment, weight }) => assessment === "Unassessed" && weight > 0,
  );
  const score = calculateWeightedScore(components);
  if (hasWeightedGap) {
    return {
      score,
      scoreLabel: "Preliminary score",
      scoreExplanation: score === null
        ? "Preliminary score is unavailable because there is no assessed positive-weight component; missing evidence is never converted to zero."
        : "Preliminary score is normalized over assessed positive weights only; Unassessed components are excluded rather than treated as zero.",
    };
  }
  return {
    score,
    scoreLabel: score === null ? "Score unavailable" : "Qualification score",
    scoreExplanation: score === null
      ? "No positive-weight component is available for scoring."
      : "Qualification score uses all assessed positive-weight components.",
  };
}

function finalizeResult(input: {
  deal: DealRecord;
  buyBox: BuyBoxConfig;
  evaluationDate: Date;
  status: QualificationStatus;
  components: QualificationComponent[];
  disqualifiers: string[];
  activeRestrictions: ResearchRestriction[];
  freshness: DataFreshness;
  confidence: DataConfidence | null;
  recommendedAction: string;
  compliance: QualificationCompliance;
  researchTasks: ResearchTask[];
}): QualificationResult {
  const positiveReasons = input.components.flatMap(
    ({ positiveReasons: reasons }) => reasons,
  );
  const negativeReasons = input.components.flatMap(
    ({ negativeReasons: reasons }) => reasons,
  );
  const missingInformation = uniqueStrings(
    input.components.flatMap(
      ({ missingInformation: missing }) => missing,
    ),
  );
  const unsupportedInformation = uniqueStrings(
    input.components.flatMap(
      ({ unsupportedInformation: unsupported }) => unsupported,
    ),
  );
  return {
    dealId: input.deal.id,
    buyBoxVersion: input.buyBox.version,
    evaluatedAt: input.evaluationDate.toISOString(),
    status: input.status,
    score: null,
    scoreLabel: "Score unavailable",
    scoreExplanation: "A valid configured qualification is required before scoring.",
    components: input.components,
    reasons: [...positiveReasons, ...negativeReasons],
    positiveReasons,
    negativeReasons,
    missingInformation,
    unsupportedInformation,
    dataFreshness: input.freshness,
    sourceConfidence: input.confidence,
    restrictions: input.activeRestrictions.map((restriction) => ({
      ...restriction,
    })),
    disqualifiers: input.disqualifiers,
    sellerFit:
      input.components.find(({ key }) => key === "sellerProvidedFit")
        ?.assessment === "Assessed"
        ? "Assessed"
        : "Unassessed",
    recommendedAction: input.recommendedAction,
    compliance: input.compliance,
    researchTasks: input.researchTasks,
    researchPriority: deferredResearchPriority(),
  };
}

function evaluateCompliance(
  restrictions: ResearchRestriction[],
  restrictedSourceRights: boolean,
  disqualifiers: string[],
  ownerStatusRestriction: "Do not contact" | "Identity disputed" | null,
  qualificationStatus: QualificationStatus,
): QualificationCompliance {
  const hasRestriction = (code: ResearchRestriction["code"]): boolean =>
    restrictions.some((restriction) => restriction.code === code);
  const doNotContact =
    ownerStatusRestriction === "Do not contact"
    || hasRestriction("Do not contact");
  const legalHold =
    ownerStatusRestriction === "Identity disputed"
    || hasRestriction("Identity disputed")
    || hasRestriction("Ownership stale");
  const specialistReview =
    hasRestriction("Specialist review")
    || disqualifiers.some((item) => /specialist legal review/i.test(item));
  const sourceBlocked =
    restrictedSourceRights || hasRestriction("Source restricted");
  const hardGateReason =
    disqualifiers.length === 0
      ? null
      : `Qualification hard gate: ${disqualifiers.join(" ")}`;
  const state: ComplianceState = doNotContact
    ? "Do not contact"
    : legalHold
      ? "Legal hold"
      : specialistReview
        ? "Transaction specialist review"
        : sourceBlocked
          ? "Outreach blocked"
          : hardGateReason !== null
            ? "Offer blocked"
            : qualificationStatus === "Scored"
              ? "Clear for manual review"
              : "Clear for research";
  return {
    state,
    outreach:
      doNotContact
        ? complianceGate("Do not contact", "A recorded do-not-contact state blocks outreach.")
        : legalHold
          ? complianceGate("Legal hold", "Identity or ownership risk places outreach on legal hold.")
          : sourceBlocked
            ? complianceGate("Outreach blocked", "Restricted source rights block outreach.")
            : specialistReview
              ? complianceGate(
                  "Transaction specialist review",
                  "Specialist review is required before any outreach progression.",
                )
              : complianceGate(
                  "Outreach review required",
                  "First homeowner contact requires recorded human approval.",
                ),
    offer:
      hardGateReason === null
        ? complianceGate(
            "Clear for manual review",
            "Offers and LOIs require recorded human approval.",
          )
        : complianceGate(
            legalHold ? "Legal hold" : specialistReview
              ? "Transaction specialist review"
              : "Offer blocked",
            hardGateReason,
          ),
    contract:
      hardGateReason === null
        ? complianceGate(
            "Clear for manual review",
            "Contracts and amendments require recorded human approval.",
          )
        : complianceGate(
            legalHold ? "Legal hold" : specialistReview
              ? "Transaction specialist review"
              : "Offer blocked",
            hardGateReason,
          ),
    marketing:
      sourceBlocked || hardGateReason !== null
        ? complianceGate(
            legalHold ? "Legal hold" : "Marketing blocked",
            sourceBlocked
              ? "Restricted source rights block public marketing."
              : hardGateReason!,
          )
        : complianceGate(
            "Clear for manual review",
            "Public marketing requires recorded human approval.",
          ),
    funds:
      hardGateReason === null
        ? complianceGate(
            "Clear for manual review",
            "Earnest money, closing instructions, and funds require recorded human approval.",
          )
        : complianceGate(
            legalHold ? "Legal hold" : specialistReview
              ? "Transaction specialist review"
              : "Offer blocked",
            hardGateReason,
          ),
  };
}

function complianceGate(
  status: ComplianceState,
  reason: string,
): ComplianceActionGate {
  return { status, eligible: false, reason };
}

function deriveRecommendedAction(input: {
  activeRestrictions: ResearchRestriction[];
  dataQuality: DataQualityEvaluation;
  financial: ComponentEvaluation;
  marketability: ComponentEvaluation;
  buyerDemand: ComponentEvaluation;
  sellerProvidedFit: ComponentEvaluation;
  propertyFit: ComponentEvaluation;
  restrictedSourceRights: boolean;
  unapprovedSpecialistStrategies: string[];
  ownerStatusRestriction: "Do not contact" | "Identity disputed" | null;
}): string {
  const hold = input.activeRestrictions.find(({ code }) =>
    [
      "Do not contact",
      "Identity disputed",
      "Ownership stale",
      "Specialist review",
    ].includes(code)
  );
  if (hold !== undefined) {
    return `Preserve the ${hold.code.toLowerCase()} hold and complete only authorized manual review.`;
  }
  if (input.ownerStatusRestriction !== null) {
    return `Preserve the ${input.ownerStatusRestriction.toLowerCase()} hold recorded by owner contact status.`;
  }
  if (
    input.restrictedSourceRights
    || input.activeRestrictions.some(({ code }) => code === "Source restricted")
  ) {
    return "Resolve source restrictions through an authorized-source review.";
  }
  if (input.unapprovedSpecialistStrategies.length > 0) {
    return "Route the recorded structure for specialist legal review.";
  }
  if (input.dataQuality.unresolvedConflicts > 0) {
    return "Resolve the recorded fact conflicts before relying on qualification.";
  }
  if (input.dataQuality.freshness.status !== "Fresh") {
    return "Refresh source verification through an authorized source.";
  }
  if (input.dataQuality.missingProvenance) {
    return "Complete the missing authorized provenance and confidence record.";
  }
  if (input.financial.component.assessment === "Unassessed") {
    return "Complete the missing underwriting facts without preparing an offer.";
  }
  if (input.marketability.component.assessment === "Unassessed") {
    return "Research comparable evidence and record its confidence.";
  }
  if (input.buyerDemand.component.assessment === "Unassessed") {
    return "Review current verified buyer criteria without claiming buyer interest.";
  }
  if (input.sellerProvidedFit.component.assessment === "Unassessed") {
    return "Leave seller fit Unassessed until information is voluntarily supplied.";
  }
  if (input.propertyFit.disqualifiers.length > 0) {
    return "Review the recorded buy-box mismatch without initiating outreach.";
  }
  return "Manually verify ownership and compliance before any later action.";
}

function deriveResearchTasks(
  result: QualificationResult,
  propertyFit: ComponentEvaluation,
  quality: DataQualityEvaluation,
  financial: ComponentEvaluation,
  marketability: ComponentEvaluation,
  buyerDemand: ComponentEvaluation,
  sellerProvidedFit: ComponentEvaluation,
): ResearchTask[] {
  const tasks: ResearchTask[] = [];
  if (
    result.restrictions.length > 0
    || result.disqualifiers.some((item) =>
      /identity|title|source|specialist|contact|ownership/i.test(item)
    )
  ) {
    tasks.push(task(1, "Legal/identity risk", "Attorney review", "Resolve active legal, identity, rights, or restriction risk."));
  }
  tasks.push(task(
    2,
    "Ownership verification",
    "Ownership",
    "The canonical record has no verified ownership evidence; verify current ownership and a reliable property identity before progression.",
  ));
  if (
    quality.component.assessment === "Unassessed"
    || quality.component.missingInformation.length > 0
  ) {
    tasks.push(task(3, "Data-quality impact", "Source verification", "Repair provenance, confidence, freshness, or conflicts."));
  }
  if (
    propertyFit.component.assessment === "Unassessed"
    || propertyFit.disqualifiers.length > 0
    || financial.component.assessment === "Unassessed"
    || financial.disqualifiers.length > 0
    || marketability.component.assessment === "Unassessed"
    || marketability.disqualifiers.length > 0
  ) {
    tasks.push(task(4, "Underwriting impact", "Underwriting", "Resolve the recorded property-fit, comparable, or financial evidence issue."));
  }
  if (
    buyerDemand.component.assessment === "Unassessed"
    || buyerDemand.component.score === 0
  ) {
    tasks.push(task(5, "Buyer-match impact", "Buyer criteria", "Review current verified buyer criteria and proof of funds."));
  }
  if (quality.freshness.status !== "Fresh") {
    tasks.push(task(6, "Time sensitivity", "Listing/sale history", "Refresh time-sensitive property and source facts."));
  }
  if (
    result.components.some(
      ({ assessment, weight }) => assessment === "Unassessed" && weight > 0,
    )
  ) {
    tasks.push(task(
      7,
      "Opportunity score",
      sellerProvidedFit.component.assessment === "Unassessed"
        ? "Seller facts"
        : "Missing qualification facts",
      "Complete the component-specific missing facts before numeric ranking.",
    ));
  }
  if (financial.component.assessment === "Unassessed") {
    tasks.push(task(8, "Estimated transaction potential", "Transaction economics", "Complete real transaction economics without inventing potential."));
  }
  return tasks;
}

function task(
  priority: ResearchTask["priority"],
  category: ResearchTaskCategory,
  taskType: string,
  reason: string,
): ResearchTask {
  return { priority, category, taskType, reason };
}

export function labelResearchPriority(
  score: number,
): ResearchPriorityLabel {
  if (score >= 90) return "Critical";
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  if (score >= 25) return "Low";
  return "Deferred";
}

function deriveResearchPriority(
  result: QualificationResult,
  quality: DataQualityEvaluation,
): ResearchPriority {
  if (result.researchTasks.length === 0) return deferredResearchPriority();
  const combined = [
    ...result.disqualifiers,
    ...result.restrictions.map(({ code, reason }) => `${code}: ${reason}`),
  ].join(" ");
  const criticalSafety =
    /identity|ownership dispute|ownership change|ownership stale|do not contact|opt.?out|suppression failure|legal deadline|foreclosure|bankruptcy|probate|incapacity|attorney request/i
      .test(combined);
  const highResearch =
    quality.unresolvedConflicts > 0
    || result.researchTasks.some(({ category, reason, taskType }) =>
      category === "Underwriting impact"
      || category === "Buyer-match impact"
      || /comparable|comp\b|repair|listing|proof of funds|\bpof\b|title|lien|material conflict/i
        .test(`${reason} ${taskType}`)
    );
  const opportunityPotential: ResearchPriorityFactor =
    result.score === null
      ? factor(
          50,
          "Conservative task default",
          "No assessed-only qualification score is available, so a neutral fit default is used without estimating transaction value.",
        )
      : factor(
          result.score,
          "Evidence",
          "Uses the normalized qualification fit score, not projected revenue or transaction value.",
        );
  const informationImpact = factor(
    criticalSafety ? 100 : highResearch ? 85 : 60,
    "Conservative task default",
    criticalSafety
      ? "Critical safety facts have maximum decision impact."
      : highResearch
        ? "Comparable, repair, buyer, title, lien, or conflict research has a high disclosed decision impact."
        : "The highest generated task uses a conservative medium information-impact default.",
  );
  const timeSensitivity = factor(
    criticalSafety ? 100 : highResearch ? 75 : 50,
    "Conservative task default",
    criticalSafety
      ? "Critical safety work receives an immediate time-sensitivity default."
      : highResearch
        ? "High research work receives a conservative time-sensitive default."
        : "No evidence-backed deadline is recorded; a conservative task default is used.",
  );
  const subtotal = quality.component.calculatedSubtotal;
  const confidenceGap = factor(
    criticalSafety
      ? 100
      : highResearch
        ? Math.max(75, subtotal === null ? 75 : 100 - subtotal)
        : subtotal === null
          ? 60
          : Math.max(10, 100 - subtotal),
    criticalSafety || highResearch || subtotal === null
      ? "Conservative task default"
      : "Evidence",
    criticalSafety
      ? "Critical safety work uses the maximum conservative confidence-gap default."
      : highResearch
        ? `High research uses a conservative confidence-gap floor${
            subtotal === null ? "" : ` anchored to the ${subtotal}/100 data-quality subtotal`
          }.`
        : subtotal === null
      ? "No explanatory data-quality subtotal is available, so a conservative confidence-gap default is used."
      : `Confidence gap is anchored to the disclosed data-quality subtotal of ${subtotal}/100.`,
  );
  const raw = Math.round(
    (
      opportunityPotential.value
      * informationImpact.value
      * timeSensitivity.value
      * confidenceGap.value
    ) ** 0.25,
  );
  const score = criticalSafety
    ? 95
    : highResearch
      ? Math.max(80, Math.min(89, raw))
      : Math.max(0, Math.min(100, raw));
  return {
    score,
    label: labelResearchPriority(score),
    factors: {
      opportunityPotential,
      informationImpact,
      timeSensitivity,
      confidenceGap,
    },
    explanation:
      "Research priority is the disclosed geometric combination of opportunity fit, information impact, time sensitivity, and confidence gap, with conservative task-class floors for safety/high research. It is not predicted transaction value.",
  };
}

function deferredResearchPriority(): ResearchPriority {
  const deferred = factor(
    0,
    "Conservative task default",
    "No generated research task requires prioritization.",
  );
  return {
    score: 0,
    label: "Deferred",
    factors: {
      opportunityPotential: deferred,
      informationImpact: deferred,
      timeSensitivity: deferred,
      confidenceGap: deferred,
    },
    explanation:
      "No generated research work is pending; this deferred score is not predicted transaction value.",
  };
}

function factor(
  value: number,
  source: ResearchPriorityFactor["source"],
  explanation: string,
): ResearchPriorityFactor {
  return { value: Math.max(0, Math.min(100, value)), source, explanation };
}

function buyerCriteriaGaps(buyer: BuyerRecord): string[] {
  const gaps: string[] = [];
  if (buyer.states.length === 0) gaps.push("Buyer geography criteria");
  if (
    buyer.states.length > 1
    && buyer.markets.some((market) => normalizeMatchText(market) !== "")
  ) {
    gaps.push("State-specific buyer market criteria");
  }
  if (
    buyer.propertyTypes.length === 0
    || buyer.propertyTypes.some((value) => normalizeMatchText(value) === "")
  ) {
    gaps.push("Buyer property type criteria");
  }
  if (
    buyer.minPrice === null && buyer.maxPrice === null
    || (
      buyer.minPrice !== null
      && buyer.maxPrice !== null
      && buyer.minPrice > buyer.maxPrice
    )
  ) {
    gaps.push("Buyer price criteria");
  }
  if (buyer.rehabTolerance.length === 0) {
    gaps.push("Buyer rehab criteria");
  }
  if (buyer.strategies.length === 0) {
    gaps.push("Buyer exit strategy criteria");
  }
  return gaps;
}

function buyerMatchesDeal(buyer: BuyerRecord, deal: DealRecord): boolean {
  const geography =
    buyer.states.includes(deal.state)
    && (
      buyer.markets.length === 0
      || buyer.markets.map(normalizeMatchText).includes(normalizeMatchText(deal.market))
      || buyer.markets.map(normalizeMatchText).includes(normalizeMatchText(deal.city))
    );
  const propertyType = buyer.propertyTypes
    .map(normalizeMatchText)
    .includes(normalizeMatchText(deal.propertyType));
  const price =
    deal.askingPrice !== null
    && (buyer.minPrice === null || deal.askingPrice >= buyer.minPrice)
    && (buyer.maxPrice === null || deal.askingPrice <= buyer.maxPrice);
  const rehab =
    deal.rehabLevel !== null
    && buyer.rehabTolerance.includes(deal.rehabLevel);
  const strategy = buyer.strategies.some((buyerStrategy) =>
    deal.strategies.some(
      (dealStrategy) =>
        normalizeMatchText(dealStrategy) === normalizeMatchText(buyerStrategy),
    )
  );
  return geography && propertyType && price && rehab && strategy;
}

function criterion(
  passed: boolean,
  passedValue: number,
  positive: string,
  negative: string,
  positiveReasons: string[],
  negativeReasons: string[],
  scores: number[],
): void {
  scores.push(passed ? passedValue : 0);
  (passed ? positiveReasons : negativeReasons).push(
    passed ? positive : negative,
  );
}

function tieredCriterion(
  value: number,
  minimum: number,
  preferred: number,
  label: string,
  positiveReasons: string[],
  negativeReasons: string[],
  scores: number[],
): void {
  if (value >= preferred) {
    scores.push(1);
    positiveReasons.push(`${label} meets the preferred threshold.`);
  } else if (value >= minimum) {
    scores.push(0.5);
    positiveReasons.push(`${label} meets the minimum threshold.`);
    negativeReasons.push(`${label} is below the preferred threshold.`);
  } else {
    scores.push(0);
    negativeReasons.push(`${label} is below the minimum threshold.`);
  }
}

function withinOptionalBounds(
  value: number,
  minimum: number | null,
  maximum: number | null,
): boolean {
  return (minimum === null || value >= minimum)
    && (maximum === null || value <= maximum);
}

function evaluateFreshness(
  value: string | null | undefined,
  evaluationDate: Date,
  maxAgeDays: number,
): DataFreshness {
  if (value === undefined || value === null || !validDate(value)) {
    return missingFreshness();
  }
  const timestamp = Date.parse(value);
  const age = evaluationDate.getTime() - timestamp;
  if (age < 0) {
    return { status: "Future", lastVerifiedAt: value, ageDays: age / DAY_MILLISECONDS };
  }
  const ageDays = age / DAY_MILLISECONDS;
  return {
    status: ageDays <= maxAgeDays ? "Fresh" : "Stale",
    lastVerifiedAt: value,
    ageDays,
  };
}

function missingFreshness(): DataFreshness {
  return { status: "Missing", lastVerifiedAt: null, ageDays: null };
}

function provenanceGaps(assertion: SourceAssertion | null): string[] {
  if (assertion === null) return ["Complete authorized provenance"];
  const gaps: string[] = [];
  if (!nonblank(assertion.source)) gaps.push("Provenance source");
  if (!nonblank(assertion.sourceRecordId)) {
    gaps.push("Provenance source record ID");
  }
  if (!validDate(assertion.retrievedAt)) gaps.push("Provenance retrieval date");
  if (!nonblank(assertion.facts.market)) gaps.push("Provenance market");
  if (assertion.usageClassification === "Restricted — research only") {
    gaps.push("Authorized non-restricted usage rights");
  }
  if (
    assertion.confidence === null ||
    !CONFIDENCE_LEVELS.includes(assertion.confidence)
  ) {
    gaps.push("Provenance confidence");
  }
  if (
    assertion.lastVerifiedAt === null ||
    !validDate(assertion.lastVerifiedAt)
  ) {
    gaps.push("Provenance verification date");
  }
  return gaps;
}

function compareAssertions(
  left: SourceAssertion,
  right: SourceAssertion,
): number {
  const verified =
    sortableDate(right.lastVerifiedAt ?? "") -
    sortableDate(left.lastVerifiedAt ?? "");
  if (verified !== 0) return verified;
  const retrieved =
    sortableDate(right.retrievedAt) - sortableDate(left.retrievedAt);
  if (retrieved !== 0) return retrieved;
  return compareStrings(left.id, right.id);
}

function validCurrentDate(
  value: string,
  evaluationDate: Date,
  maxAgeDays: number,
  expiry: boolean,
): boolean {
  if (!validDate(value)) return false;
  let timestamp = Date.parse(value);
  if (expiry && /^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    timestamp += DAY_MILLISECONDS - 1;
  }
  const age = evaluationDate.getTime() - timestamp;
  return expiry
    ? timestamp >= evaluationDate.getTime()
    : age >= 0 && age <= maxAgeDays * DAY_MILLISECONDS;
}

function validFinancialEvidenceValue(
  key: FinancialNumericEvidenceKey,
  value: number | null | undefined,
): boolean {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return false;
  }
  if (value < 0) return false;
  if (
    key === "estimatedEquityPercent"
    || key === "wholesaleGrossMarginPercent"
  ) {
    return value <= 100;
  }
  return true;
}

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function sortableDate(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function confidenceRank(value: DataConfidence): number {
  return CONFIDENCE_LEVELS.indexOf(value);
}

function normalizeStates(values: StateCode[]): StateCode[] {
  return uniqueSorted(
    values
      .map((value) => normalizeText(String(value)).toUpperCase())
      .filter(isStateCode),
  ).filter(isStateCode);
}

function normalizeRehabLevels(values: RehabLevel[]): RehabLevel[] {
  const normalized = values
    .map((value) => normalizeRehabLevel(String(value)))
    .filter((value): value is RehabLevel => value !== null);
  return [...new Set(normalized)].sort(
    (left, right) =>
      REHAB_LEVELS.indexOf(left) - REHAB_LEVELS.indexOf(right),
  );
}

function normalizeRehabLevel(value: string): RehabLevel | null {
  const normalized = normalizeMatchText(value);
  return REHAB_LEVELS.find(
    (level) => normalizeMatchText(level) === normalized,
  ) ?? null;
}

function normalizeTextArray(values: string[]): string[] {
  return uniqueSorted(
    values.map(normalizeMatchText).filter((value) => value !== ""),
  );
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function normalizeMatchText(value: string): string {
  return normalizeText(value).toLowerCase();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isStateCode(value: string): value is StateCode {
  return STATES.includes(value as StateCode);
}

function nonblank(value: string): boolean {
  return normalizeText(value) !== "";
}

function restrictionCodeForOwnerStatus(
  value: string,
): "Do not contact" | "Identity disputed" | null {
  const normalized = normalizeMatchText(value);
  const compact = normalized.replace(/[^\p{L}\p{N}]+/gu, "");
  if (
    compact.includes("donotcontact")
    || compact.includes("optout")
    || compact.includes("optedout")
    || /\bdnc\b/u.test(normalized)
  ) {
    return "Do not contact";
  }
  if (
    compact.includes("identitydisputed")
    || compact.includes("identitydispute")
  ) {
    return "Identity disputed";
  }
  return null;
}

function validateOptionalMoney(
  value: number | null,
  label: string,
  errors: string[],
): void {
  if (!validOptionalMoney(value)) {
    errors.push(`${label} must be a finite nonnegative number or blank.`);
  }
}

function validOptionalMoney(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0);
}

function safeWeight(
  buyBox: BuyBoxConfig,
  key: QualificationComponentKey,
): number {
  const weight = buyBox.weights?.[key];
  return Number.isFinite(weight) && weight >= 0 ? weight : 0;
}

function semanticJson(fields: NormalizedBuyBoxFields): string {
  return JSON.stringify(fields);
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function compareOpportunity(
  left: RankedResearchItem,
  right: RankedResearchItem,
): number {
  const score = (right.score ?? -1) - (left.score ?? -1);
  if (score !== 0) return score;
  const quality =
    (right.dataQualityScore ?? -1) - (left.dataQualityScore ?? -1);
  if (quality !== 0) return quality;
  const updated =
    sortableCanonicalDate(left.updatedAt)
    - sortableCanonicalDate(right.updatedAt);
  if (updated !== 0) return updated;
  return compareStrings(left.dealId, right.dealId);
}

function compareResearchItems(
  left: RankedResearchItem,
  right: RankedResearchItem,
): number {
  const priority = right.researchPriority - left.researchPriority;
  if (priority !== 0) return priority;
  if (left.queue === "Scored" && right.queue === "Scored") {
    return compareOpportunity(left, right);
  }
  const action = compareStrings(
    left.recommendedAction,
    right.recommendedAction,
  );
  if (action !== 0) return action;
  const updated =
    sortableCanonicalDate(left.updatedAt)
    - sortableCanonicalDate(right.updatedAt);
  if (updated !== 0) return updated;
  return compareStrings(left.dealId, right.dealId);
}

function sortableCanonicalDate(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}
