# Tradewind Control Plane and Provider Boundaries Design

**Date:** 2026-08-06

**Status:** Approved for implementation

## Goal

Complete the local-first Tradewind control plane without weakening the existing
MassGIS boundary: D1 is the system of record for approval and provenance
records, ElevenLabs is the selected webhook/outbound provider boundary, and
contact enrichment remains provider-neutral until a vendor contract is
explicitly configured.

"Enabled outbound execution" means the server-side execution path is present
and can run only after configuration, exact-envelope authorization, current
human approvals, and kill-switch checks succeed. It does not authorize this
checkout to place a live call or send a live message.

## Architecture

The worker keeps its existing D1 binding `DB`. A new additive migration stores
execution actions, envelope versions, policy decisions, approval requests and
decisions, approver authority, state transitions, provenance events, idempotency
claims, provider attempts, receipts, and webhook replay keys. Every material
record carries the canonical envelope hash where applicable.

The TypeScript ledger is deterministic and append-only at the application
boundary. It uses length-prefixed canonical event encoding, a sequence number,
the previous event hash, and the event hash. Verification reports sequence,
linkage, and tamper failures without mutating data.

The approval queue is a D1-backed operator route and workspace. Creating or
deciding an approval never authorizes execution by itself; execution rechecks
policy, exact envelope hash, expiry, role/scope authority, separation of
duties, evidence freshness, idempotency, and kill switches immediately before
the provider call.

ElevenLabs receives outbound calls through a server-only adapter. Inbound
webhooks verify an HMAC signature, timestamp/replay window, event id, and D1
idempotency claim before recording a provenance event. Missing configuration or
an invalid authorization snapshot fails closed. Skip tracing exposes a typed
provider-neutral contract and a configured HTTP implementation without
guessing a vendor-specific API shape.

Exports remain local and owner/contact-free. CSV uses the existing allowlist;
XLSX is generated as a minimal SpreadsheetML ZIP with string cells encoded as
inline strings so spreadsheet formulas cannot execute.

## Error handling and safety

- Secrets are read only from server environment bindings and never returned in
  responses, logs, exports, or evidence documents.
- Webhook failures return a generic client-safe error and do not create a
  partial action.
- Duplicate webhook ids are acknowledged idempotently after the original
  event is confirmed durable.
- Unknown provider events are retained as typed, non-executable provenance.
- Outbound calls require `globalKillSwitch === false`, channel kill switch
  clear, an allowed adapter id, an `ALLOW` or fully satisfied review decision,
  a current envelope hash, and a unique idempotency key.
- MassGIS ingestion remains owner/contact-free and remains the only default
  scheduled pipeline.

## Verification

Tests cover canonical ledger hashes, sequence/tamper detection, D1 approval
round trips, webhook signature/replay/idempotency behavior, outbound
authorization, skip-tracing contract validation, CSV/XLSX export contents,
and the approval queue route. Full verification runs unit tests, typecheck,
lint, build, rendered-route tests, and `git diff --check`.
