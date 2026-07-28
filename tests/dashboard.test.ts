import assert from "node:assert/strict";
import test from "node:test";

import { buildLeadOperatingSnapshot } from "../lib/dashboard.ts";
import { createEmptyData } from "../lib/import-export.ts";
import type {
  DealFlowData,
  DealRecord,
  ResearchRestriction,
  SourceAssertion,
} from "../lib/types.ts";

const NOW = new Date("2026-07-28T12:00:00.000Z");

function sourceAssertion(
  overrides: Partial<SourceAssertion> = {},
): SourceAssertion {
  return {
    id: "assertion-1",
    source: "Authorized test source",
    sourceRecordId: "001",
    retrievedAt: "2026-07-27",
    usageClassification: "Public record",
    confidence: "High",
    lastVerifiedAt: "2026-07-27",
    importedAt: "2026-07-28T10:00:00.000Z",
    fingerprint: "fixture-fingerprint",
    facts: {
      state: "MA",
      address: "10 Test Harbor Way",
      city: "Fall River",
      zip: "02720",
      market: "Bristol County",
      propertyType: "Single-family homes",
      askingPrice: 200_000,
      rehabLevel: "Light",
      ownerContactStatus: "Not researched",
      nextAction: "",
      notes: "",
    },
    ...overrides,
  };
}

function restriction(
  code: ResearchRestriction["code"],
): ResearchRestriction {
  return {
    id: `restriction-${code}`,
    code,
    source: "System",
    sourceAssertionId: null,
    reason: `${code} test evidence`,
    createdAt: "2026-07-28T10:00:00.000Z",
    resolvedAt: null,
    resolutionNote: "",
  };
}

function deal(
  id: string,
  overrides: Partial<DealRecord> = {},
): DealRecord {
  const assertion = sourceAssertion({
    id: `assertion-${id}`,
    sourceRecordId: id,
  });
  return {
    id,
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    state: "MA",
    address: `${id} Test Harbor Way`,
    city: "Fall River",
    zip: "02720",
    market: "Bristol County",
    propertyType: "Single-family homes",
    source: assertion.source,
    ownerContactStatus: "Not researched",
    stage: "Research",
    nextAction: "",
    notes: "",
    askingPrice: 200_000,
    rehabLevel: "Light",
    sourceAssertions: [assertion],
    factConflicts: [],
    researchRestrictions: [],
    strategies: ["Direct acquisition"],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
    ...overrides,
  };
}

function workspace(deals: DealRecord[]): DealFlowData {
  return { ...createEmptyData(NOW.toISOString()), deals };
}

test("empty snapshot keeps factual counts at zero and has no invented priority", () => {
  const snapshot = buildLeadOperatingSnapshot(workspace([]), NOW);

  assert.equal(snapshot.buyBox.configured, true);
  assert.equal(snapshot.buyBox.version, 1);
  assert.equal(snapshot.propertyRecordCount, 0);
  assert.equal(snapshot.importedPropertyCount, 0);
  assert.deepEqual(snapshot.qualificationCounts, {
    Qualified: 0,
    Possible: 0,
    "Research required": 0,
    Disqualified: 0,
    "Compliance or specialist review": 0,
  });
  assert.deepEqual(snapshot.researchItems, []);
  assert.equal(snapshot.blocked.contactBlockedRecords, 0);
});

test("snapshot separates missing provenance, conflicts, restrictions, and blocks", () => {
  const unknown = deal("unknown", {
    sourceAssertions: [],
    factConflicts: [
      {
        id: "conflict-1",
        field: "city",
        canonicalValue: "Fall River",
        assertedValue: "New Bedford",
        sourceAssertionId: "assertion-missing",
        detectedAt: "2026-07-28T10:00:00.000Z",
        status: "Unresolved",
        resolution: null,
      },
    ],
  });
  const restricted = deal("restricted", {
    researchRestrictions: [restriction("Source restricted")],
  });

  const snapshot = buildLeadOperatingSnapshot(
    workspace([unknown, restricted]),
    NOW,
  );

  assert.equal(snapshot.propertyRecordCount, 2);
  assert.equal(snapshot.importedPropertyCount, 1);
  assert.equal(snapshot.dataGaps.missingProvenanceRecords, 1);
  assert.equal(snapshot.dataGaps.unknownConfidenceRecords, 1);
  assert.equal(snapshot.dataGaps.missingVerificationRecords, 1);
  assert.equal(snapshot.integrity.unresolvedConflicts, 1);
  assert.equal(snapshot.integrity.activeRestrictions, 1);
  assert.equal(snapshot.blocked.contactBlockedRecords, 2);
  assert.equal(snapshot.blocked.complianceReviewRecords, 1);
  assert.equal(snapshot.integrity.recordsNeedingRemediation, 2);
});

test("research items retain the Task 5 priority order and exact task reason", () => {
  const ordinary = deal("ordinary");
  const critical = deal("critical", {
    researchRestrictions: [restriction("Ownership stale")],
  });

  const snapshot = buildLeadOperatingSnapshot(
    workspace([ordinary, critical]),
    NOW,
  );

  assert.equal(snapshot.researchItems[0]?.dealId, "critical");
  assert.equal(snapshot.researchItems[0]?.priorityLabel, "Critical");
  assert.match(
    snapshot.researchItems[0]?.reason ?? "",
    /legal, identity, rights, or restriction risk/i,
  );
  assert.equal(
    snapshot.researchItems[0]?.href,
    "/pipeline#property-critical",
  );
  assert.equal(
    snapshot.researchItems[0]?.priorityScore,
    95,
  );
  assert.equal(snapshot.researchItems[0]?.qualificationScoreLabel, "Preliminary score");
});

test("snapshot counts explicitly missing confidence and verification dates", () => {
  const incomplete = deal("incomplete", {
    sourceAssertions: [
      sourceAssertion({
        id: "assertion-incomplete",
        sourceRecordId: "incomplete",
        confidence: null,
        lastVerifiedAt: null,
      }),
    ],
  });

  const snapshot = buildLeadOperatingSnapshot(workspace([incomplete]), NOW);

  assert.equal(snapshot.dataGaps.unknownConfidenceRecords, 1);
  assert.equal(snapshot.dataGaps.missingVerificationRecords, 1);
});
