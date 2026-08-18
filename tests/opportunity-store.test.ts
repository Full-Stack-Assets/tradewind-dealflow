import assert from "node:assert/strict";
import test from "node:test";

import { convertAutomatedLeadToDeal } from "../lib/lead-conversion.ts";
import { upsertAutomatedLead } from "../server/automated-lead-store.ts";
import { handleOpportunityApi } from "../server/opportunity-api.ts";
import {
  EMPTY_OPPORTUNITY_WORKSPACE,
  listOpportunities,
  updateOpportunityWorkspace,
  upsertPromotedOpportunity,
} from "../server/opportunity-store.ts";
import { closeTestD1, createTestD1 } from "./helpers/d1.ts";

function request(path: string, init: RequestInit = {}, headers: Record<string, string> = {}) {
  return new Request(`https://dealflow.test${path}`, {
    ...init,
    headers: { "oai-authenticated-user-email": "operator@example.com", ...headers, ...(init.headers ?? {}) },
  });
}

async function seedLead(db: Awaited<ReturnType<typeof createTestD1>>, organizationId = "org-a") {
  return upsertAutomatedLead(db, {
    provider: "massgis",
    providerPropertyId: "95-101",
    address: "10 Harbor Way",
    city: "Fall River",
    state: "MA",
    zip: "02720",
    estimatedValue: 425000,
    ownerNames: [],
    ownerType: null,
    ownerMailingAddress: null,
    ownerOccupied: null,
    organizationId,
    sourceIdentity: "massgis:fall-river",
    sourceRecordId: "95-101",
    sourceFingerprint: "hash-1",
    sourceRetrievedAt: "2026-08-06T12:00:00.000Z",
  });
}

test("opportunity store upserts by lead id and persists workspace JSON", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const conversion = convertAutomatedLeadToDeal({
    id: "lead_1",
    source: { identity: "massgis:fall-river", recordId: "95-101", retrievedAt: "2026-08-06T12:00:00.000Z" },
    provider: "massgis",
    providerPropertyId: "95-101",
    address: "10 Harbor Way",
    city: "Fall River",
    state: "MA",
    zip: "02720",
    estimatedValue: null,
    ownerNames: [],
    ownerType: null,
    ownerOccupied: null,
    enrichmentStatus: "pending",
  }, new Date("2026-08-18T15:00:00.000Z"));
  assert.equal(conversion.ok, true);
  if (!conversion.ok) return;
  const first = await upsertPromotedOpportunity(db, {
    organizationId: "org-a",
    sourceLeadId: "lead_1",
    deal: conversion.deal,
    now: "2026-08-18T15:00:00.000Z",
  });
  const second = await upsertPromotedOpportunity(db, {
    organizationId: "org-a",
    sourceLeadId: "lead_1",
    deal: conversion.deal,
    now: "2026-08-18T16:00:00.000Z",
  });
  assert.equal(second.id, first.id);
  assert.equal((await listOpportunities(db, "org-a")).length, 1);
  assert.equal((await listOpportunities(db, "org-b")).length, 0);

  const workspace = {
    ...EMPTY_OPPORTUNITY_WORKSPACE,
    tasks: [{
      id: "task-1",
      propertyRecordId: conversion.deal.id,
      createdAt: "2026-08-18T16:00:00.000Z",
      updatedAt: "2026-08-18T16:00:00.000Z",
      title: "Verify parcel",
      status: "todo" as const,
      dueAt: "2026-08-19T16:00:00.000Z",
      notes: "",
    }],
  };
  const updated = await updateOpportunityWorkspace(db, {
    organizationId: "org-a",
    dealId: conversion.deal.id,
    workspace,
    now: "2026-08-18T16:30:00.000Z",
  });
  assert.equal(updated?.workspace.tasks[0]?.title, "Verify parcel");
});

test("opportunity API requires auth, isolates organizations, and promotes idempotently", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const lead = await seedLead(db);
  const env = { DB: db, DEALFLOW_ORGANIZATION_ID: "org-a" };

  assert.equal((await handleOpportunityApi(new Request("https://dealflow.test/api/opportunities"), { DB: db }))?.status, 401);

  const created = await handleOpportunityApi(request("/api/opportunities", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leadId: lead.id }),
  }), env);
  assert.equal(created?.status, 201);
  const createdBody = await created?.json() as { reused: boolean; opportunity: { dealId: string } };
  assert.equal(createdBody.reused, false);

  const again = await handleOpportunityApi(request("/api/opportunities", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leadId: lead.id }),
  }), env);
  assert.equal(again?.status, 200);
  const againBody = await again?.json() as { reused: boolean };
  assert.equal(againBody.reused, true);

  const otherOrg = await handleOpportunityApi(request("/api/opportunities", {}, {
    "oai-authenticated-user-organization-id": "org-b",
  }), env);
  assert.deepEqual(await otherOrg?.json(), { opportunities: [] });
});
