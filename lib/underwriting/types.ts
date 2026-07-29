export type UnderwritingPolicy = {
  version: number;
  minimumApprovedComparables: number;
  acquisitionPercent: number;
  transactionFee: number;
  frictionPercentOfArv: number;
  offerLadderPercentages: number[];
};

export type UnderwritingEvidence = {
  arv: number;
  repairs: number;
  approvedComparableCount: number;
};

export type UnderwritingResult =
  | {
      status: "ready";
      policyVersion: number;
      maximumPrice: number;
      offerLadder: number[];
      expression: string;
      approvedComparableCount: number;
    }
  | {
      status: "blocked";
      reasons: string[];
      approvedComparableCount: number;
      requiredComparableCount: number;
    };
