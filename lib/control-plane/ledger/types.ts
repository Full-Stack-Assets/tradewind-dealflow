import type { ActorReference, ISODateTime, SHA256Hash } from "../control-plane-core.ts";

export const LEDGER_SCHEMA_VERSION = "tradewind.ledger-event.v1" as const;

export interface LedgerEventInput {
  sequence: number;
  eventId: string;
  occurredAt: ISODateTime;
  actorId: string;
  actor?: ActorReference;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  previousHash: SHA256Hash | null;
}

export interface LedgerEvent extends LedgerEventInput {
  eventHash: SHA256Hash;
}

export interface LedgerVerificationResult {
  ok: boolean;
  errors: string[];
}
