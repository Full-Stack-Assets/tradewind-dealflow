import { hashCanonicalEnvelope, type ApprovalRequirement, type CanonicalExecutionEnvelope, type SHA256Hash } from "../lib/control-plane/control-plane-core.ts";
import { createLedgerEvent, hashLedgerEvent } from "../lib/control-plane/ledger/ledger-verifier.ts";
import type { D1Database } from "./d1.ts";

export interface ApprovalQueueItem {
  requestId: string;
  actionId: string;
  organizationId: string;
  actionType: string;
  targetEntityId: string;
  envelopeHash: SHA256Hash;
  requirement: ApprovalRequirement;
  requesterActorId: string;
  requestedAt: string;
  expiresAt: string | null;
  status: string;
  decisions: ApprovalDecisionRecord[];
}

export interface ApprovalDecisionRecord {
  decisionId: string;
  approverActorId: string;
  approverRole: string;
  decision: "APPROVED" | "REJECTED";
  envelopeHash: SHA256Hash;
  comments: string | null;
  decidedAt: string;
}

export interface CreateApprovalInput {
  organizationId: string;
  actionId: string;
  actionType: string;
  targetEntityId: string;
  envelope: CanonicalExecutionEnvelope;
  envelopeHash: SHA256Hash;
  requirement: ApprovalRequirement;
  requesterActorId: string;
  expiresAt?: string | null;
  idempotencyKey?: string;
  now?: string;
}

export interface DecideApprovalInput {
  organizationId: string;
  requestId: string;
  approverActorId: string;
  approverRole: string;
  decision: "APPROVED" | "REJECTED";
  envelopeHash: SHA256Hash;
  comments?: string;
  now?: string;
}

type RequestRow = {
  request_id: string;
  action_id: string;
  organization_id: string;
  action_type: string;
  target_entity_id: string;
  envelope_hash: SHA256Hash;
  requirement_json: string;
  requester_actor_id: string;
  requested_at: string;
  expires_at: string | null;
  status: string;
};

type DecisionRow = {
  decision_id: string;
  approver_actor_id: string;
  approver_role: string;
  decision: "APPROVED" | "REJECTED";
  envelope_hash: SHA256Hash;
  comments: string | null;
  decided_at: string;
};

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function parseRequirement(value: string): ApprovalRequirement {
  const requirement = JSON.parse(value) as ApprovalRequirement;
  if (!requirement.role || !Number.isInteger(requirement.minimumApprovals) || requirement.minimumApprovals < 1) {
    throw new Error("approval requirement is invalid");
  }
  return requirement;
}

function requestFromRow(row: RequestRow, decisions: DecisionRow[]): ApprovalQueueItem {
  return {
    requestId: row.request_id,
    actionId: row.action_id,
    organizationId: row.organization_id,
    actionType: row.action_type,
    targetEntityId: row.target_entity_id,
    envelopeHash: row.envelope_hash,
    requirement: parseRequirement(row.requirement_json),
    requesterActorId: row.requester_actor_id,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    status: row.status,
    decisions: decisions.map((decision) => ({
      decisionId: decision.decision_id,
      approverActorId: decision.approver_actor_id,
      approverRole: decision.approver_role,
      decision: decision.decision,
      envelopeHash: decision.envelope_hash,
      comments: decision.comments,
      decidedAt: decision.decided_at,
    })),
  };
}

async function decisionsFor(db: D1Database, requestId: string): Promise<DecisionRow[]> {
  const result = await db.prepare(
    "SELECT decision_id, approver_actor_id, approver_role, decision, envelope_hash, comments, decided_at FROM control_plane_approval_decisions WHERE request_id = ? ORDER BY decided_at ASC",
  ).bind(requestId).all<DecisionRow>();
  return result.results;
}

export async function getApprovalRequest(db: D1Database, organizationId: string, requestId: string): Promise<ApprovalQueueItem | null> {
  const row = await db.prepare(
    "SELECT request_id, action_id, organization_id, action_type, target_entity_id, envelope_hash, requirement_json, requester_actor_id, requested_at, expires_at, status FROM control_plane_approval_requests WHERE organization_id = ? AND request_id = ? LIMIT 1",
  ).bind(organizationId, requestId).first<RequestRow>();
  return row ? requestFromRow(row, await decisionsFor(db, row.request_id)) : null;
}

export async function listApprovalQueue(db: D1Database, organizationId: string): Promise<ApprovalQueueItem[]> {
  const result = await db.prepare(
    "SELECT request_id, action_id, organization_id, action_type, target_entity_id, envelope_hash, requirement_json, requester_actor_id, requested_at, expires_at, status FROM control_plane_approval_requests WHERE organization_id = ? ORDER BY requested_at DESC",
  ).bind(organizationId).all<RequestRow>();
  return Promise.all(result.results.map(async (row) => requestFromRow(row, await decisionsFor(db, row.request_id))));
}

async function appendLedgerEvent(db: D1Database, event: Parameters<typeof createLedgerEvent>[0]): Promise<void> {
  const previous = await db.prepare("SELECT event_hash FROM control_plane_ledger_events ORDER BY sequence DESC LIMIT 1").first<{ event_hash: SHA256Hash }>();
  const linked = createLedgerEvent({ ...event, previousHash: previous?.event_hash ?? null });
  await db.prepare(
    "INSERT INTO control_plane_ledger_events (event_id, occurred_at, actor_id, event_type, aggregate_type, aggregate_id, payload_json, previous_hash, event_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(linked.eventId, linked.occurredAt, linked.actorId, linked.eventType, linked.aggregateType, linked.aggregateId, JSON.stringify(linked.payload), linked.previousHash, hashLedgerEvent(linked)).run();
}

export async function createApprovalRequest(db: D1Database, input: CreateApprovalInput): Promise<{ item: ApprovalQueueItem; existing: boolean }> {
  const expectedHash = hashCanonicalEnvelope(input.envelope);
  if (expectedHash !== input.envelopeHash) throw new Error("envelope hash does not match canonical envelope");
  if (input.envelope.organizationId !== input.organizationId || input.envelope.actionId !== input.actionId) {
    throw new Error("envelope identity does not match approval request");
  }
  const idempotencyKey = input.idempotencyKey ?? input.envelope.idempotencyKey;
  const existing = await db.prepare(
    "SELECT request_id FROM control_plane_approval_requests WHERE organization_id = ? AND action_id = (SELECT id FROM control_plane_actions WHERE organization_id = ? AND idempotency_key = ?) LIMIT 1",
  ).bind(input.organizationId, input.organizationId, idempotencyKey).first<{ request_id: string }>();
  if (existing) {
    const item = await getApprovalRequest(db, input.organizationId, existing.request_id);
    if (!item) throw new Error("existing approval request could not be loaded");
    return { item, existing: true };
  }
  const now = input.now ?? new Date().toISOString();
  const requestId = id("approval");
  await db.batch([
    db.prepare("INSERT INTO control_plane_actions (id, organization_id, action_type, target_entity_id, requesting_actor_id, current_state, current_envelope_hash, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?, ?, ?, ?)").bind(input.actionId, input.organizationId, input.actionType, input.targetEntityId, input.requesterActorId, input.envelopeHash, idempotencyKey, now, now),
    db.prepare("INSERT INTO control_plane_envelopes (action_id, organization_id, envelope_hash, envelope_json, created_at) VALUES (?, ?, ?, ?, ?)").bind(input.actionId, input.organizationId, input.envelopeHash, JSON.stringify(input.envelope), now),
    db.prepare("INSERT INTO control_plane_approval_requests (request_id, action_id, organization_id, action_type, target_entity_id, envelope_hash, requirement_json, requester_actor_id, requested_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')").bind(requestId, input.actionId, input.organizationId, input.actionType, input.targetEntityId, input.envelopeHash, JSON.stringify(input.requirement), input.requesterActorId, now, input.expiresAt ?? null),
  ]);
  await appendLedgerEvent(db, {
    sequence: 0,
    eventId: id("event"),
    occurredAt: now,
    actorId: input.requesterActorId,
    eventType: "APPROVAL_REQUESTED",
    aggregateType: "ACTION",
    aggregateId: input.actionId,
    payload: { envelopeHash: input.envelopeHash, requirement: input.requirement },
    previousHash: null,
  });
  const item = await getApprovalRequest(db, input.organizationId, requestId);
  if (!item) throw new Error("approval request was not persisted");
  return { item, existing: false };
}

export async function decideApproval(db: D1Database, input: DecideApprovalInput): Promise<ApprovalQueueItem> {
  const item = await getApprovalRequest(db, input.organizationId, input.requestId);
  if (!item) throw new Error("approval request not found");
  if (item.envelopeHash !== input.envelopeHash) throw new Error("approval envelope hash is stale");
  const now = input.now ?? new Date().toISOString();
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= new Date(now).getTime()) {
    await db.prepare("UPDATE control_plane_approval_requests SET status = 'EXPIRED' WHERE request_id = ? AND status = 'PENDING'").bind(item.requestId).run();
    throw new Error("approval request has expired");
  }
  if (item.status !== "PENDING") throw new Error(`approval request is ${item.status.toLowerCase()}`);
  if (item.requirement.role !== input.approverRole) throw new Error("approver role is not authorized for this requirement");
  const authority = await db.prepare(
    "SELECT id FROM control_plane_authorities WHERE organization_id = ? AND actor_id = ? AND role = ? AND (scope = ? OR scope = '*') AND revoked = 0 AND active_from <= ? AND (active_until IS NULL OR active_until > ?) LIMIT 1",
  ).bind(input.organizationId, input.approverActorId, input.approverRole, item.actionType, now, now).first<{ id: string }>();
  if (!authority) throw new Error("approver authority is not active");
  if (item.requirement.separationOfDutiesRequired && item.requesterActorId === input.approverActorId) throw new Error("requester cannot approve this request");
  const decisionId = id("decision");
  await db.prepare("INSERT INTO control_plane_approval_decisions (decision_id, request_id, organization_id, approver_actor_id, approver_role, decision, envelope_hash, comments, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(decisionId, item.requestId, input.organizationId, input.approverActorId, input.approverRole, input.decision, input.envelopeHash, input.comments ?? null, now).run();
  const approvedCount = item.decisions.filter((decision) => decision.decision === "APPROVED").length + (input.decision === "APPROVED" ? 1 : 0);
  const nextStatus = input.decision === "REJECTED" ? "REJECTED" : approvedCount >= item.requirement.minimumApprovals ? "APPROVED" : "PENDING";
  await db.prepare("UPDATE control_plane_approval_requests SET status = ? WHERE request_id = ?").bind(nextStatus, item.requestId).run();
  await appendLedgerEvent(db, {
    sequence: 0,
    eventId: decisionId,
    occurredAt: now,
    actorId: input.approverActorId,
    eventType: "APPROVAL_DECIDED",
    aggregateType: "ACTION",
    aggregateId: item.actionId,
    payload: { requestId: item.requestId, decision: input.decision, envelopeHash: input.envelopeHash },
    previousHash: null,
  });
  const updated = await getApprovalRequest(db, input.organizationId, item.requestId);
  if (!updated) throw new Error("approval decision was not persisted");
  return updated;
}
