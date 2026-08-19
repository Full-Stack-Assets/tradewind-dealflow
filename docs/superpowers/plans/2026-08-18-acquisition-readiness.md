# Tradewind DealFlow Acquisition Readiness

Date: 2026-08-18  
Status: Internal strategy; not a CIM, teaser distribution, or claim of inbound interest  
Related: `docs/diligence/README.md`, `docs/commercial/design-partner-pilot.md`

## Honest thesis

Tradewind DealFlow is a controlled-intake Massachusetts and Rhode Island cash-buyer operating system. It is **not** a saleable going-concern SaaS company today.

A corporate-development or lower-middle-market M&A desk could later diligence a **strategic tuck-in or IP/asset purchase**. That conversation is forbidden until the gates in this document pass.

### What a buyer would be buying today

- A TypeScript/Next.js vertical OS for professional cash home buyers.
- MassGIS owner-free parcel ingestion, a D1 control plane, hash-bound approvals, and fail-closed RentCast enrichment adapters.
- MA/RI compliance guardrails that never let a score authorize contact, offers, money, or closing.

### What a buyer would not be buying today

- Contracted ARR or an ARR bridge reconcilable to a processor and bank.
- A multi-tenant customer base, retention cohorts, or transferable production PII.
- A complete seller-to-close loop in production.
- A production SLA. The product remains educational and operational software.

## Why a traditional M&A process would fail now

| Diligence item | Buyer expectation | Current Tradewind |
| --- | --- | --- |
| Contracted ARR | Stripe/bank-reconcilable recurring | None |
| Logo retention / NRR | Cohort evidence | No customers |
| System of record | Org-isolated server DB | Split D1 leads vs browser `tradewind-dealflow:v2` (durable opportunity slice is now additive) |
| Complete workflow demo | Lead to appointment to offer | Lead engine plus Deal Work; promotion exists, underwriting is not wired to offers |
| IP assignment | Employee/contractor/AI assignment | Inventory started; assignment artifacts still required. See `docs/diligence/02-ip-assignment.md` |
| Open-source / license | Clean SBOM | Dependency list exists; no generated SBOM committed |
| Security | Tenant isolation, MFA, CSP nonces | Sites auth + hashed actor; CSP still allows inline script |
| Data rights | Licensed MassGIS/RentCast use | MassGIS owner-free; RentCast gated; no transferable customer data |
| Key person | Documented runbooks | Operator docs exist; production is founder/Sites |
| Counsel | MA/RI activation memo | Checklist only; `/healthz` reports `outreach: "disabled"` |

## Realistic transaction types

1. **Strategic tuck-in / asset purchase** of the vertical OS, compliance model, and MassGIS control plane into an investor CRM or property-data platform.
2. **Operator productization** by a scaled cash-buyer that wants to own the OS rather than subscribe.
3. **Going-concern SaaS sale** only after multiple paying logos, contracted ARR, retention evidence, and a durable tenant model. Do not pitch this path until Stage 8 commercial thresholds in `docs/superpowers/plans/2026-07-29-tradewind-real-estate-os-program-roadmap.md` are real.

Do not approach bulge-bracket bank coverage. The correct counterparty is corporate development at a PropTech or investor-workflow company, or a lower-middle-market advisor who runs software tuck-ins.

## Named buyer map

This is a targeting list. It is not inbound interest.

### Tier A — Investor workflow CRMs

- REsimpli
- REISift
- InvestorFuse
- LeadSimple
- BatchLeads / PropStream-class list tools

Ask: corporate development or the CEO/founder for a tuck-in of a MA/RI acquisitions OS, not a feature partnership.

### Tier B — Direct-to-seller and property intelligence

- DealMachine
- ATTOM / CoreLogic / HouseCanary / RentCast parent

Pitch: regulated-state execution layer on top of their records, not another data scrape.

### Tier C — Disposition, transaction, brokerage (later)

- InvestorLift
- Qualia / Lone Wolf
- Salesforce / HubSpot corp dev (not a first call)

### Tier D — Operator-acquirer

A Tetrault-class or Moss-class cash-buyer platform. Usually an asset purchase plus founder transition, not a software multiple on ARR.

### Explicit non-targets until commercial proof exists

CoStar, Zillow, Rocket, Compass.

## Gates before any outbound to an M&A desk

All of the following must be true:

- [x] Pipeline can promote a MassGIS lead into Deal Work without retyping.
- [ ] Promoted work survives a new browser (durable D1 opportunity store exists; live second-device proof is still an operator task).
- [ ] One external operator has paid or contracted for a supervised pilot, with a written outcome using real metrics the partner will allow in an NDA room. **No fabricated results.**
- [ ] IP assignment inventory is complete and assignment artifacts are signed.
- [x] `/healthz` still reports `outreach: "disabled"` unless counsel has separately authorized otherwise.
- [ ] Teaser claims are source-traceable to this repository and a design-partner letter.

If a gate is unchecked, keep building. Do not shop the company.

## Product differentiators allowed in a later teaser

Only after they can be demonstrated live on synthetic or partner-authorized data:

- owner-free MassGIS control plane with append-only audit;
- hash-bound approval ledger and execution revalidation;
- assessed-only qualification that never authorizes contact;
- MA/RI cancellation and equitable-interest gates;
- three-comparable underwriting refusal in the reference engine.

## Explicit non-goals

- Automated cold outreach, AI decisioning, public marketplace, billing, or white-label before a design partner exists.
- Pitching CoStar, Zillow, or Rocket.
- Inflating ARR with setup fees or claiming customer outcomes without partner permission.
- Committing production PII, proof-of-funds files, or a public CIM into this repository.
