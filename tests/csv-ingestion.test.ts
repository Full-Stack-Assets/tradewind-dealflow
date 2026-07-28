import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CSV_BYTES,
  MAX_CSV_COLUMNS,
  MAX_CSV_DATA_ROWS,
  MAX_CSV_FIELD_LENGTH,
  MAX_CSV_TOTAL_CHARACTERS,
  decodeCsvFile,
  parseCsv,
} from "../lib/csv.ts";
import {
  applyLeadImportPlan,
  attachPossibleDuplicate,
  planLeadImport,
  resolveFactConflict,
  validateLeadCsv,
  type LeadImportCandidate,
} from "../lib/lead-ingestion.ts";
import { createEmptyData } from "../lib/import-export.ts";
import type { DealFlowData } from "../lib/types.ts";

const fixedNow = new Date("2026-07-28T12:00:00Z");
const requiredHeaders = [
  "source",
  "source_record_id",
  "retrieved_at",
  "state",
  "address",
  "city",
  "market",
  "usage_classification",
  "confidence",
  "last_verified_at",
];
const validRow = [
  "City Assessor",
  "001",
  "2026-07-20",
  "MA",
  "10 Harbor Way",
  "Boston",
  "Suffolk",
  "Public record",
  "Medium",
  "2026-07-21T10:30:00-04:00",
];

function validTable(extraHeaders: string[] = [], extraValues: string[] = []) {
  return [
    [...requiredHeaders, ...extraHeaders],
    [...validRow, ...extraValues],
  ];
}

function emptyWorkspace(revision = 0): DealFlowData {
  const data = createEmptyData("2026-07-27T12:00:00.000Z");
  data.revision = revision;
  return data;
}

function candidate(
  overrides: Partial<LeadImportCandidate> = {},
): LeadImportCandidate {
  return {
    source: "City Assessor",
    sourceRecordId: "001",
    retrievedAt: "2026-07-20T00:00:00.000Z",
    state: "MA",
    address: "10 Harbor Way",
    city: "Boston",
    market: "Suffolk",
    propertyType: "Single-family",
    askingPrice: 425_000,
    rehabLevel: "Moderate",
    ownerContactStatus: "Not researched",
    nextAction: "Verify title",
    notes: "Imported record",
    usageClassification: "Public record",
    confidence: "Medium",
    lastVerifiedAt: "2026-07-21T14:30:00.000Z",
    ...overrides,
  };
}

function importCandidates(
  data: DealFlowData,
  candidates: LeadImportCandidate[],
): DealFlowData {
  const result = applyLeadImportPlan(
    data,
    planLeadImport(data, candidates),
    fixedNow,
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected import application to succeed");
  return result.data;
}

test("CSV parser handles BOM, CRLF, escaped quotes, and quoted newlines", () => {
  const text = '\uFEFFsource,source_record_id,notes\r\n"City, Assessor",001,"Line 1\r\nLine ""2"""';
  const result = parseCsv(text);
  assert.deepEqual(result, {
    ok: true,
    rows: [
      ["source", "source_record_id", "notes"],
      ["City, Assessor", "001", 'Line 1\nLine "2"'],
    ],
  });
});

test("CSV parser rejects unclosed quotes and quotes in unquoted fields", () => {
  const unclosed = parseCsv('source\n"broken');
  assert.equal(unclosed.ok, false);
  if (!unclosed.ok) assert.match(unclosed.errors[0] ?? "", /unclosed quote/i);

  const misplaced = parseCsv('source\na"b');
  assert.equal(misplaced.ok, false);
  if (!misplaced.ok) assert.match(misplaced.errors[0] ?? "", /quote.*unquoted field/i);
});

test("CSV decoding rejects invalid UTF-8 and files over one MiB", () => {
  assert.throws(() => decodeCsvFile(new Uint8Array([0xc3, 0x28])), /UTF-8/i);
  assert.throws(
    () => decodeCsvFile(new Uint8Array(MAX_CSV_BYTES + 1)),
    /one MiB/i,
  );
});

test("CSV accepts at most one leading UTF-8 BOM from bytes or direct text", () => {
  const encoder = new TextEncoder();
  assert.equal(decodeCsvFile(encoder.encode("source")), "source");
  assert.equal(decodeCsvFile(encoder.encode("\uFEFFsource")), "source");
  assert.equal(parseCsv("source").ok, true);
  assert.equal(parseCsv("\uFEFFsource").ok, true);
  assert.throws(
    () => decodeCsvFile(encoder.encode("\uFEFF\uFEFFsource")),
    /BOM/i,
  );

  const direct = parseCsv("\uFEFF\uFEFFsource");
  assert.equal(direct.ok, false);
  if (!direct.ok) assert.match(direct.errors[0] ?? "", /BOM/i);
});

test("CSV parser enforces data row, column, field, and aggregate character limits", () => {
  const tooManyRows = Array.from({ length: MAX_CSV_DATA_ROWS + 2 }, (_, index) => String(index)).join("\n");
  const rows = parseCsv(tooManyRows);
  assert.equal(rows.ok, false);
  if (!rows.ok) assert.match(rows.errors[0] ?? "", /data rows/i);

  const columns = parseCsv(Array.from({ length: MAX_CSV_COLUMNS + 1 }, () => "field").join(","));
  assert.equal(columns.ok, false);
  if (!columns.ok) assert.match(columns.errors[0] ?? "", /columns/i);

  const field = parseCsv("x".repeat(MAX_CSV_FIELD_LENGTH + 1));
  assert.equal(field.ok, false);
  if (!field.ok) assert.match(field.errors[0] ?? "", /field.*length/i);

  const aggregate = parseCsv("x".repeat(MAX_CSV_TOTAL_CHARACTERS + 1));
  assert.equal(aggregate.ok, false);
  if (!aggregate.ok) assert.match(aggregate.errors[0] ?? "", /aggregate/i);
});

test("lead validation rejects protected, sensitive, duplicate, and unknown headers", () => {
  for (const header of ["race", "owner_phone", "owner phone number", "email"]) {
    const result = validateLeadCsv(
      [["source", "source_record_id", header], ["Assessor", "001", ""]],
      fixedNow,
    );
    assert.equal(result.ok, false, header);
    assert.match(result.errors[0] ?? "", /prohibited column/i);
  }

  const unknown = validateLeadCsv(
    [["source", "source_record_id", "stage"], ["Assessor", "001", ""]],
    fixedNow,
  );
  assert.equal(unknown.ok, false);
  assert.match(unknown.errors[0] ?? "", /unknown column/i);

  const duplicate = validateLeadCsv(validTable(["Source Record Id"], ["002"]), fixedNow);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.errors[0] ?? "", /duplicate column/i);
});

test("lead validation preserves leading-zero source IDs and normalizes dates", () => {
  const result = validateLeadCsv(validTable(), fixedNow);
  assert.equal(result.ok, true);
  assert.deepEqual(result.candidates, [{
    source: "City Assessor",
    sourceRecordId: "001",
    retrievedAt: "2026-07-20T00:00:00.000Z",
    state: "MA",
    address: "10 Harbor Way",
    city: "Boston",
    market: "Suffolk",
    propertyType: null,
    askingPrice: null,
    rehabLevel: null,
    ownerContactStatus: null,
    nextAction: null,
    notes: null,
    usageClassification: "Public record",
    confidence: "Medium",
    lastVerifiedAt: "2026-07-21T14:30:00.000Z",
  }]);
});

test("lead validation rejects impossible, timezone-less, and future dates", () => {
  for (const [column, value] of [
    ["retrieved_at", "2026-02-30"],
    ["last_verified_at", "2026-07-21T10:30:00"],
    ["retrieved_at", "2026-07-29"],
  ]) {
    const table = validTable();
    table[1][table[0].indexOf(column)] = value;
    const result = validateLeadCsv(table, fixedNow);
    assert.equal(result.ok, false, `${column}: ${value}`);
    assert.match(result.errors[0] ?? "", /date|future/i);
  }
});

test("lead validation rejects invalid enum values and negative asking prices", () => {
  for (const [column, value] of [
    ["state", "CT"],
    ["usage_classification", "MLS"],
    ["confidence", "Certain"],
  ]) {
    const table = validTable();
    table[1][table[0].indexOf(column)] = value;
    const result = validateLeadCsv(table, fixedNow);
    assert.equal(result.ok, false, `${column}: ${value}`);
    assert.match(result.errors[0] ?? "", /invalid/i);
  }

  const price = validateLeadCsv(validTable(["asking_price"], ["-1"]), fixedNow);
  assert.equal(price.ok, false);
  assert.match(price.errors[0] ?? "", /asking_price.*non-negative/i);
});

test("lead validation retains exact dollar-and-cents prices and rejects precision loss", () => {
  const valid = validateLeadCsv(validTable(["asking_price"], ["425000.50"]), fixedNow);
  assert.equal(valid.ok, true);
  assert.equal(valid.candidates[0]?.askingPrice, 425000.5);

  const unsafe = validateLeadCsv(validTable(["asking_price"], ["9007199254740993"]), fixedNow);
  assert.equal(unsafe.ok, false);
  assert.match(unsafe.errors[0] ?? "", /asking_price.*precision|asking_price.*safe/i);
});

test("lead validation accepts optional property facts when present", () => {
  const result = validateLeadCsv(
    validTable(
      ["property-type", "asking price", "rehab level", "owner_contact_status", "next_action", "notes"],
      ["Single-family", "425000", "Moderate", "", "Research ownership", "Imported record"],
    ),
    fixedNow,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.candidates[0] && {
    propertyType: result.candidates[0].propertyType,
    askingPrice: result.candidates[0].askingPrice,
    rehabLevel: result.candidates[0].rehabLevel,
    ownerContactStatus: result.candidates[0].ownerContactStatus,
    nextAction: result.candidates[0].nextAction,
    notes: result.candidates[0].notes,
  }, {
    propertyType: "Single-family",
    askingPrice: 425000,
    rehabLevel: "Moderate",
    ownerContactStatus: null,
    nextAction: "Research ownership",
    notes: "Imported record",
  });
});

test("reimport is idempotent and changed snapshots preserve canonical facts", () => {
  const first = importCandidates(
    emptyWorkspace(),
    [candidate({ address: "10 Harbor Way" })],
  );
  const duplicatePlan = planLeadImport(
    first,
    [candidate({ address: "10 Harbor Way" })],
  );
  assert.equal(duplicatePlan.exactReimports.length, 1);

  const changed = candidate({
    retrievedAt: "2026-07-28T00:00:00.000Z",
    lastVerifiedAt: "2026-07-28T00:00:00.000Z",
    address: "12 Harbor Way",
  });
  const changedPlan = planLeadImport(first, [changed]);
  const applied = applyLeadImportPlan(first, changedPlan, fixedNow);
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.data.deals[0]?.address, "10 Harbor Way");
  assert.equal(applied.data.deals[0]?.sourceAssertions.length, 2);
  assert.equal(applied.data.deals[0]?.factConflicts[0]?.field, "address");
});

test("stale plan and intra-file possible duplicates do not write", () => {
  const base = emptyWorkspace(4);
  const plan = planLeadImport(base, [
    candidate({ sourceRecordId: "1" }),
    candidate({ sourceRecordId: "2" }),
  ]);
  assert.equal(plan.newRows.length, 1);
  assert.equal(plan.possibleDuplicates.length, 1);
  assert.deepEqual(
    applyLeadImportPlan(emptyWorkspace(5), plan, fixedNow),
    {
      ok: false,
      error: "The workspace changed after preview. Review the file again.",
    },
  );

  const sameRevisionChanged = emptyWorkspace(4);
  sameRevisionChanged.preferences.selectedState = "RI";
  assert.deepEqual(
    applyLeadImportPlan(sameRevisionChanged, plan, fixedNow),
    {
      ok: false,
      error: "The workspace changed after preview. Review the file again.",
    },
  );
});

test("ambiguous source identities already attached to multiple deals are rejected", () => {
  const data = importCandidates(emptyWorkspace(), [candidate()]);
  const original = data.deals[0];
  assert.ok(original);
  data.deals.push({
    ...structuredClone(original),
    id: "second-deal",
    address: "99 Other Road",
  });

  const plan = planLeadImport(data, [
    candidate({
      retrievedAt: "2026-07-28T00:00:00.000Z",
      lastVerifiedAt: "2026-07-28T00:00:00.000Z",
    }),
  ]);

  assert.equal(plan.changedSourceRows.length, 0);
  assert.equal(plan.rejected.length, 1);
  assert.match(plan.rejected[0]?.reason ?? "", /multiple existing deals/i);
  const applied = applyLeadImportPlan(data, plan, fixedNow);
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.data.deals[0]?.sourceAssertions.length, 1);
  assert.equal(applied.data.deals[1]?.sourceAssertions.length, 1);
});

test("historical fingerprints stay idempotent while verification-only refreshes are retained", () => {
  const original = candidate();
  const first = importCandidates(emptyWorkspace(), [original]);
  const refreshed = candidate({
    lastVerifiedAt: "2026-07-28T00:00:00.000Z",
  });
  const second = importCandidates(first, [refreshed]);
  assert.equal(second.deals[0]?.sourceAssertions.length, 2);
  assert.equal(second.deals[0]?.factConflicts.length, 0);

  const historicalPlan = planLeadImport(second, [original]);
  assert.equal(historicalPlan.exactReimports.length, 1);
  const historicalApplied = applyLeadImportPlan(
    second,
    historicalPlan,
    fixedNow,
  );
  assert.equal(historicalApplied.ok, true);
  if (!historicalApplied.ok) return;
  assert.equal(historicalApplied.data.deals[0]?.sourceAssertions.length, 2);
});

test("possible duplicates require explicit attachment to a listed existing deal", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const possible = candidate({
    source: "County Records",
    sourceRecordId: "county-1",
    address: "  10 Harbor Way. ",
    city: "BOSTON",
  });
  const plan = planLeadImport(first, [possible]);
  assert.equal(plan.possibleDuplicates.length, 1);
  assert.deepEqual(plan.possibleDuplicates[0]?.matchingDealIds, [
    first.deals[0]?.id,
  ]);
  assert.throws(
    () => attachPossibleDuplicate(plan, 2, "not-a-listed-deal"),
    /listed existing deal/i,
  );

  const attached = attachPossibleDuplicate(
    plan,
    2,
    first.deals[0]?.id ?? "",
  );
  assert.equal(attached.possibleDuplicates.length, 0);
  assert.equal(attached.attachments.length, 1);
  const applied = applyLeadImportPlan(first, attached, fixedNow);
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.data.deals.length, 1);
  assert.equal(applied.data.deals[0]?.address, "10 Harbor Way");
  assert.equal(applied.data.deals[0]?.sourceAssertions.length, 2);

  const unitPlan = planLeadImport(first, [
    candidate({
      source: "County Records",
      sourceRecordId: "county-unit-2",
      address: "10 Harbor Way Unit 2",
    }),
  ]);
  assert.equal(unitPlan.possibleDuplicates.length, 0);
  assert.equal(unitPlan.newRows.length, 1);
});

test("source identity normalization collapses internal whitespace", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const plan = planLeadImport(first, [
    candidate({
      source: "CITY   ASSESSOR",
      sourceRecordId: "  001  ",
      lastVerifiedAt: "2026-07-28T00:00:00.000Z",
    }),
  ]);

  assert.equal(plan.changedSourceRows.length, 1);
  assert.equal(plan.newRows.length, 0);
});

test("property matching collapses internal whitespace conservatively", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const plan = planLeadImport(first, [
    candidate({
      source: "County Records",
      sourceRecordId: "county-space",
      address: "10   Harbor   Way",
    }),
  ]);

  assert.equal(plan.possibleDuplicates.length, 1);
  assert.equal(plan.newRows.length, 0);
});

test("cumulative source matches are categorized safely without operator handling", () => {
  const plan = planLeadImport(emptyWorkspace(), [
    candidate({ sourceRecordId: "new-identity" }),
    candidate({
      sourceRecordId: " NEW-IDENTITY ",
      source: "city assessor",
      lastVerifiedAt: "2026-07-28T00:00:00.000Z",
    }),
  ]);
  assert.equal(plan.newRows.length, 1);
  assert.equal(plan.changedSourceRows.length, 1);
  assert.equal(plan.possibleDuplicates.length, 0);

  const applied = applyLeadImportPlan(emptyWorkspace(), plan, fixedNow);
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.data.deals.length, 1);
  assert.equal(applied.data.deals[0]?.sourceAssertions.length, 2);
});

test("restricted assertions create related holds and new deals enter only Research", () => {
  const data = importCandidates(emptyWorkspace(), [
    candidate({
      propertyType: null,
      nextAction: null,
      usageClassification: "Restricted — research only",
    }),
  ]);
  const deal = data.deals[0];
  assert.ok(deal);
  assert.equal(deal.stage, "Research");
  assert.match(deal.nextAction, /research/i);
  assert.equal(deal.executedAgreement, false);
  assert.equal(deal.equitableInterestRecorded, false);
  assert.equal(deal.legalTitleDisclosureReady, false);
  assert.equal(deal.attorneyReviewComplete, false);
  assert.equal(deal.propertyType, "");
  assert.equal(deal.researchRestrictions.length, 1);
  assert.equal(deal.researchRestrictions[0]?.code, "Source restricted");
  assert.equal(
    deal.researchRestrictions[0]?.sourceAssertionId,
    deal.sourceAssertions[0]?.id,
  );
  assert.equal(deal.researchRestrictions[0]?.source, "Source assertion");
});

test("repeated disagreements retain assertions without duplicating fact conflicts", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const changed = importCandidates(first, [
    candidate({
      address: "12 Harbor Way",
      lastVerifiedAt: "2026-07-27T00:00:00.000Z",
    }),
  ]);
  const refreshed = importCandidates(changed, [
    candidate({
      address: "12 Harbor Way",
      lastVerifiedAt: "2026-07-28T00:00:00.000Z",
    }),
  ]);

  assert.equal(refreshed.deals[0]?.sourceAssertions.length, 3);
  assert.equal(refreshed.deals[0]?.factConflicts.length, 1);
  assert.equal(refreshed.deals[0]?.factConflicts[0]?.field, "address");
});

test("conflict resolution preserves assertions and validates typed asserted values", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const changed = importCandidates(first, [
    candidate({
      address: "12 Harbor Way",
      lastVerifiedAt: "2026-07-28T00:00:00.000Z",
    }),
  ]);
  const deal = changed.deals[0];
  const conflict = deal?.factConflicts[0];
  assert.ok(deal);
  assert.ok(conflict);
  const assertionsBefore = structuredClone(deal.sourceAssertions);

  assert.throws(
    () => resolveFactConflict(
      changed,
      deal.id,
      conflict.id,
      "Asserted",
      " ",
      fixedNow,
    ),
    /basis/i,
  );

  const malformed = structuredClone(changed);
  const malformedConflict = malformed.deals[0]?.factConflicts[0];
  assert.ok(malformedConflict);
  malformedConflict.assertedValue = 12;
  assert.throws(
    () => resolveFactConflict(
      malformed,
      deal.id,
      malformedConflict.id,
      "Asserted",
      "Reviewed source",
      fixedNow,
    ),
    /valid value/i,
  );

  const resolved = resolveFactConflict(
    changed,
    deal.id,
    conflict.id,
    "Asserted",
    "Verified against the recorded source",
    fixedNow,
  );
  const resolvedDeal = resolved.deals[0];
  assert.equal(resolvedDeal?.address, "12 Harbor Way");
  assert.deepEqual(resolvedDeal?.sourceAssertions, assertionsBefore);
  assert.equal(resolvedDeal?.factConflicts[0]?.status, "Resolved");
  assert.deepEqual(resolvedDeal?.factConflicts[0]?.resolution, {
    selectedSide: "Asserted",
    basis: "Verified against the recorded source",
    resolvedAt: "2026-07-28T12:00:00.000Z",
  });
});
