import assert from "node:assert/strict";
import test from "node:test";
import { executeAuthorizedAction } from "../server/control-plane-execution.ts";
import { hashCanonicalEnvelope, type CanonicalExecutionEnvelope, type ExecutionAuthorizationSnapshot } from "../lib/control-plane/control-plane-core.ts";

const envelope: CanonicalExecutionEnvelope = {
  schemaVersion: "tradewind.execution-envelope.v1",
  actionId: "action-1",
  organizationId: "org-a",
  actionType: "SEND_OUTREACH",
  destination: { type: "ELEVENLABS", channelId: "phone-1" },
  payload: { phone: "+15555550100" },
  requestingActor: { actorId: "requester", type: "HUMAN", organizationId: "org-a", role: "OPERATOR" },
  requestTimestamp: "2026-08-06T12:00:00.000Z",
  idempotencyKey: "action-1",
  policySetVersion: "tradewind.policy.v1",
  workflowVersion: "tradewind.workflow.v1",
  evidenceReferences: [],
};

function snapshot(overrides: Partial<ExecutionAuthorizationSnapshot> = {}): ExecutionAuthorizationSnapshot {
  return {
    actionState: "READY",
    actionId: envelope.actionId,
    organizationId: envelope.organizationId,
    actionType: envelope.actionType,
    envelope,
    computedEnvelopeHash: hashCanonicalEnvelope(envelope),
    policyDecision: {
      result: "ALLOW",
      envelopeHash: hashCanonicalEnvelope(envelope),
      actionId: envelope.actionId,
      organizationId: envelope.organizationId,
    },
    adapterId: "elevenlabs.outbound",
    authorizedAdapters: ["elevenlabs.outbound"],
    globalKillSwitch: false,
    channelKillSwitch: false,
    currentTime: "2026-08-06T12:01:00.000Z",
    ...overrides,
  };
}

test("authorized execution calls the adapter exactly once", async () => {
  let calls = 0;
  const result = await executeAuthorizedAction(snapshot(), async (authorizedEnvelope) => {
    calls += 1;
    return { actionId: authorizedEnvelope.actionId, providerId: "call-1" };
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { actionId: "action-1", providerId: "call-1" });
});

test("stale envelope hashes and kill switches block the adapter", async () => {
  await assert.rejects(
    executeAuthorizedAction(snapshot({ computedEnvelopeHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }), async () => "called"),
    /authorization blocked.*POLICY_ENVELOPE_HASH_MISMATCH/i,
  );
  await assert.rejects(
    executeAuthorizedAction(snapshot({ globalKillSwitch: true }), async () => "called"),
    /authorization blocked.*GLOBAL_KILL_SWITCH_ACTIVE/i,
  );
});
