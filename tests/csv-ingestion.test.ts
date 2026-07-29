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
  readCurrentCsvFile,
} from "../lib/csv.ts";
import {
  applyLeadImportPlan,
  attachPossibleDuplicate,
  holdPossibleDuplicate,
  leadImportControlState,
  planLeadImport,
  previewPlanFactConflicts,
  resolveFactConflict,
  resolveResearchRestriction,
  validateLeadCsv,
  type LeadImportCandidate,
} from "../lib/lead-ingestion.ts";
import {
  createEmptyData,
  serializeData,
  validateImport,
} from "../lib/import-export.ts";
import type { DealFlowData } from "../lib/types.ts";

const fixedNow = new Date("2026-07-28T12:00:00Z");
const requiredHeaders = [
  "source",
  "source_record_id",
  "retrieved_date",
  "state",
  "property_address",
  "city",
  "zip",
  "usage_rights",
  "market",
  "confidence",
  "verification_date",
];
const validRow = [
  "City Assessor",
  "001",
  "2026-07-20",
  "MA",
  "10 Harbor Way",
  "Boston",
  "02110",
  "Public record",
  "Suffolk",
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
    zip: "02110",
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

test("a slower older CSV read is ignored after a newer selection", async () => {
  let resolveRead: ((value: ArrayBuffer) => void) | undefined;
  let currentSelection = 1;
  const olderRead = readCurrentCsvFile(
    {
      arrayBuffer: () =>
        new Promise<ArrayBuffer>((resolve) => {
          resolveRead = resolve;
        }),
    },
    () => currentSelection === 1,
  );

  currentSelection = 2;
  assert.ok(resolveRead);
  resolveRead(new Uint8Array([1, 2, 3]).buffer);

  assert.equal(await olderRead, null);
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

  const aliasDuplicate = validateLeadCsv(
    validTable(["retrieved_at"], ["2026-07-20"]),
    fixedNow,
  );
  assert.equal(aliasDuplicate.ok, false);
  assert.match(aliasDuplicate.errors[0] ?? "", /duplicate column/i);
});

test("launch header aliases preserve leading-zero source IDs, ZIP, and normalized dates", () => {
  const result = validateLeadCsv(validTable(), fixedNow);
  assert.equal(result.ok, true);
  assert.deepEqual(result.candidates, [{
    source: "City Assessor",
    sourceRecordId: "001",
    retrievedAt: "2026-07-20T00:00:00.000Z",
    state: "MA",
    address: "10 Harbor Way",
    city: "Boston",
    zip: "02110",
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

test("minimal launch rows keep optional market, confidence, and verification unknown", () => {
  const result = validateLeadCsv(
    [[
      "source",
      "source_record_id",
      "retrieved_date",
      "usage_rights",
      "property_address",
      "city",
      "state",
      "zip",
    ], [
      "City Assessor",
      "0007",
      "2026-07-20",
      "Public record",
      "18 Bay Street",
      "Fall River",
      "MA",
      "02720",
    ]],
    fixedNow,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.candidates[0], {
    source: "City Assessor",
    sourceRecordId: "0007",
    retrievedAt: "2026-07-20T00:00:00.000Z",
    state: "MA",
    address: "18 Bay Street",
    city: "Fall River",
    zip: "02720",
    market: "",
    propertyType: null,
    askingPrice: null,
    rehabLevel: null,
    ownerContactStatus: null,
    nextAction: null,
    notes: null,
    usageClassification: "Public record",
    confidence: null,
    lastVerifiedAt: null,
  });
});

test("canonical intake header aliases remain accepted while ZIP stays required", () => {
  const canonical = validateLeadCsv(
    [[
      "source",
      "source_record_id",
      "retrieved_at",
      "usage_classification",
      "address",
      "city",
      "state",
      "zip",
    ], [
      "Authorized list",
      "001",
      "2026-07-20",
      "Authorized CRM",
      "10 Harbor Way",
      "Boston",
      "MA",
      "02110",
    ]],
    fixedNow,
  );
  assert.equal(canonical.ok, true);

  const missingZip = validateLeadCsv(
    [[
      "source",
      "source_record_id",
      "retrieved_date",
      "usage_rights",
      "property_address",
      "city",
      "state",
    ], [
      "Authorized list",
      "001",
      "2026-07-20",
      "Authorized CRM",
      "10 Harbor Way",
      "Boston",
      "MA",
    ]],
    fixedNow,
  );
  assert.equal(missingZip.ok, false);
  assert.match(missingZip.errors[0] ?? "", /missing required column: zip/i);
});

test("lead validation rejects impossible, timezone-less, and future dates", () => {
  for (const [column, value] of [
    ["retrieved_date", "2026-02-30"],
    ["verification_date", "2026-07-21T10:30:00"],
    ["retrieved_date", "2026-07-29"],
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
    ["usage_rights", "MLS"],
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

test("estimated value is not silently reinterpreted as asking price", () => {
  const result = validateLeadCsv(
    validTable(["estimated_value"], ["425000"]),
    fixedNow,
  );
  assert.equal(result.ok, false);
  assert.match(result.errors[0] ?? "", /unknown column: estimated_value/i);
});

test("ZIP and unknown verification metadata survive serialization, restore, and exact reimport", () => {
  const minimal = candidate({
    sourceRecordId: "zip-round-trip",
    zip: "02720",
    market: "",
    confidence: null,
    lastVerifiedAt: null,
  });
  const imported = importCandidates(emptyWorkspace(), [minimal]);
  const restored = validateImport(JSON.parse(serializeData(imported)), fixedNow);

  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.equal(restored.data.deals[0]?.zip, "02720");
  assert.equal(restored.data.deals[0]?.sourceAssertions[0]?.facts.zip, "02720");
  assert.equal(restored.data.deals[0]?.sourceAssertions[0]?.confidence, null);
  assert.equal(restored.data.deals[0]?.sourceAssertions[0]?.lastVerifiedAt, null);
  const reimport = planLeadImport(restored.data, [minimal]);
  assert.equal(reimport.exactReimports.length, 1);
  assert.equal(reimport.changedSourceRows.length, 0);
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

test("unknown optional facts in a new snapshot do not contradict known canonical facts", () => {
  const first = importCandidates(
    emptyWorkspace(),
    [candidate({ propertyType: "Single-family", market: "Bristol County" })],
  );
  const changed = candidate({
    retrievedAt: "2026-07-28T00:00:00.000Z",
    lastVerifiedAt: null,
    propertyType: null,
    market: "",
  });
  const applied = applyLeadImportPlan(
    first,
    planLeadImport(first, [changed]),
    fixedNow,
  );

  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.data.deals[0]?.sourceAssertions.length, 2);
  assert.equal(applied.data.deals[0]?.factConflicts.length, 0);
  assert.equal(applied.data.deals[0]?.propertyType, "Single-family");
  assert.equal(applied.data.deals[0]?.market, "Bristol County");
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

test("an exact duplicate within one selected file has its own preview category", () => {
  const repeated = candidate({ sourceRecordId: "same-file-exact" });
  const plan = planLeadImport(emptyWorkspace(), [repeated, repeated]);

  assert.equal(plan.newRows.length, 1);
  assert.equal(plan.sameFileDuplicates.length, 1);
  assert.equal(plan.exactReimports.length, 0);
  assert.equal(plan.sameFileDuplicates[0]?.rowNumber, 3);
});

test("CSV preview remains available without Web Locks while apply stays disabled", () => {
  const plan = planLeadImport(emptyWorkspace(), [
    candidate({ sourceRecordId: "read-only-preview" }),
  ]);
  const controls = leadImportControlState({
    plan,
    currentRevision: 0,
    writesSupported: false,
    storageCorrupt: false,
  });

  assert.equal(controls.canSelectFile, true);
  assert.equal(controls.canApply, false);
});

test("same-file fingerprints take precedence after a historical exact reimport", () => {
  const original = candidate({ sourceRecordId: "historical-repeat" });
  const imported = importCandidates(emptyWorkspace(), [original]);
  const plan = planLeadImport(imported, [original, original]);

  assert.equal(plan.exactReimports.length, 1);
  assert.equal(plan.exactReimports[0]?.rowNumber, 2);
  assert.equal(plan.sameFileDuplicates.length, 1);
  assert.equal(plan.sameFileDuplicates[0]?.rowNumber, 3);
});

test("same-file fingerprints take precedence after a changed source snapshot", () => {
  const original = candidate({ sourceRecordId: "changed-repeat" });
  const imported = importCandidates(emptyWorkspace(), [original]);
  const changed = candidate({
    sourceRecordId: "changed-repeat",
    retrievedAt: "2026-07-28T00:00:00.000Z",
    lastVerifiedAt: "2026-07-28T00:00:00.000Z",
    address: "12 Harbor Way",
  });
  const plan = planLeadImport(imported, [changed, changed]);

  assert.equal(plan.changedSourceRows.length, 1);
  assert.equal(plan.changedSourceRows[0]?.rowNumber, 2);
  assert.equal(plan.exactReimports.length, 0);
  assert.equal(plan.sameFileDuplicates.length, 1);
  assert.equal(plan.sameFileDuplicates[0]?.rowNumber, 3);
});

test("previewed fact conflicts exactly match conflicts preserved on apply", () => {
  const imported = importCandidates(
    emptyWorkspace(),
    [
      candidate({
        sourceRecordId: "conflict-preview",
        market: "Bristol County",
        propertyType: "Single-family",
      }),
    ],
  );
  const changed = candidate({
    sourceRecordId: "conflict-preview",
    retrievedAt: "2026-07-28T00:00:00.000Z",
    lastVerifiedAt: null,
    address: "12 Harbor Way",
    market: "",
    propertyType: null,
    usageClassification: "Restricted — research only",
  });
  const plan = planLeadImport(imported, [changed]);
  const preview = previewPlanFactConflicts(imported, plan);

  assert.deepEqual(preview, [
    {
      rowNumber: 2,
      field: "address",
      canonicalValue: "10 Harbor Way",
      assertedValue: "12 Harbor Way",
    },
  ]);

  const applied = applyLeadImportPlan(imported, plan, fixedNow);
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.deepEqual(
    applied.data.deals[0]?.factConflicts.map(
      ({ field, canonicalValue, assertedValue }) => ({
        rowNumber: 2,
        field,
        canonicalValue,
        assertedValue,
      }),
    ),
    preview,
  );
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

test("possible duplicates can be explicitly held outside production while safe rows apply", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const plan = planLeadImport(first, [
    candidate({
      source: "County Records",
      sourceRecordId: "possible",
    }),
    candidate({
      source: "County Records",
      sourceRecordId: "new-property",
      address: "22 Harbor Way",
      zip: "02111",
    }),
  ]);
  assert.equal(plan.possibleDuplicates.length, 1);
  assert.equal(plan.newRows.length, 1);

  const held = holdPossibleDuplicate(plan, 2);
  assert.equal(held.possibleDuplicates.length, 0);
  assert.equal(held.rejected.length, 1);
  assert.match(held.rejected[0]?.reason ?? "", /held outside production/i);

  const applied = applyLeadImportPlan(first, held, fixedNow);
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.data.deals.length, 2);
  assert.equal(
    applied.data.deals.some(({ address }) => address === "22 Harbor Way"),
    true,
  );
});

test("apply rejects a row duplicated across preview categories", () => {
  const data = emptyWorkspace();
  const plan = planLeadImport(data, [
    candidate({ sourceRecordId: "safe-new" }),
  ]);
  const planned = plan.newRows[0];
  assert.ok(planned);
  plan.rejected.push({
    rowNumber: planned.rowNumber,
    candidate: structuredClone(planned.candidate),
    reason: "Crafted duplicate category",
  });

  const applied = applyLeadImportPlan(data, plan, fixedNow);
  assert.equal(applied.ok, false);
  if (!applied.ok) assert.match(applied.error, /preview row integrity/i);
  assert.equal(data.deals.length, 0);
});

test("cross-row source identities with disjoint duplicate targets are rejected", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const data = importCandidates(first, [
    candidate({
      sourceRecordId: "002",
      address: "20 Harbor Way",
    }),
  ]);
  const plan = planLeadImport(data, [
    candidate({
      source: "County Records",
      sourceRecordId: "shared-id",
      address: "10 Harbor Way",
    }),
    candidate({
      source: "County Records",
      sourceRecordId: "shared-id",
      address: "20 Harbor Way",
    }),
  ]);

  assert.equal(plan.possibleDuplicates.length, 0);
  assert.deepEqual(plan.rejected.map((item) => item.rowNumber), [2, 3]);
  assert.match(plan.rejected[0]?.reason ?? "", /multiple target properties/i);
});

test("attachment rejects a crafted cross-row identity with different targets", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const data = importCandidates(first, [
    candidate({
      sourceRecordId: "002",
      address: "20 Harbor Way",
    }),
  ]);
  const legacyPlan = planLeadImport(data, [
    candidate({
      source: "County Records",
      sourceRecordId: "county-10",
      address: "10 Harbor Way",
    }),
    candidate({
      source: "County Records",
      sourceRecordId: "county-20",
      address: "20 Harbor Way",
    }),
  ]);
  const crafted = structuredClone(legacyPlan);
  const second = crafted.possibleDuplicates[1];
  assert.ok(second);
  second.candidate.sourceRecordId = "county-10";

  assert.throws(
    () => attachPossibleDuplicate(
      crafted,
      2,
      data.deals[0]?.id ?? "",
    ),
    /source identity.*multiple target properties/i,
  );
});

test("apply rejects a crafted plan that splits one source identity across deals", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const data = importCandidates(first, [
    candidate({
      sourceRecordId: "002",
      address: "20 Harbor Way",
    }),
  ]);
  const crafted = planLeadImport(data, []);
  crafted.attachments.push(
    {
      rowNumber: 2,
      candidate: candidate({
        source: "County Records",
        sourceRecordId: "shared-id",
        address: "10 Harbor Way",
      }),
      dealId: data.deals[0]?.id ?? "",
    },
    {
      rowNumber: 3,
      candidate: candidate({
        source: "County Records",
        sourceRecordId: "shared-id",
        address: "20 Harbor Way",
      }),
      dealId: data.deals[1]?.id ?? "",
    },
  );

  const applied = applyLeadImportPlan(data, crafted, fixedNow);
  assert.equal(applied.ok, false);
  if (!applied.ok) {
    assert.match(applied.error, /source identity.*multiple target properties/i);
  }
  assert.equal(data.deals[0]?.sourceAssertions.length, 1);
  assert.equal(data.deals[1]?.sourceAssertions.length, 1);
});

test("apply rejects duplicate planned row numbers before creating deals", () => {
  const data = emptyWorkspace();
  const crafted = planLeadImport(data, [
    candidate({ sourceRecordId: "new-source" }),
  ]);
  const duplicateRow = structuredClone(crafted.newRows[0]);
  assert.ok(duplicateRow);
  duplicateRow.candidate.address = "20 Harbor Way";
  crafted.newRows.push(duplicateRow);

  const applied = applyLeadImportPlan(data, crafted, fixedNow);
  assert.equal(applied.ok, false);
  if (!applied.ok) {
    assert.match(applied.error, /planned row numbers.*unique/i);
  }
  assert.equal(data.deals.length, 0);
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

test("equivalent unresolved disagreements do not duplicate conflicts", () => {
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

test("fresh disagreeing assertions get new unresolved evidence after resolution", () => {
  const first = importCandidates(emptyWorkspace(), [candidate()]);
  const changed = importCandidates(first, [
    candidate({
      address: "12 Harbor Way",
      lastVerifiedAt: "2026-07-27T00:00:00.000Z",
    }),
  ]);
  const deal = changed.deals[0];
  const conflict = deal?.factConflicts[0];
  assert.ok(deal);
  assert.ok(conflict);
  const resolved = resolveFactConflict(
    changed,
    deal.id,
    conflict.id,
    "Canonical",
    "Kept the independently verified canonical address",
    fixedNow,
  );
  const refreshed = importCandidates(resolved, [
    candidate({
      address: "12 Harbor Way",
      lastVerifiedAt: "2026-07-28T00:00:00.000Z",
    }),
  ]);
  const refreshedDeal = refreshed.deals[0];
  const newestAssertion = refreshedDeal?.sourceAssertions.at(-1);
  const newestConflict = refreshedDeal?.factConflicts.at(-1);

  assert.equal(refreshedDeal?.factConflicts.length, 2);
  assert.equal(newestConflict?.status, "Unresolved");
  assert.equal(newestConflict?.sourceAssertionId, newestAssertion?.id);
  assert.equal(
    new Set(refreshedDeal?.factConflicts.map((item) => item.id)).size,
    2,
  );
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

test("restriction resolution preserves history and cannot resolve source-derived holds", () => {
  const restricted = importCandidates(emptyWorkspace(), [
    candidate({ usageClassification: "Restricted — research only" }),
  ]);
  const sourceRestriction = restricted.deals[0]?.researchRestrictions[0];
  assert.ok(sourceRestriction);
  assert.throws(
    () => resolveResearchRestriction(
      restricted,
      restricted.deals[0]?.id ?? "",
      sourceRestriction.id,
      "Reviewed on 2026-07-28",
      fixedNow,
    ),
    /source-derived restriction/i,
  );

  const withOperatorHold = structuredClone(restricted);
  withOperatorHold.deals[0]?.researchRestrictions.push({
    id: "operator-hold",
    code: "Specialist review",
    source: "Operator",
    sourceAssertionId: null,
    reason: "Operator review",
    createdAt: "2026-07-27T00:00:00.000Z",
    resolvedAt: null,
    resolutionNote: "",
  });
  assert.throws(
    () => resolveResearchRestriction(
      withOperatorHold,
      withOperatorHold.deals[0]?.id ?? "",
      "operator-hold",
      " ",
      fixedNow,
    ),
    /dated reason/i,
  );

  const resolved = resolveResearchRestriction(
    withOperatorHold,
    withOperatorHold.deals[0]?.id ?? "",
    "operator-hold",
    "Resolved after attorney review on 2026-07-28",
    fixedNow,
  );
  assert.equal(resolved.deals[0]?.researchRestrictions.length, 2);
  assert.deepEqual(
    resolved.deals[0]?.researchRestrictions.find(
      ({ id }) => id === "operator-hold",
    ),
    {
      id: "operator-hold",
      code: "Specialist review",
      source: "Operator",
      sourceAssertionId: null,
      reason: "Operator review",
      createdAt: "2026-07-27T00:00:00.000Z",
      resolvedAt: "2026-07-28T12:00:00.000Z",
      resolutionNote: "Resolved after attorney review on 2026-07-28",
    },
  );
});
