# 02 — IP assignment

Status: inventory started; signed artifacts still required  
Related: git history of `Full-Stack-Assets/tradewind-dealflow`

## Required artifacts (private packet)

Every human, contractor, and bot that authored product code needs a written assignment into the selling entity:

- [ ] Founder IP assignment
- [ ] Any contractor or agency assignment
- [ ] Policy covering AI-generated and agent-generated code (Copilot, Codex, Cursor Cloud)
- [ ] Confirmation that archived Python DealFlow / zip handoffs were licensed for reuse without committing production PII
- [ ] Trademark/name clearance for “Tradewind DealFlow”

Unsigned inventory is not assignment.

## Public git authorship inventory (2026-08-18)

Generated from `git shortlog -sne --all`. Emails below are already public on the remote.

| Commits (approx) | Name | Email | Assignment status |
| ---: | --- | --- | --- |
| 80 | Nicholas Albertson / Nic Albertson | nicholas.albertson@students.maestrocollege.edu | TBD — founder assignment required |
| 2 | copilot-swe-agent[bot] | 198982749+Copilot@users.noreply.github.com | TBD — GitHub Copilot/agent terms + entity policy required |

No other commit authors appear on this clone. Review GitHub pull requests, Sites-hosted copies, and unpacked archives outside Git before closing this item.

## AI-generated code policy (required statement)

Tradewind source includes agent-authored commits. A buyer will ask:

1. Who owned the prompt and the merge decision?
2. Whether third-party content (licenses, customer data) was pasted into prompts.
3. Whether the selling entity has the right to assign that code.

Until counsel records answers, treat AI-generated code as **open diligence risk**, not a blocker to continuing product work.

## Archives that must stay out of the repo

`dealflow.db`, `leads_real.csv`, `comps_real.csv`, proof-of-funds files, and extracted customer archives remain outside this repository. They are not sold by committing them.
