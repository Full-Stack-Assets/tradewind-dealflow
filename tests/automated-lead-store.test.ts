import assert from "node:assert/strict";
import test from "node:test";

import {
  getAutomatedLead,
  getEnrichmentStatus,
  listAutomatedLeads,
  recordEnrichmentAttempt,
  upsertAutomatedLead,
} from "../server/automated-lead-store.ts";
import { closeTestD1, createTestD1 } from "./helpers/d1.ts";

const baseLead = {
  provider: "rentcast" as const,
  providerPropertyId: "rc_123",
  address: "123 Main Street",
  city: "Fall River",
  state: "MA",
  zip: "02720",
  estimatedValue: 245000,
  ownerNames: ["Example Owner"],
  ownerType: "Individual",
  ownerMailingAddress: {
    addressLine1: "PO Box 10",
    addressLine2: null,
    city: "Boston",
    state: "MA",
    zipCode: "02108",
  },
  ownerOccupied: false,
  organizationId: "org-a",
  sourceIdentity: "massgis:fall-river",
  sourceRecordId: "parcel-123",
  sourceFingerprint: "source-hash-1",
  sourceRetrievedAt: "2026-08-06T12:00:00.000Z",
};

test("upserts automated leads idempotently and records normalized owner facts", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const first = await upsertAutomatedLead(db, baseLead, new Date("2026-08-06T12:00:00.000Z"));
  assert.equal(first.created, true);
  assert.equal(first.changed, false);
  assert.equal(first.lead.enrichmentStatus, "available");

  const duplicate = await upsertAutomatedLead(db, baseLead, new Date("2026-08-06T12:05:00.000Z"));
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.changed, false);
  assert.equal((await listAutomatedLeads(db, "org-a")).length, 1);

  const changed = await upsertAutomatedLead(db, {
    ...baseLead,
    sourceFingerprint: "source-hash-2",
    ownerNames: ["Updated Owner"],
  }, new Date("2026-08-06T12:10:00.000Z"));
  assert.equal(changed.changed, true);
  assert.deepEqual(changed.lead.ownerNames, ["Updated Owner"]);
  assert.equal((await getAutomatedLead(db, "org-a", first.lead.id))?.sourceFingerprint, "source-hash-2");
});

test("lead reads are organization-scoped and enrichment attempts are idempotent", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const created = await upsertAutomatedLead(db, baseLead);
  assert.equal(await getAutomatedLead(db, "org-b", created.lead.id), null);
  assert.equal((await listAutomatedLeads(db, "org-b")).length, 0);

  const input = {
    organizationId: "org-a",
    leadId: created.lead.id,
    provider: "rentcast",
    requestHash: "request-hash-1",
    status: "succeeded" as const,
    responseStatus: 200,
    startedAt: "2026-08-06T12:00:00.000Z",
    completedAt: "2026-08-06T12:00:01.000Z",
  };
  const first = await recordEnrichmentAttempt(db, input);
  const second = await recordEnrichmentAttempt(db, input);
  assert.equal(first.existing, false);
  assert.equal(second.existing, true);
  assert.equal(second.attempt.id, first.attempt.id);
  assert.equal((await getEnrichmentStatus(db, "org-a", created.lead.id)).length, 1);
});

test("lead storage schema has no provider secret column", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const columns = await db.prepare("PRAGMA table_info(automated_leads)").all<{ name: string }>();
  assert.equal(columns.results.some(({ name }: { name: string }) => /key|secret|token/i.test(name)), false);
});
