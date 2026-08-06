# Automated API Lead Retrieval and Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-only manual lead import/export with a D1-backed scheduled pipeline that retrieves owner-free MassGIS parcel candidates, optionally enriches approved records through the official DealMachine API, and exposes one concise operator review surface.

**Architecture:** MassGIS remains the authoritative parcel source. A scheduled D1 worker run stages and deduplicates records, then a separately configured DealMachine adapter performs provider-neutral property/people enrichment only when its server-side key, policy, and legal activation flag are present. D1 becomes the server system of record for lead records and enrichment provenance; the browser becomes a read/review surface and no longer requires CSV upload or manual retyping.

**Tech Stack:** Cloudflare Worker, D1/SQLite migrations, TypeScript, existing MassGIS ArcGIS adapter, DealMachine REST API (`https://api.v2.dealmachine.com/v1`), React/Vinext, existing provenance/audit helpers, Node test runner.

## Global Constraints

- Keep `DEALMACHINE_API_KEY` and any provider secrets out of Git, tests with real values, logs, UI, and chat.
- Preserve owner/contact-free MassGIS requests and source provenance; owner fields may enter D1 only from the configured enrichment provider and must be redacted from exports until a separate approved export policy exists.
- No automated calling, texting, emailing, direct mail, contract generation, or outreach authorization is introduced.
- Enrichment is disabled unless the deployment secret, provider activation flag, allowed geography, and compliance activation receipt are present; missing configuration returns a safe unavailable state.
- Every provider request is bounded, idempotent, retried only for transient failures, and recorded with provider, request hash, response status, credit metadata when supplied, and timestamps without storing raw provider secrets.
- Do not delete existing browser data or migrations; additive migration and backward-compatible read behavior are required.
- Preserve the five-item primary navigation and remove manual import/export as the primary workflow only after the D1-backed read path is verified.

---

### Task 1: Define the automated lead and enrichment contracts

**Files:**
- Create: `lib/automation/lead-contracts.ts`
- Modify: `lib/ingestion/contracts.ts`
- Test: `tests/automated-lead-contracts.test.ts`

**Interfaces:**
- Produces `AutomatedLeadRecord`, `OwnerEnrichment`, `EnrichmentAttempt`, and `LeadSourcePolicy` types used by D1 storage, provider adapters, and API responses.
- Produces `normalizeDealMachineProperty(value: unknown): AutomatedLeadRecord | null` and `normalizeDealMachinePerson(value: unknown): OwnerEnrichment | null`.

- [ ] **Step 1: Write failing tests** for required provenance, rejection of owner fields in MassGIS candidates, normalization of DealMachine property/people envelopes, and absence of provider secrets from serialized records.
- [ ] **Step 2: Run the focused test** with `node --experimental-strip-types --test tests/automated-lead-contracts.test.ts` and confirm failure because the contracts do not exist.
- [ ] **Step 3: Implement bounded contracts** with explicit source IDs, address matching keys, provider IDs, enrichment status, confidence/unknown values, and no arbitrary JSON passthrough.
- [ ] **Step 4: Run the focused test** and confirm it passes.
- [ ] **Step 5: Commit** with `git add lib/automation lib/ingestion/contracts.ts tests/automated-lead-contracts.test.ts && git commit -m "feat: define automated lead contracts"`.

### Task 2: Add additive D1 tables for canonical leads and enrichment provenance

**Files:**
- Create: `drizzle/0003_automated_leads.sql`
- Modify: `drizzle/meta/_journal.json` only if the project migration tooling requires it
- Modify: `server/d1.ts`
- Create: `server/automated-lead-store.ts`
- Test: `tests/automated-lead-store.test.ts`

**Interfaces:**
- Produces `upsertAutomatedLead`, `getAutomatedLead`, `listAutomatedLeads`, `recordEnrichmentAttempt`, and `getEnrichmentStatus`.
- Uses tables `automated_leads`, `lead_enrichment_attempts`, and `lead_owner_profiles` with unique `(source, source_record_id)` and unique `(provider, provider_record_id)` constraints.

- [ ] **Step 1: Write failing migration/store tests** covering idempotent source upserts, changed source fingerprints, provider retry claims, organization scoping, and no raw API key persistence.
- [ ] **Step 2: Run `node --experimental-strip-types --test tests/automated-lead-store.test.ts`** and confirm failure because migration and store functions are absent.
- [ ] **Step 3: Implement migration** with JSON only for bounded normalized facts, explicit columns for matching/provenance/status, created/updated timestamps, and indexes for status, location, and next enrichment attempt.
- [ ] **Step 4: Implement D1 store operations** using bound parameters, transaction-style batches where supported, and idempotency keys derived from source/provider IDs plus request hash.
- [ ] **Step 5: Run migration reconciliation and focused tests**; confirm no existing migration changes and all store tests pass.
- [ ] **Step 6: Commit** with `git add drizzle server/automated-lead-store.ts server/d1.ts tests/automated-lead-store.test.ts && git commit -m "feat: persist automated leads in D1"`.

### Task 3: Implement the official DealMachine provider adapter

**Files:**
- Create: `server/providers/dealmachine.ts`
- Modify: `server/providers/provider-config.ts`
- Test: `tests/dealmachine-provider.test.ts`

**Interfaces:**
- Produces `createDealMachineProvider(env, fetcher)` with `searchProperties(input)` and `searchPeople(input)` methods implementing the existing provider-neutral enrichment boundary.
- Uses `POST /v1/properties/search` and `POST /v1/people/search` with `Authorization: Bearer <server secret>`, bounded `per_page <= 250`, explicit field selection, and strict response normalization.

- [ ] **Step 1: Write failing tests** for request URL/auth/header shape, allowed Fall River/New Bedford locations, bounded page size, pagination, response normalization, 401/429/5xx behavior, and provider credit metadata handling.
- [ ] **Step 2: Run the focused test** and confirm failure because the adapter is absent.
- [ ] **Step 3: Implement the adapter** against the official API contract, never logging the key or raw owner response, and returning generic safe errors to callers.
- [ ] **Step 4: Add retry classification**: one bounded retry for 408/429/5xx with `Retry-After` capped to the worker budget; no retry for 400/401/403.
- [ ] **Step 5: Run focused provider tests** with mocked responses only and confirm all pass.
- [ ] **Step 6: Commit** with `git add server/providers tests/dealmachine-provider.test.ts && git commit -m "feat: add DealMachine enrichment adapter"`.

### Task 4: Automate MassGIS retrieval, enrichment, and D1 upsert

**Files:**
- Create: `server/automated-lead-runner.ts`
- Modify: `server/ingestion-scheduler.ts`
- Modify: `worker/index.ts`
- Modify: `server/ingestion-runner.ts` only where shared run classification is needed
- Test: `tests/automated-lead-runner.test.ts`

**Interfaces:**
- Produces `runAutomatedLeadCycle(env, now, signal)` and `runDueAutomatedLeadCycles(env, now)`.
- Runs the existing bounded MassGIS adapter first; enriches only safe, deduplicated records; records each provider attempt; never sends outreach.

- [ ] **Step 1: Write failing tests** for scheduled admission, exact daily/hourly idempotency, MassGIS records becoming D1 leads without browser interaction, enrichment disabled behavior, provider failure isolation, and retry/resume behavior.
- [ ] **Step 2: Run the focused test** and confirm failure because the automated runner is absent.
- [ ] **Step 3: Implement the runner** with a maximum records-per-cycle cap, deterministic source/provider request hashes, D1 run/audit events, and bounded concurrency of one provider request at a time.
- [ ] **Step 4: Wire the hourly cron** to call the runner without changing `/healthz` outreach status or enabling outbound actions.
- [ ] **Step 5: Run focused runner tests and existing ingestion tests**; confirm manual and scheduled classification remains deterministic.
- [ ] **Step 6: Commit** with `git add server/automated-lead-runner.ts server/ingestion-scheduler.ts worker/index.ts server/ingestion-runner.ts tests/automated-lead-runner.test.ts && git commit -m "feat: automate MassGIS lead cycles"`.

### Task 5: Add authenticated D1 lead reads and eliminate manual lead import as the primary path

**Files:**
- Create: `server/automated-lead-api.ts`
- Modify: `worker/index.ts`
- Create: `lib/automation/client.ts`
- Modify: `components/workspaces/PipelineWorkspace.tsx`
- Modify: `components/workspaces/DashboardWorkspace.tsx`
- Modify: `components/workspaces/SourcesWorkspace.tsx`
- Test: `tests/automated-lead-api.test.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces authenticated `GET /api/leads`, `GET /api/leads/:id`, and `GET /api/leads/health` routes with organization scoping and pagination.
- Browser client reads D1 lead summaries and provider status; CSV upload, manual source-file selection, and primary export controls are removed from the default path but remain available only as an explicit recovery/admin capability until retirement is separately approved.

- [ ] **Step 1: Write failing API tests** for missing auth, organization isolation, pagination, field redaction, and provider status rendering.
- [ ] **Step 2: Run focused API tests** and confirm failure.
- [ ] **Step 3: Implement authenticated D1 routes** with no owner/contact fields in list responses by default; detailed owner data requires a separate authorized role/scope check.
- [ ] **Step 4: Implement the browser client** with loading, unavailable, stale, empty, and enriched states; never show fake records.
- [ ] **Step 5: Replace the Pipeline/Sources primary UI** with “Last automated run”, “New leads”, “Needs enrichment”, “Needs review”, and one review link; move recovery import/export behind an explicit recovery panel.
- [ ] **Step 6: Run API, rendered HTML, typecheck, and accessibility-focused tests**; confirm exactly five primary navigation choices remain.
- [ ] **Step 7: Commit** with `git add server/automated-lead-api.ts lib/automation/client.ts worker/index.ts components/workspaces tests && git commit -m "feat: make D1 leads the default workflow"`.

### Task 6: Add provider activation, secret-manager documentation, and honest health state

**Files:**
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/CONTROL_PLANE_RELEASE_EVIDENCE.md`
- Modify: `docs/KNOWN_LIMITATIONS.md`
- Modify: `server/health.ts` or the existing health route location
- Test: `tests/healthz.test.ts` or the existing health test file

**Interfaces:**
- Adds optional `DEALMACHINE_API_KEY`, `DEALMACHINE_ENABLED`, `DEALMACHINE_ALLOWED_MARKETS`, and `DEALMACHINE_DATA_USE_APPROVAL` server-only configuration.
- `/healthz` reports `leadAutomation: "configured" | "available" | "disabled"` and `ownerEnrichment: "disabled" | "configured" | "available"` without exposing secret presence details beyond safe status.

- [ ] **Step 1: Write failing tests** for all configuration combinations and fail-closed health output.
- [ ] **Step 2: Implement safe configuration parsing** and documentation; no key values or provider response bodies are emitted.
- [ ] **Step 3: Run health tests and update release evidence** to distinguish local adapter tests from live provider receipts.
- [ ] **Step 4: Commit** with `git add docs server tests && git commit -m "docs: gate automated enrichment activation"`.

### Task 7: Full verification and private deployment

**Files:**
- Modify: `docs/CONTROL_PLANE_RELEASE_EVIDENCE.md` with final receipt only after deployment

- [ ] **Step 1: Run `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:render`, and `git diff --check`.
- [ ] **Step 2: Inspect the archive** for `dist/server/index.js`, `dist/.openai/hosting.json`, `dist/.openai/drizzle/0003_automated_leads.sql`, and the hourly cron declaration.
- [ ] **Step 3: Push the exact SHA** to GitHub and the existing Sites source repository.
- [ ] **Step 4: Save and deploy one private Sites version; do not provision `DEALMACHINE_API_KEY` in this step.
- [ ] **Step 5: Verify owner-session `/healthz`, authenticated `/api/leads`, migration receipts, cron registration, and anonymous 401 behavior.
- [ ] **Step 6: Record deployment SHA, version, migration receipt, cron receipt, rollback version, and the fact that live enrichment remains unverified until the secret and compliance activation receipt exist.

## Scope review

- MassGIS automated retrieval is covered by Tasks 2 and 4.
- Owner enrichment through an official, selected provider is covered by Tasks 1, 3, 4, and 6.
- No manual CSV import/export or repeated property typing in the primary path is covered by Task 5.
- Secret safety, auditability, idempotency, organization isolation, and fail-closed activation are covered by Tasks 2–6.
- Automated outreach and contracts are deliberately not covered and remain disabled.
