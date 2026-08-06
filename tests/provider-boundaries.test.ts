import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createTestD1, closeTestD1 } from "./helpers/d1.ts";
import type { D1Database } from "../server/d1.ts";
import { handleElevenLabsWebhook, signElevenLabsPayload, verifyElevenLabsSignature } from "../server/webhooks/elevenlabs.ts";
import { createElevenLabsOutboundAdapter } from "../server/providers/elevenlabs.ts";
import { createConfiguredSkipTracingProvider } from "../server/providers/skip-tracing.ts";
import { hashCanonicalEnvelope, type CanonicalExecutionEnvelope, type ExecutionAuthorizationSnapshot } from "../lib/control-plane/control-plane-core.ts";

let db: D1Database;
before(async () => { db = await createTestD1(); });
after(async () => { await closeTestD1(db); });

const webhookSecret = "test-webhook-secret";
const webhookPayload = JSON.stringify({
  type: "post_call_transcription",
  event_timestamp: Math.floor(Date.now() / 1000),
  data: { conversation_id: "conv-1", agent_id: "agent-1", status: "done" },
});

test("ElevenLabs signatures validate the raw body and reject stale or altered requests", async () => {
  const signature = await signElevenLabsPayload(webhookPayload, webhookSecret, Math.floor(Date.now() / 1000));
  assert.equal(await verifyElevenLabsSignature(webhookPayload, signature, webhookSecret), true);
  assert.equal(await verifyElevenLabsSignature(`${webhookPayload}x`, signature, webhookSecret), false);
  const stale = await signElevenLabsPayload(webhookPayload, webhookSecret, Math.floor(Date.now() / 1000) - 600);
  assert.equal(await verifyElevenLabsSignature(webhookPayload, stale, webhookSecret), false);
});

test("ElevenLabs webhook stores a verified event once and acknowledges retries", async () => {
  const signature = await signElevenLabsPayload(webhookPayload, webhookSecret, Math.floor(Date.now() / 1000));
  const makeRequest = () => new Request("https://tradewind.example/api/webhooks/elevenlabs", {
    method: "POST",
    headers: { "content-type": "application/json", "elevenlabs-signature": signature },
    body: webhookPayload,
  });
  const env = { DB: db, ELEVENLABS_WEBHOOK_SECRET: webhookSecret };
  const first = await handleElevenLabsWebhook(makeRequest(), env);
  const second = await handleElevenLabsWebhook(makeRequest(), env);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { received: true, duplicate: true });
  const stored = await db.prepare("SELECT event_id, provider, event_type FROM control_plane_webhook_events").all<{ event_id: string; provider: string; event_type: string }>();
  assert.deepEqual(stored.results, [{ event_id: "conv-1", provider: "elevenlabs", event_type: "post_call_transcription" }]);
});

const outboundEnvelope: CanonicalExecutionEnvelope = {
  schemaVersion: "tradewind.execution-envelope.v1",
  actionId: "outbound-1",
  organizationId: "org-a",
  actionType: "SEND_OUTREACH",
  destination: { type: "ELEVENLABS", channelId: "phone-1" },
  payload: { phone: "+15555550100" },
  requestingActor: { actorId: "requester", type: "HUMAN", organizationId: "org-a", role: "OPERATOR" },
  requestTimestamp: "2026-08-06T12:00:00.000Z",
  idempotencyKey: "outbound-1",
  policySetVersion: "tradewind.policy.v1",
  workflowVersion: "tradewind.workflow.v1",
  evidenceReferences: [],
};

const authorizedSnapshot: ExecutionAuthorizationSnapshot = {
  actionState: "READY",
  actionId: outboundEnvelope.actionId,
  organizationId: outboundEnvelope.organizationId,
  actionType: outboundEnvelope.actionType,
  envelope: outboundEnvelope,
  computedEnvelopeHash: hashCanonicalEnvelope(outboundEnvelope),
  policyDecision: { result: "ALLOW", envelopeHash: hashCanonicalEnvelope(outboundEnvelope), actionId: outboundEnvelope.actionId, organizationId: outboundEnvelope.organizationId },
  adapterId: "elevenlabs.outbound",
  authorizedAdapters: ["elevenlabs.outbound"],
  globalKillSwitch: false,
  channelKillSwitch: false,
  currentTime: "2026-08-06T12:01:00.000Z",
};

test("authorized ElevenLabs outbound calls use server configuration and documented payload fields", async () => {
  let capturedRequest: Request | undefined;
  const adapter = createElevenLabsOutboundAdapter({
    ELEVENLABS_API_KEY: "secret-not-logged",
    ELEVENLABS_AGENT_ID: "agent-1",
    ELEVENLABS_PHONE_ID: "phone-1",
  }, async (input, init) => {
    capturedRequest = new Request(input, init);
    return new Response(JSON.stringify({ success: true, conversation_id: "conv-out" }), { status: 200 });
  });
  const result = await adapter.send({ snapshot: authorizedSnapshot, toNumber: "+15555550100" });
  assert.deepEqual(result, { success: true, conversationId: "conv-out" });
  assert.ok(capturedRequest);
  assert.equal(capturedRequest.url, "https://api.elevenlabs.io/v1/convai/twilio/outbound-call");
  assert.equal(capturedRequest.headers.get("xi-api-key"), "secret-not-logged");
  assert.deepEqual(await capturedRequest.json(), { agent_id: "agent-1", agent_phone_number_id: "phone-1", to_number: "+15555550100" });
});

test("skip-tracing exposes a validated provider-neutral contract", async () => {
  const provider = createConfiguredSkipTracingProvider({ SKIP_TRACING_API_KEY: "key", SKIP_TRACING_API_URL: "https://skip.example/enrich" }, async () => new Response(JSON.stringify({ phone: "+15555550100", email: "lead@example.com", dnc: true }), { status: 200 }));
  const result = await provider.enrich({ parcelId: "parcel-1", address: "1 Main Street", sourceReference: "authorized-research" });
  assert.deepEqual(result, { status: "matched", phone: "+15555550100", email: "lead@example.com", dnc: true });
});
