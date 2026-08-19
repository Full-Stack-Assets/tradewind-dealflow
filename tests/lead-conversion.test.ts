import assert from "node:assert/strict";
import test from "node:test";

import {
  convertAutomatedLeadToDeal,
  findExistingPromotedDeal,
  promotedDealId,
  type PromotableLead,
} from "../lib/lead-conversion.ts";

function sampleLead(overrides: Partial<PromotableLead> = {}): PromotableLead {
  return {
    id: "lead_1",
    source: {
      identity: "massgis:fall-river",
      recordId: "95-101",
      retrievedAt: "2026-08-06T12:00:00.000Z",
    },
    provider: "massgis",
    providerPropertyId: "95-101",
    address: "10 Harbor Way",
    city: "Fall River",
    state: "MA",
    zip: "02720",
    estimatedValue: 425000,
    ownerNames: [],
    ownerType: null,
    ownerOccupied: null,
    enrichmentStatus: "pending",
    ...overrides,
  };
}

test("conversion maps MassGIS identity into a Research deal without inventing asking price", () => {
  const now = new Date("2026-08-18T15:00:00.000Z");
  const result = convertAutomatedLeadToDeal(sampleLead(), now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reused, false);
  assert.equal(result.deal.stage, "Research");
  assert.equal(result.deal.askingPrice, null);
  assert.equal(result.deal.market, "Bristol County");
  assert.equal(result.deal.state, "MA");
  assert.equal(result.deal.id, promotedDealId(sampleLead()));
  assert.equal(result.deal.sourceAssertions[0]?.source, "massgis:fall-river");
  assert.equal(result.deal.sourceAssertions[0]?.sourceRecordId, "95-101");
  assert.equal(result.deal.sourceAssertions[0]?.usageClassification, "Public record");
  assert.equal(result.deal.sourceAssertions[0]?.confidence, "Medium");
  assert.equal(result.deal.ownerContactStatus, "Not researched");
  assert.doesNotMatch(result.deal.notes, /425000|owner/i);
});

test("conversion records licensed-provider provenance only when owner names were actually supplied", () => {
  const withOwner = convertAutomatedLeadToDeal(
    sampleLead({
      provider: "rentcast",
      ownerNames: ["Example Owner"],
      enrichmentStatus: "available",
      providerPropertyId: "rc-1",
    }),
    new Date("2026-08-18T15:00:00.000Z"),
  );
  assert.equal(withOwner.ok, true);
  if (!withOwner.ok) return;
  assert.equal(withOwner.deal.ownerContactStatus, "Owner recorded — contact not authorized");
  assert.equal(withOwner.deal.sourceAssertions.length, 2);
  assert.equal(withOwner.deal.sourceAssertions[1]?.source, "rentcast");
  assert.equal(withOwner.deal.sourceAssertions[1]?.usageClassification, "Licensed provider");
  assert.equal(withOwner.deal.sourceAssertions[1]?.confidence, "High");
  assert.doesNotMatch(JSON.stringify(withOwner.deal), /Example Owner|mailing/i);

  const withoutOwner = convertAutomatedLeadToDeal(sampleLead(), new Date("2026-08-18T15:00:00.000Z"));
  assert.equal(withoutOwner.ok, true);
  if (!withoutOwner.ok) return;
  assert.equal(withoutOwner.deal.sourceAssertions.length, 1);
});

test("conversion is idempotent for the same source identity and record id", () => {
  const now = new Date("2026-08-18T15:00:00.000Z");
  const first = convertAutomatedLeadToDeal(sampleLead(), now);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = convertAutomatedLeadToDeal(sampleLead(), new Date("2026-08-19T15:00:00.000Z"), [first.deal]);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.reused, true);
  assert.equal(second.deal.id, first.deal.id);
  assert.equal(second.deal.createdAt, first.deal.createdAt);
  assert.equal(findExistingPromotedDeal([first.deal], sampleLead())?.id, first.deal.id);
});

test("conversion rejects non-launch states and missing provenance", () => {
  const now = new Date("2026-08-18T15:00:00.000Z");
  assert.equal(convertAutomatedLeadToDeal(sampleLead({ state: "NY" }), now).ok, false);
  assert.equal(convertAutomatedLeadToDeal(sampleLead({ address: "  " }), now).ok, false);
  assert.equal(
    convertAutomatedLeadToDeal(
      sampleLead({ source: { identity: "massgis:fall-river", recordId: "95-101", retrievedAt: "not-a-date" } }),
      now,
    ).ok,
    false,
  );
});
