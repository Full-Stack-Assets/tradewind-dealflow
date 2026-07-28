# Milestone 1 Release Evidence Ledger

Internal Task 8 ledger. Do not use an unchecked item as a production claim.

Candidate commit: ____________________

Saved Sites version: ____________________

Private deployment URL: ____________________

Rollback version: ____________________

Verification time/operator: ____________________

## Scope and data integrity

- [ ] No fabricated production property, seller, buyer, comparable,
      communication, approval, revenue, or performance record.
- [ ] Empty production storage contains configuration only.
- [ ] Imported records enter `Research`.
- [ ] Exact reimports and same-file duplicates write nothing.
- [ ] Possible matches remain held until operator resolution.
- [ ] Changed facts preserve snapshots and visible conflicts.
- [ ] Restricted source rights retain the contact block.
- [ ] Dashboard uses current real browser data and does not invent history.
- [ ] No seller, buyer, underwriting, provider, outreach, Academy, billing, AI,
      backend, or public-marketplace work entered the Milestone 1 increment.

## Automated gate

- [ ] `npm run test:unit` — result/count: ____________________
- [ ] `npm run typecheck` — result: ____________________
- [ ] `npm run lint` — result: ____________________
- [ ] `npm run build` — result: ____________________
- [ ] `npm run test:render` — result/count: ____________________
- [ ] `git diff --check` — result: ____________________
- [ ] Import idempotency and stale-plan checks pass.
- [ ] JSON corrupt/legacy/oversize/restore checks pass.
- [ ] `/healthz` contract and response security headers pass.

## Browser and accessibility gate

- [ ] Desktop Dashboard and Pipeline visual review.
- [ ] 320 px, 390 px, tablet, and desktop layout review.
- [ ] Keyboard-only navigation, skip link, focus order, and visible focus.
- [ ] File preview focus and cancel/apply focus return.
- [ ] Buy-box error association and first-invalid focus.
- [ ] Confirmation dialog focus, cancel, and destructive-action behavior.
- [ ] No import file contents, address, source ID, note, or score leaves the
      browser during network capture.
- [ ] Web Locks unavailable mode allows preview/export and blocks mutation.

## Dependency and runtime gate

- [ ] Production dependency audit reviewed with no unresolved critical
      production vulnerability.
- [ ] Full dependency graph updated/reviewed for the development-only
      `brace-expansion <=5.0.7` advisory; patched dependency or documented
      release disposition: ____________________
- [ ] Runtime starts from the exact production output.
- [ ] Production `/`, `/dashboard`, `/pipeline`, `/compliance`, and `/healthz`
      return successfully.
- [ ] Production logs contain no unexpected errors or personal data.

## Compliance and documentation gate

- [ ] July 28, 2026 official legal baseline links are present and the checklist
      is framed as an attorney-review aid, not legal advice.
- [ ] January 1, 2027 Rhode Island transition warning remains explicit.
- [ ] No score authorizes contact or a transaction action.
- [ ] Outreach and provider mutations remain disabled.
- [ ] README, deployment, operator, data import, scoring/underwriting,
      compliance, backup/recovery, and known-limitations documents match code.
- [ ] Deferred authentication, underwriting, buyer verification, Approval
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
