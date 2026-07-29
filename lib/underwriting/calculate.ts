import type {
  UnderwritingEvidence,
  UnderwritingPolicy,
  UnderwritingResult,
} from "./types.ts";

function roundMoney(value: number): number {
  return Math.round(value);
}

function isRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function calculateUnderwriting(
  evidence: UnderwritingEvidence,
  policy: UnderwritingPolicy,
): UnderwritingResult {
  const reasons: string[] = [];
  if (!Number.isFinite(evidence.arv) || evidence.arv < 0) {
    reasons.push("ARV must be zero or greater.");
  }
  if (!Number.isFinite(evidence.repairs) || evidence.repairs < 0) {
    reasons.push("Repairs must be zero or greater.");
  }
  if (!Number.isInteger(evidence.approvedComparableCount) || evidence.approvedComparableCount < 0) {
    reasons.push("Approved comparable count must be a non-negative integer.");
  }
  if (!Number.isInteger(policy.version) || policy.version < 1) {
    reasons.push("Policy version must be a positive integer.");
  }
  if (!Number.isInteger(policy.minimumApprovedComparables) || policy.minimumApprovedComparables < 1) {
    reasons.push("Minimum approved comparables must be a positive integer.");
  } else if (
    Number.isInteger(evidence.approvedComparableCount)
    && evidence.approvedComparableCount >= 0
    && evidence.approvedComparableCount < policy.minimumApprovedComparables
  ) {
    reasons.push(`At least ${policy.minimumApprovedComparables} approved comparable sales are required.`);
  }
  if (!isRate(policy.acquisitionPercent)) {
    reasons.push("Acquisition percent must be between 0 and 1.");
  }
  if (!isRate(policy.frictionPercentOfArv)) {
    reasons.push("Friction percent must be between 0 and 1.");
  }
  if (!Number.isFinite(policy.transactionFee) || policy.transactionFee < 0) {
    reasons.push("Transaction fee must be zero or greater.");
  }
  if (
    !Array.isArray(policy.offerLadderPercentages)
    || policy.offerLadderPercentages.length === 0
    || policy.offerLadderPercentages.some((value) => !isRate(value))
  ) {
    reasons.push("Every offer ladder percentage must be between 0 and 1.");
  }
  if (reasons.length > 0) {
    return {
      status: "blocked",
      reasons,
      approvedComparableCount: evidence.approvedComparableCount,
      requiredComparableCount: policy.minimumApprovedComparables,
    };
  }

  const maximumPrice = roundMoney(
    evidence.arv * policy.acquisitionPercent
      - evidence.repairs
      - policy.transactionFee
      - evidence.arv * policy.frictionPercentOfArv,
  );
  if (maximumPrice < 0) {
    return {
      status: "blocked",
      reasons: ["Calculated maximum price is below zero."],
      approvedComparableCount: evidence.approvedComparableCount,
      requiredComparableCount: policy.minimumApprovedComparables,
    };
  }
  return {
    status: "ready",
    policyVersion: policy.version,
    maximumPrice,
    offerLadder: policy.offerLadderPercentages.map((value) => roundMoney(maximumPrice * value)),
    expression: "ARV × acquisition percent − repairs − transaction fee − ARV friction",
    approvedComparableCount: evidence.approvedComparableCount,
  };
}
