import assert from "node:assert/strict";
import test from "node:test";

import {
  isLegacyDealState,
  mapLegacyStage,
  normalizeLegacyPropertyType,
  parseLegacyMoney,
} from "../lib/migration/legacy-contracts.ts";

test("maps every legacy state without skipping lifecycle meaning", () => {
  assert.deepEqual(
    ["LEAD", "UNDERWRITTEN", "OFFER_SENT", "UNDER_CONTRACT", "ASSIGNED", "CLOSED", "DEAD"]
      .map((state) => mapLegacyStage(state as Parameters<typeof mapLegacyStage>[0])),
    ["Research", "Qualified", "Offer", "Contract", "Closing", "Closed", "Archived"],
  );
});

test("money parsing rejects negative, non-finite, and ambiguous values", () => {
  assert.equal(parseLegacyMoney("$125,000"), 125000);
  assert.equal(parseLegacyMoney(""), null);
  assert.equal(parseLegacyMoney(-1), null);
  assert.equal(parseLegacyMoney(Number.POSITIVE_INFINITY), null);
  assert.equal(parseLegacyMoney("unknown"), null);
});

test("normalizes only supported launch property types", () => {
  assert.equal(normalizeLegacyPropertyType("SFH"), "Single-family homes");
  assert.equal(normalizeLegacyPropertyType("2 family"), "Duplexes");
  assert.equal(normalizeLegacyPropertyType("3-FAMILY"), "Triplexes");
  assert.equal(normalizeLegacyPropertyType("4 unit"), "Four-unit residential");
  assert.equal(normalizeLegacyPropertyType("commercial"), "Unsupported: commercial");
});

test("unknown lifecycle states fail the exhaustive guard", () => {
  assert.equal(isLegacyDealState("LEAD"), true);
  assert.equal(isLegacyDealState("NEGOTIATING"), false);
});
