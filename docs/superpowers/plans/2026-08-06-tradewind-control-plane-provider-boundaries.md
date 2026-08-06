# Tradewind Control Plane and Provider Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the D1-native control plane, hash-bound approval queue, ElevenLabs webhook/outbound boundary, provider-neutral skip-tracing contract, and tested CSV/XLSX exports without enabling unapproved live outreach.

**Architecture:** Additive D1 persistence and a deterministic application ledger sit behind the existing Cloudflare Worker. Server-only provider adapters are available but fail closed unless secrets, policy authorization, approvals, authority, and kill-switch checks all pass. The browser receives only sanitized approval/export data.

**Tech Stack:** TypeScript, Cloudflare Worker, D1, SQLite migrations, React, Node test runner, Web Crypto, browser Blob APIs.

## Global Constraints

- Keep the D1 binding name `DB` and existing MassGIS migrations intact.
- Never place secrets in source, tests, exports, logs, responses, screenshots, or documentation.
- Preserve `outreach: disabled` in `/healthz` until a separately verified production configuration is explicitly enabled.
- No owner/contact fields enter MassGIS ingestion, local exports, or ledger payloads by default.
- Every provider mutation requires exact-envelope hash authorization and human approval where policy requires review.
- Do not claim live provider or production deployment verification from local tests.

### Task 1: Canonical ledger and workspace envelope typing

**Files:**
- Create: `lib/control-plane/ledger/types.ts`
- Create: `lib/control-plane/ledger/canonicalize.ts`
- Create: `lib/control-plane/ledger/ledger-verifier.ts`
- Modify: `lib/control-plane/workspace-integration.ts`
- Test: `tests/control-plane-ledger.test.ts`

**Interfaces:**
- `createLedgerEvent(input): LedgerEvent`
- `hashLedgerEvent(event): SHA256Hash`
- `verifyLedger(events): LedgerVerificationResult`
- `createEnvelopeFromWorkspaceDraft(draft, actionType): { envelope, envelopeHash }`

- [ ] Write failing tests for deterministic event hashing, sequence gaps, tampering, and typed workspace envelopes.
- [ ] Run `node --experimental-strip-types --test tests/control-plane-ledger.test.ts` and confirm the new tests fail for missing modules/types.
- [ ] Implement the ledger and correct the workspace envelope to use the existing `CanonicalExecutionEnvelope` contract.
- [ ] Re-run the focused tests and then `npm run typecheck`.

### Task 2: D1 control-plane persistence and approval API

**Files:**
- Create: `drizzle/0002_control_plane.sql`
- Create: `server/control-plane-store.ts`
- Create: `server/control-plane-api.ts`
- Modify: `server/d1.ts`
- Modify: `worker/index.ts`
- Test: `tests/control-plane-api.test.ts`

**Interfaces:**
- `listApprovalQueue(db, organizationId): Promise<ApprovalQueueItem[]>`
- `createApprovalRequest(db, input): Promise<ApprovalQueueItem>`
- `decideApproval(db, input): Promise<ApprovalQueueItem>`
- `handleControlPlaneApi(request, env): Promise<Response | null>`

- [ ] Write failing D1 tests for approval creation, exact-hash decisions, expiry, replay-safe event insertion, and organization isolation.
- [ ] Run the focused tests and confirm failure before implementation.
- [ ] Add additive SQLite tables and parameterized D1 store functions.
- [ ] Route `/api/control-plane/approvals` through the worker before the app handler.
- [ ] Re-run focused tests, typecheck, and rendered route tests.

### Task 3: Approval queue workspace and control-plane execution boundary

**Files:**
- Create: `components/workspaces/ApprovalQueueWorkspace.tsx`
- Create: `app/(workspace)/approvals/page.tsx`
- Modify: `components/WorkspaceShell.tsx`
- Create: `server/control-plane-execution.ts`
- Test: `tests/control-plane-execution.test.ts`

- [ ] Write failing tests proving stale hashes, expired approvals, unauthorized roles, self-approval, and kill switches block execution.
- [ ] Implement the execution boundary as a pure revalidation wrapper around `evaluateExecutionAuthorization`.
- [ ] Add the operator queue route with explicit pending/approved/rejected states and no client-side secret access.
- [ ] Re-run focused tests and rendered route checks.

### Task 4: ElevenLabs webhook, outbound adapter, and skip-tracing contract

**Files:**
- Create: `server/providers/elevenlabs.ts`
- Create: `server/providers/skip-tracing.ts`
- Create: `server/providers/provider-config.ts`
- Create: `server/webhooks/elevenlabs.ts`
- Modify: `worker/index.ts`
- Test: `tests/provider-boundaries.test.ts`

- [ ] Write failing tests for HMAC signature, timestamp window, duplicate event id, unknown event retention, missing secrets, and authorized outbound calls.
- [ ] Implement Web Crypto signature verification and D1 replay claims.
- [ ] Implement ElevenLabs request construction without logging credentials and require the control-plane execution boundary before `fetch`.
- [ ] Implement typed provider-neutral skip-tracing request/response validation with an optional configured base URL.
- [ ] Re-run focused tests; do not use live credentials.

### Task 5: CSV/XLSX exports and operator wiring

**Files:**
- Create: `lib/xlsx.ts`
- Modify: `lib/download.ts`
- Modify: `components/workspaces/PipelineWorkspace.tsx`
- Test: `tests/xlsx-export.test.ts`

- [ ] Write failing tests for XLSX ZIP structure, owner/contact exclusion, formula neutralization, and empty workspace export.
- [ ] Implement a dependency-free minimal XLSX writer using inline string cells and stored ZIP entries.
- [ ] Add an `Export property XLSX` operator action beside the existing CSV export.
- [ ] Re-run focused tests and rendered route tests.

### Task 6: Evidence reconciliation and release verification

**Files:**
- Modify: `docs/CONTROL_PLANE_RELEASE_EVIDENCE.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/KNOWN_LIMITATIONS.md`
- Modify: `README.md`
- Test: `tests/rendered-html.test.mjs`

- [ ] Replace unsupported completion claims with status categories and exact local evidence.
- [ ] Document D1 migration order, webhook configuration prerequisites, approval operations, and the no-live-credentials boundary.
- [ ] Run `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:render`, and `git diff --check`.
- [ ] Record remaining external gates: secret provisioning, provider sandbox receipt, authenticated production checks, D1 migration receipt, and live deployment SHA.
