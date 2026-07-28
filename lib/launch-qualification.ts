import type {
  QualificationComponent,
  QualificationResult,
  QualificationSubfactor,
  ResearchTask,
} from "./qualification.ts";

export type LaunchQualificationStatus =
  | "Qualified"
  | "Possible"
  | "Research required"
  | "Disqualified"
  | "Compliance or specialist review";

export type LaunchCategoryAssessment =
  | "Assessed"
  | "Partially assessed"
  | "Unassessed";

export type LaunchQualificationCategory = {
  key:
    | "geography"
    | "propertyType"
    | "priceEquity"
    | "financialPotential"
    | "dataConfidence";
  label: string;
  assessment: LaunchCategoryAssessment;
  score: null;
  evidence: string[];
  missingInformation: string[];
  explanation: string;
};

export type LaunchQualificationView = {
  status: LaunchQualificationStatus;
  score: number | null;
  scoreLabel: QualificationResult["scoreLabel"];
  scoreExplanation: string;
  categories: LaunchQualificationCategory[];
  positiveReasons: string[];
  negativeReasons: string[];
  missingInformation: string[];
  restrictions: QualificationResult["restrictions"];
  disqualifiers: string[];
  freshness: QualificationResult["dataFreshness"];
  sourceConfidence: QualificationResult["sourceConfidence"];
  contact: {
    blocked: true;
    state: QualificationResult["compliance"]["outreach"]["status"];
    reason: string;
  };
  nextResearchTask: ResearchTask | null;
  recommendedAction: string;
  sellerFit: "Unassessed" | "Assessed";
};

export function adaptQualificationForLaunch(
  result: QualificationResult,
): LaunchQualificationView {
  const propertyFit = component(result, "propertyFit");
  const financial = component(result, "financialFeasibility");
  const dataQuality = component(result, "dataQuality");

  return {
    status: launchStatus(result),
    score: result.score,
    scoreLabel: result.scoreLabel,
    scoreExplanation: result.scoreExplanation,
    categories: [
      category(
        "geography",
        "Geography fit",
        subfactors(propertyFit, ["Geography"]),
      ),
      category(
        "propertyType",
        "Property-type fit",
        subfactors(propertyFit, ["Property type"]),
      ),
      category(
        "priceEquity",
        "Price and equity fit",
        [
          ...subfactors(propertyFit, ["Price"]),
          ...subfactors(financial, ["Equity"]),
        ],
      ),
      category(
        "financialPotential",
        "Financial potential",
        subfactors(financial, [
          "Spread",
          "Buyer profit",
          "Costs",
          "Sensitivity",
        ]),
      ),
      category(
        "dataConfidence",
        "Data confidence",
        dataQuality?.subfactors ?? [],
      ),
    ],
    positiveReasons: result.positiveReasons,
    negativeReasons: result.negativeReasons,
    missingInformation: result.missingInformation,
    restrictions: result.restrictions,
    disqualifiers: result.disqualifiers,
    freshness: result.dataFreshness,
    sourceConfidence: result.sourceConfidence,
    contact: {
      blocked: true,
      state: result.compliance.outreach.status,
      reason: result.compliance.outreach.reason,
    },
    nextResearchTask: result.researchTasks[0] ?? null,
    recommendedAction: result.recommendedAction,
    sellerFit: result.sellerFit,
  };
}

function launchStatus(result: QualificationResult): LaunchQualificationStatus {
  if (
    result.restrictions.length > 0 ||
    [
      "Do not contact",
      "Legal hold",
      "Transaction specialist review",
      "Outreach blocked",
      "Offer blocked",
      "Marketing blocked",
    ].includes(result.compliance.state)
  ) {
    return "Compliance or specialist review";
  }
  if (result.status === "Disqualified") return "Disqualified";
  if (result.status === "Unconfigured" || result.status === "Needs data") {
    return "Research required";
  }
  return result.negativeReasons.length > 0 ? "Possible" : "Qualified";
}

function component(
  result: QualificationResult,
  key: QualificationComponent["key"],
): QualificationComponent | null {
  return result.components.find((item) => item.key === key) ?? null;
}

function subfactors(
  source: QualificationComponent | null,
  labels: string[],
): QualificationSubfactor[] {
  if (source === null) return [];
  return source.subfactors.filter(({ label }) => labels.includes(label));
}

function category(
  key: LaunchQualificationCategory["key"],
  label: string,
  factors: QualificationSubfactor[],
): LaunchQualificationCategory {
  const supported = factors.filter(
    ({ assessment }) => assessment === "Supported",
  );
  const missing = factors.filter(
    ({ assessment }) => assessment !== "Supported",
  );
  const assessment: LaunchCategoryAssessment =
    factors.length > 0 && supported.length === factors.length
      ? "Assessed"
      : supported.length > 0
        ? "Partially assessed"
        : "Unassessed";
  return {
    key,
    label,
    assessment,
    score: null,
    evidence: supported.flatMap(({ inputFacts }) => inputFacts),
    missingInformation: missing.map(
      ({ label: factorLabel }) => factorLabel,
    ),
    explanation:
      factors.length === 0
        ? "This launch category is Unassessed because supported evidence is not available."
        : factors.map(({ explanation }) => explanation).join(" "),
  };
}
