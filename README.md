# Tradewind DealFlow

Tradewind DealFlow is a controlled-intake acquisition operations workspace for a
narrow Massachusetts and Rhode Island launch. The current milestone is the
lead engine: authorized property intake, source preservation, transparent
qualification, and prioritized research.

The application starts with no properties, sellers, buyers, comparable sales,
communications, approvals, revenue, or performance data. Test fixtures stay in
the test process and are never loaded into the production workspace.

## Implemented launch capability

An operator can:

- configure one versioned launch buy box for Bristol County, Massachusetts
  and/or Providence County, Rhode Island;
- approve one versioned, owner-free MassGIS parcel policy;
- approve one bounded retrieval policy and let the hourly worker run it;
- inspect durable run counts, grouped exceptions, and the append-only audit
  export;
- read automated MassGIS leads from organization-scoped D1 without a browser
  import or repeated property typing;
- promote an automated lead into Deal Work without retyping, persisting the
  opportunity in organization-scoped D1 as well as the local workspace;
- optionally enrich approved parcel records with server-only RentCast owner
  names and mailing addresses;
- inspect each property’s source record, usage rights, confidence, freshness,
  conflicts, restrictions, qualification evidence, contact block, and next
  research task;
- see a current dashboard snapshot with five launch qualification statuses
  and the Task 5 research-priority order; and
- retain browser backup/restore only as a recovery capability;
- create and review hash-bound approval requests in the Approval Queue; and
- export the owner/contact-safe property pipeline as CSV or XLSX.

Every imported property begins in `Research`. No score authorizes contact,
marketing, an offer, a contract, sensitive disclosure, final buyer selection,
money, or closing instructions.

## Deliberate boundary

Working Pipeline records are stored under the versioned browser key
`tradewind-dealflow:v2`. D1 stores the MassGIS control plane, hash-bound
approval records, provider webhook receipts, and append-only audit events.
There is no multi-device workspace sync or server-side Pipeline backup.
Provider adapters are server-only and approval-gated; `/healthz` continues to
report outreach disabled for the current MassGIS release. Clearing browser
storage can erase the only working Pipeline copy.

The existing Deal Lab and Buyers routes remain local educational utilities.
They are not the deferred evidence-ranged underwriting case system or the
verified-buyer intake and matching milestone. See
[Known limitations and deferred backlog](docs/KNOWN_LIMITATIONS.md).

Tradewind DealFlow is educational and operational software, not legal, tax,
financial, brokerage, appraisal, or investment advice.

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Use an isolated browser profile for test data.
Do not enter real seller or buyer personal data into a public or shared test
environment.

## Verify

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:render
git diff --check
```

The milestone release gate, live browser checks, dependency review, exact
commit promotion, and private production health verification are tracked in
`docs/RELEASE_CHECKLIST.md`.

## Primary routes

| Route | Current purpose |
| --- | --- |
| `/dashboard` | Current buy-box, qualification, research, block, and storage snapshot |
| `/pipeline` | Automated D1 leads, owner-enrichment status, and Promote to Deal Work |
| `/sources` | MassGIS policy approval, scheduled runs, exceptions, and audit |
| `/approvals` | Hash-bound human approval requests and decisions |
| `/compliance` | Educational state lanes and planning-only controls |
| `/healthz` | Declares the acquisitions OS release, optional ingestion capability, and disabled outreach state |

Other existing routes are outside the fast-track Milestone 1 acceptance scope.

## Consolidated foundation

The current TypeScript application remains the only product source of truth.
Reviewed archives stay external and read-only; this repository contains only
sanitized manifests, typed migration contracts, synthetic parity fixtures,
row-free inspection, and reconciliation logic.

- [MassGIS consolidation provenance](docs/migration/MASSGIS_INTEGRATION_EVIDENCE.md)
- [Legacy asset register](docs/migration/LEGACY_ASSET_REGISTER.md)
- [Legacy consolidation contract](docs/migration/LEGACY_CONSOLIDATION.md)

The configurable reference underwriting module preserves a verified legacy
formula and the minimum-approved-comparable gate. It is not wired to the
educational Deal Lab, formal offer preparation, or any transaction action.

## Launch documentation

1. [Setup and deployment](docs/DEPLOYMENT.md)
2. [Operator manual](docs/OPERATOR_MANUAL.md)
3. [Data-import guide](docs/DATA_IMPORT.md)
4. [MassGIS ingestion operations](docs/MASSGIS_INGESTION.md)
5. [Scoring and underwriting boundary](docs/SCORING_AND_UNDERWRITING.md)
6. [Compliance-review checklist](docs/COMPLIANCE_REVIEW_CHECKLIST.md)
7. [Backup and recovery](docs/BACKUP_AND_RECOVERY.md)
8. [Known limitations and deferred backlog](docs/KNOWN_LIMITATIONS.md)
9. [Acquisition readiness (internal)](docs/superpowers/plans/2026-08-18-acquisition-readiness.md)

Existing architecture and security documents are historical references. The
eight launch documents named in the Task 7 brief, including this README, are
the current operating sources of truth.
