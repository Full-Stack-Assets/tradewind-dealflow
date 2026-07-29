# Tradewind Real Estate OS Implementation Program

Date: July 29, 2026  
Status: Approved strategy; execution roadmap  
Source specification: `Tradewind-Real-Estate-OS-Product-Design.md`

## Outcome

Extend the existing Tradewind codebase into the primary operating system for
professional cash-home-buying companies. The product will cover the complete
lifecycle from authorized lead intake through seller relationship management,
underwriting, offers, contracts, buyer disposition, closing, and realized
economics.

The program does not create a third application and does not rebuild working
capabilities merely to change technology or file structure.

## Program Rules

1. The current Next.js repository is the only product source of truth.
2. The active `codex/massgis-automation` work finishes through its existing
   review gates before consolidation begins.
3. The archived Python DealFlow engine remains a read-only behavioral reference
   until each adopted behavior has a passing TypeScript equivalent.
4. Raw seller, owner, buyer, property, comparable, or database records never
   enter public demos, normal logs, committed fixtures, or AI prompts outside
   an approved data scope.
5. Each subsystem receives its own specification and implementation plan after
   the previous subsystem meets its exit gate.
6. Every implementation task follows test-first development and receives a
   focused review before the next task begins.
7. Deployment, provider activation, outreach sending, production data
   migration, and customer cutover require separate explicit authorization.
8. Offers, contracts, public marketing, final buyer selection, sensitive
   sharing, money, and closing instructions remain human-controlled.

## Workstreams

### A. Product Engineering

The vertical application, shared platform primitives, integrations, tests,
operations, and migration tooling.

### B. Commercial Validation

Paid discovery, design-partner qualification, implementation scoping,
baseline measurement, pricing validation, and case-study evidence.

### C. Legal, Compliance, and Trust

MA/RI counsel review, outreach policies, disclosure versions, data rights,
privacy, retention, security, auditability, and incident readiness.

### D. Customer Implementation

Data inventory, migration rehearsal, user roles, workflow configuration,
training, pilot operation, reconciliation, cutover, and support.

The workstreams run in parallel only when they do not modify the same code or
depend on unverified claims.

## Stage 0 — Finish Existing MassGIS Work

**Purpose:** Complete the work already underway without duplicating it.

Existing completed increments:

- D1 source-policy and audit control plane
- Query-only, owner-free MassGIS adapter
- Bounded pagination and malformed-record resilience

Remaining work owned by the existing MassGIS task:

- Shared manual/scheduled runner
- Sources page and one-click safe import
- Documentation and release hardening
- Production deployment and first policy activation, only when separately
  authorized

**Exit gate:**

- Tasks 1–5 of the existing MassGIS plan have passed their review gates.
- The MassGIS worktree is clean.
- Both branches pass their own verification commands.
- No production deployment is required to begin Stage 1.

## Stage 1 — Consolidation and Behavioral Parity

**Purpose:** Establish one verified foundation before adding the seller revenue
loop.

Detailed plan:

- `2026-07-29-tradewind-consolidation-parity-implementation-plan.md`

Deliverables:

- reviewed integration of completed MassGIS work;
- sanitized inventory of legacy archives and designs;
- explicit legacy-to-current state mapping;
- configurable underwriting reference engine;
- parity fixtures without production PII;
- read-only legacy database inspection;
- migration reconciliation contract;
- consolidation and recovery documentation.

**Exit gate:**

- Existing release behavior remains green.
- Adopted Python reference scenarios pass in TypeScript.
- Insufficient comparable evidence still blocks underwriting.
- No raw archive or production dataset is committed.
- The next subsystem can rely on stable migration and underwriting interfaces.

Indicative engineering range: 1–2 weeks after the MassGIS merge gate.

## Stage 2 — Production Platform Foundation

**Purpose:** Replace browser-local state with a durable, organization-isolated
foundation suitable for an authorized supervised pilot.

Subsystem plan to create after Stage 1:

- `tradewind-platform-foundation-implementation-plan.md`

Deliverables:

- organizations, memberships, roles, permissions, and sessions;
- durable transactional persistence behind repository interfaces;
- object metadata and private document storage;
- background-job foundation;
- append-only lifecycle audit;
- backup, restore, export, retention, and deletion;
- local JSON and legacy export migration;
- organization-isolation, authorization, recovery, and security tests.

Architecture decision:

- Preserve the D1 ingestion implementation behind interfaces.
- Complete a documented D1-versus-PostgreSQL decision before customer PII is
  introduced.
- PostgreSQL remains the recommended full product system of record unless the
  production review proves D1 meets the relational, isolation, reporting,
  migration, and operations requirements.

**Exit gate:**

- One supervised organization can use authorized test data durably.
- Cross-organization tests fail closed.
- Backup and restore meet the documented recovery objective.
- Every state-changing action is attributable.

Indicative engineering range: 2–4 weeks.

## Stage 3 — Seller Revenue Loop

**Purpose:** Produce the first sellable workflow and design-partner pilot.

Subsystem plan:

- `tradewind-seller-revenue-loop-implementation-plan.md`

Deliverables:

- source and campaign registry;
- seller form and webhook intake;
- people, companies, properties, and opportunities;
- identity, ownership, consent, suppression, and contact eligibility;
- unified conversation history;
- explainable seller/property qualification;
- tasks, routing, appointments, reminders, and outcomes;
- approved acknowledgement and nurture;
- service-level and acquisition-team reporting.

Pilot lane:

`inbound lead → consent/eligibility → qualification brief → human task or appointment → continued approved follow-up`

**Exit gate:**

- Every authorized inbound lead creates one durable opportunity or a
  reviewable duplicate.
- Eligibility is rechecked before every external message.
- Opt-outs and identity disputes stop automation.
- A qualified lead reaches a human owner without manual re-entry.
- No sensitive or legally consequential action bypasses approval.

Indicative engineering range: 3–5 weeks.

## Stage 4 — Evidence-Ranged Underwriting and Offers

**Purpose:** Convert qualified opportunities into defensible human-approved
decisions.

Subsystem plan:

- `tradewind-underwriting-offers-implementation-plan.md`

Deliverables:

- comparable intake, selection, approval, and reliability;
- geometry or market-based comparable selection;
- repair, transaction, finance, holding, selling, profit, and fee ranges;
- cash purchase, assignment, flip, rental, wholetail, double-close, creative,
  referral, and no-deal comparisons;
- maximum price, opening range, walk-away price, confidence, and sensitivity;
- offer payload approval and material-change invalidation;
- attorney/seller summaries.

**Exit gate:**

- Approved reference cases reproduce expected calculations.
- Fewer than three approved comps block final valuation unless a documented
  human override exists.
- Projections remain separate from realized results.
- No formal offer leaves the system without approval.

Indicative engineering range: 2–4 weeks.

## Stage 5 — Contracts, Buyers, and Disposition

**Purpose:** Replace generic CRM opportunity handling through the point at which
a contracted interest has a selected exit.

Subsystem plan:

- `tradewind-contract-disposition-implementation-plan.md`

Deliverables:

- contract, parties, legal interest, disclosures, deposits, contingencies, and
  critical dates;
- approved e-signature integration;
- real buyer intake and company/entity verification;
- buy boxes, financing, proof-of-funds status and expiration;
- buyer performance and communication preferences;
- strong, possible, and non-match outcomes with exact reasons;
- marketing-authority gate;
- controlled deal rooms, distribution, showings, questions, and offers;
- final buyer selection approval and assignment preparation.

**Exit gate:**

- One authorized contracted test opportunity produces ranked verified matches.
- Stale or missing proof of funds is visible and affects readiness.
- Marketing cannot occur without legal-interest and disclosure evidence.
- Final buyer selection requires approval.

Indicative engineering range: 3–5 weeks.

## Stage 6 — Closing and Realized Outcomes

**Purpose:** Complete the operating lifecycle and management truth.

Subsystem plan:

- `tradewind-closing-outcomes-implementation-plan.md`

Deliverables:

- attorney, title, lender, seller, buyer, tenant, and vendor coordination;
- title, lien, probate, municipal, document, financing, and access exceptions;
- cancellation windows and closing-readiness checklist;
- closing dates, documents, responsible owners, and completion evidence;
- assignment fee, acquisition, resale, rental transition, referral, or no-deal
  outcome;
- projected-versus-realized economics;
- immutable closed-deal archive;
- lifecycle conversion, stage time, source, rep, buyer, market, and margin
  reporting.

**Exit gate:**

- A supervised opportunity completes the entire lifecycle.
- All critical events and approvals are auditable.
- Realized figures never rewrite historical projections.

Indicative engineering range: 2–4 weeks.

## Stage 7 — CRM Replacement and Commercial Hardening

**Purpose:** Make onboarding and cutover repeatable enough to replace a
customer’s existing CRM.

Subsystem plan:

- `tradewind-commercial-hardening-implementation-plan.md`

Deliverables:

- Salesforce and CSV migration adapters;
- object, stage, user, activity, note, document, and ownership mapping;
- reconciliation reports and rollback;
- workflow and field configuration;
- implementation wizard;
- performance, load, security, privacy, accessibility, and disaster-recovery
  verification;
- usage metering, subscriptions, support telemetry, runbooks, and service
  operations;
- customer training and cutover package.

**Exit gate:**

- A representative migration reconciles source and destination counts.
- Customer workflows run without Salesforce during a supervised cutover.
- Rollback is proven.
- Support and incident processes are staffed and documented.

Indicative engineering range: 4–8 weeks.

## Stage 8 — Repeatable Vertical Revenue

**Purpose:** Prove the business before horizontal expansion.

Commercial thresholds:

- multiple paying real-estate customers;
- a repeatable implementation sequence;
- recurring subscription revenue;
- measured activation, usage, reliability, retention, and support cost;
- at least one evidence-backed customer outcome;
- bounded customer-specific configuration that does not require product forks.

No universal revenue number is declared here because pricing and customer
volume remain hypotheses. The expansion decision uses actual contribution
margin, retention, implementation effort, and customer outcomes.

## Stage 9 — Horizontal Platform Extraction

**Purpose:** Reuse the successful primitives for additional transaction-heavy
industries without copying the real-estate application.

Subsystem plan:

- `tradewind-horizontal-platform-extraction-plan.md`

Activities:

- identify stable platform primitives proven by real customers;
- separate configurable records, workflows, permissions, communications,
  documents, approvals, automation, audit, and reporting from real-estate
  terminology;
- publish internal extension contracts;
- configure one adjacent vertical;
- measure how much required code is platform extension versus duplicated
  product logic.

**Exit gate:**

- The second vertical primarily uses configuration and extension points.
- The platform remains one codebase and one release process.

This stage has no calendar commitment until Stage 8 is achieved.

## Commercial Validation Sequence

### Paid Opportunity Audit

Target: `$2,500`, credited to implementation when agreed.

Outputs:

- current workflow and ownership map;
- baseline evidence and missing data;
- future-state prototype;
- implementation scope;
- customer-input economics;
- success metric and stop condition.

### Founding Design Partner

Target setup: `$6,500–$12,500`  
Target recurring: `$750–$1,500/month`

Scope:

- one market;
- one inbound source;
- seller-to-appointment workflow;
- bounded migration;
- supervised use.

Aaron Tetrault is the stronger initial design-partner profile because the
publicly visible operation has scale but no confirmed Salesforce dependency.

### Growth Customer

Target setup: `$25,000–$50,000`  
Target recurring: `$3,000–$6,000/month`

Moss Home Solutions becomes a credible target only after Tradewind has measured
workflow results, durable production controls, and a migration/cutover story.

## Program Stop Conditions

Pause expansion when:

- a preceding exit gate has not passed;
- code is being duplicated across applications or customer forks;
- legal or data-use authority is unresolved;
- real PII would enter an unapproved environment;
- customer-specific work lacks a reusable product boundary;
- provider cost or support burden makes recurring economics negative;
- AI or automation cannot reliably abstain and escalate;
- migration cannot reconcile or roll back;
- a deployment or outreach action lacks explicit authorization.

## Immediate Action

Execute the consolidation and parity plan after the existing MassGIS task
completes Tasks 3–5 and passes review. Do not begin a second implementation of
the MassGIS runner, Sources page, or one-click import in parallel.
