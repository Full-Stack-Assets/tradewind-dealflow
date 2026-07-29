import type { AuditEvent } from "./contracts.ts";
import { canonicalJson } from "./policy.ts";
import type { D1Database, D1PreparedStatement } from "../../server/d1.ts";

export const GENESIS_AUDIT_HASH = "0".repeat(64);

export type AuditEventInput = Omit<AuditEvent, "sequence" | "previousHash" | "eventHash">;

type StoredAuditEvent = {
  sequence: number;
  id: string;
  occurred_at: string;
  actor_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  metadata_json: string;
  previous_hash: string;
  event_hash: string;
};

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toAuditEvent(event: StoredAuditEvent): AuditEvent {
  return {
    sequence: event.sequence,
    id: event.id,
    occurredAt: event.occurred_at,
    actorId: event.actor_id,
    eventType: event.event_type,
    aggregateType: event.aggregate_type,
    aggregateId: event.aggregate_id,
    metadataJson: event.metadata_json,
    previousHash: event.previous_hash,
    eventHash: event.event_hash,
  };
}

function isPreviousHashConflict(error: unknown): boolean {
  return error instanceof Error && /audit_events\.previous_hash|UNIQUE constraint failed/i.test(error.message);
}

export async function appendAuditEvent(
  db: D1Database,
  stateChange: D1PreparedStatement | D1PreparedStatement[],
  event: AuditEventInput,
): Promise<AuditEvent> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const head = await db.prepare(
      "SELECT event_hash FROM audit_events ORDER BY sequence DESC LIMIT 1",
    ).first<{ event_hash: string }>();
    const previousHash = head?.event_hash ?? GENESIS_AUDIT_HASH;
    const eventHash = await sha256(`${previousHash}${canonicalJson(event)}`);
    const insert = db.prepare(
      "INSERT INTO audit_events (id, occurred_at, actor_id, event_type, aggregate_type, aggregate_id, metadata_json, previous_hash, event_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(event.id, event.occurredAt, event.actorId, event.eventType, event.aggregateType, event.aggregateId, event.metadataJson, previousHash, eventHash);
    try {
      await db.batch([...(Array.isArray(stateChange) ? stateChange : [stateChange]), insert]);
      const stored = await db.prepare(
        "SELECT sequence, id, occurred_at, actor_id, event_type, aggregate_type, aggregate_id, metadata_json, previous_hash, event_hash FROM audit_events WHERE id = ?",
      ).bind(event.id).first<StoredAuditEvent>();
      if (!stored) throw new Error("audit event was not persisted");
      return toAuditEvent(stored);
    } catch (error) {
      if (attempt === 0 && isPreviousHashConflict(error)) continue;
      throw error;
    }
  }
  throw new Error("audit append retry exhausted");
}
