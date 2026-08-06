# Known Limitations and Deferred Backlog

## Current release limits

### Split local and server control-plane data

- Private Sites authentication protects the application, and D1 stores the
  MassGIS control plane. There is no application-managed role system,
  multi-device Pipeline sync, encrypted object storage, or server Pipeline
  backup.
- Browser storage is the current system of record and can be erased or exposed
  by browser/device conditions.
- Web Locks are required for every mutation. Without them, review and export
  remain available but writes are disabled.
- The workspace and JSON backup are limited to 4 MiB.

### Intake

- The launch supports one strict property CSV shape, not column mapping across
  arbitrary vendor exports.
- Manual provenance-aware property entry and seller-submitted intake are not
  implemented.
- Parcel ID, registry ID, unit-specific structured identity, fuzzy address
  resolution, and provider enrichment are deferred.
- Possible matches use exact normalized state, city, and address and always
  require operator resolution.
- Owner/contact fields are rejected from the property import.
- The current preview is not retained as an immutable import-batch audit
  record.
- Only the MassGIS parcels adapter is automated. Municipal portals, registry
  data, contact enrichment, and arbitrary vendor schemas are not connected.
- Scheduled runs stage owner-free records only; they do not mutate the local
  Pipeline while the browser is closed.

### Qualification and reporting

- Five launch evidence categories are a presentation over the retained
  assessed-only qualification engine; unavailable inputs remain unassessed.
- Current property records do not contain verified ownership evidence,
  comparable sets, full repair evidence, transaction costs, or real
  seller-provided fit by default.
- Buyer demand remains unassessed without complete current verified-buyer
  evidence.
- Research priority uses disclosed conservative task defaults when numerical
  evidence is unavailable; it is not predicted transaction value.
- The Dashboard is a current snapshot. It cannot report historical imports,
  score changes, pipeline changes, completed work, or daily event history.
- Dashboard freshness and research priority use the page-load evaluation date;
  reload the page to advance that date.
- Counts can be factual zero; unsupported rates, values, and rankings display
  `Not enough data` or remain unavailable.
- The configurable underwriting reference engine is parity evidence only. It
  is not wired to Deal Lab, formal offers, or production property decisions,
  and it is not an appraisal or legal approval.

### Legacy consolidation

- No raw legacy production record has been migrated.
- The database inspection tool emits expected table names, column names,
  counts, and lifecycle-state totals only; it never emits row values.
- Raw databases, real lead/comparable exports, proof-of-funds files, and
  extracted archives remain outside the repository.
- Organization identity, tenant authorization, and durable lifecycle
  persistence remain deferred to the next platform-foundation subsystem.
- Reference parity demonstrates reproducible behavior, not valuation,
  appraisal, legal approval, or permission to generate a formal offer.

### Revenue-loop milestones not implemented

- No seller contact, inbound seller intake, communication log, appointment
  workflow, or consent record is part of Milestone 1.
- No evidence-ranged underwriting case, manual comparable approval, repair
  approval, sensitivity table, confidence override, or formal-offer package is
  implemented. The existing Deal Lab is a simpler educational calculator.
- No fast-track buyer CSV, minimal verified-buyer workflow, document
  verification, or launch buyer-match engine is implemented. The existing
  local Buyers page is not a substitute for that milestone.
- The D1-backed Approval Queue now covers hash-bound control-plane requests and
  decisions, but attorney/seller/buyer packages, closing checklists,
  projected-versus-realized reconciliation, and closed-deal archives remain
  unimplemented.

### External actions

- No CRM, seller form, buyer form, email, SMS, direct mail, payment, banking,
  title, or closing provider is connected. The ElevenLabs adapter and webhook
  boundary exist, but live provider configuration and external verification are
  not part of this release evidence.
- No form sends outreach or creates a provider mutation.
- No executable legal document or attorney-approved template is generated.
- Cold automated SMS, prerecorded/AI voice, mass dialing, formal offers, public
  marketing, final buyer selection, sensitive sharing, money, and closing
  instructions remain disabled or outside the application.

### Release evidence

- Automated unit, build, and rendered-route tests do not replace Task 8 live
  mobile, keyboard, focus, storage, network, production-health, and log review.
- A development-only transitive `brace-expansion` advisory is recorded for the
  Task 8 dependency gate and is not silently represented as resolved.
- No DNS or public-access change is part of this source increment.

## Deferred backlog in revenue order

1. **Seller/property workspace and simplified underwriting** — manual
   conversation log, property facts, documents, tasks, manual comparable and
   repair ranges, and preliminary evidence-ranged outputs.
2. **Minimal buyer engine** — real buyer entry/CSV, verification date and
   proof-of-funds status, narrow buy boxes, seven-factor matching, reasons, and
   conflicts.
3. **Deal-package approval expansion** — extend the existing hash-bound
   control-plane queue to cover first-contact, offers, contract preparation,
   buyer marketing/selection, sensitive sharing, and closing instructions;
   export seller, attorney, and buyer summaries.
4. **Closing and realized results** — checklist, dates, professionals,
   projected economics, realized income/costs, final margin, and archive.
5. **One controlled integration** — select the single provider that removes a
   demonstrated bottleneck after the manual loop works.
6. **Server foundation** — existing React interface plus FastAPI, PostgreSQL,
   SQLAlchemy, Alembic, managed authentication, private storage,
   database-backed jobs, monitoring, and restricted audit history.

Do not begin speculative AI, automated cold outreach, public marketplace,
advanced maps, multiple overlapping providers, native apps, billing,
white-label, or public multi-tenant SaaS work before the core manual-assisted
revenue loop demonstrates a real bottleneck.
