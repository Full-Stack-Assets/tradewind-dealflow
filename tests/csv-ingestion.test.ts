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
import { validateLeadCsv } from "../lib/lead-ingestion.ts";

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
