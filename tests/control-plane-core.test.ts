import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  type CanonicalExecutionEnvelope,
  type EvidenceReference,
  type ExecutionAuthorizationSnapshot,
  type Money,
  CanonicalizationError,
  InvalidStateTransitionError,
  ALLOWED_TRANSITIONS,
  AUTHORIZATION_FAILURE_CODES,
  assertTransitionAllowed,
  canonicalize,
  compareEvidenceReferences,
  evaluateExecutionAuthorization,
  hashCanonicalEnvelope,
  isTransitionAllowed,
  normalizeEnvelope,
  normalizeEvidenceReference,
} from "../lib/control-plane/control-plane-core.ts";

function createValidEnvelope(overrides: Partial<CanonicalExecutionEnvelope> = {}): CanonicalExecutionEnvelope {
  return {
    schemaVersion: 1,
    actionId: "action-123",
    organizationId: "org-456",
    actionType: "SUBMIT_OFFER",
    propertyId: "prop-789",
    sellerId: "seller-101",
    dealId: "deal-202",
    destination: {
      type: "DIRECT_API",
      channelId: "offers-channel",
      endpoint: "https://api.tradewind.com/v1/offers",
    },
    recipient: "seller@example.com",
    payload: {
      offerAmount: { currency: "USD", minorUnits: 45000000 },
      terms: "Cash 14-day close",
    },
    requestingActor: {
      actorId: "actor-user-1",
      type: "HUMAN",
      email: "operator@tradewind.com",
      role: "OPERATOR",
    },
    requestTimestamp: "2026-08-06T12:00:00Z",
    idempotencyKey: "idempotency-key-001",
    policySetVersion: "v1.2.0",
    workflowVersion: "wf-2.0",
    evidenceReferences: [
      {
        evidenceId: "ev-1",
        type: "PROOF_OF_FUNDS",
        contentHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        retrievedAt: "2026-08-06T10:00:00Z",
      },
    ],
    executionDeadline: "2026-08-07T12:00:00Z",
    ...overrides,
  };
}

function createValidSnapshot(overrides: Partial<ExecutionAuthorizationSnapshot> = {}): ExecutionAuthorizationSnapshot {
  const envelope = createValidEnvelope();
  const hash = hashCanonicalEnvelope(envelope);

  return {
    actionState: "READY",
    actionId: envelope.actionId,
    organizationId: envelope.organizationId,
    actionType: envelope.actionType,
    envelope,
    computedEnvelopeHash: hash,
    policyDecision: {
      decisionId: "pol-dec-1",
      gate: "OFFER_THRESHOLD",
      result: "ALLOW",
      policySetVersion: envelope.policySetVersion,
      envelopeHash: hash,
      actionId: envelope.actionId,
      organizationId: envelope.organizationId,
      actionType: envelope.actionType,
      expiresAt: "2026-08-07T12:00:00Z",
    },
    globalKillSwitch: false,
    channelKillSwitch: false,
    currentTime: "2026-08-06T12:30:00Z",
    evidenceSnapshots: [
      {
        evidenceId: "ev-1",
        type: "PROOF_OF_FUNDS",
        contentHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        retrievedAt: "2026-08-06T10:00:00Z",
        current: true,
      },
    ],
    ...overrides,
  };
}

describe("Canonicalization Engine", () => {
  it("Equivalent object-key ordering yields the same serialization and hash", () => {
    const objA = { z: 1, b: 2, a: 3 };
    const objB = { a: 3, z: 1, b: 2 };
    assert.equal(canonicalize(objA), canonicalize(objB));
  });

  it("normalizeEvidenceReference and compareEvidenceReferences work as expected", () => {
    const ref1: EvidenceReference = {
      evidenceId: "ev-1",
      type: "PROOF_OF_FUNDS",
      contentHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      retrievedAt: "2026-08-06T10:00:00Z",
    };
    const ref2: EvidenceReference = {
      evidenceId: "ev-2",
      type: "TITLE_SEARCH",
      contentHash: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
      retrievedAt: "2026-08-06T10:05:00Z",
    };

    const norm1 = normalizeEvidenceReference(ref1);
    assert.equal(norm1.evidenceId, "ev-1");
    assert.ok(compareEvidenceReferences(ref1, ref2) < 0);
  });

  it("Evidence-reference ordering yields the same hash", () => {
    const ref1: EvidenceReference = {
      evidenceId: "ev-1",
      type: "PROOF_OF_FUNDS",
      contentHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      retrievedAt: "2026-08-06T10:00:00Z",
    };
    const ref2: EvidenceReference = {
      evidenceId: "ev-2",
      type: "TITLE_SEARCH",
      contentHash: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
      retrievedAt: "2026-08-06T10:05:00Z",
    };

    const envA = createValidEnvelope({ evidenceReferences: [ref1, ref2] });
    const envB = createValidEnvelope({ evidenceReferences: [ref2, ref1] });

    assert.equal(hashCanonicalEnvelope(envA), hashCanonicalEnvelope(envB));
  });

  it("normalizeEnvelope strips undefined properties and sorts evidence references", () => {
    const env = createValidEnvelope({ recipient: undefined });
    const norm = normalizeEnvelope(env);
    assert.equal("recipient" in norm, false);
  });

  it("Meaningful payload-array ordering yields different hashes", () => {
    const envA = createValidEnvelope({ payload: { items: [1, 2, 3] } });
    const envB = createValidEnvelope({ payload: { items: [3, 2, 1] } });
    assert.notEqual(hashCanonicalEnvelope(envA), hashCanonicalEnvelope(envB));
  });

  it("undefined object properties are omitted", () => {
    const objA = { a: 1, b: undefined };
    const objB = { a: 1 };
    assert.equal(canonicalize(objA), canonicalize(objB));
    assert.equal(canonicalize(objA), '{"a":1}');
  });

  it("undefined array entries throw CanonicalizationError", () => {
    assert.throws(() => canonicalize([1, undefined, 3]), CanonicalizationError);
  });

  it("Date throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ d: new Date() }), CanonicalizationError);
  });

  it("Map throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ m: new Map() }), CanonicalizationError);
  });

  it("Set throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ s: new Set() }), CanonicalizationError);
  });

  it("Class instance throws CanonicalizationError", () => {
    class CustomClass {}
    assert.throws(() => canonicalize({ instance: new CustomClass() }), CanonicalizationError);
  });

  it("Typed array throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ arr: new Uint8Array([1, 2, 3]) }), CanonicalizationError);
  });

  it("Function throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ fn: () => {} }), CanonicalizationError);
  });

  it("Symbol throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ sym: Symbol("test") }), CanonicalizationError);
  });

  it("BigInt throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ b: BigInt(123) }), CanonicalizationError);
  });

  it("NaN throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ n: NaN }), CanonicalizationError);
  });

  it("Infinity throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ i: Infinity }), CanonicalizationError);
  });

  it("Non-safe integer throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ n: Number.MAX_SAFE_INTEGER + 10 }), CanonicalizationError);
  });

  it("Floating-point number throws CanonicalizationError", () => {
    assert.throws(() => canonicalize({ amount: 12.34 }), CanonicalizationError);
  });

  it("Valid safe integer succeeds", () => {
    assert.equal(canonicalize({ count: 42 }), '{"count":42}');
  });

  it("Valid minor-unit money succeeds", () => {
    const money: Money = { currency: "USD", minorUnits: 500000 };
    assert.equal(canonicalize(money), '{"currency":"USD","minorUnits":500000}');
  });

  it("Hash matches sha256:[0-9a-f]{64}", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);
    assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  });
});

describe("Material Mutation Tests", () => {
  const base = createValidEnvelope();
  const baseHash = hashCanonicalEnvelope(base);

  it("Mutating offer amount changes hash", () => {
    const mutated = createValidEnvelope({
      payload: { ...base.payload, offerAmount: { currency: "USD", minorUnits: 50000000 } },
    });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating recipient changes hash", () => {
    const mutated = createValidEnvelope({ recipient: "different@example.com" });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating destination channel changes hash", () => {
    const mutated = createValidEnvelope({
      destination: { type: "DIRECT_API", channelId: "different-channel" },
    });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating action type changes hash", () => {
    const mutated = createValidEnvelope({ actionType: "EXECUTE_CONTRACT" });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating organization ID changes hash", () => {
    const mutated = createValidEnvelope({ organizationId: "org-diff" });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating action ID changes hash", () => {
    const mutated = createValidEnvelope({ actionId: "action-diff" });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating document version changes hash", () => {
    const mutated = createValidEnvelope({ documentVersion: "v2.0" });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating policy-set version changes hash", () => {
    const mutated = createValidEnvelope({ policySetVersion: "v1.3.0" });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating workflow version changes hash", () => {
    const mutated = createValidEnvelope({ workflowVersion: "wf-3.0" });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating execution deadline changes hash", () => {
    const mutated = createValidEnvelope({ executionDeadline: "2026-08-08T12:00:00Z" });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });

  it("Mutating evidence content hash changes hash", () => {
    const mutated = createValidEnvelope({
      evidenceReferences: [
        {
          ...base.evidenceReferences[0],
          contentHash: "sha256:9999999999999999999999999999999999999999999999999999999999999999",
        },
      ],
    });
    assert.notEqual(hashCanonicalEnvelope(mutated), baseHash);
  });
});

describe("Finite State Machine (FSM) Tests", () => {
  it("Every allowed transition succeeds", () => {
    for (const [from, allowed] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of allowed) {
        assert.equal(
          isTransitionAllowed(
            from as keyof typeof ALLOWED_TRANSITIONS,
            to as keyof typeof ALLOWED_TRANSITIONS,
          ),
          true,
        );
        assert.doesNotThrow(() =>
          assertTransitionAllowed(
            from as keyof typeof ALLOWED_TRANSITIONS,
            to as keyof typeof ALLOWED_TRANSITIONS,
          ),
        );
      }
    }
  });

  it("Unlisted transitions fail", () => {
    assert.equal(isTransitionAllowed("DRAFT", "EXECUTED"), false);
    assert.throws(
      () => assertTransitionAllowed("DRAFT", "EXECUTED"),
      InvalidStateTransitionError,
    );
    assert.throws(
      () => assertTransitionAllowed("REVIEW_REQUIRED", "EXECUTING"),
      InvalidStateTransitionError,
    );
  });

  it("Terminal states reject transitions", () => {
    assert.throws(
      () => assertTransitionAllowed("RECEIPTED", "READY"),
      InvalidStateTransitionError,
    );
    assert.throws(
      () => assertTransitionAllowed("DENIED", "DRAFT"),
      InvalidStateTransitionError,
    );
    assert.throws(
      () => assertTransitionAllowed("CANCELLED", "POLICY_EVALUATION"),
      InvalidStateTransitionError,
    );
  });
});

describe("Execution Authorization Predicate Tests", () => {
  it("Valid ALLOW action with no required approval succeeds", () => {
    const snapshot = createValidSnapshot();
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, true);
    assert.deepEqual(result.reasons, []);
  });

  it("DENY fails", () => {
    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "DENY",
      },
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.POLICY_DENIED));
  });

  it("Expired policy fails", () => {
    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        expiresAt: "2026-08-06T12:00:00Z", // equal to or before currentTime
      },
      currentTime: "2026-08-06T12:30:00Z",
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.POLICY_EXPIRED));
  });

  it("Policy envelope mismatch fails", () => {
    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        envelopeHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.POLICY_ENVELOPE_HASH_MISMATCH));
  });

  it("Policy action mismatch fails", () => {
    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        actionId: "action-mismatch",
      },
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.ACTION_ID_MISMATCH));
  });

  it("Policy organization mismatch fails", () => {
    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        organizationId: "org-mismatch",
      },
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.ORGANIZATION_MISMATCH));
  });

  it("REVIEW_REQUIRED with no requirements fails", () => {
    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [],
      },
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.NO_APPROVAL_REQUIREMENTS_DECLARED));
  });

  it("Missing approval fails", () => {
    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [
          { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 },
        ],
      },
      approvalRequests: [],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.MISSING_APPROVAL));
  });

  it("Expired approval fails", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 },
          requestedAt: "2026-08-06T10:00:00Z",
          expiresAt: "2026-08-06T12:00:00Z", // expired before currentTime (12:30)
          decisions: [
            {
              approver: { actorId: "approver-1", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
          ],
        },
      ],
      approverAuthorities: [
        {
          actorId: "approver-1",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER",
          scope: "GLOBAL",
          activeFrom: "2026-01-01T00:00:00Z",
        },
      ],
      currentTime: "2026-08-06T12:30:00Z",
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.APPROVAL_EXPIRED));
  });

  it("Approval envelope mismatch fails", () => {
    const envelope = createValidEnvelope();

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 },
          requestedAt: "2026-08-06T10:00:00Z",
          decisions: [
            {
              approver: { actorId: "approver-1", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
          ],
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.APPROVAL_ENVELOPE_MISMATCH));
  });

  it("Approval action mismatch fails", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: "wrong-action-id",
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 },
          requestedAt: "2026-08-06T10:00:00Z",
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.APPROVAL_ACTION_MISMATCH));
  });

  it("Approval organization mismatch fails", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: "wrong-org-id",
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 },
          requestedAt: "2026-08-06T10:00:00Z",
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.APPROVAL_ORGANIZATION_MISMATCH));
  });

  it("Approval target-action mismatch fails", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: "EXECUTE_CONTRACT",
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 },
          requestedAt: "2026-08-06T10:00:00Z",
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.APPROVAL_TARGET_ACTION_MISMATCH));
  });

  it("Duplicate approvals from one approver count once", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 2 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 2 },
          requestedAt: "2026-08-06T10:00:00Z",
          decisions: [
            {
              approver: { actorId: "approver-1", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
            {
              approver: { actorId: "approver-1", type: "HUMAN" }, // Duplicate
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:05:00Z",
            },
          ],
        },
      ],
      approverAuthorities: [
        {
          actorId: "approver-1",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER",
          scope: "GLOBAL",
          activeFrom: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.MISSING_APPROVAL));
  });

  it("Two distinct authorized approvers satisfy a two-approval requirement", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 2 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 2 },
          requestedAt: "2026-08-06T10:00:00Z",
          decisions: [
            {
              approver: { actorId: "approver-1", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
            {
              approver: { actorId: "approver-2", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:05:00Z",
            },
          ],
        },
      ],
      approverAuthorities: [
        {
          actorId: "approver-1",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER",
          scope: "GLOBAL",
          activeFrom: "2026-01-01T00:00:00Z",
        },
        {
          actorId: "approver-2",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER",
          scope: "GLOBAL",
          activeFrom: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, true);
    assert.deepEqual(result.reasons, []);
  });

  it("Unauthorized role fails", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "LEGAL_COUNSEL", minimumApprovals: 1 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "LEGAL_COUNSEL", minimumApprovals: 1 },
          requestedAt: "2026-08-06T10:00:00Z",
          decisions: [
            {
              approver: { actorId: "approver-1", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
          ],
        },
      ],
      approverAuthorities: [
        {
          actorId: "approver-1",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER", // Mismatch
          scope: "GLOBAL",
          activeFrom: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.UNAUTHORIZED_APPROVER_ROLE));
  });

  it("Wrong authority scope fails", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 1, scope: "NORTH_EAST" }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1, scope: "NORTH_EAST" },
          requestedAt: "2026-08-06T10:00:00Z",
          decisions: [
            {
              approver: { actorId: "approver-1", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
          ],
        },
      ],
      approverAuthorities: [
        {
          actorId: "approver-1",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER",
          scope: "SOUTH_WEST", // Scope mismatch
          activeFrom: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.AUTHORITY_SCOPE_MISMATCH));
  });

  it("Revoked authority fails", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 },
          requestedAt: "2026-08-06T10:00:00Z",
          decisions: [
            {
              approver: { actorId: "approver-1", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
          ],
        },
      ],
      approverAuthorities: [
        {
          actorId: "approver-1",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER",
          scope: "GLOBAL",
          activeFrom: "2026-01-01T00:00:00Z",
          revoked: true,
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.AUTHORITY_REVOKED));
  });

  it("Future authority fails", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 },
          requestedAt: "2026-08-06T10:00:00Z",
          decisions: [
            {
              approver: { actorId: "approver-1", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
          ],
        },
      ],
      approverAuthorities: [
        {
          actorId: "approver-1",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER",
          scope: "GLOBAL",
          activeFrom: "2026-08-10T00:00:00Z", // Future date
        },
      ],
      currentTime: "2026-08-06T12:30:00Z",
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.AUTHORITY_INACTIVE_FUTURE));
  });

  it("Expired authority fails", () => {
    const envelope = createValidEnvelope();
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [{ role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 }],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1 },
          requestedAt: "2026-08-06T10:00:00Z",
          decisions: [
            {
              approver: { actorId: "approver-1", type: "HUMAN" },
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
          ],
        },
      ],
      approverAuthorities: [
        {
          actorId: "approver-1",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER",
          scope: "GLOBAL",
          activeFrom: "2026-01-01T00:00:00Z",
          activeUntil: "2026-08-01T00:00:00Z", // Expired
        },
      ],
      currentTime: "2026-08-06T12:30:00Z",
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.AUTHORITY_EXPIRED));
  });

  it("Requester approving their own request fails when separation of duties is required", () => {
    const envelope = createValidEnvelope({
      requestingActor: { actorId: "actor-user-1", type: "HUMAN" },
    });
    const hash = hashCanonicalEnvelope(envelope);

    const snapshot = createValidSnapshot({
      envelope,
      computedEnvelopeHash: hash,
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        result: "REVIEW_REQUIRED",
        requiredApprovals: [
          { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1, separationOfDutiesRequired: true },
        ],
      },
      approvalRequests: [
        {
          requestId: "req-1",
          actionId: envelope.actionId,
          organizationId: envelope.organizationId,
          actionType: envelope.actionType,
          envelopeHash: hash,
          requirement: { role: "ACQUISITIONS_MANAGER", minimumApprovals: 1, separationOfDutiesRequired: true },
          requestedAt: "2026-08-06T10:00:00Z",
          decisions: [
            {
              approver: { actorId: "actor-user-1", type: "HUMAN" }, // Self approval!
              decision: "APPROVE",
              decidedAt: "2026-08-06T11:00:00Z",
            },
          ],
        },
      ],
      approverAuthorities: [
        {
          actorId: "actor-user-1",
          organizationId: envelope.organizationId,
          role: "ACQUISITIONS_MANAGER",
          scope: "GLOBAL",
          activeFrom: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.SEPARATION_OF_DUTIES_VIOLATION));
  });

  it("Global kill switch fails", () => {
    const snapshot = createValidSnapshot({ globalKillSwitch: true });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.GLOBAL_KILL_SWITCH_ACTIVE));
  });

  it("Channel kill switch fails if implemented in the snapshot", () => {
    const snapshot = createValidSnapshot({ channelKillSwitch: true });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.CHANNEL_KILL_SWITCH_ACTIVE));
  });

  it("Stale evidence fails", () => {
    const snapshot = createValidSnapshot({
      evidenceSnapshots: [
        {
          evidenceId: "ev-1",
          type: "PROOF_OF_FUNDS",
          contentHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
          retrievedAt: "2026-08-06T10:00:00Z",
          current: false, // Stale evidence
        },
      ],
    });
    assert.equal(evaluateExecutionAuthorization(snapshot).authorized, false);
  });

  it("Unauthorized adapter fails", () => {
    const snapshot = createValidSnapshot({
      adapterId: "adapter-unauthorized",
      authorizedAdapters: ["adapter-allowed-1", "adapter-allowed-2"],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.UNAUTHORIZED_ADAPTER));
  });

  it("Unknown prior execution outcome fails", () => {
    const snapshot = createValidSnapshot({
      unresolvedPriorAttempts: [
        { attemptId: "attempt-1", outcome: "EXECUTION_OUTCOME_UNKNOWN" },
      ],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.UNRESOLVED_EXECUTION_ATTEMPT));
  });

  it("Expired execution deadline fails", () => {
    const envelope = createValidEnvelope({
      executionDeadline: "2026-08-06T12:00:00Z",
    });

    const snapshot = createValidSnapshot({
      envelope,
      computedEnvelopeHash: hashCanonicalEnvelope(envelope),
      policyDecision: {
        ...createValidSnapshot().policyDecision,
        envelopeHash: hashCanonicalEnvelope(envelope),
      },
      currentTime: "2026-08-06T12:30:00Z",
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.EXECUTION_DEADLINE_ELAPSED));
  });

  it("Non-READY action fails", () => {
    const snapshot = createValidSnapshot({ actionState: "DRAFT" });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.ACTION_NOT_READY));
  });

  it("Multiple simultaneous failures return multiple reason codes", () => {
    const snapshot = createValidSnapshot({
      actionState: "DRAFT",
      globalKillSwitch: true,
      channelKillSwitch: true,
      adapterId: "adapter-bad",
      authorizedAdapters: ["adapter-good"],
    });
    const result = evaluateExecutionAuthorization(snapshot);
    assert.equal(result.authorized, false);
    assert.ok(result.reasons.length >= 4);
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.ACTION_NOT_READY));
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.GLOBAL_KILL_SWITCH_ACTIVE));
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.CHANNEL_KILL_SWITCH_ACTIVE));
    assert.ok(result.reasons.includes(AUTHORIZATION_FAILURE_CODES.UNAUTHORIZED_ADAPTER));
  });
});
