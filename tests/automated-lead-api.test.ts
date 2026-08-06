import assert from "node:assert/strict";
import test from "node:test";

import { handleAutomatedLeadApi } from "../server/automated-lead-api.ts";
import { upsertAutomatedLead } from "../server/automated-lead-store.ts";
import { closeTestD1, createTestD1 } from "./helpers/d1.ts";

function request(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://dealflow.test${path}`, {
    headers: { "oai-authenticated-user-email": "operator@example.com", ...headers },
  });
}

test("lead API requires the owner session and same-origin request", async () => {
  const db = await createTestD1();
  try {
    assert.equal((await handleAutomatedLeadApi(new Request("https://dealflow.test/api/leads"), { DB: db }))?.status, 401);
    assert.equal((await handleAutomatedLeadApi(new Request("https://dealflow.test/api/leads", {
      headers: { "oai-authenticated-user-email": "operator@example.com", origin: "https://evil.example" },
    }), { DB: db }))?.status, 403);
  } finally {
    await closeTestD1(db);
  }
});

test("lead API scopes reads by organization and returns normalized owner data", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  await upsertAutomatedLead(db, {
    provider: "rentcast",
    providerPropertyId: "rc-1",
    address: "1 Main St",
    city: "Fall River",
    state: "MA",
    zip: "02720",
    estimatedValue: 425000,
    ownerNames: ["Example Owner"],
    ownerType: "Individual",
    ownerMailingAddress: null,
    ownerOccupied: false,
    organizationId: "org-a",
    sourceIdentity: "massgis:fall-river",
    sourceRecordId: "1",
    sourceFingerprint: "hash-1",
    sourceRetrievedAt: "2026-08-06T12:00:00.000Z",
  });
  const env = { DB: db, DEALFLOW_ORGANIZATION_ID: "org-a" };
  const response = await handleAutomatedLeadApi(request("/api/leads"), env);
  assert.equal(response?.status, 200);
  const body = await response?.json() as { leads: Array<Record<string, unknown>> };
  assert.equal(body.leads.length, 1);
  assert.equal(body.leads[0]?.provider, "rentcast");
  assert.deepEqual(body.leads[0]?.ownerNames, ["Example Owner"]);
  assert.deepEqual(body.leads[0]?.source, {
    identity: "massgis:fall-river",
    recordId: "1",
    retrievedAt: "2026-08-06T12:00:00.000Z",
  });
  const otherOrg = await handleAutomatedLeadApi(request("/api/leads", { "oai-authenticated-user-organization-id": "org-b" }), env);
  assert.deepEqual((await otherOrg?.json()) as unknown, { leads: [] });
});

test("lead health is honest when enrichment is not activated", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const response = await handleAutomatedLeadApi(request("/api/leads/health"), { DB: db });
  assert.deepEqual(await response?.json(), {
    leadAutomation: "available",
    source: "massgis",
    ownerEnrichment: "disabled",
    provider: "rentcast",
  });
});
