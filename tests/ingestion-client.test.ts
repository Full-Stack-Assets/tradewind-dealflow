import assert from "node:assert/strict";
import test from "node:test";

import { acknowledgeImportedRecords } from "../lib/ingestion/client.ts";

test("acknowledgement posts the entire snapshot in bounded chunks with outcome counts", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: Array<{ recordIds: string[]; outcomeCounts: Record<string, number> }> = [];
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as typeof bodies[number];
    bodies.push(body);
    return Response.json({ acknowledged: body.recordIds.length });
  }) as typeof fetch;

  try {
    const outcomeCounts = {
      applied: 999,
      changedSource: 1,
      exactReimport: 1,
      possiblePropertyMatch: 0,
      excluded: 0,
    };
    const acknowledged = await acknowledgeImportedRecords(
      Array.from({ length: 1001 }, (_, index) => `record-${index + 1}`),
      outcomeCounts,
    );

    assert.equal(acknowledged, 1001);
    assert.deepEqual(bodies.map((body) => body.recordIds.length), [500, 500, 1]);
    assert.deepEqual(bodies.map((body) => body.outcomeCounts), [
      outcomeCounts,
      outcomeCounts,
      outcomeCounts,
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
