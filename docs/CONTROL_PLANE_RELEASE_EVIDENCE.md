# Tradewind DealFlow Control Plane Release Evidence

**Evidence updated:** 2026-08-06

This document reports current source and local-test state. It is not a
provider receipt, legal approval, or production deployment receipt.

## Implemented and locally verified

- `lib/control-plane/control-plane-core.ts` provides canonical envelope hashing,
  legal state transitions, and execution authorization predicates.
- `lib/control-plane/ledger/` provides length-prefixed event canonicalization,
  deterministic event hashes, and sequence/link/tamper verification.
- `lib/control-plane/workspace-integration.ts` creates a typed, deterministic
  envelope without contact-phone fields.
- `drizzle/0002_control_plane.sql` adds D1 tables for actions, envelope
  versions, approvals, authority, ledger events, webhook events, and
  idempotency claims.
- `server/control-plane-store.ts` persists organization-scoped approvals and
  ledger events. Decisions require the exact envelope hash, active authority,
  correct scope, and separation of duties where required.
- `server/control-plane-api.ts` is routed by `worker/index.ts` at
  `/api/control-plane/approvals`.
- `/approvals` renders the operator approval queue. Approval does not mutate the
  envelope and does not bypass execution-time revalidation.
- `server/webhooks/elevenlabs.ts` verifies the official
  `ElevenLabs-Signature: t={unix},v0={hmac}` format, timestamp window, and D1
  duplicate event identity.
- `server/providers/elevenlabs.ts` implements the documented Twilio outbound
  call request behind the exact-envelope authorization boundary.
- `server/providers/skip-tracing.ts` provides a typed provider-neutral
  enrichment contract. It is not connected to MassGIS ingestion.
- `lib/xlsx.ts` generates a dependency-free XLSX export from the same
  owner/contact-safe allowlist used by CSV export.
- `server/ai-field-generation.ts` exposes an authenticated, same-origin,
  server-only OpenAI Responses API route with field allowlisting, bounded
  input/output, common contact-pattern redaction, `store: false`, and strict
  JSON-schema output validation.
- `components/ai/GenerateWithAIButton.tsx` adds visible draft-generation
  controls to material free-text fields. Generated text is inserted as an
  editable draft and requires operator review before the existing save action.
- `drizzle/0003_automated_leads.sql` adds organization-scoped D1 canonical lead,
  owner-profile, and enrichment-attempt tables without a secret column.
- `server/providers/rentcast.ts` implements bounded, server-only RentCast
  property retrieval using `X-Api-Key`; `server/automated-lead-runner.ts`
  stages MassGIS records and optionally persists matched owner facts.
- `/api/leads`, `/api/leads/:id`, and `/api/leads/health` require the private
  owner session and read organization-scoped D1 leads. Pipeline no longer
  presents CSV import/export or manual property entry as its primary workflow.

## Configured-but-not externally verified

The following server-only variables may be supplied through the deployment
secret manager. They are intentionally absent from this repository:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_PHONE_ID`
- `ELEVENLABS_WEBHOOK_SECRET`
- `SKIP_TRACING_API_KEY`
- `SKIP_TRACING_API_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional)
- `RENTCAST_API_KEY`
- `RENTCAST_ENABLED`
- `RENTCAST_DATA_USE_APPROVAL`

No local test uses a real credential. No live call, webhook delivery, or
skip-tracing lookup was performed. RentCast adapter tests use mocked responses
only.

## Current release boundary

- `/healthz` reports `outreach: "disabled"`, scheduled lead automation
  available, and owner enrichment disabled until the deployment activation
  flags and secret are present.
- MassGIS remains the only default scheduled parcel source; RentCast is an
  optional server-side owner-data enrichment stage.
- AI field generation is draft assistance only; it does not make qualification,
  approval, outreach, legal, or underwriting decisions and remains unavailable
  until `OPENAI_API_KEY` is provisioned through the secret manager.
- Outbound code is available only through server-side authorization and fails
  closed when configuration, approvals, authority, evidence, or kill-switch
  conditions are missing.
- Contact phone/email enrichment, AI voice, outreach, contracts, and
  webhook-derived business actions remain outside the verified production
  workflow. Owner names/mailing addresses are not live-verified yet.

## Required external evidence before live activation

- Provider sandbox or production configuration receipt, including webhook URL
  and secret provisioning record.
- Counsel/compliance approval for the exact Massachusetts channel, audience,
  consent/suppression model, script, calling hours, recording, and retention.
- Authenticated production route checks for `/`, `/dashboard`, `/sources`,
  `/pipeline`, `/approvals`, `/compliance`, and `/healthz`.
- D1 migration receipt confirming `0000_massgis_ingestion.sql`,
  `0001_harden_ingestion_runs.sql`, `0002_control_plane.sql`, and
  `0003_automated_leads.sql` were applied.
- Provider webhook test receipt, outbound test receipt, deployment SHA, and
  rollback version.

## Local verification record

Run from the exact candidate checkout:

```text
  npm run test:unit       # 298 passed, 0 failed
npm run typecheck       # passed
npm run lint             # passed; 3 pre-existing warnings in ingestion-runner.ts
npm run build            # passed; Vinext reports known Node-import compatibility warnings
  npm run test:render      # 23 passed, 0 failed
git diff --check         # passed
```

These results were recorded from the exact candidate checkout on 2026-08-06.
Local success does not prove deployment, D1 migration application, or provider
access.

## Last private deployment receipt

- Deployment status: succeeded on 2026-08-06 for the automated-lead candidate.
- Production URL: `https://tradewind-dealflow.blaizexb.chatgpt.site`.
- Deployed source SHA: `db4536ae556349e2c915b0fcb5b788cbd689a06e`.
- Saved Sites version: `15` (`appgprj_6a681e7c21f4819182043900ac4fd875~appgver_11e00f4691cc8191af98a9dda111e025`).
- Deployment ID: `appgdep_6a751b20478c8191860b64b58c51a657`.
- Provider deployment ID: `blaizexb--tradewind-dealflow`.
- The deployed archive contained `dist/.openai/drizzle/0000_massgis_ingestion.sql`,
  `0001_harden_ingestion_runs.sql`, `0002_control_plane.sql`, and
  `0003_automated_leads.sql`, plus the logical `DB` binding and hourly
  `0 * * * *` trigger in the generated worker configuration.
- The deployment remains private. Anonymous edge requests, including `/healthz`
  `/api/leads`, and `/pipeline`, correctly returned the Sites sign-in gate with
  HTTP 401. Owner-session route checks, authenticated D1 reads, and real D1
  migration/cron receipts remain pending the owner-session verification gate.
- An identity-less Sites bypass cannot forward the signed-in user headers used
  by the D1 API routes, so live authenticated API reads and the provider-side
  migration/cron receipts remain pending owner-session verification. No claim
  of live D1 mutation or hourly execution is made from this receipt.
- Sites runtime environment revision is `0` with no entries. `RENTCAST_API_KEY`
  has not been provisioned, so live RentCast retrieval remains disabled and
  unverified.
