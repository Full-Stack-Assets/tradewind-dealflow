# Production Release Checklist

## Product integrity

- [ ] Public site contains no fabricated property, buyer, testimonial, revenue,
      deal-count, scarcity, urgency, or performance claim.
- [ ] Empty workspaces explain how to add real records.
- [ ] Pricing and limitations match the approved product direction.
- [ ] “90-Day First-Deal Execution System” is described as a process, not a
      guarantee.
- [ ] Outreach, submission, contracts, payments, and provider mutations remain
      disabled.

## Functional verification

- [ ] `npm test` passes from the release source.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] JSON import rejects incompatible and malformed nested records.
- [ ] Valid import requires replacement confirmation.
- [ ] Record delete and full clear require confirmation.
- [ ] MAO and heuristic labels are correct.
- [ ] Buyer matching displays reasons and conflicts.
- [ ] Rhode Island seller and assignee windows remain separate.
- [ ] Unknown holiday calendar keeps Rhode Island readiness blocked.

## Accessibility and responsive review

- [ ] Skip link is visible on keyboard focus and moves to main content.
- [ ] Every interactive control is reachable and visibly focused.
- [ ] Forms have programmatic labels and descriptive errors.
- [ ] Dialog focus and Escape/cancel behavior are reviewed.
- [ ] Layout is usable at 320 px, 390 px, tablet, and desktop widths.
- [ ] Reduced-motion preference is honored.
- [ ] Color and status are not the only carriers of meaning.

## Compliance and privacy

- [ ] Massachusetts and Rhode Island lanes display in the correct context.
- [ ] January 1, 2027 Rhode Island alert is permanent and sourced.
- [ ] Every legal summary is dated, linked, and presented as educational.
- [ ] Counsel reviewed any changed legal or outreach copy.
- [ ] No analytics or telemetry receives addresses, contacts, buyer data, or
      free-form notes.
- [ ] Browser-storage/data-loss notice is prominent.
- [ ] Security headers are present in the production response.

## Deployment

- [ ] Working tree contains only intended release changes.
- [ ] Exact source commit is pushed before the Sites version is saved.
- [ ] Saved version uses that exact commit SHA.
- [ ] Deployment uses the saved version.
- [ ] `/`, every primary workspace, and `/healthz` load on production.
- [ ] Production version, commit, URL, time, and rollback version are recorded.
- [ ] No DNS change is made without explicit authorization.

