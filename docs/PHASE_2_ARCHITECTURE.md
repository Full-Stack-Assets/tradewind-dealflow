# Phase 2 Production Architecture

Status: design only; not activated by the local-first release  
Rule: no provider or outreach action is enabled from an unset configuration

## Scope boundary

This document maps the larger acquisition platform into a maintainable Phase 2
system. It does not claim that authentication, a database, provider ingestion,
outreach, or automation exists in Phase 1. Those capabilities require provider
selection, credentials, data-use rights, security review, and Massachusetts /
Rhode Island legal approval.

Phase 2 should begin as a modular monolith with durable background workers,
rather than independent microservices. That keeps authorization, approvals,
audit trails, and transaction boundaries understandable while usage is still
being validated.

## Proposed runtime

- Responsive React frontend
- Typed Node.js/TypeScript application API
- Managed passwordless authentication with MFA support
- PostgreSQL with tenant/organization isolation and row-level policies
- Persistent job queue with idempotency, exponential backoff, and dead letters
- Encrypted object storage for approved documents
- Managed HTTPS and reverse proxy
- Central structured logging, error tracking, metrics, and job monitoring
- Secrets manager with scoped credentials and rotation

No seller or buyer data should enter analytics payloads or general application
logs. Sensitive files use object-level access policies and short-lived URLs.

## Modules

1. **Data ingestion** — adapter registry, import runs, source snapshots,
   provenance, license restrictions, and reconciliation.
2. **Property normalization** — canonical addresses/parcels, source-preserving
   facts, conflicts, and entity resolution.
3. **Lead qualification** — configurable buy boxes, factual indicators,
   explainable component scores, missing data, and disqualifiers.
4. **Property underwriting** — ranges, comparable evidence, repair evidence,
   configurable formulas, scenarios, sensitivity, and confidence gates.
5. **Seller outreach** — eligibility decisions, approved campaigns,
   suppression, rate/frequency limits, channel adapters, and immutable send
   evidence.
6. **Response classification** — opt-out first, identity disputes, intent,
   uncertainty, complaints, and specialist escalation.
7. **Tasks and appointments** — responsible user, due dates, calendar adapters,
   reminders, and exception routing.
8. **Offer and scenario preparation** — seller-priority comparison, assumptions,
   risks, professional requirements, and approval-only formal action.
9. **Buyer database** — real submissions/imports, buy boxes, verification,
   proof-of-funds metadata, performance evidence, consent, and retention.
10. **Buyer matching** — exact criteria, economics, conflicts, freshness,
    proof-of-funds status, and explainable ranking.
11. **Deal room and document preparation** — per-buyer authorization,
    shareable-document selection, views, questions, acknowledgments, and offer
    intake.
12. **Compliance controls** — jurisdiction versions, legal basis, consent,
    suppression, cancellation periods, disclosures, retention, and kill switch.
13. **Reporting and system health** — projected versus realized metrics, source
    quality, job health, provider health, complaints, opt-outs, and exceptions.
14. **Approval and exception handling** — one queue containing the exact
    proposed action, evidence, risks, versioned payload, approver, and outcome.

## Core data model

Every important fact must carry:

- source/provider;
- source record identifier;
- retrieval timestamp;
- market/jurisdiction;
- license or usage classification;
- confidence;
- last verification time;
- raw/source snapshot reference;
- normalized value and transformation version;
- conflict status.

Suggested aggregate roots:

- organization, user, role, and approval policy;
- provider connection and data-use policy;
- person/contact point, consent, suppression, and identity dispute;
- property, parcel, ownership assertion, source fact, and fact conflict;
- opportunity, factual indicators, score version, and pipeline history;
- analysis, comparable, repair estimate, scenario, and confidence gate;
- campaign, template version, eligibility decision, communication, and reply;
- task, appointment, exception, and specialist referral;
- buyer, entity, buy box, verification, funds status, and performance event;
- legal interest, marketing authorization, deal room, offer, and closing event;
- audit event, retention action, export, deletion request, and incident.

Contradictory facts remain as separate source assertions. The system never
silently overwrites one source with another.

## Adapter contracts

Adapters are real integrations configured per organization. No fictional
provider name or fake result is a default.

### Property data adapter

Must return a provider record ID, retrieval time, rights classification,
market, raw snapshot reference, normalized facts, and confidence. It must
support idempotency and document whether marketing use is permitted.

### CRM import adapter

Must preserve external IDs, consent evidence, source, original timestamps,
suppression state, and conflicts. It cannot treat mere CRM presence as consent.

### Email, SMS, and voice adapters

Must expose dry-run/draft and send as separate permissions. Send requires a
stored eligibility decision, approved campaign/template version, recipient
suppression re-check, channel legal basis, idempotency key, and provider
response. Webhooks require signature and replay verification.

### Direct-mail adapter

Must separate export/preparation from order placement. Order placement requires
approved creative/version, recipient eligibility, human campaign approval, and
an immutable manifest.

### Authentication and storage adapters

Must enforce organization isolation server-side. Client-provided organization
or role claims are never authoritative. Proof-of-funds and identity documents
receive narrower roles and access logs than general deal facts.

## Explainable scoring

Store facts separately from predictions. A score version contains configurable
weights and components:

- seller fit;
- property fit;
- marketability;
- verified buyer demand;
- data quality;
- compliance risk;
- overall score;
- reasons, missing information, and disqualifiers.

Protected characteristics and neighborhood protected-class composition are
prohibited inputs. A score never independently authorizes homeowner contact,
contract execution, or public marketing.

## Underwriting

Support ranges for current value, ARV, repairs, holding, financing, closing,
taxes/utilities, selling costs, buyer profit, and transaction fee. Store
comparable-selection reasons and reliability. Formulas are organization and
strategy configuration, not one hard-coded percentage rule.

When evidence or confidence is below the approved threshold, scenario
generation may continue as a draft, but formal-offer preparation routes to
manual underwriting.

## Outreach eligibility

The final pre-send decision must atomically check:

- campaign, market, provider, template, channel, and first-launch approval;
- documented legal basis and consent where required;
- federal, state, and company suppression;
- prior opt-out, identity dispute, complaint, or ownership change;
- source-use restriction;
- quiet hours and frequency cap;
- required role/disclosure version;
- contact-point confidence and verification age;
- global and channel kill switches.

Finding a telephone number is never consent to cold-text or autodial it.
Opt-outs are processed before other reply classification and propagate across
every applicable channel.

## Approval queue

Each request stores a canonical action payload, human-readable diff, evidence,
risk flags, legal/compliance version, expiry, and idempotency key. Approval
cannot be reused after a material payload or template change.

Human approval is mandatory for first campaign launches, formal offers,
contracts/amendments, threshold exceptions, novation, seller financing,
subject-to, public marketing, final buyer selection, sensitive sharing, earnest
money, closing instructions, and every legal or financial commitment.

Distress, confusion, incapacity, foreclosure, bankruptcy, probate complexity,
identity/ownership disputes, complaints, and legal-advice requests enter a
specialist queue and stop automation.

## Job processing and daily loop

Jobs use a deterministic idempotency key derived from organization, action,
record, provider, and version. Retries use bounded exponential backoff with
jitter. Permanent failures move to a dead-letter queue and create one operator
exception, not repeated messages.

The scheduled loop may:

1. verify provider and compliance health;
2. ingest authorized records;
3. normalize and deduplicate;
4. verify freshness and ownership;
5. apply filters and explainable scoring;
6. exclude suppressed/ineligible contacts;
7. prepare or execute only previously approved low-risk follow-up;
8. process replies and opt-outs;
9. update intent, tasks, and stages;
10. prepare underwriting scenarios;
11. route sensitive actions to approval;
12. match approved opportunities to verified buyers;
13. prepare individualized summaries;
14. issue exception alerts and an evidence-backed end-of-day report.

The loop cannot sign, bind, transfer funds, record documents, or make legal
representations.

## Reporting

Report only real recorded events and label projected/realized values separately:

- leads by source and contact-eligibility rate;
- response, positive-response, appointment, offer, contract, buyer-match, and
  closing rates;
- projected and realized margin;
- acquisition cost and time in stage;
- opt-out and complaint rate;
- data-quality and compliance exceptions;
- failed/dead-letter jobs and integration health.

No denominator may silently exclude failures, opt-outs, or unqualified records.

## Required decisions before implementation

The following remain intentionally unset:

| Configuration | Required evidence |
| --- | --- |
| Primary domain | Domain-owner decision and Sites custom-domain target |
| Target cities/counties | Operator-approved markets and counsel review |
| Property types and price/repair limits | Written buy box |
| Minimum assignment spread and buyer margin | Written underwriting policy |
| Human approval contact | Named person, verified email, backup approver |
| Authentication provider | Security/privacy review and tenant model |
| PostgreSQL provider | Region, encryption, backup, DPA, recovery objective |
| Queue provider | Delivery semantics, retries, dead letters, monitoring |
| Object storage provider | Encryption, access logs, retention, deletion |
| CRM provider | Authorized scope and consent/suppression migration plan |
| Property-data provider | Contract, source rights, permitted marketing use |
| Email provider | Sender domain, SPF/DKIM/DMARC, webhook security |
| SMS/voice provider | Registration, campaign approval, consent model |
| Analytics/error provider | Redaction guarantees and privacy approval |
| Closing professionals | State-specific workflow and responsibilities |
| Legal reviewers | MA/RI counsel, scope, dates, document/template versions |

## Activation sequence

1. Finalize legal/compliance matrix with state counsel.
2. Select auth, database, queue, and storage; complete security design.
3. Migrate versioned local exports into isolated user accounts with explicit
   consent and a reconciliation report.
4. Add one read-only authorized data adapter and verify provenance.
5. Add approval queue and immutable audit trail.
6. Add a single outreach channel in draft-only mode.
7. Validate registration, consent, suppression, webhook, and kill-switch tests.
8. Approve one narrow campaign and monitor manually.
9. Expand only after real evidence and post-launch legal/security review.

No phase is unblocked by synthetic production records or assumed provider
credentials.

