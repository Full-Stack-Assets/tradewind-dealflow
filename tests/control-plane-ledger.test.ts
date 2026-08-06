import assert from "node:assert/strict";
import test from "node:test";
import {
  createLedgerEvent,
  hashLedgerEvent,
  verifyLedger,
} from "../lib/control-plane/ledger/ledger-verifier.ts";
import { createEnvelopeFromWorkspaceDraft } from "../lib/control-plane/workspace-integration.ts";

const evidence = {
  evidenceId: "source-1",
  type: "property-source",
  contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  retrievedAt: "2026-08-06T12:00:00.000Z",
  source: "operator-research",
};

test("ledger events hash deterministically and verify as a linked chain", () => {
  const first = createLedgerEvent({
    sequence: 1,
    eventId: "evt-1",
    occurredAt: "2026-08-06T12:00:00.000Z",
    actorId: "actor-1",
    eventType: "ACTION_CREATED",
    aggregateType: "ACTION",
    aggregateId: "action-1",
    payload: { b: 2, a: 1 },
    previousHash: null,
  });
  const second = createLedgerEvent({
    sequence: 2,
    eventId: "evt-2",
    occurredAt: "2026-08-06T12:01:00.000Z",
    actorId: "actor-1",
    eventType: "APPROVAL_REQUESTED",
    aggregateType: "ACTION",
    aggregateId: "action-1",
    payload: { envelopeHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    previousHash: hashLedgerEvent(first),
  });

  assert.equal(hashLedgerEvent(first), hashLedgerEvent({ ...first, payload: { a: 1, b: 2 } }));
  assert.deepEqual(verifyLedger([first, second]), { ok: true, errors: [] });
});

test("ledger verification detects sequence gaps and tampered event hashes", () => {
  const first = createLedgerEvent({
    sequence: 1,
    eventId: "evt-1",
    occurredAt: "2026-08-06T12:00:00.000Z",
    actorId: "actor-1",
    eventType: "ACTION_CREATED",
    aggregateType: "ACTION",
    aggregateId: "action-1",
    payload: {},
    previousHash: null,
  });
  const second = createLedgerEvent({
    sequence: 3,
    eventId: "evt-2",
    occurredAt: "2026-08-06T12:01:00.000Z",
    actorId: "actor-1",
    eventType: "APPROVAL_REQUESTED",
    aggregateType: "ACTION",
    aggregateId: "action-1",
    payload: {},
    previousHash: hashLedgerEvent(first),
  });
  const tampered = { ...second, payload: { changed: true } };
  const result = verifyLedger([first, tampered]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /sequence|hash/i);
});

test("workspace drafts produce a typed, hash-bound execution envelope", () => {
  const result = createEnvelopeFromWorkspaceDraft({
    workspaceId: "workspace-1",
    organizationId: "org-1",
    parcelId: "parcel-1",
    address: "1 Main Street",
    townName: "Fall River",
    sellerName: "Subject to Verification",
    evidenceReferences: [evidence],
  }, "PUBLISH_DOCUMENT");

  assert.match(result.envelopeHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.envelope.actionId, "ACT-parcel-1");
  assert.deepEqual(result.envelope.evidenceReferences, [evidence]);
  assert.equal(typeof result.envelope.destination === "string" ? result.envelope.destination : result.envelope.destination.type, "CONTROL_PLANE_REVIEW");
});
