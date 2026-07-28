import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyData,
  LOCAL_DATA_KEY,
  serializePipelineCsv,
  validateImport,
} from "../lib/import-export.ts";

function makeVersionOneWorkspace(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    updatedAt: "2026-07-27T12:00:00.000Z",
    preferences: { selectedState: null, participationPath: null },
    deals: [],
    buyers: [],
    analyses: [],
    curriculum: {},
    weekProgress: {},
    readinessChecks: {},
    compliance: {
      sellerWindow: {
        startDate: "",
        verifiedHolidays: [],
        holidayCalendarVerified: false,
        attorneyConfirmed: false,
      },
      assigneeWindow: {
        startDate: "",
        verifiedHolidays: [],
        holidayCalendarVerified: false,
        attorneyConfirmed: false,
      },
      outreachChecks: {},
      marketingChecks: {},
    },
    dealDeskDraft: {
      dealId: "",
      submitterName: "",
      submitterEmail: "",
      summary: "",
      requestedStructure: "",
      qualificationChecks: {},
      consentToReview: false,
    },
  };
}

function makeVersionOneDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: "legacy-deal",
    createdAt: "2026-07-27T12:00:00.000Z",
    updatedAt: "2026-07-27T12:00:00.000Z",
    state: "MA",
    address: "10 Harbor Way",
    city: "Boston",
    propertyType: "Single-family",
    source: "Municipal assessor",
    ownerContactStatus: "Not researched",
    stage: "Research",
    nextAction: "Verify title",
    notes: "",
    askingPrice: 250_000,
    rehabLevel: "Light",
    strategies: ["Assignment"],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
    ...overrides,
  };
}

test("v1 migration preserves DNC and never invents provenance", () => {
  const v1 = makeVersionOneWorkspace();
  (v1.deals as unknown[]).push(makeVersionOneDeal({
    ownerContactStatus: "Do not contact",
    rehabLevel: "Moderate",
  }));

  const result = validateImport(v1, new Date("2026-07-28T12:00:00Z"));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.schemaVersion, 2);
  assert.equal(result.data.deals[0]?.rehabLevel, "Moderate");
  assert.deepEqual(result.data.deals[0]?.sourceAssertions, []);
  assert.equal(
    result.data.deals[0]?.researchRestrictions[0]?.code,
    "Do not contact",
  );
  assert.equal(
    result.data.deals[0]?.researchRestrictions[0]?.createdAt,
    "2026-07-27T12:00:00.000Z",
  );
});

test("the shipped local key remains readable until the storage migration ships", () => {
  assert.equal(LOCAL_DATA_KEY, "tradewind-dealflow:v1");
});

test("v2 validation strips no unknown data and rejects it instead", () => {
  const candidate = { ...createEmptyData(), unexpected: "not allowed" };
  const result = validateImport(candidate);
  assert.deepEqual(result, {
    ok: false,
    errors: ["The workspace contains unsupported top-level fields: unexpected."],
  });
});

test("pipeline CSV neutralizes spreadsheet formulas", () => {
  const data = createEmptyData();
  data.deals.push({
    id: "formula-deal",
    createdAt: "2026-07-27T12:00:00.000Z",
    updatedAt: "2026-07-27T12:00:00.000Z",
    state: "MA",
    address: '=HYPERLINK("bad")',
    city: "Boston",
    market: "Boston",
    propertyType: "Single-family",
    source: "Municipal assessor",
    ownerContactStatus: "Not researched",
    stage: "Research",
    nextAction: "Verify title",
    notes: "",
    askingPrice: null,
    rehabLevel: null,
    sourceAssertions: [],
    factConflicts: [],
    researchRestrictions: [],
    strategies: [],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
  });
  assert.match(serializePipelineCsv(data.deals), /'=/);
});
