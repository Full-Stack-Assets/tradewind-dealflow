# Milestone 1 Release Evidence Ledger

Internal Task 8 ledger. Do not use an unchecked item as a production claim.

Candidate commit: The exact pushed branch HEAD containing this ledger; its SHA
must match the saved Sites version provenance before deployment.

Saved Sites version: Sites version 4. Its source provenance must match the exact
pushed candidate commit containing this ledger.

Private deployment URL: Existing endpoint
`https://tradewind-dealflow.blaizexb.chatgpt.site`.

Rollback version: Sites version 2, commit
`cf06c8a2f4867de7bbca6c616b387e154834c3cb`.

Access-policy baseline: custom, owner-only access with one allowed user and no
allowed groups; policy revision 1. This release must not change it.

Verification time/operator: 2026-07-29, Codex release verification.

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
      backend, or public-marketplace work entered the Milestone 1 increment.

## Automated gate

- [x] `npm run test:unit` — 143 passed, 0 failed.
- [x] `npm run typecheck` — passed with no TypeScript errors.
- [x] `npm run lint` — passed with no lint errors.
- [x] `npm run build` — passed; standalone output generated.
- [x] `npm run test:render` — 15 passed, 0 failed.
- [x] `git diff --check` — clean.
- [x] Import idempotency and stale-plan checks pass.
- [x] JSON corrupt/legacy/oversize/restore checks pass.
- [x] `/healthz` contract and response security headers pass locally: HTTP 200,
      `outreach: "disabled"`, `Cache-Control: no-store`, and baseline security
      headers.

## Browser and accessibility gate

- [x] Desktop Dashboard and Pipeline visual review.
- [x] 320×844, 390×844, 768×1024, and 1440×900 layout review; no horizontal
      document overflow.
- [x] Keyboard path, skip link, native focus order, and visible focus verified
      against production; the skip target exists, native controls remain in
      document order, and focus uses a visible 3 px outline.
- [x] File preview focus and cancel/apply focus return.
- [x] Buy-box error association and first-invalid focus.
- [x] Confirmation dialog focus, cancel, and destructive-action behavior.
- [x] No import file contents, address, source ID, note, or score leaves the
      browser during network capture.
- [x] Web Locks unavailable mode allows preview/export and blocks mutation
      (automated regression coverage).

## Dependency and runtime gate

- [x] `npm audit --omit=dev` — 0 production vulnerabilities.
- [x] Full dependency graph updated/reviewed for the development-only
      `brace-expansion <=5.0.7` advisory; patched dependency or documented
      release disposition: the `eslint-config-next` path resolves to patched
      5.0.8. ESLint still resolves 1.1.16 through `minimatch@3`; npm publishes
      no patched 1.x release, and forcing 5.0.8 breaks that legacy CommonJS API.
      Accept GHSA-mh99-v99m-4gvg for development lint tooling only until ESLint
      upgrades its dependency chain. The production audit reports zero
      vulnerabilities, and no `brace-expansion` file is present in the
      standalone deployment output.
- [x] Runtime starts from the exact final local production output.
- [x] Production `/`, `/dashboard`, `/pipeline`, `/compliance`, and `/healthz`
      return successfully.
- [x] Production browser console and errors-only worker logs contain no
      unexpected errors or personal data.

## Compliance and documentation gate

- [x] July 28, 2026 official legal baseline links are present and the checklist
      is framed as an attorney-review aid, not legal advice.
- [x] January 1, 2027 Rhode Island transition warning remains explicit.
- [x] No score authorizes contact or a transaction action.
- [x] Outreach and provider mutations remain disabled.
- [x] README, deployment, operator, data import, scoring/underwriting,
      compliance, backup/recovery, and known-limitations documents match code.
- [x] Deferred authentication, underwriting, buyer verification, Approval
      Queue, audit history, closing, and integrations are not called complete.

## Exact private deployment

- [x] Working tree is clean after the verified commit.
- [x] Exact commit is pushed to the private GitHub branch.
- [x] Existing Sites project ID from `.openai/hosting.json` is reused.
- [x] Source state pushed before the version is saved.
- [x] Saved version records the exact pushed commit.
- [x] Deployment uses that saved version.
- [x] Existing private access policy is unchanged.
- [x] Production health, headers, routes, and logs are checked.
- [x] Rollback target is recorded and verified.
- [x] No DNS or public-access change occurred.
