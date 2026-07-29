import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateUnderwriting } from "../lib/underwriting/calculate.ts";
import type { UnderwritingEvidence, UnderwritingPolicy } from "../lib/underwriting/types.ts";

const cases = JSON.parse(
  readFileSync(
    new URL("./fixtures/legacy-reference/underwriting-cases.json", import.meta.url),
    "utf8",
  ),
);

const policy: UnderwritingPolicy = {
  version: 1,
  minimumApprovedComparables: 3,
  acquisitionPercent: 0.7,
  transactionFee: 15000,
  frictionPercentOfArv: 0.02,
  offerLadderPercentages: [0.88, 0.94, 1],
};

test("reproduces the approved synthetic reference case", () => {
  const fixture = cases[0];
  const result = calculateUnderwriting(fixture.evidence, policy);
  assert.equal(result.status, fixture.expected.status);
  if (result.status !== "ready") throw new Error("Expected ready result");
  assert.equal(result.maximumPrice, fixture.expected.maximumPrice);
  assert.deepEqual(result.offerLadder, fixture.expected.offerLadder);
});

test("blocks final underwriting below the comparable threshold", () => {
  const fixture = cases[1];
  assert.deepEqual(calculateUnderwriting(fixture.evidence, policy), {
    status: "blocked",
    reasons: [fixture.expected.reason],
    approvedComparableCount: 2,
    requiredComparableCount: 3,
  });
});

test("invalid evidence and policy values fail closed without an offer", () => {
  const casesToBlock: Array<[UnderwritingEvidence, UnderwritingPolicy]> = [
    [{ arv: -1, repairs: 0, approvedComparableCount: 3 }, policy],
    [{ arv: 1, repairs: -1, approvedComparableCount: 3 }, policy],
    [{ arv: 1, repairs: 0, approvedComparableCount: 3 }, { ...policy, acquisitionPercent: 1.1 }],
    [{ arv: 1, repairs: 0, approvedComparableCount: 3 }, { ...policy, frictionPercentOfArv: -0.1 }],
    [{ arv: 1, repairs: 0, approvedComparableCount: 3 }, { ...policy, transactionFee: -1 }],
    [{ arv: 1, repairs: 0, approvedComparableCount: 3 }, { ...policy, offerLadderPercentages: [1.01] }],
  ];
  for (const [evidence, currentPolicy] of casesToBlock) {
    const result = calculateUnderwriting(evidence, currentPolicy);
    assert.equal(result.status, "blocked");
    assert.equal("maximumPrice" in result, false);
    assert.equal(JSON.stringify(result).includes("NaN"), false);
  }
});
