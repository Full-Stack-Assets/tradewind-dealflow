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
const DEFAULT_MARKETS = [
  "Bristol County",
  "Plymouth County",
  "Norfolk County",
  "Worcester County",
  "Providence-border communities",
  "Fall River",
  "New Bedford",
  "Taunton",
  "Attleboro",
  "Brockton",
  "Wareham",
  "Dartmouth",
  "Fairhaven",
  "Seekonk",
  "Swansea",
  "Somerset",
  "Rehoboth",
  "Providence County",
  "Kent County",
  "Providence",
  "Pawtucket",
  "Central Falls",
  "Cranston",
  "Warwick",
  "East Providence",
  "Woonsocket",
  "Johnston",
  "North Providence",
  "West Warwick",
  "Coventry",
  "Bristol",
  "Warren",
];
const DEFAULT_PROPERTY_TYPES = [
  "Single-family homes",
  "Duplexes",
  "Triplexes",
  "Four-unit residential",
  "Small multifamily, 5–12 units — manual review",
  "Vacant residential land — manual review",
  "Mixed-use — manual review",
];

export type QualificationStatus =
  | "Unconfigured"
  | "Disqualified"
  | "Needs data"
  | "Scored";
export type QualificationComponentKey = (typeof COMPONENT_KEYS)[number];
export type ComponentAssessment = "Assessed" | "Unassessed";

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
  explanation: string;
};

export type FinancialQualificationEvidence = {
  estimatedValue: number | null;
  acquisitionPrice: number | null;
  estimatedEquityPercent: number | null;
  assignmentSpread: number | null;
  buyerProfit: number | null;
  wholesaleGrossMarginPercent: number | null;
};

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

export type ComplianceActionStatus =
  | "Blocked"
  | "Human approval required";

export type ComplianceActionGate = {
  status: ComplianceActionStatus;
  eligible: false;
  reason: string;
};

export type QualificationCompliance = {
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

export type QualificationResult = {
  dealId: string;
  buyBoxVersion: number;
  evaluatedAt: string;
  status: QualificationStatus;
  score: number | null;
  components: QualificationComponent[];
  reasons: string[];
  positiveReasons: string[];
  negativeReasons: string[];
  missingInformation: string[];
  dataFreshness: DataFreshness;
  sourceConfidence: DataConfidence | null;
  restrictions: ResearchRestriction[];
  disqualifiers: string[];
  sellerFit: "Unassessed" | "Assessed";
  recommendedAction: string;
  compliance: QualificationCompliance;
  researchTasks: ResearchTask[];
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
    markets: normalizeTextArray(DEFAULT_MARKETS),
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
  const compliance = evaluateCompliance(
    activeRestrictions,
    restrictedSourceRights,
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
      compliance,
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
      compliance,
      researchTasks: [],
    });
  }

  const config = validated.value;
  const propertyFit = evaluatePropertyFit(deal, config);
  const financial = evaluateFinancial(context.financial, config);
  const marketability = evaluateMarketability(
    context.marketability,
    config,
    evaluationDate,
  );
  const buyerDemand = evaluateBuyerDemand(
    deal,
    context.buyers,
    config,
    evaluationDate,
  );
  const dataQuality = evaluateDataQuality(deal, config, evaluationDate);
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
  });
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
  const score =
    status === "Scored" ? calculateWeightedScore(components) : null;
  const withScore = { ...preliminary, score };
  return {
    ...withScore,
    researchTasks: deriveResearchTasks(
      withScore,
      dataQuality,
      financial,
      buyerDemand,
    ),
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
      researchPriority:
        qualification.researchTasks[0]?.priority
        ?? (qualification.status === "Scored" ? 7 : 1),
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
  const rawMarkets = Array.isArray(input.markets) ? input.markets : [];
  const rawPropertyTypes = Array.isArray(input.propertyTypes)
    ? input.propertyTypes
    : [];
  const rawRehabLevels = Array.isArray(input.rehabLevels)
    ? input.rehabLevels
    : [];
  const states = normalizeStates(rawStates);
  const markets = normalizeTextArray(rawMarkets);
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
  if (rawMarkets.some((market) => normalizeText(market) === "")) {
    errors.push("Market labels cannot be blank.");
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
      markets,
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
  const geographyMatches =
    buyBox.states.includes(deal.state)
    && (
      buyBox.markets.length === 0
      || buyBox.markets.includes(market)
      || buyBox.markets.includes(city)
    );
  if (geographyMatches) {
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
    ),
    disqualifiers,
  };
}

function evaluateFinancial(
  evidence: FinancialQualificationEvidence | undefined,
  buyBox: NormalizedBuyBoxFields,
): ComponentEvaluation {
  const fields: Array<
    [keyof FinancialQualificationEvidence, string]
  > = [
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
  if (evidence === undefined || missingInformation.length > 0) {
    return {
      component: buildComponent(
        "financialFeasibility",
        buyBox.weights.financialFeasibility,
        null,
        [],
        [],
        [],
        missingInformation.length > 0
          ? missingInformation
          : fields.map(
              ([, label]) => `Financial feasibility evidence: ${label}`,
            ),
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
      fields.map(([key, label]) => `${label}: ${String(evidence[key])}`),
      positiveReasons,
      negativeReasons,
      [],
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
    ),
    disqualifiers: sufficient
      ? []
      : ["Insufficient comparable confidence requires review before an offer."],
  };
}

function evaluateBuyerDemand(
  deal: DealRecord,
  buyers: BuyerRecord[] | undefined,
  buyBox: NormalizedBuyBoxFields,
  evaluationDate: Date,
): ComponentEvaluation {
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
  if (verified.length === 0) {
    return {
      component: buildComponent(
        "buyerDemand",
        buyBox.weights.buyerDemand,
        null,
        [],
        [],
        [],
        ["Current verified buyer evidence"],
      ),
      disqualifiers: [],
    };
  }
  const matches = verified.filter((buyer) => buyerMatchesDeal(buyer, deal));
  return {
    component: buildComponent(
      "buyerDemand",
      buyBox.weights.buyerDemand,
      matches.length > 0 ? 100 : 0,
      [`${verified.length} current verified buyer records reviewed`],
      matches.length > 0
        ? [`${matches.length} verified buyer criteria record(s) match exactly.`]
        : [],
      matches.length === 0
        ? ["No verified buyer criteria record matches the supported facts."]
        : [],
      [],
    ),
    disqualifiers: [],
  };
}

function evaluateDataQuality(
  deal: DealRecord,
  buyBox: NormalizedBuyBoxFields,
  evaluationDate: Date,
): DataQualityEvaluation {
  const eligible = deal.sourceAssertions.filter(
    ({ usageClassification }) =>
      usageClassification !== "Restricted — research only",
  );
  const selected = eligible.slice().sort(compareAssertions)[0] ?? null;
  const complete = eligible.some(assertionHasCompleteProvenance);
  const freshness = evaluateFreshness(selected?.lastVerifiedAt, evaluationDate, buyBox.maxVerificationAgeDays);
  const confidence = selected?.confidence ?? null;
  const confidenceMeets =
    confidence !== null
    && confidenceRank(confidence) >= confidenceRank(buyBox.minimumConfidence);
  const unresolved = deal.factConflicts.filter(
    ({ status }) => status === "Unresolved",
  ).length;
  const missingInformation: string[] = [];
  if (!complete) missingInformation.push("Complete authorized provenance");
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
  const score =
    selected === null
      ? null
      : (complete ? 40 : 0)
        + confidencePoints
        + (freshness.status === "Fresh" ? 25 : 0)
        + (unresolved === 0 ? 10 : 0);
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
  const valid =
    evidence !== undefined
    && evidence.voluntarilyProvided
    && Number.isFinite(evidence.score)
    && evidence.score >= 0
    && evidence.score <= 100
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
        "sellerProvidedFit",
        buyBox.weights.sellerProvidedFit,
        null,
        [],
        [],
        [],
        ["Current voluntarily supplied seller-provided fit information"],
      ),
      disqualifiers: [],
    };
  }
  return {
    component: buildComponent(
      "sellerProvidedFit",
      buyBox.weights.sellerProvidedFit,
      evidence.score,
      [`Source: ${evidence.source}`, `Verified: ${evidence.verifiedAt}`],
      evidence.positiveReasons.slice(),
      evidence.negativeReasons.slice(),
      [],
    ),
    disqualifiers: [],
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
): QualificationComponent {
  const assessment: ComponentAssessment =
    score === null ? "Unassessed" : "Assessed";
  const explanation =
    assessment === "Unassessed"
      ? `${COMPONENT_LABELS[key]} is Unassessed because required real inputs are missing or not current.`
      : `${COMPONENT_LABELS[key]} is ${score}/100 from the recorded inputs.`;
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
): number {
  const included = components.filter(
    ({ included, score }) => included && score !== null,
  );
  const totalWeight = included.reduce((sum, { weight }) => sum + weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = included.reduce(
    (sum, { score, weight }) => sum + (score ?? 0) * weight,
    0,
  );
  return Math.round(weighted / totalWeight);
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
  return {
    dealId: input.deal.id,
    buyBoxVersion: input.buyBox.version,
    evaluatedAt: input.evaluationDate.toISOString(),
    status: input.status,
    score: null,
    components: input.components,
    reasons: [...positiveReasons, ...negativeReasons],
    positiveReasons,
    negativeReasons,
    missingInformation,
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
  };
}

function evaluateCompliance(
  restrictions: ResearchRestriction[],
  restrictedSourceRights: boolean,
): QualificationCompliance {
  const blocking = restrictions.find(({ code }) =>
    [
      "Do not contact",
      "Identity disputed",
      "Ownership stale",
      "Source restricted",
      "Specialist review",
    ].includes(code)
  );
  const sourceRightsReason = restrictedSourceRights
    ? "Restricted source rights block outreach."
    : null;
  return {
    outreach:
      blocking === undefined && sourceRightsReason === null
        ? approvalGate(
            "First homeowner contact requires recorded human approval.",
          )
        : {
            status: "Blocked",
            eligible: false,
            reason:
              sourceRightsReason
              ?? `Active ${blocking!.code.toLowerCase()} restriction blocks outreach.`,
          },
    offer: approvalGate("Offers and LOIs require recorded human approval."),
    contract: approvalGate(
      "Contracts and amendments require recorded human approval.",
    ),
    marketing: approvalGate(
      "Public marketing requires recorded human approval.",
    ),
    funds: approvalGate(
      "Earnest money, closing instructions, and funds require recorded human approval.",
    ),
  };
}

function approvalGate(reason: string): ComplianceActionGate {
  return { status: "Human approval required", eligible: false, reason };
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
  quality: DataQualityEvaluation,
  financial: ComponentEvaluation,
  buyerDemand: ComponentEvaluation,
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
  tasks.push(task(2, "Ownership verification", "Ownership", "Verify current ownership and a reliable property identity before progression."));
  if (
    quality.component.assessment === "Unassessed"
    || quality.component.missingInformation.length > 0
  ) {
    tasks.push(task(3, "Data-quality impact", "Source verification", "Repair provenance, confidence, freshness, or conflicts."));
  }
  if (financial.component.assessment === "Unassessed") {
    tasks.push(task(4, "Underwriting impact", "Underwriting", "Collect the missing real financial inputs."));
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
  if (result.score === null) {
    tasks.push(task(7, "Opportunity score", "Missing qualification facts", "Complete required assessed components before numeric ranking."));
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
  return geography && propertyType && price && rehab;
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
  value: string | undefined,
  evaluationDate: Date,
  maxAgeDays: number,
): DataFreshness {
  if (value === undefined || !validDate(value)) return missingFreshness();
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

function assertionHasCompleteProvenance(assertion: SourceAssertion): boolean {
  return nonblank(assertion.source)
    && nonblank(assertion.sourceRecordId)
    && validDate(assertion.retrievedAt)
    && nonblank(assertion.facts.market)
    && assertion.usageClassification !== "Restricted — research only"
    && CONFIDENCE_LEVELS.includes(assertion.confidence)
    && validDate(assertion.lastVerifiedAt);
}

function compareAssertions(
  left: SourceAssertion,
  right: SourceAssertion,
): number {
  const verified =
    sortableDate(right.lastVerifiedAt) - sortableDate(left.lastVerifiedAt);
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
  key: keyof FinancialQualificationEvidence,
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
  const priority = left.researchPriority - right.researchPriority;
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
