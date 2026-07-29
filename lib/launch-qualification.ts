import type {
  QualificationComponent,
  QualificationResult,
  QualificationSubfactor,
  ResearchTask,
} from "./qualification.ts";
import {
  normalizeBuyBox,
  type BuyBoxValidationResult,
} from "./qualification.ts";
import type { BuyBoxConfig, StateCode } from "./types.ts";

const LAUNCH_MARKET_BY_STATE: Record<StateCode, string> = {
  MA: "bristol county",
  RI: "providence county",
};

const LAUNCH_PROPERTY_TYPE_ALIASES = new Map<string, string>([
  ["single-family homes", "single-family homes"],
  ["single-family residential", "single-family homes"],
  ["duplexes", "duplexes"],
  ["two-family residential", "duplexes"],
  ["triplexes", "triplexes"],
  ["three-family residential", "triplexes"],
  ["four-unit residential", "four-unit residential"],
  ["four-family residential", "four-unit residential"],
]);

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

export type LaunchBuyBoxFieldKey =
  | "states"
  | "markets"
  | "propertyTypes"
  | "prices"
  | "rehab"
  | "confidence"
  | "freshness"
  | "financial";

export function mapLaunchBuyBoxValidationErrors(
  result: Extract<BuyBoxValidationResult, { ok: false }>,
): Partial<Record<LaunchBuyBoxFieldKey, string>> {
  const mapped: Partial<Record<LaunchBuyBoxFieldKey, string>> = {};
  for (const error of result.errors) {
    const normalized = error.toLowerCase();
    const key: LaunchBuyBoxFieldKey = /^property type(?:\s|$)/u.test(normalized)
      ? "propertyTypes"
      : /state/.test(normalized)
        ? "states"
        : /market/.test(normalized)
          ? "markets"
          : /property type/.test(normalized)
            ? "propertyTypes"
            : /price/.test(normalized)
              ? "prices"
              : /rehab/.test(normalized)
                ? "rehab"
                : /confidence/.test(normalized)
                  ? "confidence"
                  : /fresh|verification age/.test(normalized)
                    ? "freshness"
                    : "financial";
    mapped[key] = mapped[key] ? `${mapped[key]} ${error}` : error;
  }
  return mapped;
}

export function normalizeLaunchBuyBox(
  input: BuyBoxConfig,
  previous: BuyBoxConfig,
  now: Date,
): BuyBoxValidationResult {
  const errors: string[] = [];
  const states = Array.isArray(input.states) ? input.states : [];
  const marketsByState: BuyBoxConfig["marketsByState"] = { MA: [], RI: [] };
  for (const state of ["MA", "RI"] as const) {
    const rawMarkets = Array.isArray(input.marketsByState?.[state])
      ? input.marketsByState[state]
      : [];
    const normalizedMarkets = rawMarkets.map(normalizeLaunchLabel);
    const allowed = LAUNCH_MARKET_BY_STATE[state];
    if (normalizedMarkets.some((market) => market !== allowed)) {
      errors.push(
        `${state} launch markets may include only ${allowed}.`,
      );
    }
    if (states.includes(state)) {
      if (!normalizedMarkets.includes(allowed)) {
        errors.push(`${state} requires the frozen ${allowed} launch market.`);
      } else {
        marketsByState[state] = [allowed];
      }
    }
  }

  const propertyTypes = Array.isArray(input.propertyTypes)
    ? input.propertyTypes
    : [];
  const canonicalTypes: string[] = [];
  for (const rawType of propertyTypes) {
    const canonical = LAUNCH_PROPERTY_TYPE_ALIASES.get(
      normalizeLaunchLabel(rawType),
    );
    if (canonical === undefined) {
      errors.push(
        `Property type "${String(rawType)}" is outside the frozen residential 1–4 family launch scope.`,
      );
    } else {
      canonicalTypes.push(canonical);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  return normalizeBuyBox(
    {
      ...input,
      marketsByState,
      propertyTypes: canonicalTypes,
    },
    previous,
    now,
  );
}

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

function normalizeLaunchLabel(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
}
