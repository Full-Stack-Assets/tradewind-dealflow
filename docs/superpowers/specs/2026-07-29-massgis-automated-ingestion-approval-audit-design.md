# MassGIS Automated Ingestion, Approval, and Audit Design

Date: 2026-07-29  
Status: approved design direction; implementation planning pending written-spec review

## Goal

Make recurring Massachusetts property discovery materially easier for a
single owner-operator who routinely processes more than 100 legitimate
potential opportunities at a time.

The first automated source is the Commonwealth of Massachusetts Bureau of
Geographic Information (MassGIS) statewide Property Tax Parcels FeatureServer.
The product supports both:

- scheduled retrieval while the browser is closed; and
- operator-triggered retrieval from the application.

Standing approval applies to a versioned source policy. Records that conform to
that approved policy may flow automatically into `Research`. The operator does
not approve every parcel or every run. Review is reserved for policy changes,
source-contract changes, and genuine record exceptions.

This increment does not add outreach, seller-contact enrichment, owner-name or
owner-mailing-address collection, automated offers, contracts, public
marketing, or AI decision-making.

## Approved first-build reduction

After reviewing the complete design, the operator requested a leaner first
implementation. The first build keeps scheduled and operator-triggered
retrieval, standing policy approval, D1 staging, grouped exception counts, and
append-only audit evidence. It uses one `Import all safe records` action when
the operator opens the app.

The first build defers automatic background-to-local delivery, delivery-receipt
tables, the generic approval-request subsystem, and the full audit explorer.
Those additions are unnecessary to remove the immediate 100-plus-record
ingestion bottleneck. Exact reimport handling makes a lost post-import
acknowledgement safe to retry.

## Confirmed product decisions

1. The normal batch size is hundreds of property records, not a handful.
2. Both scheduled and operator-triggered retrieval are required.
3. One standing source-policy approval replaces per-record approval.
4. Safe records import in one batch action; there is no per-record approval.
5. Exceptions are reviewed in batches, grouped by reason.
6. Source, run, decision, transformation, and application events are audited.
7. MassGIS property facts may identify research candidates, but they are not
   evidence of seller motivation, legal authority, or contact eligibility.
8. Seller contact data remains outside this increment.

## Source contract

### Authoritative endpoint

- Dataset description:
  `https://www.mass.gov/info-details/massgis-data-property-tax-parcels`
- Feature layer:
  `https://services1.arcgis.com/hGdibHYSPO59RG1h/ArcGIS/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0`
- ArcGIS item ID: `73d4c766167848b795f1048cad3919c7`
- Layer ID: `0`
- Publisher: Commonwealth of Massachusetts Bureau of Geographic Information
  (MassGIS)

The adapter is query-only. It never calls ArcGIS edit, append, delete, replica,
or synchronization operations.

### Allowed fields

The adapter requests an explicit allowlist and sets `returnGeometry=false`:

- `OBJECTID`
- `GlobalID`
- `MAP_PAR_ID`
- `LOC_ID`
- `TOWN_ID`
- `PROP_ID`
- `POLY_TYPE`
- `TOTAL_VAL`
- `BLDG_VAL`
- `LAND_VAL`
- `OTHER_VAL`
- `FY`
- `LOT_SIZE`
- `LOT_UNITS`
- `LS_DATE`
- `LS_PRICE`
- `USE_CODE`
- `USE_DESC`
- `SITE_ADDR`
- `ADDR_NUM`
- `FULL_STR`
- `LOCATION`
- `CITY`
- `ZIP`
- `YEAR_BUILT`
- `BLD_AREA`
- `RES_AREA`
- `UNITS`
- `STYLE`
- `STORIES`
- `NUM_ROOMS`
- `LAST_EDIT`
- `BND_CHK`
- `NO_MATCH`

The adapter must not request, store, log, or derive these available owner
fields:

- `OWNER1`
- `OWN_ADDR`
- `OWN_CITY`
- `OWN_STATE`
- `OWN_ZIP`
- `OWN_CO`

Adding any source field requires a new policy version and explicit approval.

### Source limitations shown in the product

- Assessor parcel boundaries are not legal surveys or authoritative legal
  boundary determinations.
- Assessing information may lag the municipality's current records.
- Assessed value is not an appraisal, asking price, ARV, or offer basis.
- A matching parcel is a research candidate, not evidence of seller intent.
- Registry, municipal, title, zoning, and legal verification remain separate
  research tasks.

## Architecture

### Hybrid durable-control/local-workspace model

The current browser workspace remains the deal-operating workspace for this
increment. A new server-side ingestion control plane stores source policies,
approvals, schedules, runs, staged source snapshots, exceptions, delivery
receipts, and audit events.

The control plane uses the existing Sites Cloudflare Worker plus a provisioned
D1 binding. D1 is required because scheduled retrieval must work while the
browser is closed and the audit/run history must survive browser-storage loss.

The browser and scheduler call the same adapter service and the same run
pipeline:

```text
approved source policy
        |
        +-- operator POST /api/ingestion/runs
        |
        +-- scheduled Worker trigger
                   |
                   v
            MassGIS query adapter
                   |
                   v
       validate -> normalize -> fingerprint
                   |
          +--------+--------+
          |                 |
          v                 v
     safe staging       exception queue
          |
          v
   local delivery API
          |
          v
 one Web-Locked local mutation
          |
          v
 delivery acknowledgement + audit event
```

The adapter, normalizer, matcher, policy evaluator, local merge planner, and
audit canonicalizer are separate modules with typed interfaces. Operator and
scheduled runs differ only by trigger metadata.

### Why this architecture

- Direct browser-only fetching cannot run while the browser is closed.
- A complete server migration of every existing workspace module is not
  required to remove the immediate ingestion bottleneck.
- Durable staging allows scheduled retrieval without losing results.
- Idempotent delivery allows the local workspace to remain the current
  qualification environment.
- The control-plane tables and APIs can later support additional official or
  licensed adapters without changing the approval model.

## Data model

### `source_policies`

- `id`
- `version`
- `status`: `draft | active | paused | superseded`
- `adapter_key`: initially `massgis-property-tax-parcels-v1`
- exact endpoint, service item, and layer identifiers
- selected Massachusetts town IDs
- approved output-field allowlist
- approved use-code and unit mapping version
- property filters
- page size and maximum records per run
- schedule time and IANA timezone
- `auto_apply_safe_records`
- source usage classification
- source disclaimer version
- mapping and policy fingerprints
- `created_at`, `activated_at`, `superseded_at`

An active policy is immutable. Editing creates a new draft version.

### `source_policy_approvals`

- `id`
- `source_policy_id`
- canonical policy hash
- actor: `site-owner` in the current owner-only deployment
- decision: `approved | rejected`
- decision note
- decided timestamp

An approval is valid only for the exact canonical policy hash.

### `ingestion_runs`

- `id`
- `source_policy_id` and policy hash
- trigger: `operator | schedule | retry`
- status:
  `queued | running | staged | delivering | completed | partial | failed |
  cancelled`
- idempotency key
- source schema fingerprint and data-edit timestamp
- requested and completed timestamps
- page and record counts
- safe, duplicate, changed, held, rejected, delivered, and failed counts
- retry count and last error category
- lease owner and lease expiry

### `source_snapshots`

- `id`
- run ID
- source record identity
- source retrieval timestamp
- usage classification
- canonical raw-attribute JSON containing allowlisted fields only
- normalized property facts
- raw and normalized fingerprints
- transformation version
- classification:
  `safe-new | exact-reimport | safe-changed | possible-match |
  source-conflict | invalid | policy-violation`
- delivery state and delivery receipt

Raw geometry, owner fields, arbitrary response properties, and response
headers are not retained.

### `approval_requests`

Approval requests exist for:

- source-policy activation or change;
- source schema drift that affects the allowlist or mapping;
- endpoint identity changes;
- explicit exception overrides; and
- reactivating a policy paused by a source-contract failure.

Record exceptions are grouped by run and reason. A batch decision stores the
exact affected snapshot IDs and canonical decision payload.

### `audit_events`

- monotonically increasing sequence
- event ID and occurred timestamp
- actor and trigger
- event type
- aggregate type and ID
- canonical metadata with no owner/contact data
- previous-event hash
- event hash

There is no application update or delete path for audit events.

## Standing approval model

The operator approves a complete source policy once. That approval authorizes:

- queries only against the pinned MassGIS service and layer;
- only approved fields and approved town IDs;
- only the approved property filters and record cap;
- the approved schedule;
- the approved mapping and normalization version; and
- automatic local application of records classified as safe.

The following do not require approval:

- another run under the unchanged active policy;
- exact-reimport suppression;
- safe new-record insertion into `Research`;
- safe additional source snapshots attached without canonical overwrite; and
- retrying a transient read failure within policy limits.

The policy pauses automatically when:

- the service item, layer, or host changes;
- a required source field disappears or changes type;
- an unapproved field appears in the normalized payload;
- the adapter would exceed the approved maximum record count;
- pagination becomes inconsistent;
- the source returns edit-oriented or unexpected content;
- the source disclaimer/rights classification becomes unknown; or
- repeated permanent failures exceed the policy threshold.

Paused policies create one grouped exception instead of repeated notifications.

## Retrieval modes

### Operator-triggered

The Sources workspace provides `Run now`. The action creates a run using the
current active policy, returns immediately, and displays progress by pages and
counts. Repeated clicks with the same active run are idempotent.

The operator may cancel a run. Cancellation stops future page requests but
keeps already retrieved source snapshots and the audit history.

### Scheduled

The Worker receives an hourly scheduled trigger and selects policies due in
their configured IANA timezone. This avoids daylight-saving errors from a
fixed UTC-only daily expression.

The initial default is one daily run at 2:00 AM in `America/New_York`, editable
before policy approval. The schedule is inactive until its policy is approved.

A lease and unique idempotency key prevent overlapping runs. Missed schedules
do not create a burst of backfilled runs; the scheduler creates at most one
catch-up run per policy.

## Query, pagination, and filtering

The adapter uses the ArcGIS query endpoint with:

- `f=json`
- `where` produced only from allowlisted policy fields and operators
- explicit `outFields`
- `returnGeometry=false`
- `orderByFields=OBJECTID ASC`
- `resultOffset`
- `resultRecordCount` up to the service maximum of 2,000

User-entered raw SQL is never accepted. Town IDs, numeric bounds, and approved
enumerations are encoded by the query builder.

Each page is checked for:

- valid JSON and ArcGIS error envelopes;
- expected object structure;
- required attributes;
- page-size and aggregate run limits;
- nondecreasing object IDs;
- duplicate source identities; and
- response fields outside the allowlist.

The first policy filters candidates by approved town IDs and the existing buy
box. Optional factual filters include:

- DOR use-code groups mapped to one-to-four-family property types;
- unit count;
- maximum assessed total value;
- maximum or minimum year built;
- minimum years since recorded last sale; and
- building-area range.

These filters identify research candidates only. Missing facts remain missing;
they are not converted to zero or treated as motivation.

## Identity, normalization, and idempotency

Preferred source identity is `GlobalID`. If a valid GlobalID is absent, the
fallback is a versioned composite of `TOWN_ID`, `LOC_ID`, `MAP_PAR_ID`, and
`PROP_ID`, with the fallback reason recorded.

The snapshot fingerprint is SHA-256 over canonical JSON containing:

- adapter and mapping version;
- source identity;
- retrieval-relevant source fields; and
- normalized property facts.

Exact fingerprints write no new local deal or duplicate source assertion.
Changed fingerprints preserve the new source snapshot and use the existing
conflict rules. Address-only possible matches remain exceptions unless the
existing deterministic matcher proves an exact source identity.

## Automatic local application

When the Pipeline or Sources workspace hydrates, it requests undelivered safe
snapshots for the active owner workspace. Operator runs also begin this delivery
step immediately after staging.

If `auto_apply_safe_records` is active:

1. the browser builds an import plan using the existing deterministic ingestion
   library;
2. the browser rechecks the policy hash and delivery token;
3. all safe records apply in one Web-Locked local mutation;
4. every new deal begins in `Research`;
5. the browser posts a delivery acknowledgement containing the resulting local
   revision and per-snapshot outcome; and
6. the server marks only acknowledged snapshots delivered and appends audit
   events.

If the browser closes, storage is corrupt, Web Locks are unavailable, the
workspace exceeds its size limit, or acknowledgement fails, the staged
snapshots remain available for idempotent retry. No server response is treated
as applied until the locked local mutation succeeds.

Exception records never auto-apply. Exact reimports are acknowledged as
no-write outcomes.

## Audit design

Audit events use canonical JSON and a SHA-256 hash chain:

```text
event_hash = SHA256(previous_event_hash + canonical_event_without_hash)
```

The audit module appends an event in the same D1 transaction as the state
change it describes. The product provides:

- chronological audit view;
- filters by policy, run, record identity, event type, and outcome;
- run manifest export;
- full audit JSON export;
- local verification of the exported hash chain; and
- visible chain-integrity status.

The chain is tamper-evident, not a claim that a database administrator cannot
alter storage. A future external write-once archive can anchor periodic chain
heads without changing event semantics.

Audit metadata must not contain property owner names, owner mailing addresses,
free-form source responses, access tokens, request headers, or arbitrary
exception stacks.

## User experience

### Sources workspace

Add a `Sources` navigation item with:

- active-policy summary;
- MassGIS connection and schema health;
- schedule and next-run time;
- `Run now` and `Cancel run`;
- latest-run progress and counts;
- safe records awaiting delivery;
- grouped exceptions;
- recent run history; and
- audit export.

### Policy editor

The editor defaults towns and property types from the current buy box. It shows
the exact resulting query scope and estimated maximum batch size. `Approve and
activate` presents one concise diff from the active version.

### Exception queue

Exceptions are grouped by:

- possible duplicate;
- changed source conflict;
- invalid or missing source field;
- source schema drift;
- record-cap or pagination failure; and
- policy violation.

The operator can apply one action to a compatible group. The UI does not force
record-by-record review when the same decision can be represented safely as a
batch.

### Pipeline and Dashboard

- Pipeline reports the last ingestion run and automatic-delivery result.
- Dashboard reports due/failed source runs and unresolved exception counts.
- Imported records continue to expose provenance, qualification reasons, and
  restrictions.
- No send, owner-contact, offer, or contract control is added.

## API and worker boundaries

Initial authenticated owner-only endpoints:

- `GET /api/source-policies`
- `POST /api/source-policies`
- `POST /api/source-policies/:id/approve`
- `POST /api/ingestion-runs`
- `GET /api/ingestion-runs`
- `GET /api/ingestion-runs/:id`
- `POST /api/ingestion-runs/:id/cancel`
- `GET /api/ingestion-deliveries`
- `POST /api/ingestion-deliveries/:token/acknowledge`
- `GET /api/approval-requests`
- `POST /api/approval-requests/:id/decide`
- `GET /api/audit-events`
- `GET /api/audit-export`

The Worker exposes no arbitrary URL-fetch endpoint. Adapter destinations are
compiled allowlists. State-changing requests require same-origin checks,
content-type validation, bounded bodies, idempotency keys, and the existing
owner-only Sites access boundary.

The scheduled handler calls the ingestion service directly rather than calling
its own HTTP endpoint.

## Error handling and operations

- Page requests use a bounded timeout.
- Transient failures retry up to three times with exponential backoff and
  jitter.
- ArcGIS validation, authorization, schema, and policy failures do not retry.
- A run has a strict wall-clock, page, and record limit.
- Expired leases may be recovered by one retry run.
- Permanent failures create one grouped exception and pause only when the
  policy threshold is reached.
- Error messages use category codes and redacted context.
- Production logs contain run IDs and counts, not parcel addresses or raw
  attributes.
- `/healthz` gains non-sensitive ingestion readiness fields while continuing to
  report outreach as disabled.

## Migration and compatibility

1. Provision D1 and apply versioned migrations before enabling Sources.
2. Existing local `schemaVersion: 2` workspaces remain valid.
3. Add only the minimum local schema fields needed to retain MassGIS parcel
   facts, delivery receipts, and source-policy provenance.
4. Migrate local storage to the next schema version without inventing missing
   parcel facts or audit events.
5. Existing CSV intake remains available and continues to use the same
   deterministic import planner.
6. Scheduled retrieval remains disabled until one policy is approved.
7. Rollback may disable the scheduler and Sources UI without deleting staged
   runs or audit data.

## Security and privacy controls

- Exact MassGIS hostname, service item, and layer allowlist prevents SSRF.
- Query-only adapter; no source mutation operations.
- Explicit response-field projection prevents owner/contact collection.
- No geometry is retrieved or stored in the first adapter.
- No protected or sensitive personal characteristics are accepted.
- No secrets enter source policies, audit events, browser storage, or logs.
- D1 statements are parameterized.
- API bodies, pages, records, strings, and exports have explicit limits.
- All local mutations retain Web Locks and strict schema validation.
- Owner-only Sites access remains unchanged for this increment.
- Outreach remains disabled in `/healthz` and in product behavior.

## Testing strategy

### Unit tests

- query builder allowlists and encoding;
- source-policy canonicalization, versioning, hashes, and approval invalidation;
- source schema fingerprint and drift detection;
- ArcGIS response validation and owner-field rejection;
- pagination, caps, cancellation, leases, retries, and idempotency;
- source identity and fallback identity;
- allowed-field raw snapshot pruning;
- MassGIS field normalization and property-type mapping;
- exact reimports, changed snapshots, duplicates, and conflict preservation;
- audit canonicalization, append ordering, and hash-chain verification;
- scheduled due-time calculation across DST;
- delivery-plan retries and acknowledgement semantics.

### Integration tests

- D1 migrations and transaction rollback;
- operator and scheduled triggers produce the same staged result;
- policy approval is required before either trigger;
- safe hundreds-record run completes without per-record interaction;
- exception batches do not block unrelated safe records;
- local Web-Locked delivery and server acknowledgement are idempotent;
- failure after local commit but before acknowledgement redelivers without
  duplicating records;
- owner fields never enter D1, browser storage, exports, or logs.

### Render and browser tests

- accessible policy diff and approval;
- run progress, cancellation, and grouped exceptions;
- keyboard and responsive behavior;
- automatic delivery status and retry;
- audit filtering/export and chain verification;
- no outreach controls;
- production smoke for manual run, scheduled test trigger, health, logs, and
  rollback.

The automated test fixtures use synthetic source records only. Production
demonstration and verification use live official-source data without inserting
fabricated business outcomes.

## Release sequence

1. Add D1 migrations and repository contracts.
2. Add source policy, approval, and audit services.
3. Add the MassGIS query-only adapter and deterministic normalization.
4. Add operator-triggered runs.
5. Add staging, grouped exceptions, and automatic local delivery.
6. Add hourly scheduler and due-policy leasing.
7. Add Sources, Pipeline, Dashboard, and audit interfaces.
8. Add backup/export, operational documentation, and rollback controls.
9. Run production-only dependency audit, full verification, private deployment,
   owner-only access verification, and live-source smoke.
10. Activate the first narrow policy only after the operator approves its exact
    towns, filters, cap, mapping, and schedule.

## Expansion after the first adapter

Additional municipal GIS or assessor adapters may be added only through the
same contract:

- official or explicitly authorized endpoint;
- pinned destination and query-only behavior;
- documented field allowlist and source limitations;
- versioned transformation;
- standing source-policy approval;
- identical run, exception, delivery, and audit semantics; and
- no owner/contact fields until that separate feature is designed and approved.

Municipal portals are prioritized by operator market coverage and data gaps
after measuring the statewide adapter's real results. The system does not
silently scrape arbitrary municipal websites.

## Acceptance criteria

The increment is complete when:

- one approved MassGIS policy supports both scheduled and manual runs;
- a run can process at least 100 qualifying source records without
  record-by-record approval;
- safe records enter `Research` automatically when the browser workspace is
  writable;
- exact repeats add no duplicate deals or source assertions;
- changed and ambiguous records retain evidence and enter grouped exceptions;
- scheduled runs operate while the browser is closed;
- policies, approvals, runs, exceptions, deliveries, and audit events survive
  browser-storage loss;
- the exported audit hash chain verifies;
- no owner/contact fields are requested or retained;
- no outreach, offer, contract, public-marketing, or AI action is introduced;
  and
- production health, logs, access policy, rollback, and dependency gates pass.
