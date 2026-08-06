import type { SHA256Hash } from "../control-plane-core.ts";
import { sha256Hex } from "../../sha256.ts";
import { canonicalizeLedgerEvent } from "./canonicalize.ts";
import type { LedgerEvent, LedgerEventInput, LedgerVerificationResult } from "./types.ts";

export function hashLedgerEvent(event: LedgerEventInput): SHA256Hash {
  const hex = sha256Hex(canonicalizeLedgerEvent(event));
  return `sha256:${hex}`;
}

export function createLedgerEvent(input: LedgerEventInput): LedgerEvent {
  return { ...input, eventHash: hashLedgerEvent(input) };
}

export function verifyLedger(events: readonly LedgerEvent[]): LedgerVerificationResult {
  const errors: string[] = [];
  const seenSequences = new Set<number>();
  const seenIds = new Set<string>();

  events.forEach((event, index) => {
    if (seenSequences.has(event.sequence)) errors.push(`duplicate sequence ${event.sequence}`);
    seenSequences.add(event.sequence);
    if (seenIds.has(event.eventId)) errors.push(`duplicate event id ${event.eventId}`);
    seenIds.add(event.eventId);

    const expectedSequence = index + 1;
    if (event.sequence !== expectedSequence) {
      errors.push(`sequence gap at index ${index}: expected ${expectedSequence}, received ${event.sequence}`);
    }

    const previous = events[index - 1];
    const expectedPrevious = previous?.eventHash ?? null;
    if (event.previousHash !== expectedPrevious) {
      errors.push(`previous hash mismatch for sequence ${event.sequence}`);
    }

    if (hashLedgerEvent(event) !== event.eventHash) {
      errors.push(`event hash mismatch for sequence ${event.sequence}`);
    }
  });

  return { ok: errors.length === 0, errors };
}
