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

## Configured-but-not externally verified

The following server-only variables may be supplied through the deployment
secret manager. They are intentionally absent from this repository:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_PHONE_ID`
- `ELEVENLABS_WEBHOOK_SECRET`
- `SKIP_TRACING_API_KEY`
- `SKIP_TRACING_API_URL`

No local test uses a real credential. No live call, webhook delivery, or
skip-tracing lookup was performed.

## Current release boundary

- `/healthz` continues to report `outreach: "disabled"` for the existing
  MassGIS release.
- MassGIS remains owner/contact-free and is the only default scheduled
  pipeline.
- Outbound code is available only through server-side authorization and fails
  closed when configuration, approvals, authority, evidence, or kill-switch
  conditions are missing.
- Contact enrichment, AI voice, outreach, contracts, and webhook-derived
  business actions remain outside the verified MassGIS production workflow.

## Required external evidence before live activation

- Provider sandbox or production configuration receipt, including webhook URL
  and secret provisioning record.
- Counsel/compliance approval for the exact Massachusetts channel, audience,
  consent/suppression model, script, calling hours, recording, and retention.
- Authenticated production route checks for `/`, `/dashboard`, `/sources`,
  `/pipeline`, `/approvals`, `/compliance`, and `/healthz`.
- D1 migration receipt confirming `0000_massgis_ingestion.sql`,
  `0001_harden_ingestion_runs.sql`, and `0002_control_plane.sql` were applied.
- Provider webhook test receipt, outbound test receipt, deployment SHA, and
  rollback version.

## Local verification record

Run from the exact candidate checkout:

```text
npm run test:unit       # 279 passed, 0 failed
npm run typecheck       # passed
npm run lint             # passed; 3 pre-existing warnings in ingestion-runner.ts
npm run build            # passed; Vinext reports known Node-import compatibility warnings
npm run test:render      # 21 passed, 0 failed
git diff --check         # passed
```

These results were recorded from the exact candidate checkout on 2026-08-06.
Local success does not prove deployment, D1 migration application, or provider
access.

## Current private deployment receipt

- Deployment status: succeeded on 2026-08-06.
- Production URL: `https://tradewind-dealflow.blaizexb.chatgpt.site`.
- Deployed source SHA: `3083b87f2bccd2d1f477706c813a600e79ad7a4c`.
- Saved Sites version: `10` (`appgprj_6a681e7c21f4819182043900ac4fd875~appgver_17c4413a7c908191aa26f6cd3e507f8b`).
- Deployment ID: `appgdep_6a750775490c8191b9df9bb0224a0ba8`.
- Provider deployment ID: `blaizexb--tradewind-dealflow`.
- The deployed archive contained `dist/.openai/drizzle/0000_massgis_ingestion.sql`,
  `0001_harden_ingestion_runs.sql`, and `0002_control_plane.sql`, plus the
  logical `DB` binding in `.openai/hosting.json`.
- Private authenticated page checks returned 200 for `/`, `/dashboard`,
  `/sources`, `/pipeline`, `/approvals`, and `/compliance`; `/healthz` returned
  the expected acquisitions release contract with `outreach: "disabled"`.
- An identity-less Sites bypass cannot forward the signed-in user headers used
  by the D1 API routes, so live authenticated API reads and the provider-side
  migration/cron receipts remain pending owner-session verification. No claim
  of live D1 mutation or hourly execution is made from this receipt.
