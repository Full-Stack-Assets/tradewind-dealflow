# Setup and Deployment

Release mode: local-first lead engine

Hosting target: the existing private OpenAI Sites project

Data backend: none

## Local setup

Use Node.js 22.13 or newer:

```bash
npm ci
npm run dev
```

No provider credential is required. Do not add secrets, private email
addresses, seller records, buyer records, or production exports to source
control.

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
  "release": "local-first",
  "outreach": "disabled"
}
```

The endpoint proves that the deployed worker responds with the declared mode.
It does not inspect a user’s browser storage.

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
8. Verify `/`, `/dashboard`, `/pipeline`, `/compliance`, and `/healthz`.
9. Review production response headers and runtime logs.
10. Record the commit SHA, saved-version ID, deployment URL, verification time,
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

This milestone has no application secret and no provider mutation. Future
authentication, PostgreSQL, object storage, monitoring, property data, email,
SMS, or voice services must use the deployment secret manager. Never place a
credential in frontend code, git history, documentation, logs, health
responses, screenshots, or project chat.

## Rollback

1. Stop further promotion.
2. Select the last verified saved Sites version.
3. Deploy that saved version without rewriting git history.
4. Verify the primary routes, `/healthz`, headers, and logs.
5. Record the failed and restored versions and the operator’s time of action.
6. Fix forward in a new reviewed commit.

Application rollback and user-data recovery are different operations. Sites
can restore application code; it cannot restore browser records. Follow
[Backup and recovery](BACKUP_AND_RECOVERY.md) for workspace data.
