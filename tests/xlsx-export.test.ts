import assert from "node:assert/strict";
import test from "node:test";
import { serializePipelineXlsx } from "../lib/xlsx.ts";
import type { DealRecord } from "../lib/types.ts";

const deal = {
  id: "deal-1",
  createdAt: "2026-08-06T12:00:00.000Z",
  updatedAt: "2026-08-06T12:00:00.000Z",
  state: "MA",
  address: "1 Main Street",
  city: "Fall River",
  zip: "02720",
  market: "Bristol County",
  propertyType: "Single-family",
  source: "MassGIS",
  ownerContactStatus: "=HYPERLINK(\"https://unsafe.example\")",
  stage: "Research",
  nextAction: "Verify ownership",
  notes: "=1+1",
  askingPrice: 100000,
  rehabLevel: null,
  sourceAssertions: [],
  factConflicts: [],
  researchRestrictions: [],
  strategies: [],
  executedAgreement: false,
  equitableInterestRecorded: false,
  legalTitleDisclosureReady: false,
  attorneyReviewComplete: false,
} as DealRecord;

test("XLSX export is a valid stored ZIP with the owner/contact-safe export allowlist", () => {
  const bytes = serializePipelineXlsx([deal]);
  const text = new TextDecoder().decode(bytes);
  assert.equal(String.fromCharCode(...bytes.slice(0, 2)), "PK");
  assert.match(text, /xl\/worksheets\/sheet1\.xml/);
  assert.match(text, /Property address/);
  assert.match(text, /&apos;=HYPERLINK/);
  assert.match(text, /&apos;=1\+1/);
  assert.doesNotMatch(text, /sellerPhone|email|phoneNumber/);
});

test("empty XLSX export still contains workbook parts", () => {
  const bytes = serializePipelineXlsx([]);
  const text = new TextDecoder().decode(bytes);
  assert.equal(String.fromCharCode(...bytes.slice(0, 2)), "PK");
  assert.match(text, /xl\/workbook\.xml/);
  assert.match(text, /State/);
});
