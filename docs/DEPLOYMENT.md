# Setup and Deployment

Release mode: Tradewind acquisitions OS with optional MassGIS ingestion

Hosting target: the existing private OpenAI Sites project

Data backend: D1 control plane plus D1 automated-lead system of record

## Local setup

Use Node.js 22.13 or newer:

```bash
npm ci
npm run dev
```

No MassGIS credential is required. The deployment must provide logical D1
binding `DB`, apply `drizzle/0000_massgis_ingestion.sql`,
`drizzle/0001_harden_ingestion_runs.sql`, and
`drizzle/0002_control_plane.sql`, and `drizzle/0003_automated_leads.sql`, and
register hourly cron `0 * * * *`. Do
not add secrets, private email addresses, seller records, buyer records, or
production exports to source control.

## Release verification

From the exact candidate source:

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:render
git diff --check
```

Task 8 also performs live desktop/mobile, keyboard, storage-recovery, security
header, dependency, runtime, and production-health checks. A successful build
alone is not a production release.

`GET /healthz` must return:

```json
{
  "status": "ok",
  "service": "tradewind-dealflow",
  "release": "acquisitions-os",
  "outreach": "disabled",
  "ingestion": {
    "manual": "disabled",
    "scheduled": "enabled",
    "ownerContactFields": "disabled",
    "leadAutomation": "available",
    "ownerEnrichment": "disabled"
  }
}
```

The endpoint proves that the deployed worker responds with the declared mode.
It does not inspect a user’s browser storage. Authenticated `/api/leads` reads
remain separately gated by the private owner session.

## Exact-commit Sites promotion

`.openai/hosting.json` identifies the existing Sites project. Reuse that
opaque project ID; do not create a second site.

1. Confirm the working tree contains only reviewed release changes.
2. Commit the verified source.
3. Push that exact commit to the source remote.
4. Build the deployment source from that pushed state.
5. Save a Sites version using the exact pushed commit SHA.
6. Deploy only that saved version.
7. Preserve the existing private access policy.
8. Apply the D1 migration and confirm the hourly cron registration.
9. Verify `/`, `/dashboard`, `/sources`, `/pipeline`, `/compliance`, and
   `/healthz`.
10. Review production response headers and runtime logs.
11. Record the commit SHA, saved-version ID, deployment URL, verification time,
    and rollback version in the release evidence ledger.

Do not claim the current branch is deployed until those steps are complete.

## Domain and DNS boundary

No DNS change is authorized by a code deployment.

1. Obtain the exact domain-verification and routing records from Sites.
2. Obtain explicit domain-owner approval.
3. Add only the exact `A`, `AAAA`, or `CNAME` record Sites supplies.
4. Do not guess an address or derive a DNS target from a deployment URL.
5. Resolve existing conflicting records before changing them.
6. Wait for managed TLS, then verify the hostname, certificate, canonical
   routes, mobile load, and `/healthz`.
7. Keep the prior verified deployment available until cutover is confirmed.

Public-access changes are also approval-gated. The release remains private
unless the owner explicitly authorizes an access-policy change.

## Secrets and external services

MassGIS is a public query-only provider. Future authentication, PostgreSQL,
object storage, monitoring, property data, email, SMS, or voice services must
use the deployment secret manager. Never place a credential in frontend code, git
history, documentation, logs, health responses, screenshots, or project chat.

The optional server-only AI drafting tool uses `OPENAI_API_KEY` and optional
`OPENAI_MODEL`. It is limited to allowlisted editable notes, redacts common
email and phone patterns before provider submission, requests `store: false`
structured output, and never saves or executes a generated draft automatically.
The route remains fail-closed until the key is provisioned through the
deployment secret manager and the required compliance review is complete.

The optional provider boundary uses server-only `ELEVENLABS_API_KEY`,
`ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_ID`, `ELEVENLABS_WEBHOOK_SECRET`,
`SKIP_TRACING_API_KEY`, and `SKIP_TRACING_API_URL`. Provisioning these values
does not replace counsel approval, envelope authorization, or provider sandbox
verification.

The selected owner-data adapter uses server-only `RENTCAST_API_KEY` plus
`RENTCAST_ENABLED=true` and `RENTCAST_DATA_USE_APPROVAL=approved`. Add these
only through the private Sites deployment secret manager after the provider
account, terms, and compliance review are complete. Never add the key to Git,
local test fixtures, frontend code, logs, or chat. RentCast enrichment remains
disabled until all three activation conditions are present.

## Rollback

1. Stop further promotion and disable the active source schedule when the
   current release remains operable.
2. Export the audit and retain a D1 recovery point.
3. Select the last verified saved Sites version.
4. Deploy that saved version without rewriting git history or deleting D1.
5. Verify the primary routes, `/healthz`, headers, private access, and logs.
6. Record the failed and restored versions and the operator’s time of action.
7. Fix forward in a new reviewed commit.

Application rollback and data recovery are different operations. Sites can
restore application code; it cannot restore browser records or D1. Follow
[Backup and recovery](BACKUP_AND_RECOVERY.md) for workspace data.
