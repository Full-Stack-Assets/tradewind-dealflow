import assert from "node:assert/strict";
import test from "node:test";

import { reconcileMigration } from "../lib/migration/reconciliation.ts";

test("passes only when source dispositions and destination counts balance", () => {
  assert.deepEqual(
    reconcileMigration(
      { total: 100, accepted: 80, exactDuplicates: 10, conflicts: 5, rejected: 5 },
      { created: 80, linkedDuplicates: 10, openConflicts: 5 },
    ),
    {
      status: "reconciled",
      sourceTotal: 100,
      accountedSourceTotal: 100,
      expectedDestinationRecords: 80,
      destinationCreatedRecords: 80,
      issues: [],
    },
  );
});

test("fails closed when one record is unaccounted", () => {
  const result = reconcileMigration(
    { total: 100, accepted: 79, exactDuplicates: 10, conflicts: 5, rejected: 5 },
    { created: 79, linkedDuplicates: 10, openConflicts: 5 },
  );
  assert.equal(result.status, "not-reconciled");
  assert.deepEqual(result.issues, ["Source dispositions account for 99 of 100 records."]);
});

test("reports invalid and mismatched counts together", () => {
  const result = reconcileMigration(
    { total: Number.MAX_SAFE_INTEGER + 1, accepted: -1, exactDuplicates: 1.5, conflicts: 2, rejected: 0 },
    { created: 7, linkedDuplicates: 3, openConflicts: 4 },
  );
  assert.equal(result.status, "not-reconciled");
  assert.equal(result.issues[0], "Every migration count must be a non-negative safe integer.");
  assert.equal(result.issues.some((issue) => /Destination created/.test(issue)), true);
  assert.equal(result.issues.some((issue) => /Destination linked/.test(issue)), true);
  assert.equal(result.issues.some((issue) => /Destination retained/.test(issue)), true);
});
