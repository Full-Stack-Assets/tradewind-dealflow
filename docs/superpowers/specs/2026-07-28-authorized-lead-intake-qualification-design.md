# Tradewind DealFlow — Authorized Lead Intake + Qualification Design

Date: July 28, 2026

Status: Approved for implementation

Owner: Nic / Tradewind Automations

## Objective

This increment turns the local-first Phase 1 workspace into a practical
research-prioritization loop for real, authorized property records. An operator
can import a bounded CSV, review validation and duplicate results before any
write, retain source provenance, configure an investment buy box, and see a
transparent qualification result and next research action for every record.

The increment improves acquisition throughput without activating homeowner
contact, offer delivery, contract distribution, public marketing, buyer
contact, provider mutations, or movement of money.

Revenue remains an operator outcome rather than a system guarantee. The
software may prioritize work and calculate from recorded facts; it may not
claim that an owner is motivated, a buyer is interested, a transaction will
close, or revenue will result.

## Release boundary

The release remains a static-capable React application hosted on Sites. All
property, source, buy-box, and qualification data remains in the current
browser. No imported row or qualification result is sent to a backend,
analytics provider, data provider, outreach provider, or buyer.

The increment adds:

- authorized CSV lead intake with a documented schema;
- preview-first validation and an atomic apply step;
- versioned source provenance and source-preserving conflict detection;
- idempotent exact-source reimports;
- conservative possible-property duplicate detection;
- an operator-configured, versioned buy box;
- deterministic, explainable qualification results;
- a prioritized manual-research queue on Pipeline and Dashboard;
- a non-destructive migration from local schema version 1 to version 2; and
- formula-injection protection for generated CSV exports.

The increment does not add:

- automated property or contact enrichment;
- seller names, telephone numbers, email addresses, or sensitive documents;
- protected-characteristic or neighborhood-composition fields;
- skip tracing;
- calls, texts, emails, direct mail orders, or social messages;
- consent inference or contact authorization;
- offers, executable forms, signatures, payments, or closing instructions;
- public equitable-interest marketing or buyer outreach;
- authentication, synchronization, server storage, jobs, or paid providers; or
- a claim that a qualification score is motivation, appraisal, legal approval,
  or buyer demand.

`/healthz` must continue to report outreach as disabled.

## Operator workflow

1. The operator configures a buy box using actual investment criteria.
2. The operator downloads or consults the documented CSV template.
3. The operator selects a CSV containing only lawfully obtained, authorized
   property facts.
4. The browser parses and validates the entire file without mutating the
   workspace.
5. The preview reports valid new records, exact reimports, changed-source
   conflicts, possible property duplicates, rejected rows, and prohibited
   columns.
6. The operator applies only the safe portion of the plan. Invalid rows and
   possible property duplicates are skipped. Changed source snapshots are
   attached to the existing record and surfaced as unresolved conflicts;
   canonical property facts are not silently changed. If the workspace
   revision changed after preview, Apply is rejected and the operator must
   generate a fresh plan.
7. Every new imported property enters `Research`, regardless of any incoming
   stage-like value.
8. Pipeline shows the qualification result, reasons, missing facts,
   disqualifiers, source freshness, and recommended manual research action.
9. Dashboard shows the highest-priority research records using only real local
   data.
10. The operator resolves source conflicts and independently verifies ownership
    and contact eligibility before any later workflow.

## CSV contract

The parser accepts UTF-8 comma-separated data with RFC 4180-style quoted
fields, escaped quotes, CRLF or LF rows, and quoted line breaks. Limits are:

- maximum file size: 1 MiB;
- maximum data rows: 500;
- maximum columns: 30; and
- maximum decoded field length: 10,000 characters;
- maximum aggregate decoded characters: 1,000,000.

The browser decodes bytes as UTF-8 in fatal mode, allows one leading UTF-8 BOM,
and rejects invalid byte sequences rather than replacing them silently.

Required columns:

| Column | Rule |
| --- | --- |
| `source` | Human-readable public record, licensed provider, direct submission, authorized CRM, or operator-research source |
| `source_record_id` | Stable identifier supplied by that source |
| `retrieved_at` | Valid ISO date or date-time |
| `state` | `MA` or `RI` |
| `address` | Non-empty property street address |
| `city` | Non-empty municipality |
| `market` | Operator-defined target market, city, or county label |
| `usage_classification` | One of the supported classifications below |
| `confidence` | `Low`, `Medium`, or `High` |
| `last_verified_at` | Valid ISO date or date-time |

Optional columns:

- `property_type`
- `asking_price`
- `rehab_level`
- `owner_contact_status`
- `next_action`
- `notes`

Supported usage classifications:

- `Public record`
- `Licensed provider`
- `Direct submission`
- `Authorized CRM`
- `Operator research`
- `Restricted — research only`

The classification is an operator assertion, not proof that a license,
contract, law, or provider terms permit marketing use.

Headers representing protected or highly sensitive personal characteristics
are rejected for the whole import, even if their cells are blank. Unknown
or duplicate normalized headers are also rejected so that imported data cannot
silently escape the typed model. Header normalization removes a leading BOM,
trims/collapses whitespace, case folds, and converts spaces/hyphens to
underscores. The initial intake schema intentionally contains no owner contact
fields.

## Local schema version 2

The version-2 envelope preserves every version-1 field and adds a buy-box
configuration. Each deal adds provenance, conflicts, and a structured research
restriction.

```ts
type SourceUsageClassification =
  | "Public record"
  | "Licensed provider"
  | "Direct submission"
  | "Authorized CRM"
  | "Operator research"
  | "Restricted — research only";

type DataConfidence = "Low" | "Medium" | "High";

type PropertyFactSnapshot = {
  state: StateCode;
  address: string;
  city: string;
  market: string;
  propertyType: string;
  askingPrice: number | null;
  rehabLevel: RehabLevel | null;
  ownerContactStatus: string;
  nextAction: string;
  notes: string;
};

type SourceAssertion = {
  id: string;
  source: string;
  sourceRecordId: string;
  retrievedAt: string;
  usageClassification: SourceUsageClassification;
  confidence: DataConfidence;
  lastVerifiedAt: string;
  importedAt: string;
  fingerprint: string;
  facts: PropertyFactSnapshot;
};

type FactConflict = {
  id: string;
  field: keyof PropertyFactSnapshot;
  canonicalValue: string | number | null;
  assertedValue: string | number | null;
  sourceAssertionId: string;
  detectedAt: string;
  status: "Unresolved" | "Resolved";
  resolution: null | {
    selectedSide: "Canonical" | "Asserted";
    basis: string;
    resolvedAt: string;
  };
};

type ResearchRestrictionCode =
  | "Do not contact"
  | "Identity disputed"
  | "Ownership stale"
  | "Source restricted"
  | "Specialist review";

type ResearchRestriction = {
  id: string;
  code: ResearchRestrictionCode;
  source: "Operator" | "Migration" | "Source assertion" | "System";
  sourceAssertionId: string | null;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string;
};

type BuyBoxConfig = {
  configured: boolean;
  version: number;
  updatedAt: string;
  states: StateCode[];
  markets: string[];
  propertyTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  rehabLevels: RehabLevel[];
  minimumConfidence: DataConfidence;
  maxVerificationAgeDays: number;
  weights: {
    geography: number;
    propertyType: number;
    price: number;
    rehab: number;
    dataQuality: number;
  };
};
```

Version-1 imports migrate in memory and remain exportable as version 2. Existing
deals keep all canonical data but start with no fabricated provenance. Their
qualification result therefore lists the missing source metadata. Migration
never invents a source record ID, retrieval time, rights classification,
confidence, or verification date.

Canonical deals also gain `market: string`, `rehabLevel: RehabLevel | null`,
`sourceAssertions: SourceAssertion[]`, `factConflicts: FactConflict[]`, and
`researchRestrictions: ResearchRestriction[]`. Missing property type, market,
price, or rehab remains missing. The system never supplies a default property
condition.

Migration conservatively maps case-insensitive existing contact states that
contain `do not contact`, `opt out`, `identity disputed`, `ownership stale`, or
`specialist review` into corresponding active restriction records. A migrated
deal in `Contact Approved` or a later stage without provenance remains
ineligible for a contact-oriented recommendation. A pipeline stage is never
treated as legal or compliance authorization.

The envelope also gains a monotonically increasing `revision`. Every successful
local write increments it. Import plans record the exact base revision and
cannot apply to a different one.

The storage reader accepts the legacy local key and current key. It distinguishes
`absent`, `valid version 2`, `migrated version 1`, and `corrupt` states. It
prefers a valid current snapshot; when the current snapshot is corrupt but a
valid legacy snapshot exists, it exposes the migrated legacy data with a
recovery warning. It never automatically overwrites corrupt storage. A
successful, explicit user write can persist valid migrated data. Writes are
blocked when no valid source snapshot exists until the operator restores a
backup or explicitly clears the corrupt workspace. Clearing the workspace
removes both keys.

## Import planning and deduplication

CSV handling is split into pure stages:

1. `parseCsv` decodes the bounded table.
2. `validateLeadCsv` validates the header and every row into typed candidates.
3. `planLeadImport` compares typed candidates with current deals and returns a
   complete preview.
4. `applyLeadImportPlan` produces the next workspace only after the operator
   confirms the plan.

No stage before step 4 writes local storage.

Exact source identity is the case-insensitive normalized pair of `source` and
`source_record_id`.

- If the same identity and snapshot fingerprint already exists, the row is an
  exact reimport and is skipped.
- If the same identity exists with changed facts, the new source assertion is
  retained on the existing property. Differences from the canonical property
  fields become unresolved conflicts. Canonical values are not overwritten.
- If no source identity matches but normalized state, city, and address match
  an existing deal, the row is a possible duplicate and is held out of the
  apply plan for human resolution. The preview may explicitly attach it as an
  additional source assertion to the identified existing property after the
  operator confirms that choice; it never merges silently.
- Otherwise a new deal and source assertion are created.

Planning processes rows cumulatively in file order, so source duplicates and
possible property duplicates within the same upload receive the same treatment
as matches against stored records. If one source identity is already attached
to multiple deals, planning blocks that identity as an existing integrity
conflict rather than selecting an arbitrary property.

A snapshot fingerprint is calculated from canonical serialization of:

- normalized source and source record ID;
- normalized retrieval and verification timestamps;
- usage classification and confidence; and
- every normalized property fact in `PropertyFactSnapshot`.

Generated IDs, import time, row number, and conflict-resolution state are
excluded. A refreshed verification timestamp therefore produces a new source
assertion even when the property facts are unchanged. Reimporting any previously
stored historical fingerprint is idempotent and does not recreate assertions
or conflicts.

Address normalization is deliberately conservative: Unicode normalization,
case folding, whitespace collapse, and limited punctuation removal. It does not
claim parcel-level identity or automatically combine unit addresses.

Possible duplicates against another new row in the same file remain blocked.
The operator may first import the chosen canonical row and then reimport the
other row to explicitly attach it to the now-existing property. This keeps the
attachment target stable and auditable.

New imported deals always use:

- stage `Research`;
- no executed-agreement, equitable-interest, title-disclosure, attorney-review,
  or contact-approval assertion;
- no seller-motivation inference; and
- a research-oriented next action when none was supplied.

Imported `next_action` remains an immutable source fact. The qualification
engine does not classify that free text or use it to authorize anything. Its
own safe recommended action is calculated separately from structured
restrictions, conflicts, freshness, missing data, and buy-box results.

Source-derived restrictions and operator restrictions are independent active
records, so clearing one cannot erase another. A `Restricted — research only`
assertion creates a `Source restricted` hold. Source-assertion holds cannot be
removed by editing a dropdown. Resolution requires a dated note and leaves the
original restriction in history; the interface may resolve an operator or
migration hold, while a source-derived hold remains until an authorized
replacement source is explicitly attached and a review basis is recorded.
Every source-derived restriction references its `sourceAssertionId`; imports
validate that relationship and deduplicate holds by restriction code plus
assertion.

Conflict resolution is source preserving. The operator can either retain the
canonical value or adopt the asserted value, must record a short basis, and the
system records `selectedSide` and resolution time. The preserved canonical and
asserted values are typed JSON scalar values. Adopting the asserted side
updates only the applicable canonical field after field-specific validation;
it does not alter or delete either source assertion.

Each preview contains the envelope revision and a fingerprint of the relevant
workspace snapshot. Apply runs against the latest validated local snapshot and
aborts without a write if either value changed. IDs and timestamps are injected
only during Apply, not during preview. The complete serialized next workspace
must remain below 4 MiB; otherwise Apply aborts before `localStorage.setItem`.
Storage calls are caught, and a quota or access failure leaves the previous
serialized value intact.

All local writes use one named Web Lock around latest-read, validation,
revision check, size check, and `localStorage.setItem`. Import Apply is disabled
with an explanation when the Web Locks API is unavailable; other mutating
workspace controls are also disabled while read/export remains available. The
app never falls back to an unsafe read-check-write sequence. The same-tab event
and cross-tab `storage` event update subscribers after the lock is released.
This lock is a browser concurrency guard, not a substitute for the server-side
transactions required in a future multi-user release.

Accepted dates are either a real `YYYY-MM-DD` calendar date or an ISO 8601
date-time with an explicit `Z` or numeric offset. Date-times are normalized to
UTC ISO strings; dates remain calendar dates. Impossible dates, timezone-less
date-times, and values after the injected evaluation time are rejected.

## Buy box and qualification

A qualification score is unavailable until the operator saves a buy box.
Saving a material change increments its version. All weights are nonnegative;
at least one weight must be positive. At least one state, property type, and
rehab level is required. Market labels are optional; an empty market list means
state-level geography. Price bounds must be coherent and freshness days must be
an integer from 1 through 365.

Before semantic comparison and storage, state, property-type, rehab, and market
arrays are deduplicated and sorted. Strings use Unicode NFKC normalization,
trimmed/collapsed whitespace, and locale-independent case folding for matching.
Saving an equivalent normalized configuration does not increment the version.

The deterministic score uses five visible components:

1. Geography
2. Property type
3. Recorded asking-price fit
4. Recorded rehab fit
5. Data quality

Weights are normalized at calculation time, so they do not need to total 100.
Every component includes its input facts, score, explanation, and configured
weight. The overall score is rounded to the nearest integer from 0–100 using
`Math.round`.

Component rules are:

- **Geography:** 100 when state matches and, when market labels are configured,
  either canonical market or city exactly matches one configured normalized
  label. Otherwise it is a hard buy-box disqualifier.
- **Property type:** 100 for an exact normalized match, missing when the
  canonical value is blank, and otherwise a hard buy-box disqualifier.
- **Price:** excluded from the denominator when both configured bounds are
  blank; otherwise 100 when the recorded asking price falls inclusively within
  every configured bound, missing when no price is recorded, and otherwise a
  hard buy-box disqualifier.
- **Rehab:** 100 when the recorded level is allowed, missing when not recorded,
  and otherwise a hard buy-box disqualifier.
- **Data quality:** up to 100 from 40 points for complete required provenance,
  25 confidence points, 25 freshness points, and 10 conflict points. High,
  Medium, and Low confidence receive 25, 15, and 5 points respectively.
  Verification age from 0 through the configured maximum receives 25 points.
  A future date is invalid. No unresolved conflicts receives 10 points.

Required provenance for the 40-point block is source, source record ID,
retrieval time, market, usage classification, confidence, and last
verification time on at least one non-restricted source assertion. The newest
eligible assertion is the one with the greatest normalized
`lastVerifiedAt`; ties use `retrievedAt` and then assertion ID. Its confidence
and freshness drive the data-quality component.

Missing required provenance, confidence below the configured minimum, stale
verification, or an unresolved conflict produces `Needs data` and no overall
score regardless of the data-quality weight; provenance safeguards cannot be
weighted away. Its calculated data-quality subtotal is still shown to explain
the deficiency. Missing positively weighted property type, price, or rehab
likewise produces `Needs data` and no overall score. A property-fit component
with weight zero remains visible as informational but is excluded from
missing-data gating and the denominator.

Data quality uses only:

- required provenance completeness;
- recorded confidence relative to the configured minimum;
- age of the last verification relative to the configured maximum; and
- unresolved source conflicts.

Results contain:

- status: `Unconfigured`, `Needs data`, `Disqualified`, or `Scored`;
- overall score when permitted;
- exact components;
- plain-language reasons;
- missing information;
- disqualifiers;
- seller fit: always `Not assessed` in this increment; and
- a recommended manual action.

Hard disqualifiers include:

- state or configured market outside the buy box;
- recorded property type, price, or rehab outside configured limits;
- any active `Do not contact`, identity-dispute, source-restricted,
  ownership-stale, or specialist-review restriction;
- malformed or contradictory configuration.

Status precedence is:

1. `Unconfigured` when no valid saved buy box exists.
2. `Disqualified` when a hard disqualifier exists.
3. `Needs data` when a positively weighted component lacks the required
   trustworthy fact or an unresolved conflict remains.
4. `Scored` when no earlier condition applies.

Only `Scored` results receive an overall number and enter the numeric priority
ranking. `Disqualified` and `Needs data` records are separately prioritized by
their safe remediation action, never by an implied partial score.

A disqualified record remains available for research and correction. A score
or recommendation never changes the pipeline stage, authorizes contact, or
creates an offer.

Safe recommendation order is deterministic:

1. configure the buy box;
2. preserve do-not-contact or dispute/specialist holds;
3. resolve source restrictions through an authorized-source review;
4. resolve fact conflicts;
5. refresh stale verification;
6. complete missing provenance;
7. complete missing weighted property facts;
8. review the buy-box mismatch; or
9. manually verify ownership and compliance before deciding any later action.

The UI labels buyer matching separately as criteria alignment. Existing buyer
matching does not become a claim of interest, funding, capacity, or likely
closing.

## Interface

### Pipeline

Pipeline adds:

- a buy-box configuration panel;
- an Authorized CSV Import panel with template/schema guidance;
- a file selector and validation summary;
- an accessible preview grouped by new, exact reimport, changed source,
  possible duplicate, and rejected;
- an explicit, confirmed attachment choice for a possible duplicate that
  references one existing property;
- an explicit Apply Safe Records action;
- filters for qualification status, provenance freshness, and conflicts;
- source/freshness badges;
- per-record score and qualification explanation; and
- structured research-restriction editing.

The existing single-record form gains the same provenance fields. It cannot
save a new property without complete provenance. Existing migrated records can
remain incomplete so the operator can repair them without data loss.

### Dashboard

Dashboard adds:

- buy-box configuration status and version;
- records needing provenance repair;
- records with unresolved conflicts;
- highest-scoring research records;
- exact reasons and missing-data counts; and
- safe next actions such as verify ownership, resolve a conflict, refresh a
  source, or complete analysis.

No card shows projected revenue, seller motivation, buyer interest, or contact
eligibility unless supported by separately recorded real events and an
applicable later-phase workflow.

### Empty and error states

Empty states explain how to add a real authorized record and configure a buy
box. File, row, field, and configuration errors are specific and announced in
an ARIA live region. After a successful import, focus moves to the result
summary. No modal traps focus incorrectly, and all actions are keyboard
operable at 320-pixel widths.

## Safety and privacy

- The CSV never leaves the browser.
- Imported records exclude owner contact details in this increment.
- No production sample leads, buyers, scores, or metrics are seeded.
- Protected-characteristic columns are prohibited and never scored.
- Qualification reasons are factual and reproducible.
- Spreadsheet exports prefix a single quote before string cells whose first
  non-whitespace character is `=`, `+`, `-`, or `@`, or whose first character
  is tab, carriage return, or line feed. Numeric values are emitted from typed
  numbers and are not converted into attacker-controlled formulas.
- Import size limits reduce browser denial-of-service risk.
- Error messages do not echo entire sensitive rows.
- `Do not contact` and dispute/restriction states always produce research-only
  actions.
- Source rights remain an operator assertion and require independent review.
- Version-2 JSON validation reconstructs an allowlisted envelope rather than
  spreading imported objects. It enforces bounded arrays and strings, unique
  identifiers, valid record relationships, strict enums/dates/numbers, and
  finite configuration weights.

## Failure behavior

- Oversized, malformed, incompatible, or prohibited-column files cause no
  workspace mutation.
- A row error does not silently coerce a bad value. The preview identifies the
  row and field; invalid rows remain excluded.
- An invalid header blocks the whole file because column semantics are
  uncertain.
- A storage quota failure leaves the previous serialized workspace intact and
  surfaces an actionable error.
- A corrupted current snapshot with no valid legacy snapshot falls back to an
  empty in-memory envelope; the app never treats malformed data as valid and
  blocks writes until the operator restores a known-good export or explicitly
  clears the workspace. When a valid legacy snapshot exists, it can be shown as
  a recoverable migration with a warning.
- A bad buy-box configuration produces no score.

## Testing

Domain tests must cover:

- quoted CSV fields, CRLF, escaped quotes, and quoted line breaks;
- file, row, column, and field-length limits;
- required, unknown, and protected headers;
- date, enum, number, and required-value validation;
- exact-source idempotency;
- duplicate source identities and possible-property duplicates within one file;
- changed-source conflict retention without canonical overwrite;
- conservative possible-property duplicate blocking;
- explicit additional-source attachment without silent canonical overwrite;
- stale-preview rejection after a workspace revision changes;
- serialized concurrent writes and disabled import Apply without Web Locks;
- new-record `Research` stage enforcement;
- version-1 migration without invented provenance;
- preservation of migrated do-not-contact and dispute restrictions;
- corrupt-current/valid-legacy recovery and blocked writes on unrecoverable
  corruption;
- quota failure and serialized-workspace size preflight without prior-data loss;
- invalid version-2 import rejection without mutation;
- qualification configuration validation;
- deterministic weighted scores and explanations;
- missing-data behavior;
- hard research/contact restrictions;
- data freshness and confidence;
- CSV formula-injection protection; and
- existing MAO, compliance, cancellation, buyer-matching, and import behavior.

Rendered and browser checks must cover:

- the CSV and buy-box controls on Pipeline;
- honest empty states;
- Dashboard priority summaries from local data only;
- visible MA/RI warnings in their existing contexts;
- keyboard focus and live error announcements;
- 320-pixel and desktop layouts;
- destructive confirmations;
- absence of send, contract, payment, or outreach controls; and
- `/healthz` reporting outreach disabled.

Production verification requires unit tests, typecheck, lint, production build,
rendered-route tests, runtime dependency audit, desktop/mobile smoke testing,
and successful loading of the deployed Sites URL.

## Legal and activation notes

This release is operational and educational software, not legal, tax,
brokerage, appraisal, financial, or investment advice.

Massachusetts disposition retains the principal-versus-broker controls and
transaction-specific counsel review. Rhode Island retains the permanent
January 1, 2027 transition warning, heightened disclosure workflow, separate
seller and assignee cancellation tracking, and state-counsel review.

Cold calling, cold SMS, prerecorded or AI voice calls, mass dialing, direct
mail ordering, and automated email remain disabled. A future campaign requires
the recorded legal classification, registrations, federal/state/internal
suppression checks, channel-specific consent or legal basis, approved templates
and disclosures, strictest applicable hours, immutable audit evidence,
complaint kill switch, and human approval of the first launch.

Blanket implementation approval does not waive the product’s human gates for
outreach, formal offers, legal documents, public marketing, sensitive
information sharing, final buyer selection, earnest money, closing
instructions, DNS changes, or financial commitments.
