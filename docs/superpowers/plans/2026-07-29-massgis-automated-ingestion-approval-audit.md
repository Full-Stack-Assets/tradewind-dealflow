# Lean MassGIS Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrieve hundreds of Massachusetts parcel candidates through both scheduled and operator-triggered runs, using one standing source approval, one-click safe import, and a durable audit trail.

**Architecture:** A small D1 control plane stores one versioned MassGIS policy, runs, staged records, and append-only audit events. The existing Worker uses the same ingestion function for `Run now` and an hourly schedule; the Sources page imports every safe staged record into the existing local Pipeline through one Web-Locked batch.

**Tech Stack:** TypeScript 5.9, Node.js 22.13+, React 19, Next.js 16/Vinext, Cloudflare Worker scheduled handler, D1, Drizzle migration, Miniflare tests, existing local ingestion planner.

## Global Constraints

- Keep the existing private Sites project and owner-only access policy.
- Add logical D1 binding `DB`; keep `r2: null`.
- Pin the first adapter to MassGIS item
  `73d4c766167848b795f1048cad3919c7`, layer `0`.
- Query only `services1.arcgis.com`; set `returnGeometry=false`.
- Never request or retain `OWNER1`, `OWN_ADDR`, `OWN_CITY`, `OWN_STATE`,
  `OWN_ZIP`, or `OWN_CO`.
- Standing approval covers the policy, not each parcel or run.
- New local records enter `Research`.
- Exact reruns add no duplicate records.
- Exceptions do not block safe records and are summarized by reason.
- Keep outreach, contact enrichment, offers, contracts, public marketing,
  payments, and AI decisions disabled.
- Default schedule: daily at 02:00 `America/New_York`, evaluated by an hourly
  Worker trigger.
- Preserve existing Web Locks, strict storage validation, provenance, and
  conflict behavior.

## Deliberately deferred

- Generic multi-action approval queues.
- Per-record approval.
- Automatic import while the browser is closed.
- Delivery-receipt tables and workspace synchronization.
- A full audit-search application.
- Municipal portal adapters beyond MassGIS.
- Any owner/contact data.

Scheduled runs stage records while the browser is closed. On the next visit,
the operator uses one `Import all safe records` action.

---

### Task 1: Add four-table D1 control plane

**Files:**
- Modify: `.openai/hosting.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `drizzle.config.ts`
- Create: `db/schema.ts`
- Create: `drizzle/0000_massgis_ingestion.sql`
- Create: `server/d1.ts`
- Create: `lib/ingestion/contracts.ts`
- Create: `lib/ingestion/policy.ts`
- Create: `lib/ingestion/audit.ts`
- Create: `tests/helpers/d1.ts`
- Create: `tests/ingestion-control.test.ts`

**Interfaces:**
- Produces `SourcePolicy`, `IngestionRun`, `StagedSourceRecord`,
  `AuditEvent`, `validatePolicy`, `hashPolicy`, `appendAuditEvent`, and the
  logical `DB` binding.

- [ ] **Step 1: Write the failing schema and policy tests**

```ts
test("migration creates only the four ingestion tables", async () => {
  const db = await createTestD1();
  assert.deepEqual(await tableNames(db), [
    "audit_events",
    "ingestion_runs",
    "source_policies",
    "source_records",
  ]);
});

test("one material policy change invalidates approval", async () => {
  const approved = validPolicy({ maxRecordsPerRun: 5000 });
  const changed = validPolicy({ maxRecordsPerRun: 6000 });
  assert.notEqual(await hashPolicy(approved), await hashPolicy(changed));
});

test("policy rejects owner fields and arbitrary endpoints", () => {
  assert.equal(validatePolicy({ ...validPolicy(), outFields: ["OWNER1"] }).ok, false);
  assert.equal(
    validatePolicy({ ...validPolicy(), endpoint: "https://example.com/query" }).ok,
    false,
  );
});
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --experimental-strip-types --test tests/ingestion-control.test.ts
```

Expected: FAIL because the schema and policy modules do not exist.

- [ ] **Step 3: Add exact dependencies and binding**

Install exact current packages:

```bash
npm install --save-exact drizzle-orm@0.45.2
npm install --save-dev --save-exact drizzle-kit@0.31.10 miniflare@4.20260722.1
```

Set `.openai/hosting.json` to:

```json
{
  "project_id": "appgprj_6a681e7c21f4819182043900ac4fd875",
  "d1": "DB",
  "r2": null
}
```

- [ ] **Step 4: Define the four tables**

`source_policies`:

- `id`, `version`, `status`, `policy_json`, `policy_hash`
- `approved_by`, `approved_at`
- `next_run_at`, `created_at`
- one active policy at a time

`ingestion_runs`:

- `id`, `policy_id`, `policy_hash`, `trigger`, `status`
- `idempotency_key`, `requested_at`, `started_at`, `completed_at`
- counts for retrieved, safe, duplicate, changed, exception, imported, failed
- `last_error_code`

`source_records`:

- `id`, `run_id`, `source_identity`, `source_record_id`
- `retrieved_at`, `raw_json`, `normalized_json`
- `raw_fingerprint`, `normalized_fingerprint`
- classification `safe | exact-duplicate | changed | exception`
- `reason_code`, `imported_at`
- unique `(source_identity, normalized_fingerprint)`

`audit_events`:

- autoincrement `sequence`
- `id`, `occurred_at`, `actor_id`, `event_type`
- `aggregate_type`, `aggregate_id`, `metadata_json`
- unique `previous_hash`, unique `event_hash`

Use foreign keys with `ON DELETE RESTRICT`.

- [ ] **Step 5: Define the policy**

```ts
export type SourcePolicy = {
  adapter: "massgis-parcels-v1";
  endpoint: "https://services1.arcgis.com/hGdibHYSPO59RG1h/ArcGIS/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0/query";
  townIds: number[];
  outFields: MassGisField[];
  useCodes: string[];
  unitCounts: number[];
  maximumAssessedValue: number | null;
  maximumYearBuilt: number | null;
  minimumLastSaleAgeYears: number | null;
  pageSize: number;
  maxRecordsPerRun: number;
  scheduleEnabled: boolean;
  scheduleTimeZone: "America/New_York";
  scheduleHour: number;
  scheduleMinute: number;
};
```

Canonicalization sorts and deduplicates arrays. Validation enforces town IDs
`1..351`, pages `1..2000`, run cap `100..100000`, exact endpoint, and the field
allowlist.

- [ ] **Step 6: Implement append-only audit hashing**

```ts
eventHash = SHA256(previousHash + canonicalJson(eventWithoutHashes))
```

Append the state change and audit insert in one D1 `batch`. Unique
`previous_hash` prevents a fork; retry one concurrent conflict.

- [ ] **Step 7: Generate migration and pass tests**

```bash
npm run db:generate -- --name massgis_ingestion
node --experimental-strip-types --test tests/ingestion-control.test.ts
npm run typecheck
npm run build
```

Inspect the migration, normalize its filename to
`drizzle/0000_massgis_ingestion.sql`, and confirm it is copied into
`dist/.openai/drizzle`.

- [ ] **Step 8: Commit**

```bash
git add .openai/hosting.json package.json package-lock.json drizzle.config.ts db drizzle server/d1.ts lib/ingestion tests/helpers/d1.ts tests/ingestion-control.test.ts
git commit -m "feat: add lean ingestion control plane"
```

---

### Task 2: Add the query-only MassGIS adapter

**Files:**
- Create: `lib/ingestion/massgis.ts`
- Create: `tests/massgis.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes an approved `SourcePolicy`.
- Produces `buildQuery`, `validateMassGisPage`, `normalizeMassGisRecord`, and
  `fetchMassGisRecords`.

- [ ] **Step 1: Write failing adapter tests**

```ts
test("query is paginated, deterministic, geometry-free, and owner-free", () => {
  const query = buildQuery(validPolicy(), 2000);
  assert.equal(query.get("resultOffset"), "2000");
  assert.equal(query.get("resultRecordCount"), "2000");
  assert.equal(query.get("orderByFields"), "OBJECTID ASC");
  assert.equal(query.get("returnGeometry"), "false");
  assert.doesNotMatch(query.get("outFields") ?? "", /OWNER|OWN_/);
});

test("unexpected owner data rejects the page", () => {
  assert.throws(
    () => validateMassGisPage(pageWithField("OWNER1"), validPolicy()),
    /unapproved field/i,
  );
});

test("official residential codes map without inventing motivation", () => {
  assert.equal(normalizeMassGisRecord(feature({ USE_CODE: "101" })).propertyType, "single-family homes");
  assert.equal(normalizeMassGisRecord(feature({ USE_CODE: "104" })).propertyType, "duplexes");
  assert.equal(normalizeMassGisRecord(feature({ USE_CODE: "105" })).propertyType, "triplexes");
  assert.equal(normalizeMassGisRecord(feature({ USE_CODE: "111", UNITS: 4 })).propertyType, "four-unit residential");
});
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --experimental-strip-types --test tests/massgis.test.ts
```

- [ ] **Step 3: Implement the exact field allowlist**

Request only:

```ts
[
  "OBJECTID", "GlobalID", "MAP_PAR_ID", "LOC_ID", "TOWN_ID", "PROP_ID",
  "TOTAL_VAL", "BLDG_VAL", "LAND_VAL", "FY", "LOT_SIZE", "LOT_UNITS",
  "LS_DATE", "LS_PRICE", "USE_CODE", "USE_DESC", "SITE_ADDR", "CITY", "ZIP",
  "YEAR_BUILT", "BLD_AREA", "UNITS"
]
```

Explicitly deny:

```ts
["OWNER1", "OWN_ADDR", "OWN_CITY", "OWN_STATE", "OWN_ZIP", "OWN_CO"]
```

- [ ] **Step 4: Implement bounded query and pagination**

Use typed filters only—no raw SQL. Query parameters:

- `f=json`
- `where`
- explicit `outFields`
- `returnGeometry=false`
- `orderByFields=OBJECTID ASC`
- `resultOffset`
- `resultRecordCount`

Stop at the policy cap. Retry timeout, HTTP 408, 429, and 5xx up to three times.
Reject ArcGIS error envelopes, unknown fields, decreasing object IDs,
impossible dates, nonfinite numbers, and malformed records.

- [ ] **Step 5: Normalize records**

```ts
export type MassGisCandidate = {
  sourceIdentity: string;
  sourceRecordId: string;
  retrievedAt: string;
  address: string;
  city: string;
  zip: string;
  propertyType: string;
  assessedValue: number | null;
  assessmentFiscalYear: number | null;
  useCode: string;
  units: number | null;
  yearBuilt: number | null;
  buildingArea: number | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  rawFingerprint: string;
  normalizedFingerprint: string;
};
```

Assessed value and sale price remain source facts; never map them to asking
price, ARV, equity, or seller motivation.

- [ ] **Step 6: Run tests and commit**

```bash
node --experimental-strip-types --test tests/massgis.test.ts
npm run test:unit
npm run typecheck
git add lib/ingestion/massgis.ts tests/massgis.test.ts package.json
git commit -m "feat: add MassGIS parcel adapter"
```

---

### Task 3: Use one runner for manual and scheduled retrieval

**Files:**
- Create: `server/ingestion-store.ts`
- Create: `server/ingestion-runner.ts`
- Create: `server/ingestion-api.ts`
- Create: `server/ingestion-scheduler.ts`
- Create: `tests/ingestion-runner.test.ts`
- Modify: `worker/index.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `runIngestion(policy, trigger, idempotencyKey)`,
  `handleIngestionApi`, and `runDuePolicies`.

- [ ] **Step 1: Write failing shared-runner tests**

```ts
test("manual and scheduled triggers produce identical classifications", async () => {
  const manual = await runFixture("operator");
  const scheduled = await runFixture("schedule");
  assert.deepEqual(manual.fingerprints, scheduled.fingerprints);
  assert.deepEqual(manual.counts, scheduled.counts);
});

test("125 safe records create no per-record approval rows", async () => {
  const result = await runFixture("operator", 125);
  assert.equal(result.counts.safe, 125);
  assert.equal(result.counts.exception, 0);
});

test("exact rerun stages duplicates without creating new source records", async () => {
  const first = await runFixture("operator", 125);
  const second = await runFixture("operator", 125);
  assert.equal(first.counts.safe, 125);
  assert.equal(second.counts.duplicate, 125);
});
```

Also test cancellation, record cap, changed fingerprint, invalid record,
transient retry, permanent failure, and overlapping-run rejection.

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --experimental-strip-types --test tests/ingestion-runner.test.ts
```

- [ ] **Step 3: Implement the runner**

```ts
export async function runIngestion(input: {
  policy: ApprovedPolicy;
  trigger: "operator" | "schedule";
  idempotencyKey: string;
  actorId: string;
  signal: AbortSignal;
}): Promise<IngestionRun>;
```

The runner:

1. verifies the active policy hash;
2. creates one run;
3. fetches sequential pages;
4. fingerprints and classifies records;
5. stores each page and one audit event atomically;
6. preserves safe pages if a later page fails;
7. finishes with counts; and
8. never creates per-record approval records.

Classifications:

- `safe`
- `exact-duplicate`
- `changed`
- `exception`

Exception reason codes:

- `possible-property-match`
- `source-conflict`
- `invalid-record`
- `source-schema-change`
- `record-cap`
- `source-failure`

- [ ] **Step 4: Add the small API**

Authenticated same-origin endpoints:

- `GET /api/sources/policy`
- `POST /api/sources/policy/approve`
- `POST /api/sources/runs`
- `GET /api/sources/runs`
- `GET /api/sources/records`
- `POST /api/sources/records/imported`
- `GET /api/sources/audit`

Read `oai-authenticated-user-email`, hash the normalized email for `actor_id`,
and never store the plaintext email. Require JSON, 64 KiB bodies, and
`Idempotency-Key` on run requests.

- [ ] **Step 5: Add hourly scheduling**

Extend the Worker:

```ts
async scheduled(controller, env, ctx) {
  ctx.waitUntil(runDuePolicies(env, new Date(controller.scheduledTime)));
}
```

Add:

```ts
triggers: { crons: ["0 * * * *"] }
```

The hourly check creates at most one due run for the approved policy in its
`America/New_York` schedule window.

- [ ] **Step 6: Run tests and commit**

```bash
node --experimental-strip-types --test tests/ingestion-runner.test.ts
npm run test:render
npm run typecheck
npm run build
git add server tests/ingestion-runner.test.ts worker/index.ts vite.config.ts package.json
git commit -m "feat: add manual and scheduled source runs"
```

---

### Task 4: Add Sources page and one-click safe import

**Files:**
- Create: `app/(workspace)/sources/page.tsx`
- Create: `components/workspaces/SourcesWorkspace.tsx`
- Create: `lib/ingestion/client.ts`
- Create: `lib/ingestion/import-safe.ts`
- Create: `tests/ingestion-import.test.ts`
- Modify: `components/WorkspaceShell.tsx`
- Modify: `components/workspaces/PipelineWorkspace.tsx`
- Modify: `components/workspaces/DashboardWorkspace.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes staged records and the existing local import planner.
- Produces `/sources`, policy approval, `Run now`, run status, grouped
  exceptions, audit download, and `Import all safe records`.

- [ ] **Step 1: Write failing import tests**

```ts
test("one action imports 125 safe records into Research", () => {
  const result = importSafeRecords(emptyWorkspace(), safeRecords(125), NOW);
  assert.equal(result.data.deals.length, 125);
  assert.equal(result.data.deals.every((deal) => deal.stage === "Research"), true);
  assert.equal(result.outcomes.filter((item) => item === "applied").length, 125);
});

test("retry after lost server acknowledgement creates no duplicates", () => {
  const first = importSafeRecords(emptyWorkspace(), safeRecords(2), NOW);
  const second = importSafeRecords(first.data, safeRecords(2), NOW);
  assert.equal(second.data.deals.length, 2);
  assert.deepEqual(second.outcomes, ["exact-reimport", "exact-reimport"]);
});
```

Also test changed-source conflict preservation and exclusion of server
exceptions from safe import.

- [ ] **Step 2: Add failing rendered route test**

`/sources` must render:

- official MassGIS source identity;
- schedule status;
- `Run now`;
- latest run counts;
- grouped exception counts;
- `Import all safe records`;
- audit export;
- no owner/contact fields; and
- no outreach control.

- [ ] **Step 3: Run tests and confirm failure**

```bash
node --experimental-strip-types --test tests/ingestion-import.test.ts
npm run test:render
```

- [ ] **Step 4: Build the Sources page**

One screen contains:

- policy scope derived initially from the active buy box;
- town IDs, use codes, unit counts, assessed-value cap, year-built cap,
  last-sale age, run cap, and schedule;
- one `Approve policy` action with a concise diff;
- `Run now`;
- active/last five runs;
- safe/duplicate/changed/exception counts;
- grouped exception reason counts;
- `Import all safe records`; and
- `Download audit`.

No generic workflow builder or per-record review grid.

- [ ] **Step 5: Implement one-click local import**

Convert safe records to existing `LeadImportCandidate` values:

- source `MassGIS Property Tax Parcels`
- usage `Public record`
- state `MA`
- confidence `Medium`
- retrieved/verified time from the source run
- address, city, ZIP, and mapped property type

Apply the entire safe batch through one `updateData` call, which already uses
the workspace Web Lock. After success, post snapshot IDs and outcome counts to
`/api/sources/records/imported`.

If acknowledgement fails, leave a retry notice. The next import is safe because
the existing fingerprint/idempotency rules produce exact reimports.

- [ ] **Step 6: Add concise operating health**

- Pipeline shows pending safe-record count and latest import result.
- Dashboard shows last run, next scheduled run, and exception count.
- Neither surface invents lead counts before D1 returns real data.

- [ ] **Step 7: Verify responsive and keyboard behavior**

Check 320, 390, 768, and 1440 CSS pixels; no horizontal overflow. Preserve the
skip link, semantic labels, first-invalid focus, confirmation focus return, and
3 px visible focus.

- [ ] **Step 8: Run tests and commit**

```bash
npm run test:unit
npm run test:render
npm run typecheck
npm run lint
npm run build
git add app/'(workspace)'/sources components lib/ingestion/client.ts lib/ingestion/import-safe.ts tests/ingestion-import.test.ts tests/rendered-html.test.mjs package.json
git commit -m "feat: add one-click GIS lead intake"
```

---

### Task 5: Document, verify, and harden the lean release

**Files:**
- Create: `docs/MASSGIS_INGESTION.md`
- Modify: `README.md`
- Modify: `docs/OPERATOR_MANUAL.md`
- Modify: `docs/BACKUP_AND_RECOVERY.md`
- Modify: `docs/SECURITY_AND_PRIVACY.md`
- Modify: `docs/KNOWN_LIMITATIONS.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/RELEASE_CHECKLIST.md`
- Modify: `app/healthz/route.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces truthful operator instructions, rollback steps, and release evidence.

- [ ] **Step 1: Update health contract**

```json
{
  "status": "ok",
  "service": "tradewind-dealflow",
  "release": "massgis-ingestion",
  "outreach": "disabled",
  "ingestion": {
    "manual": "enabled",
    "scheduled": "enabled",
    "ownerContactFields": "disabled"
  }
}
```

- [ ] **Step 2: Write the operator guide**

Cover:

- source and field allowlist;
- policy approval;
- schedule and `Run now`;
- one-click safe import;
- duplicate behavior;
- grouped exceptions;
- audit export;
- scheduler pause;
- D1/local backup boundaries; and
- rollback.

- [ ] **Step 3: Update existing claims**

Remove outdated claims that no backend or automated ingestion exists. Preserve
all statements that outreach, owner/contact enrichment, AI decisions, offers,
contracts, and payments remain absent.

- [ ] **Step 4: Run privacy and full verification**

```bash
rg -n "OWNER1|OWN_ADDR|OWN_CITY|OWN_STATE|OWN_ZIP|OWN_CO" . -g '!node_modules' -g '!dist'
npm run test
npm run typecheck
npm run lint
npm audit --omit=dev
git diff --check
```

Every owner-field match must be limited to denylist code, tests, or
documentation.

- [ ] **Step 5: Commit**

```bash
git add docs README.md app/healthz/route.ts tests/rendered-html.test.mjs
git commit -m "docs: add MassGIS ingestion operations"
```

---

### Task 6: Deploy and activate the first production policy

**Files:**
- Modify: `docs/RELEASE_CHECKLIST.md`

**Interfaces:**
- Produces the private deployed release and its first active MassGIS policy.

- [ ] **Step 1: Verify locally**

```bash
npm ci
npm run test
npm run typecheck
npm run lint
npm audit --omit=dev
git diff --check
```

Start the standalone server and verify `/`, `/dashboard`, `/sources`,
`/pipeline`, `/compliance`, and `/healthz`.

- [ ] **Step 2: Run live-source dry verification**

Use one narrow town policy with import disabled. Verify:

- official endpoint and schema;
- query-only request;
- owner/contact fields absent;
- pagination and counts;
- staged records and audit chain; and
- no local Pipeline mutation.

- [ ] **Step 3: Verify both trigger modes**

Run the same policy manually and through a controlled due-schedule invocation.
Confirm identical fingerprints/classifications and no duplicate run.

- [ ] **Step 4: Verify 100+ batch intake**

Use the approved target-town policy to retrieve at least 100 safe candidates.
Click `Import all safe records` once and verify:

- safe records enter `Research`;
- exact rerun creates no duplicates;
- exceptions remain grouped;
- audit export verifies; and
- no owner/contact fields appear in requests, D1, browser backup, exports, or
  logs.

- [ ] **Step 5: Commit and deploy exact source**

Complete the release ledger, commit, push the private branch, package the exact
Sites source with D1 migration, save one Sites version, deploy it privately,
and poll to success.

- [ ] **Step 6: Production smoke**

Verify:

- owner-only access unchanged;
- D1 migration applied;
- manual run works;
- hourly schedule registered;
- next scheduled run visible;
- required routes and health succeed;
- worker/browser error logs empty;
- outreach disabled; and
- rollback can pause scheduling before restoring the prior Sites version.
