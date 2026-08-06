import { canonicalize } from "../control-plane-core.ts";
import { LEDGER_SCHEMA_VERSION, type LedgerEventInput } from "./types.ts";

function lengthPrefix(value: string): string {
  return `${value.length}:${value}`;
}

export function canonicalizeLedgerEvent(event: LedgerEventInput): string {
  const fields = [
    LEDGER_SCHEMA_VERSION,
    String(event.sequence),
    event.eventId,
    event.occurredAt,
    event.actorId,
    event.eventType,
    event.aggregateType,
    event.aggregateId,
    event.previousHash ?? "GENESIS",
    canonicalize(event.payload),
  ];
  return fields.map(lengthPrefix).join("");
}
