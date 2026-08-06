import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import type { D1Database } from "../server/d1.ts";
import { createTestD1, closeTestD1 } from "./helpers/d1.ts";
import { handleControlPlaneApi } from "../server/control-plane-api.ts";
import { hashCanonicalEnvelope, type CanonicalExecutionEnvelope } from "../lib/control-plane/control-plane-core.ts";

let db: D1Database;
before(async () => { db = await createTestD1(); });
after(async () => { await closeTestD1(db); });

function request(path: string, method: string, body: unknown, email = "operator@example.com", organization = "org-a") {
  return new Request(`https://tradewind.example${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-email": email,
      "oai-authenticated-user-organization-id": organization,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function actorHash(email: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const envelope: CanonicalExecutionEnvelope = {
  schemaVersion: "tradewind.execution-envelope.v1",
  actionId: "action-1",
  organizationId: "org-a",
  actionType: "PUBLISH_DOCUMENT",
  destination: { type: "CONTROL_PLANE_REVIEW" },
  payload: { document: "draft-1" },
  requestingActor: { actorId: "requester-1", type: "HUMAN", organizationId: "org-a", role: "OPERATOR" },
  requestTimestamp: "2026-08-06T12:00:00.000Z",
  idempotencyKey: "action-1-v1",
  policySetVersion: "tradewind.policy.v1",
  workflowVersion: "tradewind.workflow.v1",
  evidenceReferences: [],
};

test("approval API creates a hash-bound pending request and isolates organizations", async () => {
  const response = await handleControlPlaneApi(request("/api/control-plane/approvals", "POST", {
    actionId: "action-1",
    actionType: "PUBLISH_DOCUMENT",
    targetEntityId: "property-1",
    envelope,
    envelopeHash: hashCanonicalEnvelope(envelope),
    requirement: { role: "LEGAL_REVIEWER", minimumApprovals: 1, separationOfDutiesRequired: true },
    requesterActorId: "requester-1",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }), { DB: db });
  assert.equal(response?.status, 201);
  const otherOrg = await handleControlPlaneApi(request("/api/control-plane/approvals", "GET", undefined, "other@example.com", "org-b"), { DB: db });
  assert.deepEqual(await otherOrg?.json(), { approvals: [] });
  const sameOrg = await handleControlPlaneApi(request("/api/control-plane/approvals", "GET", undefined), { DB: db });
  const body = await sameOrg?.json() as { approvals: Array<{ requestId: string; envelopeHash: string }> };
  assert.equal(body.approvals.length, 1);
  assert.equal(body.approvals[0].envelopeHash, hashCanonicalEnvelope(envelope));
});

test("approval decisions require the exact envelope hash and active authority", async () => {
  const approverId = await actorHash("approver@example.com");
  await db.prepare("INSERT INTO control_plane_authorities (id, organization_id, actor_id, role, scope, active_from, revoked) VALUES (?, ?, ?, ?, ?, ?, 0)")
    .bind("authority-1", "org-a", approverId, "LEGAL_REVIEWER", "PUBLISH_DOCUMENT", "2026-08-06T11:00:00.000Z").run();
  const queue = await handleControlPlaneApi(request("/api/control-plane/approvals", "GET", undefined), { DB: db });
  const { approvals } = await queue?.json() as { approvals: Array<{ requestId: string }> };
  const requestId = approvals[0].requestId;
  const stale = await handleControlPlaneApi(request(`/api/control-plane/approvals/${requestId}/decision`, "POST", {
    decision: "APPROVED",
    envelopeHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    role: "LEGAL_REVIEWER",
  }, "approver@example.com"), { DB: db });
  assert.equal(stale?.status, 409);
  const approved = await handleControlPlaneApi(request(`/api/control-plane/approvals/${requestId}/decision`, "POST", {
    decision: "APPROVED",
    envelopeHash: hashCanonicalEnvelope(envelope),
    role: "LEGAL_REVIEWER",
  }, "approver@example.com"), { DB: db });
  assert.equal(approved?.status, 200);
});

test("duplicate approval requests use the supplied idempotency key", async () => {
  const body = {
    actionId: "action-2",
    actionType: "EXPORT_FACT_SHEET",
    targetEntityId: "property-2",
    envelope: { ...envelope, actionId: "action-2", actionType: "EXPORT_FACT_SHEET" },
    envelopeHash: hashCanonicalEnvelope({ ...envelope, actionId: "action-2", actionType: "EXPORT_FACT_SHEET" }),
    requirement: { role: "OPERATOR", minimumApprovals: 1 },
    requesterActorId: "requester-2",
    idempotencyKey: "approval-request-2",
  };
  const first = await handleControlPlaneApi(request("/api/control-plane/approvals", "POST", body), { DB: db });
  const second = await handleControlPlaneApi(request("/api/control-plane/approvals", "POST", body), { DB: db });
  assert.equal(first?.status, 201);
  assert.equal(second?.status, 200);
  assert.deepEqual(await first?.json(), await second?.json());
});
