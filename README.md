# Tradewind DealFlow

Tradewind DealFlow is the local-first first release of the **New England
Wholesale OS**: a sober education and operating workspace for beginning and
early-stage real-estate wholesalers in Massachusetts and Rhode Island.

The release implements the approved “90-Day First-Deal Execution System” as a
structured process, not a promise that a user will contract, assign, fund, or
close a transaction in 90 days.

## What is live

- Public product home with transparent pricing, limitations, and no fabricated
  testimonials, properties, buyers, or performance claims
- Dashboard with state lane, readiness, 90-day progress, and totals calculated
  only from the user’s browser data
- Deal Lab with the transparent primary formula:
  `MAO = ARV - Repairs - Holding/Closing Costs - Buyer Profit - Wholesale Fee`
- Pipeline for user-entered, lawfully sourced records, with guarded deletion,
  full JSON backup/restore, and CSV export
- Buyer workspace with real user-entered profiles and explainable matching
- Twelve-module Academy and 13-week execution tracker
- Separate Massachusetts and Rhode Island compliance lanes, dated official
  sources, Rhode Island transition alert, cancellation-window tracking, and
  marketing-interest readiness gate
- Resource Center with official public research starting points
- Deal Desk packet preparation and local export
- Responsive, keyboard-accessible interface from 320 px through desktop
- `/healthz` release-health endpoint

## Deliberate safety boundary

This release stores workspace records in `localStorage` on the user’s device.
It has no project database, authentication, payment processing, analytics,
seller or buyer messaging, property-data ingestion, legal-document execution,
or provider mutation. No form transmits seller, buyer, property, or free-form
deal data to a Tradewind backend.

Clearing browser storage can erase records. Export a JSON backup from
**Pipeline → Export JSON** and store it securely. Imports are schema-validated
and require confirmation before replacing the current workspace.

The product is educational and operational software. It is not legal, tax,
financial, brokerage, appraisal, or investment advice.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public product and value ladder |
| `/dashboard` | State lane, readiness, progress, and real-data totals |
| `/deal-lab` | Evidence-backed analysis and export |
| `/pipeline` | Local property records and backup controls |
| `/buyers` | Local buyer CRM and explainable matching |
| `/academy` | Twelve modules and 13-week tracker |
| `/compliance` | State lanes, outreach checklist, and readiness gates |
| `/resources` | Dated official and public research links |
| `/deal-desk` | Qualification checklist and packet export |
| `/healthz` | Machine-readable release health |

## Local development

Requirements:

- Node.js 22.13 or newer
- npm

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The application begins empty and never seeds
production-looking records.

## Verification

```bash
npm test
npm run typecheck
npm run lint
```

`npm test` runs deterministic calculation, import, compliance, business-day,
and buyer-matching tests; builds the production worker; and verifies every
route, the health contract, legal-source copy, empty states, and security
headers.

## Data model and backups

- Local schema version: `1`
- Browser key: `tradewind-dealflow:v1`
- Canonical backup: JSON exported by the application
- Pipeline-only convenience export: CSV
- Restore behavior: validate first, then show a destructive replacement
  confirmation
- Clear behavior: explicit confirmation, then deletion from that browser

Do not place proof-of-funds files, identity documents, account numbers,
medical information, or unnecessary distress details in local notes.

## Deployment

The production target is OpenAI Sites. The exact committed source must be
pushed before a Sites version is saved, and deployment must use that saved
version. See [Deployment and domain operations](docs/DEPLOYMENT.md).

No domain or DNS record is changed by this repository. Use only the exact DNS
target returned by the hosting provider.

## Documentation

- [Operator manual](docs/OPERATOR_MANUAL.md)
- [Compliance review checklist](docs/COMPLIANCE_REVIEW_CHECKLIST.md)
- [Security and privacy](docs/SECURITY_AND_PRIVACY.md)
- [Deployment, domain, backup, and rollback](docs/DEPLOYMENT.md)
- [Phase 2 production architecture](docs/PHASE_2_ARCHITECTURE.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)

## Deferred Phase 2

Authenticated multi-device storage, managed PostgreSQL, real authorized-source
ingestion, outreach providers, campaign automation, payment processing,
executable legal forms, and provider-backed daily automation are architecture
work—not implied features of this release. Their activation requires provider
selection, credentials, data-use terms, security review, and Massachusetts /
Rhode Island counsel approval. No missing production input is replaced with
fabricated data.
