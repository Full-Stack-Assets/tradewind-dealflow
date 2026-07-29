# Milestone 1 Release Evidence Ledger

Internal Task 8 ledger. Do not use an unchecked item as a production claim.

Candidate commit: The exact pushed branch HEAD containing this ledger; its SHA
must match the saved Sites version provenance before deployment.

Saved Sites version: ____________________

Private deployment URL: Existing endpoint
`https://tradewind-dealflow.blaizexb.chatgpt.site`; this release is not yet
deployed.

Rollback version: Sites version 2, commit
`cf06c8a2f4867de7bbca6c616b387e154834c3cb`.

Access-policy baseline: custom, owner-only access with one allowed user and no
allowed groups; policy revision 1. This release must not change it.

Verification time/operator: 2026-07-29, Codex pre-release verification.

Pre-release evidence below is checked only where the local source, automated
suite, or browser smoke test proved the claim. Commit, production audit, saved
version, deployment, access-policy, rollback, and production-smoke claims remain
unchecked until their corresponding release steps complete.

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
- [ ] Keyboard-only navigation, skip link, focus order, and visible focus.
      Local smoke proved the skip-link target and 3 px visible focus; repeat the
      complete traversal against the saved production version.
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
      release disposition: `npm ls brace-expansion --all` resolves to 5.0.8
      through `eslint-config-next` and 1.1.16 through `eslint`; both paths are
      development tooling.
- [x] Runtime starts from the exact final local production output.
- [ ] Production `/`, `/dashboard`, `/pipeline`, `/compliance`, and `/healthz`
      return successfully.
- [ ] Production logs contain no unexpected errors or personal data.

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

- [ ] Working tree is clean after the verified commit.
- [ ] Exact commit is pushed to the private GitHub branch.
- [ ] Existing Sites project ID from `.openai/hosting.json` is reused.
- [ ] Source state pushed before the version is saved.
- [ ] Saved version records the exact pushed commit.
- [ ] Deployment uses that saved version.
- [ ] Existing private access policy is unchanged.
- [ ] Production health, headers, routes, and logs are checked.
- [ ] Rollback target is recorded and verified.
- [ ] No DNS or public-access change occurred.
