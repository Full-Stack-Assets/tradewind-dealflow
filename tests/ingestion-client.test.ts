import assert from "node:assert/strict";
import test from "node:test";

import * as ingestionClient from "../lib/ingestion/client.ts";

test("acknowledgement posts per-chunk IDs and reconciling mixed outcome counts", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<{ recordIds: string[]; outcomeCounts: Record<string, number> }> = [];
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as typeof bodies[number];
    bodies.push(body);
    return Response.json({ acknowledged: body.recordIds.length });
  }) as typeof fetch;

  try {
    const acknowledgements = [
      ...Array.from({ length: 498 }, (_, index) => ({ recordId: `applied-${index}`, outcome: "applied" as const })),
      { recordId: "changed", outcome: "changed-source" as const },
      { recordId: "excluded-a", outcome: "excluded" as const },
      ...Array.from({ length: 499 }, (_, index) => ({ recordId: `exact-${index}`, outcome: "exact-reimport" as const })),
      { recordId: "possible", outcome: "possible-property-match" as const },
      { recordId: "excluded-b", outcome: "excluded" as const },
    ];
    const acknowledged = await ingestionClient.acknowledgeImportedRecords(acknowledgements);

    assert.equal(acknowledged, 998);
    assert.deepEqual(bodies.map((body) => body.recordIds.length), [499, 499, 0]);
    assert.deepEqual(bodies.map((body) => body.outcomeCounts), [
      { applied: 498, changedSource: 1, exactReimport: 0, possiblePropertyMatch: 0, excluded: 1 },
      { applied: 0, changedSource: 0, exactReimport: 499, possiblePropertyMatch: 1, excluded: 0 },
      { applied: 0, changedSource: 0, exactReimport: 0, possiblePropertyMatch: 0, excluded: 1 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a refresh failure after acknowledgement returns an accepted import result", async () => {
  const finalize = (ingestionClient as unknown as {
    acknowledgeAndRefreshImportedRecords?: (
      items: Array<{ recordId: string; outcome: "applied" }>,
      refresh: () => Promise<void>,
    ) => Promise<{ acknowledged: number; refreshed: boolean }>;
  }).acknowledgeAndRefreshImportedRecords;
  assert.equal(typeof finalize, "function");
  if (!finalize) return;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { recordIds: string[] };
    return Response.json({ acknowledged: body.recordIds.length });
  }) as typeof fetch;
  try {
    const result = await finalize(
      [{ recordId: "record-1", outcome: "applied" }],
      async () => { throw new Error("refresh unavailable"); },
    );
    assert.deepEqual(result, { acknowledged: 1, refreshed: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
