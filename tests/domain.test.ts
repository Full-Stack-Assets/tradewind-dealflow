import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateHeuristic,
  calculateMao,
} from "../lib/calculations.ts";
import {
  addBusinessDays,
  evaluateCancellationWindow,
  evaluateMarketingReadiness,
} from "../lib/compliance.ts";
import {
  createEmptyData,
  validateImport,
} from "../lib/import-export.ts";
import { matchBuyer } from "../lib/matching.ts";
import type { BuyerRecord, DealRecord } from "../lib/types.ts";

test("primary MAO subtracts every user-entered cost exactly once", () => {
  const result = calculateMao({
    arv: 300_000,
    repairs: 50_000,
    holdingClosingCosts: 20_000,
    buyerProfit: 40_000,
    wholesaleFee: 10_000,
  });

  assert.deepEqual(result, {
    ok: true,
    value: 180_000,
    expression: "$300,000 − $50,000 − $20,000 − $40,000 − $10,000",
  });
});

test("MAO rejects missing, negative, and non-finite inputs instead of presenting a result", () => {
  assert.deepEqual(
    calculateMao({
      arv: 300_000,
      repairs: -1,
      holdingClosingCosts: 20_000,
      buyerProfit: 40_000,
      wholesaleFee: Number.NaN,
    }),
    {
      ok: false,
      errors: [
        "Repairs must be zero or greater.",
        "Wholesale fee must be a finite number.",
      ],
    },
  );
});

test("percentage comparison identifies itself as a heuristic", () => {
  assert.deepEqual(calculateHeuristic(300_000, 50_000, 70), {
    ok: true,
    value: 160_000,
    label: "70% rule heuristic",
    warning: "A heuristic is not a valuation, appraisal, or universal acquisition rule.",
  });
});

test("new local data is configuration-only and contains no production records", () => {
  const empty = createEmptyData("2026-07-27T12:00:00.000Z");

  assert.equal(empty.schemaVersion, 1);
  assert.equal(empty.updatedAt, "2026-07-27T12:00:00.000Z");
  assert.deepEqual(empty.deals, []);
  assert.deepEqual(empty.buyers, []);
  assert.deepEqual(empty.analyses, []);
  assert.equal(empty.preferences.selectedState, null);
  assert.equal(empty.preferences.participationPath, null);
});

test("malformed or incompatible imports are rejected without a replacement value", () => {
  const result = validateImport({
    schemaVersion: 99,
    deals: [{ address: "untrusted" }],
  });

  assert.deepEqual(result, {
    ok: false,
    errors: [
      "This file uses schema version 99; Tradewind DealFlow supports version 1.",
      "The import is missing required top-level fields.",
    ],
  });
  assert.equal("data" in result, false);
});

test("imports reject malformed nested records before any browser data can be replaced", () => {
  const candidate = createEmptyData("2026-07-27T12:00:00.000Z") as unknown as Record<
    string,
    unknown
  >;
  candidate.preferences = {
    selectedState: "CT",
    participationPath: "principal",
  };
  candidate.analyses = [{ id: "analysis-with-missing-fields" }];
  candidate.curriculum = { "module-1": "complete" };
  candidate.compliance = {
    sellerWindow: {},
    assigneeWindow: {},
    outreachChecks: { consent: true },
    marketingChecks: { agreement: true },
  };

  const result = validateImport(candidate);

  assert.deepEqual(result, {
    ok: false,
    errors: [
      "Workspace preferences are malformed.",
      "One or more deal analyses are malformed.",
      "Curriculum progress is malformed.",
      "Compliance records are malformed.",
    ],
  });
  assert.equal("data" in result, false);
});

test("valid imports normalize whitespace and preserve only typed records", () => {
  const candidate = createEmptyData("2026-07-27T12:00:00.000Z");
  candidate.deals.push({
    id: "deal-1",
    createdAt: "2026-07-27T12:00:00.000Z",
    updatedAt: "2026-07-27T12:00:00.000Z",
    state: "MA",
    address: "  10 Harbor Way  ",
    city: "  Boston ",
    propertyType: "Single-family",
    source: "  Municipal assessor  ",
    ownerContactStatus: "Not researched",
    stage: "Research",
    nextAction: "",
    notes: "",
    askingPrice: 250000,
    rehabLevel: "Moderate",
    strategies: ["Assignment"],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
  });

  const result = validateImport(candidate);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected a valid import");
  assert.equal(result.data.deals[0]?.address, "10 Harbor Way");
  assert.equal(result.data.deals[0]?.city, "Boston");
  assert.equal(result.data.deals[0]?.source, "Municipal assessor");
});

test("business-day arithmetic excludes weekends and only verified holidays", () => {
  assert.equal(addBusinessDays("2026-07-02", 3, []), "2026-07-07");
  assert.equal(
    addBusinessDays("2026-07-02", 3, ["2026-07-03"]),
    "2026-07-08",
  );
});

test("Rhode Island cancellation result stays blocked without a verified holiday calendar", () => {
  assert.deepEqual(
    evaluateCancellationWindow({
      startDate: "2026-07-02",
      today: "2026-07-09",
      verifiedHolidays: [],
      holidayCalendarVerified: false,
      attorneyConfirmed: false,
    }),
    {
      endDate: "2026-07-07",
      isOpen: false,
      requiresAttorneyConfirmation: true,
      ready: false,
      reason:
        "The weekday-only date is tentative because no verified holiday calendar is recorded.",
    },
  );
});

test("Rhode Island cancellation result clears only after the verified window and confirmation", () => {
  assert.deepEqual(
    evaluateCancellationWindow({
      startDate: "2026-07-02",
      today: "2026-07-09",
      verifiedHolidays: ["2026-07-03"],
      holidayCalendarVerified: true,
      attorneyConfirmed: true,
    }),
    {
      endDate: "2026-07-08",
      isOpen: false,
      requiresAttorneyConfirmation: false,
      ready: true,
      reason: "The recorded three-business-day window has elapsed.",
    },
  );
});

test("Rhode Island marketing readiness fails while either cancellation window is unresolved", () => {
  const result = evaluateMarketingReadiness({
    state: "RI",
    participationPath: "principal",
    executedAgreement: true,
    equitableInterestRecorded: true,
    legalTitleDisclosureReady: true,
    attorneyReviewComplete: true,
    sellerWindowReady: true,
    assigneeWindowReady: false,
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, [
    "The assignee cancellation window must elapse and be confirmed.",
  ]);
});

const deal: DealRecord = {
  id: "deal-1",
  createdAt: "2026-07-27T12:00:00.000Z",
  updatedAt: "2026-07-27T12:00:00.000Z",
  state: "MA",
  address: "10 Harbor Way",
  city: "Boston",
  propertyType: "Single-family",
  source: "Municipal assessor",
  ownerContactStatus: "Not researched",
  stage: "Qualified",
  nextAction: "Verify title",
  notes: "",
  askingPrice: 250_000,
  rehabLevel: "Moderate",
  strategies: ["Assignment", "Rehab/resale"],
  executedAgreement: false,
  equitableInterestRecorded: false,
  legalTitleDisclosureReady: false,
  attorneyReviewComplete: false,
};

const buyer: BuyerRecord = {
  id: "buyer-1",
  createdAt: "2026-07-27T12:00:00.000Z",
  updatedAt: "2026-07-27T12:00:00.000Z",
  name: "User-entered buyer",
  company: "",
  email: "",
  phone: "",
  states: ["MA"],
  markets: ["Boston"],
  propertyTypes: ["Single-family"],
  minPrice: 100_000,
  maxPrice: 300_000,
  rehabTolerance: ["Light", "Moderate"],
  strategies: ["Assignment"],
  proofOfFundsStatus: "Verified",
  proofOfFundsExpiresAt: "2026-12-31",
  lastVerifiedAt: "2026-07-20",
};

test("buyer matching explains exact matches and conflicts without inventing activity", () => {
  assert.deepEqual(matchBuyer(deal, buyer, "2026-07-27"), {
    score: 100,
    reasons: [
      "State MA is in the buyer’s buy box.",
      "Boston is an exact market match.",
      "Single-family matches the buyer’s property types.",
      "$250,000 is inside the recorded price range.",
      "Moderate rehab is within tolerance.",
      "Assignment matches a recorded strategy.",
      "Proof of funds is recorded as verified and unexpired.",
      "Buyer verification is 7 days old.",
    ],
    conflicts: [],
  });
});

test("buyer matching surfaces criteria conflicts instead of hiding them", () => {
  const result = matchBuyer(
    { ...deal, state: "RI", askingPrice: 425_000, rehabLevel: "Heavy" },
    buyer,
    "2026-07-27",
  );

  assert.equal(result.score, 50);
  assert.deepEqual(result.conflicts, [
    "State RI is outside the recorded buy box.",
    "$425,000 is outside the recorded $100,000–$300,000 range.",
    "Heavy rehab exceeds the recorded tolerance.",
  ]);
});
