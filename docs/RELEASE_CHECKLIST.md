# Acquisitions OS Release Candidate Evidence Ledger

Internal Task 8 ledger. Do not use an unchecked item as a production claim.

Candidate commit: The exact pushed branch HEAD containing this ledger. Record
its SHA in the deployment receipt and require it to match the saved Sites
version provenance before deployment.

Saved Sites version: Pending for this candidate. Historical Sites version 4 is
not evidence that the current branch is deployed.

Private deployment URL: Existing endpoint
`https://tradewind-dealflow.blaizexb.chatgpt.site`.

Historical rollback reference: Sites version 2, commit
`cf06c8a2f4867de7bbca6c616b387e154834c3cb`. Reconfirm it before promotion.

Historical access-policy baseline: custom, owner-only access with one allowed
user and no allowed groups; policy revision 1. Reconfirm it and do not broaden
access during this release.

Candidate verification time/operator: 2026-08-03, Codex local verification.

Evidence below is checked only where the local source, automated suite, browser
smoke test, repository state, or Sites release state proved the claim.

## Scope and data integrity

- [x] No fabricated production property, seller, buyer, comparable,
      communication, approval, revenue, or performance record.
- [x] Empty production storage contains configuration only.
- [x] Imported records enter `Research`.
- [x] Exact reimports and same-file duplicates write nothing.
- [x] Possible matches remain held until operator resolution.
- [x] Changed facts preserve snapshots and visible conflicts.
- [x] Restricted source rights and source-declared contact holds retain the
      contact block.
- [x] Dashboard uses current real browser data and does not invent history.
- [x] No seller, buyer, underwriting, provider, outreach, Academy, billing, AI,
      contact enrichment, or public-marketplace work entered this increment.
- [x] D1 migration creates only policy, run, staged-record, and audit tables.
- [x] Manual and scheduled triggers produce identical classifications.
- [x] At least 100 safe records can be staged and imported in one action.
- [x] Exact rerun and acknowledgement retry create no duplicate Pipeline deal.
- [x] Owner/contact fields are absent from requests, D1, local import, exports,
      and logs.

## Automated gate

- [x] `npm run test:unit` — 197 passed, 0 failed.
- [x] `npm run typecheck` — passed with no TypeScript errors.
- [x] `npm run lint` — passed with 0 errors and 3 existing unused-variable
      warnings in `server/ingestion-runner.ts`.
- [x] `npm run build` — passed; standalone output generated.
- [x] `npm run test:render` — 18 passed, 0 failed.
- [x] `git diff --check` — clean.
- [x] Fresh `npm audit --omit=dev` registry query — 0 production
      vulnerabilities.
- [x] Import idempotency and stale-plan checks pass.
- [x] JSON corrupt/legacy/oversize/restore checks pass.
- [x] `/healthz` contract and response security headers pass locally: HTTP 200,
      release `acquisitions-os`, `outreach: "disabled"`, manual/scheduled
      ingestion enabled, owner/contact fields disabled, `Cache-Control:
      no-store`, and baseline security headers.

## Browser and accessibility gate

- [ ] Current candidate desktop Dashboard, Sources, and Pipeline visual review.
- [ ] Current candidate 320×844, 390×844, 768×1024, and 1440×900 layout
      review; no horizontal document overflow.
- [ ] Current candidate keyboard path, skip link, native focus order, and
      visible focus review.
- [ ] Current candidate file preview focus and cancel/apply focus return.
- [ ] Current candidate buy-box error association and first-invalid focus.
- [ ] Current candidate confirmation-dialog focus and destructive-action review.
- [ ] Current candidate network review confirms that import file contents,
      addresses, source IDs, notes, and scores stay in the browser.
- [x] Web Locks unavailable mode allows preview/export and blocks mutation
      (automated regression coverage).

## Dependency and runtime gate

- [x] `npm audit --omit=dev` — 0 production vulnerabilities.
- [x] Full dependency graph review: fresh `npm ci` reports 7 moderate and 3
      high findings in build, migration, lint, and local-emulation tooling.
      `npm audit --omit=dev` reports zero production vulnerabilities; the
      vulnerable `brace-expansion`, `fast-uri`, `undici`, and `@esbuild-kit`
      packages are absent from `dist/standalone/node_modules`. Registry-proposed
      fixes require incompatible toolchain downgrades, so keep development
      servers private and track compatible upstream patches.
- [x] Runtime starts from the exact final local production output.
- [ ] Production `/`, `/dashboard`, `/sources`, `/pipeline`, `/compliance`, and `/healthz`
      return successfully.
- [ ] Current production browser console and errors-only worker logs contain no
      unexpected errors or personal data.

## Compliance and documentation gate

- [x] July 28, 2026 official legal baseline links are present and the checklist
      is framed as an attorney-review aid, not legal advice.
- [x] January 1, 2027 Rhode Island transition warning remains explicit.
- [x] No score authorizes contact or a transaction action.
- [x] Outreach and provider mutations remain disabled.
- [x] Automated tests prove MassGIS retrieval is query-only, bounded,
      owner/contact-free, and tied to
      one approved policy hash.
- [x] README, deployment, operator, data import, scoring/underwriting,
      compliance, backup/recovery, and known-limitations documents match code.
- [x] Deferred authentication, underwriting, buyer verification, Approval
      Queue, audit history, closing, and integrations are not called complete.

## Exact private deployment

- [ ] Working tree is clean after the verified candidate commit.
- [ ] Exact candidate commit is pushed to the private GitHub branch.
- [x] Existing Sites project ID from `.openai/hosting.json` is reused.
- [ ] Source state is pushed before the version is saved.
- [ ] Saved version records the exact pushed commit.
- [ ] Deployment uses that saved version.
- [ ] Existing private access policy is unchanged.
- [ ] Production health, headers, routes, and logs are checked.
- [ ] Rollback target is recorded and verified.
- [ ] No DNS or public-access change occurred.

Record the immutable deployment receipt (candidate SHA, saved-version ID,
deployment ID, URL, access-policy check, verification time, and rollback
version) in the review record. Do not edit this source ledger after promotion
and then describe the unpromoted edit as deployed.
