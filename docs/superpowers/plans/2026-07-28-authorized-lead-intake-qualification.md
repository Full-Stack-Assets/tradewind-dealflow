# Authorized Lead Intake + Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator safely import real authorized property records, preserve provenance and conflicts, configure a buy box, and receive deterministic research priorities without enabling outreach.

**Architecture:** Upgrade the browser-local envelope to a strict version-2 model, then build pure CSV, import-planning, and qualification modules around it. A Web-Locks-backed local data provider serializes writes and rejects stale previews; focused client components expose preview-first import, buy-box configuration, provenance, conflicts, restrictions, and Dashboard priorities.

**Tech Stack:** TypeScript 5.9, React 19, Next.js 16/vinext, browser localStorage and Web Locks, Node’s built-in test runner, semantic HTML/CSS, Sites hosting.

## Fast-track amendment — 2026-07-28

The active objective is now Milestone 1 of the owner-operated revenue loop:
authorized CSV intake, provenance and duplicate safety, one buy box,
transparent qualification, research prioritization, focused release
verification, and exact private deployment. Finish this milestone before
seller, buyer, underwriting, approval, closing, backend, or provider work.

Tasks 1–5 were already complete or in their final corrective verification when
this amendment arrived. Preserve that tested work, but do not extend its
complexity. In Task 6, present the launch qualification model through five
operator categories: geography fit, property-type fit, price and equity fit,
financial potential, and data confidence. Return Qualified, Possible,
Research required, Disqualified, or Compliance or specialist review; always
show reasons, unknowns, next research action, and the contact block.

For Tasks 6–8, the exact current scope and deferrals in
`.superpowers/sdd/2026-07-28-authorized-lead-intake-qualification/fast-track-directive.md`
override any broader step below. The narrower launch geography is Bristol
County, Massachusetts, and Providence County, Rhode Island; launch property
types are single-family and two- through four-family residential. Existing
configuration may retain future placeholders, but the first interface does not
build their operating workflows.

## Global Constraints

- Production contains no fabricated property, seller, buyer, testimonial, activity, revenue, or performance data.
- Imported data remains in the current browser and no form sends outreach.
- Maximum CSV file size is 1 MiB, 500 data rows, 30 columns, 10,000 characters per field, and 1,000,000 decoded characters.
- New imported records always enter `Research`.
- Protected/sensitive characteristic columns are rejected and never scored.
- No score authorizes contact, marketing, an offer, a contract, or a financial action.
- Massachusetts and Rhode Island warnings and attorney-review gates remain unchanged.
- `/healthz` must continue to return outreach `"disabled"`.
- A serialized workspace may not exceed 4 MiB.
- All local writes use one named Web Lock; mutating controls are disabled when Web Locks are unavailable.
- Tests use synthetic fixtures only inside the test environment.

---

## File map

### Domain and persistence

- Modify `lib/types.ts`: version-2 domain types, nullable rehab, canonical market, source assertions, conflicts, restrictions, buy box, and revision.
- Modify `lib/import-export.ts`: strict version-1 validation, lossless migration, strict allowlisted version-2 validation, schema-2 JSON/CSV exports, formula neutralization.
- Create `lib/local-storage.ts`: pure current/legacy storage reads, corruption recovery states, bounded writes, and storage error mapping.
- Modify `components/LocalDataProvider.tsx`: async Web-Lock mutation boundary, revision stamping, storage health, and safe legacy migration.
- Modify `components/WorkspaceShell.tsx`: persistent storage recovery/error notice.
- Modify existing workspace components that call provider mutations so they tolerate the Promise-returning interface and surface provider errors.

### Intake and qualification

- Create `lib/csv.ts`: bounded fatal UTF-8 decoding and RFC-style CSV parser.
- Create `lib/lead-ingestion.ts`: header/row validation, normalization, fingerprints, batch planning, attachment choices, conflict/restriction creation, and stale-plan-safe application.
- Create `lib/qualification.ts`: buy-box normalization/validation and deterministic explainable qualification.
- Modify `lib/matching.ts`: nullable-rehab behavior without invented condition facts.

### Interface

- Create `components/pipeline/BuyBoxForm.tsx`: accessible versioned buy-box editor.
- Create `components/pipeline/AuthorizedCsvImport.tsx`: local file decode, validation preview, duplicate attachment decisions, and guarded apply.
- Create `components/pipeline/QualificationPanel.tsx`: reasons, gaps, disqualifiers, source history, conflict resolution, and restrictions.
- Modify `components/workspaces/PipelineWorkspace.tsx`: provenance-aware manual entry, filters, source/freshness badges, and the new components.
- Modify `components/workspaces/DashboardWorkspace.tsx`: configuration health, data repair counts, and scored research priorities.
- Modify `app/globals.css`: responsive panels, preview groups, score details, and 320-pixel behavior.

### Tests and documentation

- Modify `tests/domain.test.ts`: v2 regression coverage and nullable buyer matching.
- Create `tests/schema-storage.test.ts`: migration, strict validation, recovery, corruption, and bounded writes.
- Create `tests/csv-ingestion.test.ts`: parser, schema, idempotency, conflicts, attachments, restrictions, and stale plans.
- Create `tests/qualification.test.ts`: configuration and exact score/status/recommendation rules.
- Modify `tests/rendered-html.test.mjs`: Pipeline/Dashboard controls, empty states, disclaimers, and disabled outreach.
- Modify `README.md`, `docs/OPERATOR_MANUAL.md`, `docs/PHASE_2_ARCHITECTURE.md`, and `docs/RELEASE_CHECKLIST.md`: schema, import contract, daily loop, safety boundary, and verification results.

---

### Task 1: Version-2 domain model and lossless migration

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/import-export.ts`
- Modify: `lib/matching.ts`
- Modify: `tests/domain.test.ts`
- Create: `tests/schema-storage.test.ts`

**Interfaces:**
- Produces: `DealFlowData` with `schemaVersion: 2`, `revision`, `buyBox`, and version-2 `DealRecord`.
- Produces: `createEmptyData(now?: string): DealFlowData`.
- Produces: `validateImport(value: unknown, now?: Date): ImportResult`.
- Produces: `migrateV1(value: DealFlowDataV1, now: Date): DealFlowData`.
- Consumes later: every persistence, intake, qualification, and UI task uses these exact types.

- [ ] **Step 1: Add failing migration and strict-validation tests**

```ts
test("v1 migration preserves DNC and never invents provenance", () => {
  const v1 = makeVersionOneWorkspace();
  v1.deals.push(makeVersionOneDeal({
    ownerContactStatus: "Do not contact",
    rehabLevel: "Moderate",
  }));

  const result = validateImport(v1, new Date("2026-07-28T12:00:00Z"));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.schemaVersion, 2);
  assert.equal(result.data.deals[0]?.rehabLevel, "Moderate");
  assert.deepEqual(result.data.deals[0]?.sourceAssertions, []);
  assert.equal(
    result.data.deals[0]?.researchRestrictions[0]?.code,
    "Do not contact",
  );
});

test("v2 validation strips no unknown data and rejects it instead", () => {
  const candidate = { ...createEmptyData(), unexpected: "not allowed" };
  const result = validateImport(candidate);
  assert.deepEqual(result, {
    ok: false,
    errors: ["The workspace contains unsupported top-level fields: unexpected."],
  });
});

test("pipeline CSV neutralizes spreadsheet formulas", () => {
  const data = createEmptyData();
  data.deals.push(makeVersionTwoDeal({ address: '=HYPERLINK("bad")' }));
  assert.match(serializePipelineCsv(data.deals), /'=/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --experimental-strip-types --test tests/schema-storage.test.ts tests/domain.test.ts`

Expected: FAIL because schema version 2, `revision`, provenance, restrictions, and migration do not exist.

- [ ] **Step 3: Implement the version-2 types**

Add exact enums and records from the approved design to `lib/types.ts`. Change
`DealRecord.rehabLevel` to `RehabLevel | null`; add `market`,
`sourceAssertions`, `factConflicts`, and `researchRestrictions`; add
`BuyBoxConfig`; and change the envelope to:

```ts
export type DealFlowData = {
  schemaVersion: 2;
  revision: number;
  updatedAt: string;
  preferences: {
    selectedState: StateCode | null;
    participationPath: ParticipationPath | null;
  };
  buyBox: BuyBoxConfig;
  deals: DealRecord[];
  buyers: BuyerRecord[];
  analyses: DealAnalysis[];
  curriculum: Record<string, boolean>;
  weekProgress: Record<string, boolean>;
  readinessChecks: Record<string, boolean>;
  compliance: ComplianceState;
  dealDeskDraft: DealDeskDraft;
};
```

The empty buy box is unconfigured, version `0`, with no states/markets/types or
rehab levels, null price bounds, `Medium` minimum confidence, 90 freshness days,
and weights `{ geography: 25, propertyType: 20, price: 15, rehab: 15,
dataQuality: 25 }`.

- [ ] **Step 4: Implement strict v1 migration and v2 reconstruction**

Retain a private `DealFlowDataV1` validator matching the shipped schema.
`migrateV1` copies every valid field, sets `market: ""`, retains the recorded
rehab level, adds empty assertions/conflicts, and maps normalized legacy status
phrases to active migration restrictions. It must never synthesize source IDs,
dates, rights, confidence, or market.

Version-2 validation must reconstruct every allowlisted object and reject
unknown keys, invalid relations, duplicate IDs, non-finite weights, bad enums,
and over-limit arrays/strings. It must not use object spread on imported JSON.

- [ ] **Step 5: Update nullable-rehab consumers**

In `matching.ts`, treat missing rehab as a visible conflict:

```ts
if (deal.rehabLevel === null) {
  conflicts.push("Rehab level is not recorded, so tolerance cannot be evaluated.");
} else if (buyer.rehabTolerance.includes(deal.rehabLevel)) {
  reasons.push(`${deal.rehabLevel} rehab is within tolerance.`);
} else {
  conflicts.push(`${deal.rehabLevel} rehab exceeds the recorded tolerance.`);
}
```

Update existing test fixtures with `market`, empty provenance arrays, and empty
restriction arrays.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npm run test:unit && npm run typecheck`

Expected: all domain/schema tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/import-export.ts lib/matching.ts tests/domain.test.ts tests/schema-storage.test.ts
git commit -m "feat: migrate local data to provenance schema"
```

---

### Task 2: Serialized storage writes and corruption recovery

**Files:**
- Create: `lib/local-storage.ts`
- Modify: `components/LocalDataProvider.tsx`
- Modify: `components/WorkspaceShell.tsx`
- Modify: `components/workspaces/PipelineWorkspace.tsx`
- Modify: `components/workspaces/BuyersWorkspace.tsx`
- Modify: `components/workspaces/DealLabWorkspace.tsx`
- Modify: `components/workspaces/DashboardWorkspace.tsx`
- Modify: `components/workspaces/AcademyWorkspace.tsx`
- Modify: `components/workspaces/ComplianceWorkspace.tsx`
- Modify: `components/workspaces/DealDeskWorkspace.tsx`
- Modify: `tests/schema-storage.test.ts`

**Interfaces:**
- Produces: `readStoredWorkspace(storage, now): StorageReadResult`.
- Produces: `writeStoredWorkspace(storage, data): StorageWriteResult`.
- Produces: context methods `updateData`, `replaceData`, and `clearData` returning `Promise<MutationResult>`.
- Produces: context fields `storageStatus`, `storageMessage`, and `writesSupported`.
- Consumes: `validateImport` and the v2 envelope from Task 1.

- [ ] **Step 1: Add failing storage-state tests**

```ts
test("corrupt current storage recovers valid legacy without overwriting it", () => {
  const storage = memoryStorage({
    [LOCAL_DATA_KEY]: "{broken",
    [LEGACY_LOCAL_DATA_KEY]: JSON.stringify(makeVersionOneWorkspace()),
  });
  const result = readStoredWorkspace(storage, new Date("2026-07-28T12:00:00Z"));
  assert.equal(result.status, "recovered-legacy");
  assert.equal(result.data.schemaVersion, 2);
  assert.equal(storage.getItem(LOCAL_DATA_KEY), "{broken");
});

test("bounded write preserves the old value on quota failure", () => {
  const storage = throwingStorage("QuotaExceededError", '{"old":true}');
  const result = writeStoredWorkspace(storage, createEmptyData());
  assert.equal(result.ok, false);
  assert.equal(storage.getItem(LOCAL_DATA_KEY), '{"old":true}');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test tests/schema-storage.test.ts`

Expected: FAIL because the storage helper and current/legacy status model do not exist.

- [ ] **Step 3: Implement pure storage reads and writes**

Use:

```ts
export const LOCAL_DATA_KEY = "tradewind-dealflow:v2";
export const LEGACY_LOCAL_DATA_KEY = "tradewind-dealflow:v1";
export const MAX_WORKSPACE_BYTES = 4 * 1024 * 1024;
```

`readStoredWorkspace` prefers a valid current v2 snapshot, otherwise checks a
valid legacy v1 snapshot, returns `empty` only when both keys are absent, and
returns `corrupt` when neither present candidate validates. It never calls
`setItem`.

`writeStoredWorkspace` JSON-serializes first, checks UTF-8 byte length, calls one
`setItem`, catches access/quota errors, and returns a user-safe message without
echoing workspace data.

- [ ] **Step 4: Implement the Web-Lock mutation boundary**

Use one lock name, `tradewind-dealflow:workspace-write`. Inside the lock:

1. read the latest valid workspace;
2. block unrecoverable corrupt state;
3. call the updater;
4. validate the candidate;
5. increment `revision` and stamp `updatedAt`;
6. preflight/write through `writeStoredWorkspace`; and
7. dispatch the local-change event only after success.

If `navigator.locks` is unavailable, expose `writesSupported: false` and keep
read/export available. Do not write through an unlocked fallback.

- [ ] **Step 5: Adapt mutation call sites**

Calls that do not need a result use:

```ts
void updateData((current) => ({
  ...current,
  curriculum: { ...current.curriculum, [moduleId]: checked },
}));
```

Confirm/import actions `await` the mutation and show `result.message` when
`ok` is false. Add one persistent, role=`status` storage notice in the workspace
shell when recovery, corruption, quota, or unsupported-lock state is active.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npm run test:unit && npm run typecheck && npm run lint`

Expected: all tests, typecheck, and lint pass.

- [ ] **Step 7: Commit**

```bash
git add lib/local-storage.ts components tests/schema-storage.test.ts
git commit -m "feat: serialize local workspace mutations"
```

---

### Task 3: Bounded CSV parser and authorized-row validation

**Files:**
- Create: `lib/csv.ts`
- Create: `lib/lead-ingestion.ts`
- Create: `tests/csv-ingestion.test.ts`

**Interfaces:**
- Produces: `decodeCsvFile(bytes: Uint8Array): string`.
- Produces: `parseCsv(text: string): CsvParseResult`.
- Produces: `validateLeadCsv(table, now): LeadCsvValidationResult`.
- Produces: typed `LeadImportCandidate` rows with normalized dates and nullable optional facts.
- Consumes later: Task 4 import planning and Task 6 import UI.

- [ ] **Step 1: Add failing parser and schema tests**

```ts
test("CSV parser handles BOM, CRLF, escaped quotes, and quoted newlines", () => {
  const text = '\uFEFFsource,source_record_id,notes\r\n"City, Assessor",001,"Line 1\r\nLine ""2"""';
  const result = parseCsv(text);
  assert.deepEqual(result, {
    ok: true,
    rows: [
      ["source", "source_record_id", "notes"],
      ["City, Assessor", "001", 'Line 1\nLine "2"'],
    ],
  });
});

test("lead validation rejects protected headers before reading rows", () => {
  const result = validateLeadCsv(
    [["source", "source_record_id", "race"], ["Assessor", "001", ""]],
    new Date("2026-07-28T12:00:00Z"),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors[0] ?? "", /prohibited column/i);
});
```

Also add exact tests for unclosed quotes, duplicate headers, unknown headers,
bad UTF-8, all five limits, leading-zero IDs, impossible/future dates, enum
values, negative price, and absent optional rehab/property type.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test tests/csv-ingestion.test.ts`

Expected: FAIL because `csv.ts` and lead validation do not exist.

- [ ] **Step 3: Implement fatal decoding and the parser state machine**

Use `new TextDecoder("utf-8", { fatal: true })`. Parse character by character
with `inQuotes`, `field`, `row`, and aggregate counters. Normalize CRLF and CR
row breaks to LF, preserve line breaks inside quotes, handle `""`, and reject a
quote in an unquoted field or an unclosed quoted field.

- [ ] **Step 4: Implement strict header and row validation**

Define the exact required/optional headers from the design. Normalize headers
with NFKC, trim/collapse, lowercase, and space/hyphen-to-underscore. Reject
duplicate, unknown, protected, and sensitive aliases. Parse `source_record_id`
only as text.

Accept only `YYYY-MM-DD` or ISO date-times with explicit timezone. Round-trip
calendar components, normalize date-times to UTC, and reject values after the
injected `now`. Return row/field errors without echoing entire rows.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --experimental-strip-types --test tests/csv-ingestion.test.ts`

Expected: all parser and validation tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/csv.ts lib/lead-ingestion.ts tests/csv-ingestion.test.ts
git commit -m "feat: validate authorized property CSV files"
```

---

### Task 4: Idempotent import planning, attachments, conflicts, and restrictions

**Files:**
- Modify: `lib/lead-ingestion.ts`
- Modify: `tests/csv-ingestion.test.ts`

**Interfaces:**
- Produces: `planLeadImport(data, candidates): LeadImportPlan`.
- Produces: `attachPossibleDuplicate(plan, rowNumber, dealId): LeadImportPlan`.
- Produces: `applyLeadImportPlan(data, plan, now): ImportApplyResult`.
- Produces: `resolveFactConflict(data, dealId, conflictId, selectedSide, basis, now): DealFlowData`.
- Consumes: validated candidates from Task 3 and version-2 records from Task 1.

- [ ] **Step 1: Add failing plan/apply tests**

```ts
test("reimport is idempotent and changed snapshots preserve canonical facts", () => {
  const first = importOne(emptyWorkspace(), candidate({ address: "10 Harbor Way" }));
  const duplicatePlan = planLeadImport(first, [candidate({ address: "10 Harbor Way" })]);
  assert.equal(duplicatePlan.exactReimports.length, 1);

  const changed = candidate({
    retrievedAt: "2026-07-28",
    lastVerifiedAt: "2026-07-28",
    address: "12 Harbor Way",
  });
  const changedPlan = planLeadImport(first, [changed]);
  const applied = applyLeadImportPlan(first, changedPlan, fixedNow);
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.data.deals[0]?.address, "10 Harbor Way");
  assert.equal(applied.data.deals[0]?.sourceAssertions.length, 2);
  assert.equal(applied.data.deals[0]?.factConflicts[0]?.field, "address");
});

test("stale plan and intra-file possible duplicates do not write", () => {
  const plan = planLeadImport(emptyWorkspace(4), [
    candidate({ sourceRecordId: "1" }),
    candidate({ sourceRecordId: "2" }),
  ]);
  assert.equal(plan.possibleDuplicates.length, 1);
  assert.deepEqual(
    applyLeadImportPlan(emptyWorkspace(5), plan, fixedNow),
    { ok: false, error: "The workspace changed after preview. Review the file again." },
  );
});
```

Add tests for duplicate source identities attached to multiple deals, historical
fingerprints, changed verification only, explicit attach-to-existing,
restricted-source holds with assertion relation, conflict deduplication,
new-stage enforcement, and typed conflict resolution.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --experimental-strip-types --test tests/csv-ingestion.test.ts`

Expected: FAIL because planning and apply functions do not exist.

- [ ] **Step 3: Implement deterministic normalization and fingerprints**

Create stable FNV-1a IDs from normalized source identity and canonical JSON for
testable local identities. Fingerprints include normalized source identity,
retrieval/verification timestamps, classification, confidence, and all source
facts; they exclude generated import metadata.

Address matching uses NFKC, lowercase, collapsed whitespace, and removal of only
`.` and `,`. Preserve unit tokens and numbers.

- [ ] **Step 4: Implement cumulative plan categories**

Process candidates in file order against a working index that includes existing
and earlier planned records. Return:

```ts
type LeadImportPlan = {
  baseRevision: number;
  workspaceFingerprint: string;
  newRows: PlannedNewLead[];
  changedSourceRows: PlannedSourceUpdate[];
  exactReimports: PreviewItem[];
  possibleDuplicates: PossibleDuplicate[];
  rejected: PreviewItem[];
  attachments: PlannedAttachment[];
};
```

Block ambiguous source identities. `attachPossibleDuplicate` accepts only an
existing deal listed for that row and moves it into `attachments` without
changing canonical data.

- [ ] **Step 5: Implement apply and conflict resolution**

Apply verifies revision and workspace fingerprint again. It creates assertions,
new `Research` deals, source-derived restrictions, and only non-duplicate
conflicts. It never applies rejected/possible-duplicate rows.

`resolveFactConflict` validates the selected side and field type, records basis
and time, and updates a canonical field only when `Asserted` is selected.
Source assertions remain unchanged.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npm run test:unit && npm run typecheck`

Expected: all import, domain, migration, and matching tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/lead-ingestion.ts tests/csv-ingestion.test.ts
git commit -m "feat: plan idempotent lead imports"
```

---

### Task 5: Versioned buy box and explainable qualification

**Files:**
- Create: `lib/qualification.ts`
- Create: `tests/qualification.test.ts`

**Interfaces:**
- Produces: `normalizeBuyBox(input, previous, now): BuyBoxValidationResult`.
- Produces: `qualifyDeal(deal, buyBox, evaluationDate): QualificationResult`.
- Produces: `rankResearchQueue(deals, buyBox, evaluationDate): RankedResearchItem[]`.
- Consumes: version-2 deal/source/restriction types.

- [ ] **Step 1: Add failing configuration and score tests**

```ts
test("qualification is deterministic and shows the exact weighted result", () => {
  const result = qualifyDeal(completeDeal({
    confidence: "Medium",
    lastVerifiedAt: "2026-07-20",
  }), configuredBuyBox(), new Date("2026-07-28T12:00:00Z"));

  assert.equal(result.status, "Scored");
  assert.equal(result.score, 98);
  assert.equal(result.sellerFit, "Not assessed");
  assert.deepEqual(
    result.components.map(({ key, score }) => [key, score]),
    [["geography", 100], ["propertyType", 100], ["price", 100],
     ["rehab", 100], ["dataQuality", 90]],
  );
});

test("DNC wins over score and only recommends preserving the hold", () => {
  const result = qualifyDeal(
    completeDeal({ restriction: "Do not contact" }),
    configuredBuyBox(),
    new Date("2026-07-28T12:00:00Z"),
  );
  assert.equal(result.status, "Disqualified");
  assert.equal(result.score, null);
  assert.match(result.recommendedAction, /do not contact/i);
});
```

Add tests for semantic version increments, equivalent normalized saves, every
configuration error, exact matching, inclusive price edges, null optional
facts, zero-weight behavior, stale/future verification, confidence threshold,
unresolved conflicts, all status precedence branches, and stable ranking ties.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test tests/qualification.test.ts`

Expected: FAIL because qualification functions do not exist.

- [ ] **Step 3: Implement buy-box normalization and semantic versioning**

Validate states/types/rehab, optional markets, coherent nonnegative price bounds,
confidence, 1–365 freshness, and finite nonnegative weights with at least one
positive weight. Normalize/dedupe/sort arrays. Compare only semantic fields; an
equivalent save retains the current version, otherwise increment it.

- [ ] **Step 4: Implement exact component and status rules**

Implement the approved component rules and data-quality subtotal:

```ts
const dataQuality =
  (hasCompleteProvenance ? 40 : 0) +
  ({ High: 25, Medium: 15, Low: 5 }[confidence] ?? 0) +
  (isFresh ? 25 : 0) +
  (unresolvedConflicts === 0 ? 10 : 0);
```

Apply status precedence `Unconfigured` → `Disqualified` → `Needs data` →
`Scored`, produce no numeric overall score for the first three, and derive the
safe recommendation in the specified order.

- [ ] **Step 5: Implement ranking**

Sort scored records by score descending, then data-quality score descending,
then oldest canonical `updatedAt`, then stable deal ID. Return Needs-data and
disqualified remediation queues separately so partial scores never imply rank.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npm run test:unit && npm run typecheck && npm run lint`

Expected: all tests, typecheck, and lint pass.

- [ ] **Step 7: Commit**

```bash
git add lib/qualification.ts tests/qualification.test.ts
git commit -m "feat: add explainable property qualification"
```

---

### Task 6: Pipeline buy box, CSV preview, provenance, and qualification UI

**Files:**
- Create: `components/pipeline/BuyBoxForm.tsx`
- Create: `components/pipeline/AuthorizedCsvImport.tsx`
- Create: `components/pipeline/QualificationPanel.tsx`
- Modify: `components/workspaces/PipelineWorkspace.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: provider mutation results, CSV validation, import plans, buy-box normalization, and qualification from Tasks 2–5.
- Produces: accessible local-only operator workflow on `/pipeline`.

- [ ] **Step 1: Add failing rendered-route assertions**

```js
test("pipeline renders authorized intake and scoring boundaries", async () => {
  const html = await renderRoute("/pipeline");
  assert.match(html, /Authorized CSV import/);
  assert.match(html, /Configure buy box/);
  assert.match(html, /The file stays in this browser/);
  assert.match(html, /A score never authorizes contact/);
  assert.doesNotMatch(html, /Send campaign|Text owner|Email owner/);
});
```

- [ ] **Step 2: Run rendered tests and verify RED**

Run: `npm run build && npm run test:render`

Expected: FAIL because the new Pipeline controls and boundary copy are absent.

- [ ] **Step 3: Build the buy-box form**

Use labelled checkboxes for MA/RI and rehab levels; comma-separated markets and
property types with descriptive help; numeric price/freshness/weight inputs;
and a persistent `aria-live="polite"` result. On invalid save, apply
`aria-invalid`, connect the field error with `aria-describedby`, and focus the
first invalid control. On success, await `updateData` and report the stored
version.

- [ ] **Step 4: Build the CSV import preview**

Read `File.arrayBuffer`, enforce byte limits before decode, parse/validate, and
focus a `tabIndex={-1}` preview heading. Render semantic lists for new rows,
changed source rows, exact reimports, possible duplicates, and errors. A
possible duplicate may be explicitly attached to the shown existing record.
Apply is disabled for unresolved possible duplicates, invalid files, stale
plans, unsupported locks, or empty safe plans.

Use one button labelled `Apply safe records`; it must not say upload because no
network request occurs. Restore focus to the file control after cancel or
success. Add `Download blank CSV template`; its only data row is absent, so it
contains headers and instructions but no property or seller record.

- [ ] **Step 5: Add provenance-aware manual entry**

Require source, source record ID, retrieval date, state, address, city, market,
usage classification, confidence, and verification date. Property type, asking
price, rehab, and notes stay optional. Default no unknown condition value.
Pass the candidate through the same planner used by CSV so source and possible
property duplicates cannot bypass intake safeguards. Create a source assertion
and a `Research` deal only from a safe plan; never accept a stage from the form.

- [ ] **Step 6: Render qualification and source integrity**

Show status/score, components, reasons, missing facts, disqualifiers, seller-fit
`Not assessed`, and recommended research action. Show assertion history,
freshness, usage class, active restrictions, and unresolved conflicts.

Conflict resolution offers `Keep canonical` and `Use asserted`, requires a
basis, awaits a locked mutation, and leaves the source history visible.
Source-derived holds have no direct delete control.

Allow the operator to add a structured DNC, identity-dispute, ownership-stale,
or specialist-review restriction with a reason. Permit resolution of only
operator/migration restrictions with a required dated note; preserve every
restriction in history. Add filters for qualification status, stale source,
unresolved conflicts, and active restrictions.

- [ ] **Step 7: Add responsive styles**

At widths below 640px, stack controls and preview cards, let long source IDs
wrap, keep 44-pixel minimum targets, and avoid a mandatory horizontally
scrolling data table for qualification details. Preserve visible focus and
reduced-motion behavior.

- [ ] **Step 8: Run tests and verify GREEN**

Run: `npm run test:unit && npm run typecheck && npm run lint && npm run build && npm run test:render`

Expected: all unit, type, lint, build, and rendered-route checks pass.

- [ ] **Step 9: Commit**

```bash
git add components/pipeline components/workspaces/PipelineWorkspace.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: add authorized lead intake workspace"
```

---

### Task 7: Dashboard research queue and operator documentation

**Files:**
- Modify: `components/workspaces/DashboardWorkspace.tsx`
- Modify: `README.md`
- Modify: `docs/OPERATOR_MANUAL.md`
- Modify: `docs/PHASE_2_ARCHITECTURE.md`
- Modify: `docs/RELEASE_CHECKLIST.md`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `rankResearchQueue` and version-2 storage/buy-box state.
- Produces: real-data-only daily research queue and complete operating instructions.

- [ ] **Step 1: Add failing Dashboard assertions**

```js
test("dashboard exposes real-data research readiness without revenue claims", async () => {
  const html = await renderRoute("/dashboard");
  assert.match(html, /Buy box status/);
  assert.match(html, /Research priority/);
  assert.match(html, /No scored records yet/);
  assert.doesNotMatch(html, /Projected revenue|Motivated sellers|Guaranteed/);
});
```

- [ ] **Step 2: Run rendered tests and verify RED**

Run: `npm run build && npm run test:render`

Expected: FAIL because Dashboard lacks buy-box and research-priority sections.

- [ ] **Step 3: Implement Dashboard summaries**

Derive from local data only:

- configured status and buy-box version;
- count missing provenance;
- count unresolved conflicts;
- count active restrictions;
- top five `Scored` research records with exact score/reason link; and
- separate needs-data and disqualified remediation counts.

The empty state says how to configure a buy box and add a real authorized
record. It never inserts a demonstration record.

- [ ] **Step 4: Update documentation**

Document the exact CSV schema/enums/limits, browser-only processing, v1→v2
migration, storage recovery, Web Locks requirement, JSON/CSV backup behavior,
formula neutralization, source rights assertion, buy-box formula/status rules,
daily research loop, and all disabled actions.

Update the Phase 2 architecture status to identify this local-first
intake/qualification slice as implemented while server ingestion, auth, jobs,
outreach, and provider adapters remain inactive.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:unit && npm run typecheck && npm run lint && npm run build && npm run test:render`

Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add components/workspaces/DashboardWorkspace.tsx README.md docs tests/rendered-html.test.mjs
git commit -m "feat: add daily research priority queue"
```

---

### Task 8: Security, browser, production, and deployment verification

**Files:**
- Modify only if verification finds a defect in the files from Tasks 1–7.
- Update: `docs/RELEASE_CHECKLIST.md` with actual dated results.

**Interfaces:**
- Consumes: the complete release.
- Produces: a verified commit, saved Sites version, and production deployment.

- [ ] **Step 1: Run the complete automated verification**

Run:

```bash
npm run test
npm run typecheck
npm run lint
npm audit --omit=dev
git diff --check
```

Expected: all tests/build/render checks pass, typecheck/lint pass, runtime audit
reports zero vulnerabilities, and diff check is clean.

- [ ] **Step 2: Run local desktop and mobile browser smoke tests**

Start the production server and verify at desktop and 320×844:

1. empty Pipeline has no fake record;
2. buy-box invalid form focuses its first error;
3. valid buy box saves and versions;
4. malformed CSV changes no data;
5. valid CSV preview shows exact categories;
6. Apply creates only `Research` records;
7. reimport creates no duplicate;
8. changed source shows a conflict without canonical overwrite;
9. DNC/restricted record receives no contact recommendation;
10. Dashboard shows real local priorities;
11. keyboard traversal and visible focus work;
12. MA/RI warnings remain visible in relevant workspaces; and
13. a synthetic v1 browser snapshot migrates without losing its DNC hold;
14. a corrupt snapshot blocks writes and shows restore/clear guidance; and
15. `/healthz` reports outreach disabled.

- [ ] **Step 3: Run production content and network audit**

Search the built artifacts and live route behavior for:

```bash
rg -n "mock|sample lead|fake buyer|send sms|send email|autodial|guaranteed revenue" dist .next
```

Inspect browser network activity during CSV parse/apply and confirm no property
row, address, source ID, note, or score leaves the origin.

- [ ] **Step 4: Fix any discovered defect with a regression test**

For every defect, first add the smallest failing unit/render regression, verify
RED, implement the correction, and rerun the complete Step 1 suite before
continuing.

- [ ] **Step 5: Record actual release results**

Add the date, commands, exact passing counts, browser viewports, runtime audit
result, health result, and remaining deliberate limitations to
`docs/RELEASE_CHECKLIST.md`.

- [ ] **Step 6: Commit the release**

```bash
git add .
git commit -m "release: ship authorized lead qualification"
git status --short
```

Expected: clean working tree.

- [ ] **Step 7: Push the exact source state and save a Sites version**

Read `.openai/hosting.json`, reuse its opaque project ID, push the release
commit to the bound Sites source branch, and confirm the remote commit equals
local `HEAD`. Build any deployment archive from that exact commit only, then
save a Sites version with the same `commit_sha`.

- [ ] **Step 8: Deploy the saved version and verify production**

Deploy only the saved version. Inspect status until terminal, then load every
public/workspace route plus `/healthz` from the production URL. Confirm the
access policy remains unchanged and report any domain/DNS action as still
requiring explicit authorization.
