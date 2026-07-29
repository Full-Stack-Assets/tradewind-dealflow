# Legacy Consolidation

## Authority

The current TypeScript application is the product source of truth. External
archives are read-only evidence and migration inputs.

## Adopted behavior

- MassGIS town/use-code/field and pagination knowledge
- evidence-preserving intake and duplicate review
- configurable underwriting policy
- minimum approved comparable threshold
- legacy lifecycle state mapping
- buyer criteria and proof-of-funds freshness
- human approval for consequential actions

## Deliberately excluded data

Raw SQLite databases, real seller/owner/buyer rows, comparable exports,
proof-of-funds files, absolute personal paths, and generated dashboards
containing production records are not committed.

## Migration sequence

1. Inspect source schema and counts read-only.
2. Export through an approved private migration process.
3. Normalize through typed contracts.
4. Preview duplicates, conflicts, restrictions, and rejected records.
5. Apply to an isolated destination.
6. Produce reconciliation evidence.
7. Obtain cutover approval.
8. Preserve rollback until post-cutover acceptance.

## Underwriting boundary

The reference policy is configurable and is not a universal investment rule,
valuation, or appraisal. Final underwriting blocks below the approved evidence
threshold unless a versioned human override is recorded.

## Next subsystem

The next plan is the production platform foundation: identity, organizations,
authorization, durable persistence, jobs, audit, backup, recovery, export,
retention, and deletion.
