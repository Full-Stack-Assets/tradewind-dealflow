# Tradewind Real Estate OS — Consolidated Product Design

Date: July 29, 2026  
Status: Approved product strategy and engineering brief  
Owner: Nic / Tradewind  
Primary repository: `work/tradewind-dealflow`  

## 1. Executive Summary

Tradewind Real Estate OS is a vertical operating system for professional
cash-home-buying businesses. It replaces a generic CRM as the system of record
for the complete real-estate acquisition lifecycle:

`lead source → seller intake → qualification → appointment → underwriting → offer → contract → disposition or hold → title/closing → realized result`

The first market is high-volume residential cash buyers operating in
Massachusetts and Rhode Island. The first product must be useful to an
owner-operator such as Tetrault Real Estate and capable of scaling to a larger
team such as Moss Home Solutions.

The approved long-term strategy is:

1. Win the cash-home-buying vertical with a complete lifecycle product.
2. Build reusable platform primitives underneath the vertical application.
3. Prove repeatable revenue in the first vertical.
4. Launch additional industry operating systems using the same platform.
5. Replace Salesforce in target accounts by operating the business workflow
   more completely, not by cloning Salesforce feature for feature.

The principal execution risk is fragmentation across prior prototypes and
threads. The product will extend the current Next.js repository, merge the
active MassGIS work, and preserve the verified behavior of the earlier Python
DealFlow engine. No third application will be created.

## 2. Decisions Already Locked

- **Product strategy:** real-estate lifecycle first, reusable horizontal
  platform underneath, new industries only after repeatable vertical revenue.
- **System posture:** Tradewind becomes the primary operating system and system
  of record rather than a Salesforce add-on.
- **Lifecycle boundary:** seller acquisition through disposition, closing, and
  realized economics.
- **Commercial model:** implementation/setup fee plus recurring software and
  support revenue.
- **Automation posture:** automate preparation, routing, low-risk approved
  follow-up, monitoring, and reporting; retain human approval for legal,
  financial, contractual, sensitive, or reputation-critical decisions.
- **Implementation posture:** reuse existing code, data rules, tests, designs,
  and sales assets before writing replacements.

## 3. Evidence and Asset Authority

### 3.1 Authority order

1. The current Next.js Tradewind repository is the product source of truth.
2. `codex/massgis-automation` is the active implementation branch to finish and
   merge.
3. `dealflow-handoff.zip` is the reference implementation for verified domain
   behavior, real-data import, underwriting, state transitions, buyer matching,
   and nightly operation.
4. The July 27 site design remains authoritative for MA/RI compliance controls,
   accessibility, and non-fabrication requirements.
5. `tradewind-launch-system.zip` supplies sales, discovery, audit, proposal,
   delivery, and revenue-operations assets.
6. The three-day revenue-lockdown document supplies vertical-slice priorities
   and acceptance scenarios, not a production schedule.

### 3.2 Existing capability to preserve

The current repository already contains:

- versioned buy-box configuration;
- authorized CSV intake with validation and preview;
- source assertions, retrieval dates, usage classifications, confidence, and
  fact conflicts;
- duplicate and possible-match handling;
- explainable qualification with missing evidence and disqualifiers;
- research restrictions and compliance blocks;
- research-task prioritization;
- a local dashboard and pipeline;
- deterministic MAO and heuristic calculations;
- educational buyer and matching models;
- import/export, backup, and recovery;
- accessible confirmation and navigation patterns;
- unit, type, lint, build, render, and release checks.

The active MassGIS branch adds:

- a durable D1 control plane;
- standing ingestion policy;
- append-only audit integrity;
- a bounded, owner-free, fact-only MassGIS parcel adapter;
- tests for pagination, malformed records, deterministic ordering, rejected
  record caps, and prohibited owner/contact fields.

The Python DealFlow handoff provides verified knowledge and behavior:

- 854 real leads and 1,293 real comparable records as of July 8, 2026;
- MassGIS town IDs, use-code variations, field quirks, pagination, and stale
  municipal data behavior;
- SQLite state flow from lead through underwriting, offer, contract,
  assignment, and closing;
- ARV/MAO, repair tiers, offer ladders, and evidence refusal when fewer than
  three usable comparables exist;
- buyer-box matching and proof-of-funds-first ordering;
- nightly GitHub scheduling;
- MA equitable-interest and attorney-closing guardrails.

These assets are evidence and migration inputs. Real seller, owner, buyer, and
property records must never be copied into public demos or committed into a
multi-tenant production repository.

## 4. Users, Problem, and Value

### 4.1 Primary users

- Owner/operator of a local cash-home-buying company
- Inside sales representative
- Acquisitions manager or home-buying specialist
- Underwriter
- Dispositions manager
- Transaction coordinator
- Finance or operations leader
- System administrator

### 4.2 Current problem

Cash buyers commonly assemble generic CRM records, web forms, calling/texting
tools, spreadsheets, property-data products, calculators, calendars,
e-signature, title systems, and accounting tools. The generic CRM stores
contacts and opportunities but does not natively understand:

- seller motivation and property facts as separate evidence;
- ownership, consent, suppression, and source restrictions;
- comparable and repair evidence;
- multiple acquisition and exit scenarios;
- formal offer and contract approval;
- equitable-interest and buyer-marketing readiness;
- buyer buy boxes and proof-of-funds freshness;
- assignment, title, closing, and realized transaction economics.

Tradewind replaces the generic CRM by making those workflows the native data
model.

### 4.3 Product value

- one complete, evidence-backed record from first lead through closed outcome;
- fewer lost or unworked inbound leads;
- faster qualification and appointment routing;
- underwriting that exposes evidence, ranges, and missing inputs;
- controlled offers, contracts, buyer selection, and sensitive sharing;
- verifiable buyer matching;
- auditable compliance and approval history;
- projected-versus-realized economics;
- management reporting tied to recorded operational events.

No revenue lift, conversion gain, closing count, or savings claim may be made
without customer baseline and outcome data.

## 5. Outcomes, Metrics, and Boundaries

### 5.1 Product success metrics

The system must record and calculate:

- lead count and attribution by source;
- duplicate and rejected intake rates;
- speed to first eligible response;
- contact, qualification, appointment, offer, contract, match, and closing
  conversion;
- task completion and time in stage;
- follow-up coverage and overdue work;
- underwriting confidence and evidence gaps;
- buyer verification freshness and match acceptance;
- projected and realized margin;
- opt-outs, complaints, compliance blocks, approval exceptions, and failed
  automation jobs;
- integration and worker health.

### 5.2 First pilot exit criteria

A supervised pilot is successful when:

1. every authorized inbound lead creates exactly one durable seller/property
   opportunity or a reviewable duplicate;
2. consent, source, communication eligibility, and restrictions are visible;
3. an eligible inbound lead receives an approved acknowledgement within the
   configured service-level target;
4. the system produces a qualification and property/motivation brief with
   cited inputs and explicit missing data;
5. an appointment or human task can be routed without manual re-entry;
6. an underwriting case reproduces approved reference calculations within the
   defined rounding tolerance;
7. no offer, contract, public marketing action, buyer selection, sensitive
   disclosure, money movement, or closing instruction occurs without the
   required approval;
8. a contracted opportunity can be matched to verified buyers with reasons and
   conflicts;
9. the closing workflow records projected and realized economics separately;
10. every automated action, failure, retry, approval, override, and user change
    is attributable and auditable.

### 5.3 Initial vertical scope

In scope:

- MA Bristol County and RI Providence County launch configuration;
- single-family and two- to four-unit residential properties;
- direct cash purchase and wholesale/assignment workflows;
- flip, rental, wholetail, double-close, novation, seller-finance,
  subject-to, listing/referral, and no-deal scenarios as controlled
  comparisons;
- inbound seller leads and operator-authorized imports;
- consented or otherwise approved follow-up;
- verified buyer intake and matching;
- contract-to-close transaction coordination.

Not initially in scope:

- general-purpose CRM customization for arbitrary industries;
- construction project management;
- property management;
- full accounting or general ledger;
- title production;
- banking, custody, or money movement;
- autonomous legal advice, negotiation, contract execution, or closing;
- unapproved cold automated SMS, prerecorded/AI voice, mass dialing, or public
  marketing;
- opaque AI decisions;
- a public buyer marketplace;
- fabricated demo leads, buyers, metrics, or outcomes.

## 6. Testable Requirements

| ID | Requirement and acceptance criterion | Priority | Rationale | Validation |
|---|---|---|---|---|
| R-01 | The application shall maintain an organization-isolated system of record for users, contacts, companies, properties, opportunities, tasks, communications, documents, approvals, integrations, and audit events. Cross-organization access tests must fail. | Must | Salesforce-replacement foundation | Authorization and integration tests |
| R-02 | Every material property or seller fact shall retain source, source record ID, retrieval time, rights classification, confidence, verification time, and conflict state. | Must | Existing provenance principle | Schema and round-trip tests |
| R-03 | Reimporting an identical record shall be idempotent; changed or possible duplicate records shall produce reviewable diffs and shall not silently overwrite canonical facts. | Must | Existing intake behavior | Import regression tests |
| R-04 | Seller intake shall capture identity/ownership status, decision makers, condition, occupancy, timeline, voluntary motivation, price expectation, preferred channel, and continued-contact consent without requiring sensitive motivation. | Must | Acquisition workflow | Form and domain tests |
| R-05 | Communication eligibility shall atomically check consent/legal basis, source restrictions, suppression, opt-out, identity disputes, quiet hours, frequency caps, template approval, channel status, and kill switches immediately before send. | Must | Compliance and reputation | Eligibility matrix tests |
| R-06 | An opt-out, complaint, identity dispute, or ownership change shall stop applicable automation and create the required restriction/audit events. | Must | Safety control | End-to-end tests |
| R-07 | Qualification shall expose component scores, input facts, positive/negative reasons, missing information, unsupported information, disqualifiers, freshness, and the active buy-box version. | Must | Existing explainability | Deterministic unit tests |
| R-08 | Appointment routing shall assign an owner, preserve the triggering lead and conversation, detect conflicts, and record confirmed, cancelled, completed, and no-show outcomes. | Must | Revenue loop | Workflow tests |
| R-09 | Underwriting shall support evidence-ranged ARV, repairs, transaction costs, financing/holding costs, buyer profit, company fee, maximum price, opening range, walk-away price, confidence, and sensitivity. | Must | Core domain value | Parity and formula tests |
| R-10 | The system shall refuse a formal offer recommendation below configured evidence/confidence thresholds and route the case to manual underwriting. | Must | Non-fabrication | Threshold tests |
| R-11 | Comparables shall retain selection reasons, distance/market basis, dates, and reliability; fewer than three approved usable comps shall block final valuation unless a documented human override is approved. | Must | Python reference behavior | Reference parity tests |
| R-12 | Formal offers and executable documents shall require a versioned approval tied to the exact payload and expire after material changes. | Must | Legal/financial control | Approval mutation tests |
| R-13 | Buyer profiles shall include verified identity/entity, markets, property types, price/repair/strategy criteria, financing, proof-of-funds status and expiry, communication consent, and performance events. | Must | Real buyer engine | Validation tests |
| R-14 | Buyer matching shall return strong, possible, or non-match outcomes with criteria matches, conflicts, economics, proof-of-funds freshness, and last verification. | Must | Explainable disposition | Match tests |
| R-15 | Public or private deal distribution shall require evidence of the company’s legal interest, required disclosures, and marketing approval. | Must | MA/RI controls | Readiness gate tests |
| R-16 | Contract and closing workspaces shall track documents, deposits, contingencies, title issues, cancellation windows, responsible professionals, critical dates, and completion evidence. | Must | Full lifecycle | State-machine tests |
| R-17 | Projected and realized economics shall remain separate and reports shall never substitute one for the other. | Must | Trustworthy reporting | Reporting tests |
| R-18 | Background jobs shall use deterministic idempotency keys, bounded retries with backoff, dead-letter handling, grouped exceptions, and operator-visible status. | Must | Reliable autonomy | Worker tests |
| R-19 | AI outputs shall cite retained context, disclose uncertainty, reject unsupported claims, obey permissions, and route sensitive or low-confidence cases to humans. | Must | Safe agent behavior | Evaluation suite |
| R-20 | The interface shall be usable from 320 px through desktop, keyboard accessible, screen-reader labeled, high-contrast, reduced-motion compatible, and free of fabricated production data. | Must | Existing product principle | Automated and manual accessibility tests |
| R-21 | Administrators shall be able to export organization data, apply retention rules, process deletion requests, restore backups, and inspect access/audit history. | Must | Enterprise readiness | Recovery and privacy tests |
| R-22 | External providers shall be replaceable through typed adapters and shall not become the canonical source for Tradewind-owned lifecycle state. | Should | Platform longevity | Contract tests |
| R-23 | Workflow definitions, fields, stages, policies, approvals, and reports shall be configurable without modifying core lifecycle code. | Should | Horizontal platform extraction | Configuration tests |
| R-24 | A customer migration shall provide source counts, destination counts, conflicts, rejected records, and a signed reconciliation artifact before cutover. | Must | Salesforce replacement | Migration rehearsal |

## 7. Product Architecture

### 7.1 Architecture posture

Use a modular monolith with durable workers. Do not split the product into
microservices while the first vertical and customer operating model are still
being validated.

The UI remains React/TypeScript. Domain logic stays in small, framework-light
TypeScript modules with deterministic tests. Server modules own authorization,
organization isolation, durable transactions, provider credentials, jobs, and
audit history.

### 7.2 Platform core

Reusable platform modules:

1. **Identity and organizations** — users, memberships, roles, permissions,
   sessions, MFA policy, service principals.
2. **Record graph** — people, organizations, relationships, addresses,
   configurable objects and fields.
3. **Workflow engine** — definitions, versions, states, transitions, timers,
   assignments, service levels, exceptions.
4. **Tasks and calendar** — ownership, queues, appointments, reminders,
   conflicts, outcomes.
5. **Communications** — channel identities, threads, templates, consent,
   eligibility, delivery, replies, suppression.
6. **Documents** — metadata, access policy, versions, signatures, retention,
   disclosure acknowledgements.
7. **Rules and approvals** — policy versions, exact action payloads, thresholds,
   review, override, expiry.
8. **Automation and agents** — event triggers, jobs, AI tools, human handoff,
   evaluations, cost and latency controls.
9. **Reporting** — immutable events, operational facts, dimensions,
   projections, outcomes, configurable dashboards.
10. **Integrations** — connection scopes, adapters, webhooks, sync cursors,
    retries, health, migration tools.
11. **Audit and governance** — append-only events, hashes, access records,
    exports, retention, deletion, incident evidence.

### 7.3 Real-estate vertical modules

1. Marketing source and seller lead
2. Seller and decision-maker relationship
3. Property, parcel, ownership assertion, and source fact
4. Acquisition opportunity and buy-box qualification
5. Comparable, repair estimate, and underwriting case
6. Offer scenario, approval, negotiation, and outcome
7. Contract, legal interest, disclosures, and contingency tracking
8. Buyer, buy box, proof-of-funds, and performance
9. Buyer match, distribution authorization, deal room, and offer
10. Transaction, title issue, closing checklist, and professional
11. Projected and realized financial outcome

### 7.4 Data flow

1. An authorized source or direct seller submission creates an immutable source
   snapshot.
2. Normalization resolves or proposes a property, person, and opportunity
   without discarding contradictory assertions.
3. Compliance and source-use policies determine permissible next actions.
4. Qualification creates a versioned, explainable assessment and research
   tasks.
5. A seller conversation adds voluntarily supplied facts and may route an
   appointment.
6. Underwriting creates evidence-ranged scenarios and confidence gates.
7. Approved offer and contract actions create versioned transaction artifacts.
8. Verified buyers are matched only after marketing authority is recorded.
9. The selected transaction proceeds through title and closing tasks.
10. Realized results close the learning loop without rewriting historical
    projections.

### 7.5 Persistence decision

The current local schema and D1 control-plane work are preserved for the
single-organization pilot and ingestion/audit milestones.

Before storing customer PII or launching a multi-tenant commercial production
environment, introduce a persistence boundary and complete a documented
database decision. PostgreSQL is the recommended production system of record
because the full product requires organization isolation, relational
constraints, durable transactions, reporting, migrations, and operational
tooling. Existing D1 logic should remain behind repository contracts so useful
ingestion and audit behavior ports without rewriting domain rules.

No silent dual-write period is allowed. Migration requires a rehearsal,
reconciliation report, rollback procedure, and explicit cutover.

### 7.6 Build versus buy

Build:

- real-estate lifecycle data model;
- qualification and underwriting;
- workflow/approval behavior;
- buyer verification and matching;
- lifecycle analytics;
- governance and audit semantics;
- migration and reconciliation.

Integrate:

- telephony and SMS transport;
- email transport;
- calendar;
- e-signature;
- object storage;
- authentication primitives;
- title-production software;
- accounting;
- licensed property/comparable data;
- maps/geocoding;
- error monitoring.

Tradewind owns business state even when an external provider executes delivery
or signature.

## 8. Lifecycle Workspaces

### 8.1 Growth and Intake

- source and campaign registry;
- seller web forms, call events, referrals, CSV/API imports;
- consent and privacy disclosure capture;
- duplicate review and source reconciliation;
- lead ownership and service-level clock.

### 8.2 Seller Workspace

- seller, representatives, and decision makers;
- property facts and ownership status;
- unified calls, texts, emails, notes, tasks, and documents;
- qualification conversation;
- nurture plans and escalation.

### 8.3 Appointments and Acquisition

- territory and rep routing;
- appointment scheduling and reminders;
- property access and visit outcomes;
- rep checklist and follow-up;
- conversion ownership and coaching evidence.

### 8.4 Underwriting and Offers

- comparable selection and approval;
- repair ranges;
- direct acquisition, assignment, flip, rental, wholetail, double-close,
  creative-finance, listing/referral, and no-deal scenarios;
- seller-net and company-economics comparison;
- opening and walk-away ranges;
- approval and change history.

### 8.5 Contracts and Transactions

- approved template and e-signature integration;
- parties, legal interest, deposits, contingencies, inspection, disclosures,
  cancellation windows, dates, and documents;
- attorney/title handoff;
- exception and specialist queues.

### 8.6 Buyers and Dispositions

- real buyer intake and verification;
- proof-of-funds status;
- configurable buy boxes;
- explainable ranked matches;
- per-buyer deal rooms and controlled distribution;
- showings, questions, offers, selection approval, and assignment preparation.

### 8.7 Closing and Outcomes

- title, lien, probate, tenant, municipal, financing, and document issues;
- owners and deadlines;
- closing readiness;
- projected and realized cash flows;
- assignment fee, purchase/rehab outcome, rental transition, referral outcome,
  or no-deal reason;
- immutable closed-deal archive.

### 8.8 Leadership and Administration

- role-specific dashboards;
- source, rep, market, stage, and exit reporting;
- system health and exception inbox;
- workflow, field, stage, policy, approval, and report configuration;
- integrations, permissions, audit, retention, export, and recovery.

## 9. AI and Automation Design

AI may:

- summarize approved conversation history;
- extract voluntarily supplied property and seller facts with source links;
- classify intent, opt-out, identity dispute, complaint, and uncertainty;
- recommend questions and next actions;
- prepare qualification and underwriting briefs;
- draft approved-channel replies and follow-up;
- recommend tasks, appointments, and buyer matches;
- explain pipeline risk and operational anomalies.

AI may not:

- invent facts, comps, repairs, buyers, offers, urgency, scarcity, or outcomes;
- infer protected or sensitive characteristics;
- silently update high-impact canonical facts;
- determine contact eligibility by itself;
- send outside approved policy and channel scopes;
- make a formal offer, execute a contract, select the final buyer, share
  sensitive data, transfer money, or issue closing instructions;
- provide legal, tax, appraisal, brokerage, lending, or investment advice.

Every AI feature requires:

- explicit input provenance;
- structured output validation;
- confidence and abstention;
- action permissions;
- human escalation;
- evaluation fixtures;
- latency and cost budgets;
- prompt/model/version audit;
- a non-AI fallback.

## 10. Security, Privacy, and Compliance

Production controls:

- organization isolation enforced server-side;
- least privilege, MFA-capable authentication, session expiry, and service
  account scoping;
- secrets manager and provider credential rotation;
- encryption in transit and at rest;
- short-lived document access;
- webhook signature and replay protection;
- CSRF, input validation, output encoding, rate limits, and abuse controls;
- no seller/buyer PII in analytics, prompts beyond approved scope, or general
  logs;
- configurable retention, export, deletion, backup, and restore;
- immutable approval and audit history;
- channel and global automation kill switches;
- incident and recovery procedures.

MA and RI legal requirements remain configuration backed by dated sources and
qualified counsel review. The product is operational software, not legal
advice. State-specific outreach, wholesaling, equitable-interest marketing,
contract, cancellation, brokerage, call-recording, and closing behavior cannot
be activated solely from an internal interpretation.

## 11. Consolidation and Migration Plan

### Phase 0 — Freeze and Inventory

- designate the current Next.js repository and branch authority;
- finish and independently verify the active MassGIS tasks;
- inventory archive code, data schemas, formulas, templates, and tests;
- hash and store a read-only manifest of imported source artifacts;
- ensure real datasets are excluded from public source and test fixtures.

Exit: one artifact inventory, no ambiguous source-of-truth branch, and no
unreviewed data copied into production.

### Phase 1 — Merge Existing Foundations

- merge the approved MassGIS control-plane and adapter work;
- preserve existing intake, qualification, calculations, compliance, and UI;
- add parity fixtures derived from non-sensitive or isolated reference cases;
- record Python-to-TypeScript behavior mappings.

Exit: all existing tests pass and the repository can demonstrate import,
provenance, qualification, research priority, and audited MassGIS retrieval.

### Phase 2 — Production Platform Foundation

- identity, organizations, roles, durable persistence, object storage, jobs,
  audit, backup, recovery, monitoring;
- migration contracts for local JSON, SQLite, CSV, and future Salesforce
  exports;
- organization-isolation and security tests.

Exit: a supervised single-organization environment can hold authorized test
data durably with full audit and recovery.

### Phase 3 — Seller Revenue Loop

- inbound forms and call/webhook intake;
- seller/contact/property/opportunity graph;
- consent, suppression, communication history;
- qualification conversation;
- tasks, appointments, routing, acknowledgement, nurture;
- management service-level reporting.

Exit: one real authorized inbound source moves through qualification and human
appointment handoff without re-entry or prohibited action.

### Phase 4 — Underwriting and Offer Control

- comparable and repair evidence;
- multi-scenario underwriting;
- reference-engine parity;
- offer range, confidence, sensitivity, approval, and change tracking.

Exit: an approved test case reproduces reference economics and an insufficient
case reliably blocks.

### Phase 5 — Contract, Buyer, and Disposition

- contract and legal-interest record;
- buyer verification and proof-of-funds;
- matching and controlled distribution;
- deal room, buyer offers, selection approval, assignment preparation.

Exit: one authorized contracted opportunity produces ranked, explainable
matches and a reviewable selected-buyer package.

### Phase 6 — Closing and Operating Intelligence

- title/closing exceptions and checklist;
- projected/realized economics;
- lifecycle reporting;
- source, rep, market, buyer, stage, and outcome analytics.

Exit: one supervised opportunity completes the full lifecycle with a complete
audit and outcome record.

### Phase 7 — Commercial Hardening

- migration rehearsal from a representative CRM export;
- performance, security, privacy, recovery, accessibility, and incident tests;
- implementation wizard and customer configuration package;
- support, telemetry, usage metering, subscription, and tenant operations.

Exit: repeatable implementation with documented acceptance and rollback.

### Phase 8 — Horizontal Platform Extraction

Begin only after multiple paying real-estate customers demonstrate repeatable
implementation and recurring revenue.

- separate configurable platform primitives from real-estate terminology;
- publish stable internal extension contracts;
- test a second transaction-heavy vertical;
- preserve one codebase and one platform release process.

Exit: a second vertical is configured primarily through platform extension
points rather than copied application code.

## 12. Prototype and Validation Plan

| Stage | Risk tested | Artifact | Acceptance evidence |
|---|---|---|---|
| Asset parity | Valuable behavior is lost during consolidation | Python/TypeScript behavior map and fixtures | Approved reference cases match within declared tolerances |
| Intake pilot | Leads duplicate, lose provenance, or bypass consent | One authorized inbound source | Idempotent creation, reviewable conflicts, complete eligibility record |
| Revenue-loop pilot | Automation does not improve operational handoff | Seller qualification and appointment workflow | Recorded acknowledgement, brief, owner, appointment/task, and audit |
| Underwriting pilot | Outputs create false precision | Evidence-ranged case | Comparable/repair sources, sensitivity, confidence, and reliable block |
| Disposition pilot | Buyer matches are fabricated or stale | Verified buyer workflow | Real buyer origin, fresh POF status, explainable match/conflicts |
| Full lifecycle | Modules do not share coherent state | Supervised deal rehearsal | One opportunity reaches outcome with complete event history |
| CRM replacement | Migration loses or mutates customer truth | Representative export rehearsal | Reconciled counts, conflicts, rejected records, rollback |
| Production hardening | Security or automation failure harms customers | Security/recovery/kill-switch exercise | Isolation, restore, dead-letter, opt-out, and emergency stop pass |

## 13. Commercial Packaging

Pricing remains a hypothesis until discovery confirms lead volume, team size,
data condition, integration scope, and workflow complexity.

### Founding Design Partner

- one market and one inbound source;
- supervised seller-to-appointment workflow;
- limited migration;
- paid setup target: `$6,500–$12,500`;
- recurring target: `$750–$1,500/month`;
- explicit case-study and product-feedback terms require separate agreement.

### Tradewind Core

- owner-operated cash buyer;
- complete lifecycle, bounded users and integrations;
- setup target: `$12,500–$20,000`;
- recurring target: `$1,500–$2,500/month`.

### Tradewind Growth

- multi-rep acquisitions and disposition team;
- migration, routing, scorecards, expanded automation and integrations;
- setup target: `$25,000–$50,000`;
- recurring target: `$3,000–$6,000/month`.

### Tradewind Enterprise

- complex migration, multiple markets, custom permissions, integrations,
  security review, and service levels;
- setup begins above `$50,000`;
- recurring pricing is scoped from users, markets, communications, AI usage,
  storage, integrations, and support.

Third-party transport, data, signature, and usage costs must be separately
disclosed. A one-time perpetual license is not the default.

## 14. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Trying to replace all of Salesforce before vertical fit | High | Critical | Vertical lifecycle scope and phased platform extraction |
| Duplicate implementation across threads and archives | High | High | Authority hierarchy, asset manifest, parity map, single repository |
| Premature multi-tenant complexity | Medium | High | Modular monolith and supervised single-org pilot first |
| D1-to-production persistence rework | Medium | High | Repository boundary, explicit database decision, migration rehearsal |
| Legal or outreach activation based on incomplete interpretation | Medium | Critical | Counsel review, configuration, approvals, default-disabled channels |
| AI fabricates or overreaches | Medium | Critical | Structured outputs, provenance, abstention, evaluation, permissions |
| Real dataset leaks into source, demo, logs, or prompts | Medium | Critical | Isolation, redaction, manifests, data-lifecycle tests |
| Underwriting creates false certainty | Medium | High | Ranges, evidence gates, three-comp rule, manual override audit |
| Customer migration loses history | Medium | High | Reconciliation, shadow rehearsal, rollback, signed cutover |
| Product becomes a consulting project per customer | High | High | Fixed extension points, implementation templates, configuration limits |
| Buyer records become stale | High | Medium | Verification expiry, POF freshness, engagement and performance events |
| Recurring cost exceeds customer value | Medium | High | Usage budgets, cost attribution, tier limits, ROI from customer data |

## 15. Error Handling and Operational Recovery

- Provider failures never erase accepted source records or canonical state.
- Partial imports retain safe records and isolate rejected rows with sanitized
  reasons.
- Every external mutation has a deterministic idempotency key.
- Retries are bounded and observable; permanent failures enter a dead-letter
  queue and create one grouped operator exception.
- Stale approvals cannot authorize changed payloads.
- Communication eligibility is rechecked immediately before delivery.
- A provider outage creates a task or fallback state; it does not invent
  success.
- Restore tests run against documented recovery objectives.
- A global and per-channel kill switch stops future sends without destroying
  history.

## 16. Immediate Decisions and Next Five Actions

No additional product-strategy decision is required before implementation
planning. Provider and production infrastructure selections remain deferred
until the relevant phase and evidence.

Next actions:

1. Finish and merge the MassGIS branch through its existing review gates.
2. Create the artifact manifest and Python-to-TypeScript parity matrix.
3. Define the platform persistence and organization-isolation contracts.
4. Design the seller/contact/property/opportunity aggregates for the first
   revenue-loop slice.
5. Build the detailed implementation plan with task-level files, tests,
   dependencies, migration gates, and commercial pilot exit criteria.

## 17. Self-Review

- No placeholders are required to understand the approved direction.
- Product facts, inherited evidence, recommendations, and unverified pricing
  hypotheses are separated.
- The architecture preserves current assets and avoids a third codebase.
- The first vertical is bounded; horizontal expansion is gated by repeatable
  revenue.
- Human approval and legal/compliance boundaries remain consistent across the
  lifecycle.
- Pilot readiness is not represented as multi-tenant production readiness.
- Real records are treated as sensitive migration inputs, not test or demo
  content.
