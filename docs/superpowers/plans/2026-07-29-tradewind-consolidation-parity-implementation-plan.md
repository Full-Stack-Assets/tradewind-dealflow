# Tradewind Consolidation and Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the completed MassGIS work and the verified legacy DealFlow behavior into the current Tradewind repository without copying production PII, changing existing release behavior, or rebuilding active work.

**Architecture:** The current Next.js/TypeScript repository remains the application source of truth. The completed MassGIS branch is merged only after its current task passes review; legacy archives remain external read-only evidence while sanitized manifests, migration contracts, configurable underwriting logic, and reconciliation tools are added to the repository.

**Tech Stack:** TypeScript 5.9, Node.js 22.13+, React 19, Next.js 16/Vinext, Node test runner, Cloudflare Worker/D1 for the existing ingestion control plane, JSON fixtures containing synthetic test-only records.

## Global Constraints

- Start only after Tasks 3–5 of the existing Lean MassGIS Automation plan are complete and independently reviewed.
- Do not repeat the MassGIS runner, scheduling, Sources page, one-click import, or hardening work owned by the existing task.
- Production deployment and policy activation remain outside this plan.
- Preserve the current Next.js repository as the only product source of truth.
- Preserve unrelated user modifications and stage only files named by the active task.
- Never commit `dealflow.db`, `leads_real.csv`, `comps_real.csv`, raw owner or seller records, proof-of-funds documents, absolute personal file paths, or extracted archive directories.
- Test fixtures must be synthetic, clearly labeled, and impossible to confuse with production records.
- Preserve source assertions, usage rights, confidence, conflicts, restrictions, Web Locks, and existing qualification behavior.
- Preserve the legacy rule that final underwriting requires at least three approved usable comparables unless a versioned human override exists.
- Keep offers, executable contracts, public marketing, final buyer selection, sensitive sharing, money, and closing instructions human-controlled.
- Run test-first for every code task and use one focused commit per task.
- Use an isolated worktree when this plan is executed.

---

### Task 1: Integrate the Completed MassGIS Branch

**Files:**
- Merge source: branch `codex/massgis-automation`
- Merge destination: branch `codex/authorized-lead-intake`
- Verify: all files changed by the completed MassGIS plan

**Interfaces:**
- Consumes: reviewed implementations of `SourcePolicy`, `IngestionRun`, `StagedSourceRecord`, `AuditEvent`, the shared retrieval runner, the Sources workspace, and safe local import.
- Produces: one destination branch containing the existing release plus completed MassGIS Tasks 1–5.

- [ ] **Step 1: Create an isolated integration worktree**

Run the `superpowers:using-git-worktrees` skill. Create the worktree from
`codex/authorized-lead-intake`; do not reuse the active MassGIS worktree.

Expected: the new worktree starts at the approved product-specification commit
or its reviewed successor and contains no untracked files.

- [ ] **Step 2: Verify the destination baseline**

Run:

```bash
npm ci
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:render
git diff --check
```

Expected: every command passes before the merge. If one fails, record the
baseline failure and stop; do not attribute it to the MassGIS branch.

- [ ] **Step 3: Verify the MassGIS completion gate**

Run:

```bash
git -C .worktrees/massgis-automation status --short
git -C .worktrees/massgis-automation log --oneline codex/authorized-lead-intake..codex/massgis-automation
```

Inspect the MassGIS progress record and review reports.

Expected:

- the MassGIS worktree is clean;
- Tasks 1–5 have implementation commits;
- Tasks 1–5 have passed their required reviews;
- no production deployment is required;
- Task 6 is not silently treated as complete.

If the gate is not satisfied, stop this task and return control to the existing
MassGIS task.

- [ ] **Step 4: Merge without rewriting either branch**

Run:

```bash
git merge --no-ff codex/massgis-automation -m "merge: integrate reviewed MassGIS automation"
```

Expected: a merge commit. If Git reports a conflict, stop and inventory each
conflicted file; do not choose a side with `checkout --ours`, `checkout
--theirs`, or a broad reset.

- [ ] **Step 5: Run focused and full verification**

Run:

```bash
node --experimental-strip-types --test tests/ingestion-control.test.ts tests/massgis.test.ts
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:render
git diff --check
```

Expected: focused ingestion tests and every release gate pass.

- [ ] **Step 6: Record the merge evidence**

Create `docs/migration/MASSGIS_INTEGRATION_EVIDENCE.md` with:

```markdown
# MassGIS Integration Evidence

- Destination branch: `codex/authorized-lead-intake`
- Source branch: `codex/massgis-automation`
- Included plan tasks: 1–5
- Production deployment included: No
- Focused ingestion tests: Passed
- Unit tests: Passed
- Typecheck: Passed
- Lint: Passed
- Build: Passed
- Render tests: Passed
- Diff check: Passed
```

Replace each `Passed` only with the actual verified result; if any result is
not passing, do not create the merge evidence or continue.

- [ ] **Step 7: Commit the evidence**

```bash
git add docs/migration/MASSGIS_INTEGRATION_EVIDENCE.md
git commit -m "docs: record MassGIS integration evidence"
```

---

### Task 2: Add a Sanitized Legacy Asset Manifest

**Files:**
- Create: `scripts/legacy-asset-manifest.mjs`
- Create: `tests/legacy-asset-manifest.test.mjs`
- Create: `docs/migration/LEGACY_ASSET_REGISTER.md`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `sha256File(path: string): Promise<string>`
  - `listZipEntries(path: string): string[]`
  - `buildLegacyAssetManifest(inputs: LegacyAssetInput[]): Promise<LegacyAssetManifest>`
  - CLI command `npm run legacy:manifest -- <paths...>`
- The returned manifest contains only logical asset ID, basename, byte length,
  SHA-256, archive entry names, and inspection timestamp. It never contains an
  absolute path or file contents.

- [ ] **Step 1: Write the failing manifest tests**

Create `tests/legacy-asset-manifest.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildLegacyAssetManifest,
  sha256File,
} from "../scripts/legacy-asset-manifest.mjs";

test("hashes an asset deterministically", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tradewind-manifest-"));
  const file = path.join(directory, "reference.txt");
  await writeFile(file, "synthetic reference only\n", "utf8");
  assert.equal(
    await sha256File(file),
    "8ad61598b32e0a4c17b1324c66ee922a6090541231f40c29ee659aef77dd3d7a",
  );
});

test("manifest omits absolute paths and contents", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tradewind-manifest-"));
  const file = path.join(directory, "reference.txt");
  await writeFile(file, "synthetic seller name must not be emitted", "utf8");
  const manifest = await buildLegacyAssetManifest([
    { id: "reference-design", path: file, kind: "document" },
  ]);
  const serialized = JSON.stringify(manifest);
  assert.equal(serialized.includes(directory), false);
  assert.equal(serialized.includes("synthetic seller name"), false);
  assert.equal(manifest.assets[0].basename, "reference.txt");
});
```

- [ ] **Step 2: Run the tests and confirm failure**

```bash
node --test tests/legacy-asset-manifest.test.mjs
```

Expected: FAIL because `scripts/legacy-asset-manifest.mjs` does not exist.

- [ ] **Step 3: Implement the minimal manifest library**

Create `scripts/legacy-asset-manifest.mjs`:

```js
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function listZipEntries(filePath) {
  return execFileSync("unzip", ["-Z1", filePath], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
}

export async function buildLegacyAssetManifest(inputs, now = new Date()) {
  const assets = [];
  for (const input of inputs) {
    const basename = path.basename(input.path);
    const isArchive = /\.(zip|pages)$/i.test(basename);
    assets.push({
      id: input.id,
      kind: input.kind,
      basename,
      byteLength: statSync(input.path).size,
      sha256: await sha256File(input.path),
      archiveEntries: isArchive ? listZipEntries(input.path) : [],
    });
  }
  return {
    schemaVersion: 1,
    inspectedAt: now.toISOString(),
    assets: assets.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

async function main(argv) {
  const inputs = argv.map((filePath, index) => ({
    id: `legacy-asset-${index + 1}`,
    kind: "reference",
    path: filePath,
  }));
  process.stdout.write(`${JSON.stringify(await buildLegacyAssetManifest(inputs), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
```

- [ ] **Step 4: Run the tests and confirm the exact hash**

```bash
node --test tests/legacy-asset-manifest.test.mjs
```

Expected: both tests pass, including the exact SHA-256 assertion.

- [ ] **Step 5: Register the four reviewed assets**

Create `docs/migration/LEGACY_ASSET_REGISTER.md`:

```markdown
# Legacy Asset Register

Raw artifacts remain outside the repository. This register records their role,
not their seller, owner, buyer, property, or comparable contents.

| Logical asset | Role | Adopt | Do not copy |
| --- | --- | --- | --- |
| Tradewind launch system | Discovery, audit, proposal, delivery, and revenue-operations templates | Commercial templates and evidence rules | Home-service positioning and public prospect data |
| DealFlow handoff | Reference engine, MassGIS knowledge, underwriting, states, matching, nightly operation | Verified behavior and sanitized fixtures | SQLite database and real lead/comp rows |
| July 27 site design | MA/RI controls, accessibility, transparent calculations | Compliance and interaction requirements | Beginner membership as primary product |
| Revenue-lockdown plan | Vertical-slice acceptance sequence | Priorities and gates | Three-day production promise |
```

- [ ] **Step 6: Add the package command**

Add to `package.json` scripts:

```json
"legacy:manifest": "node scripts/legacy-asset-manifest.mjs"
```

Include `tests/legacy-asset-manifest.test.mjs` in the unit-test command.

- [ ] **Step 7: Verify and commit**

```bash
npm run test:unit
npm run typecheck
npm run lint
git diff --check
git add scripts/legacy-asset-manifest.mjs tests/legacy-asset-manifest.test.mjs docs/migration/LEGACY_ASSET_REGISTER.md package.json
git commit -m "chore: register legacy Tradewind assets safely"
```

---

### Task 3: Define Legacy State and Record Contracts

**Files:**
- Create: `lib/migration/legacy-contracts.ts`
- Create: `tests/legacy-contracts.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `LegacyDealState`
  - `LegacyLeadRecord`
  - `LegacyMigrationIssue`
  - `mapLegacyStage(state: LegacyDealState): PipelineStage`
  - `parseLegacyMoney(value: unknown): number | null`
  - `normalizeLegacyPropertyType(value: string): string`

- [ ] **Step 1: Write the failing contract tests**

Create `tests/legacy-contracts.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  mapLegacyStage,
  normalizeLegacyPropertyType,
  parseLegacyMoney,
} from "../lib/migration/legacy-contracts.ts";

test("maps every legacy state without skipping lifecycle meaning", () => {
  assert.deepEqual(
    ["LEAD", "UNDERWRITTEN", "OFFER_SENT", "UNDER_CONTRACT", "ASSIGNED", "CLOSED", "DEAD"]
      .map((state) => mapLegacyStage(state)),
    ["Research", "Qualified", "Offer", "Contract", "Closing", "Closed", "Archived"],
  );
});

test("money parsing rejects negative, non-finite, and ambiguous values", () => {
  assert.equal(parseLegacyMoney("$125,000"), 125000);
  assert.equal(parseLegacyMoney(""), null);
  assert.equal(parseLegacyMoney(-1), null);
  assert.equal(parseLegacyMoney("unknown"), null);
});

test("normalizes only supported launch property types", () => {
  assert.equal(normalizeLegacyPropertyType("SFH"), "Single-family homes");
  assert.equal(normalizeLegacyPropertyType("2 family"), "Duplexes");
  assert.equal(normalizeLegacyPropertyType("3-FAMILY"), "Triplexes");
  assert.equal(normalizeLegacyPropertyType("4 unit"), "Four-unit residential");
  assert.equal(normalizeLegacyPropertyType("commercial"), "Unsupported: commercial");
});
```

- [ ] **Step 2: Run the tests and confirm failure**

```bash
node --experimental-strip-types --test tests/legacy-contracts.test.ts
```

Expected: FAIL because the migration contract does not exist.

- [ ] **Step 3: Implement exact types and mappings**

Create `lib/migration/legacy-contracts.ts`:

```ts
import type { PipelineStage } from "../types.ts";

export type LegacyDealState =
  | "LEAD"
  | "UNDERWRITTEN"
  | "OFFER_SENT"
  | "UNDER_CONTRACT"
  | "ASSIGNED"
  | "CLOSED"
  | "DEAD";

export type LegacyLeadRecord = {
  id: number;
  address: string;
  city: string;
  owner: string | null;
  ownerMail: string | null;
  propertyType: string;
  asking: number | null;
  state: LegacyDealState;
  distressScore: number | null;
  arv: number | null;
  repairs: number | null;
  mao: number | null;
  spread: number | null;
  contractPrice: number | null;
  assignedTo: string | null;
};

export type LegacyMigrationIssue = {
  recordId: string;
  code:
    | "missing-address"
    | "unsupported-property-type"
    | "invalid-money"
    | "unknown-state"
    | "personal-data-withheld";
  message: string;
};

const STAGE_MAP: Record<LegacyDealState, PipelineStage> = {
  LEAD: "Research",
  UNDERWRITTEN: "Qualified",
  OFFER_SENT: "Offer",
  UNDER_CONTRACT: "Contract",
  ASSIGNED: "Closing",
  CLOSED: "Closed",
  DEAD: "Archived",
};

export function mapLegacyStage(state: LegacyDealState): PipelineStage {
  return STAGE_MAP[state];
}

export function parseLegacyMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).replaceAll(",", "").replace("$", "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeLegacyPropertyType(value: string): string {
  const normalized = value.trim().toLowerCase().replaceAll("-", " ");
  if (["sfh", "single family", "single family homes"].includes(normalized)) {
    return "Single-family homes";
  }
  if (["2 family", "2 unit", "duplex", "duplexes"].includes(normalized)) {
    return "Duplexes";
  }
  if (["3 family", "3 unit", "triplex", "triplexes"].includes(normalized)) {
    return "Triplexes";
  }
  if (["4 family", "4 unit", "four unit residential"].includes(normalized)) {
    return "Four-unit residential";
  }
  return `Unsupported: ${value.trim().toLowerCase()}`;
}
```

- [ ] **Step 4: Add exhaustive unknown-state validation**

Add:

```ts
export function isLegacyDealState(value: string): value is LegacyDealState {
  return Object.hasOwn(STAGE_MAP, value);
}
```

Add a test proving `"NEGOTIATING"` returns `false`. The migration importer must
create an `unknown-state` issue rather than casting the value.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test tests/legacy-contracts.test.ts
npm run typecheck
npm run lint
git diff --check
git add lib/migration/legacy-contracts.ts tests/legacy-contracts.test.ts package.json
git commit -m "feat: define legacy DealFlow migration contracts"
```

---

### Task 4: Add the Configurable Underwriting Reference Engine

**Files:**
- Create: `lib/underwriting/types.ts`
- Create: `lib/underwriting/calculate.ts`
- Create: `tests/fixtures/legacy-reference/underwriting-cases.json`
- Create: `tests/underwriting-reference.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `UnderwritingPolicy`
  - `UnderwritingEvidence`
  - `UnderwritingResult`
  - `calculateUnderwriting(evidence, policy): UnderwritingResult`
- Does not replace `calculateMao` or change current Deal Lab output in this
  task.

- [ ] **Step 1: Create synthetic reference fixtures**

Create `tests/fixtures/legacy-reference/underwriting-cases.json`:

```json
[
  {
    "id": "synthetic-ready-001",
    "evidence": {
      "arv": 300000,
      "repairs": 50000,
      "approvedComparableCount": 4
    },
    "expected": {
      "status": "ready",
      "maximumPrice": 139000,
      "offerLadder": [122320, 130660, 139000]
    }
  },
  {
    "id": "synthetic-blocked-001",
    "evidence": {
      "arv": 300000,
      "repairs": 50000,
      "approvedComparableCount": 2
    },
    "expected": {
      "status": "blocked",
      "reason": "At least 3 approved comparable sales are required."
    }
  }
]
```

The ready fixture follows the archived policy:

`maximumPrice = ARV × 0.70 − repairs − 15000 fee − ARV × 0.02 friction`

- [ ] **Step 2: Write the failing underwriting tests**

Create `tests/underwriting-reference.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateUnderwriting } from "../lib/underwriting/calculate.ts";
import type { UnderwritingPolicy } from "../lib/underwriting/types.ts";

const cases = JSON.parse(
  readFileSync(
    new URL("./fixtures/legacy-reference/underwriting-cases.json", import.meta.url),
    "utf8",
  ),
);

const policy: UnderwritingPolicy = {
  version: 1,
  minimumApprovedComparables: 3,
  acquisitionPercent: 0.7,
  transactionFee: 15000,
  frictionPercentOfArv: 0.02,
  offerLadderPercentages: [0.88, 0.94, 1],
};

test("reproduces the approved synthetic reference case", () => {
  const fixture = cases[0];
  const result = calculateUnderwriting(fixture.evidence, policy);
  assert.equal(result.status, fixture.expected.status);
  if (result.status !== "ready") throw new Error("Expected ready result");
  assert.equal(result.maximumPrice, fixture.expected.maximumPrice);
  assert.deepEqual(result.offerLadder, fixture.expected.offerLadder);
});

test("blocks final underwriting below the comparable threshold", () => {
  const fixture = cases[1];
  assert.deepEqual(calculateUnderwriting(fixture.evidence, policy), {
    status: "blocked",
    reasons: [fixture.expected.reason],
    approvedComparableCount: 2,
    requiredComparableCount: 3,
  });
});
```

- [ ] **Step 3: Run the tests and confirm failure**

```bash
node --experimental-strip-types --test tests/underwriting-reference.test.ts
```

Expected: FAIL because the underwriting modules do not exist.

- [ ] **Step 4: Define the underwriting contracts**

Create `lib/underwriting/types.ts`:

```ts
export type UnderwritingPolicy = {
  version: number;
  minimumApprovedComparables: number;
  acquisitionPercent: number;
  transactionFee: number;
  frictionPercentOfArv: number;
  offerLadderPercentages: number[];
};

export type UnderwritingEvidence = {
  arv: number;
  repairs: number;
  approvedComparableCount: number;
};

export type UnderwritingResult =
  | {
      status: "ready";
      policyVersion: number;
      maximumPrice: number;
      offerLadder: number[];
      expression: string;
      approvedComparableCount: number;
    }
  | {
      status: "blocked";
      reasons: string[];
      approvedComparableCount: number;
      requiredComparableCount: number;
    };
```

- [ ] **Step 5: Implement validation and calculation**

Create `lib/underwriting/calculate.ts`:

```ts
import type {
  UnderwritingEvidence,
  UnderwritingPolicy,
  UnderwritingResult,
} from "./types.ts";

function roundMoney(value: number): number {
  return Math.round(value);
}

function isRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function calculateUnderwriting(
  evidence: UnderwritingEvidence,
  policy: UnderwritingPolicy,
): UnderwritingResult {
  const reasons: string[] = [];
  if (!Number.isFinite(evidence.arv) || evidence.arv < 0) reasons.push("ARV must be zero or greater.");
  if (!Number.isFinite(evidence.repairs) || evidence.repairs < 0) reasons.push("Repairs must be zero or greater.");
  if (
    !Number.isInteger(evidence.approvedComparableCount) ||
    evidence.approvedComparableCount < 0
  ) reasons.push("Approved comparable count must be a non-negative integer.");
  if (evidence.approvedComparableCount < policy.minimumApprovedComparables) {
    reasons.push(
      `At least ${policy.minimumApprovedComparables} approved comparable sales are required.`,
    );
  }
  if (!isRate(policy.acquisitionPercent)) reasons.push("Acquisition percent must be between 0 and 1.");
  if (!isRate(policy.frictionPercentOfArv)) reasons.push("Friction percent must be between 0 and 1.");
  if (!Number.isFinite(policy.transactionFee) || policy.transactionFee < 0) {
    reasons.push("Transaction fee must be zero or greater.");
  }
  if (policy.offerLadderPercentages.some((value) => !isRate(value))) {
    reasons.push("Every offer ladder percentage must be between 0 and 1.");
  }
  if (reasons.length > 0) {
    return {
      status: "blocked",
      reasons,
      approvedComparableCount: evidence.approvedComparableCount,
      requiredComparableCount: policy.minimumApprovedComparables,
    };
  }
  const maximumPrice = roundMoney(
    evidence.arv * policy.acquisitionPercent -
      evidence.repairs -
      policy.transactionFee -
      evidence.arv * policy.frictionPercentOfArv,
  );
  return {
    status: "ready",
    policyVersion: policy.version,
    maximumPrice,
    offerLadder: policy.offerLadderPercentages.map((value) =>
      roundMoney(maximumPrice * value),
    ),
    expression: "ARV × acquisition percent − repairs − transaction fee − ARV friction",
    approvedComparableCount: evidence.approvedComparableCount,
  };
}
```

- [ ] **Step 6: Add invalid-policy coverage**

Add tests proving:

- negative ARV blocks;
- negative repairs block;
- acquisition percent `1.1` blocks;
- friction percent `-0.1` blocks;
- a negative fee blocks;
- an offer percentage above `1` blocks;
- the function never returns `NaN` or an offer when blocked.

- [ ] **Step 7: Verify and commit**

```bash
node --experimental-strip-types --test tests/underwriting-reference.test.ts
npm run test:unit
npm run typecheck
npm run lint
git diff --check
git add lib/underwriting tests/fixtures/legacy-reference/underwriting-cases.json tests/underwriting-reference.test.ts package.json
git commit -m "feat: add configurable underwriting reference engine"
```

---

### Task 5: Add Read-Only Legacy Database Inspection

**Files:**
- Create: `scripts/inspect-legacy-dealflow.mjs`
- Create: `tests/inspect-legacy-dealflow.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `inspectLegacyDatabase(path: string): LegacyDatabaseSummary`
  - CLI command `npm run legacy:inspect -- <dealflow.db>`
- The summary contains table names, column names, total counts, and lead-state
  counts. It never returns or prints row-level values.

- [ ] **Step 1: Write the failing inspection test**

Create `tests/inspect-legacy-dealflow.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { inspectLegacyDatabase } from "../scripts/inspect-legacy-dealflow.mjs";

test("reports counts and schema without returning row values", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tradewind-legacy-db-"));
  const databasePath = path.join(directory, "synthetic.db");
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE leads (id INTEGER PRIMARY KEY, owner TEXT, address TEXT, state TEXT);
    CREATE TABLE comps (id INTEGER PRIMARY KEY, address TEXT);
    CREATE TABLE buyers (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE events (id INTEGER PRIMARY KEY, what TEXT);
    INSERT INTO leads (owner, address, state)
      VALUES ('Synthetic Owner', '1 Test Way', 'LEAD'),
             ('Another Synthetic Owner', '2 Test Way', 'UNDERWRITTEN');
  `);
  database.close();

  const summary = inspectLegacyDatabase(databasePath);
  assert.equal(summary.tables.leads.rowCount, 2);
  assert.deepEqual(summary.leadStates, { LEAD: 1, UNDERWRITTEN: 1 });
  const serialized = JSON.stringify(summary);
  assert.equal(serialized.includes("Synthetic Owner"), false);
  assert.equal(serialized.includes("1 Test Way"), false);
  assert.equal(serialized.includes(directory), false);
});
```

- [ ] **Step 2: Run the test and confirm failure**

```bash
node --test tests/inspect-legacy-dealflow.test.mjs
```

Expected: FAIL because the inspection script does not exist.

- [ ] **Step 3: Implement read-only summary inspection**

Create `scripts/inspect-legacy-dealflow.mjs`:

```js
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const EXPECTED_TABLES = ["buyers", "comps", "events", "leads"];

export function inspectLegacyDatabase(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const observed = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((row) => String(row.name))
      .filter((name) => !name.startsWith("sqlite_"));
    const missingTables = EXPECTED_TABLES.filter((name) => !observed.includes(name));
    const tables = {};
    for (const name of observed.filter((value) => EXPECTED_TABLES.includes(value))) {
      const columns = database
        .prepare(`PRAGMA table_info(${name})`)
        .all()
        .map((row) => String(row.name))
        .sort();
      const rowCount = Number(
        database.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get().count,
      );
      tables[name] = { columns, rowCount };
    }
    const leadStates = Object.fromEntries(
      database
        .prepare("SELECT state, COUNT(*) AS count FROM leads GROUP BY state ORDER BY state")
        .all()
        .map((row) => [String(row.state), Number(row.count)]),
    );
    return {
      schemaVersion: 1,
      databaseBasename: path.basename(databasePath),
      missingTables,
      tables,
      leadStates,
    };
  } finally {
    database.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const databasePath = process.argv[2];
  if (!databasePath) throw new Error("Usage: npm run legacy:inspect -- <dealflow.db>");
  process.stdout.write(`${JSON.stringify(inspectLegacyDatabase(databasePath), null, 2)}\n`);
}
```

- [ ] **Step 4: Add failure coverage**

Add tests proving:

- the source database remains byte-for-byte unchanged;
- missing expected tables appear only in `missingTables`;
- an unknown table is not queried or returned;
- no owner, address, buyer name, event text, or absolute path is emitted;
- an invalid database path fails with a nonzero CLI exit.

- [ ] **Step 5: Add the package command**

Add:

```json
"legacy:inspect": "node scripts/inspect-legacy-dealflow.mjs"
```

Include `tests/inspect-legacy-dealflow.test.mjs` in the unit-test command.

- [ ] **Step 6: Verify and commit**

```bash
node --test tests/inspect-legacy-dealflow.test.mjs
npm run test:unit
npm run lint
git diff --check
git add scripts/inspect-legacy-dealflow.mjs tests/inspect-legacy-dealflow.test.mjs package.json
git commit -m "feat: inspect legacy DealFlow databases safely"
```

---

### Task 6: Add Migration Reconciliation Contracts

**Files:**
- Create: `lib/migration/reconciliation.ts`
- Create: `tests/migration-reconciliation.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `MigrationCounts`
  - `MigrationReconciliation`
  - `reconcileMigration(source, destination): MigrationReconciliation`
- Later importers must produce this report before a cutover can be approved.

- [ ] **Step 1: Write the failing reconciliation tests**

Create `tests/migration-reconciliation.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { reconcileMigration } from "../lib/migration/reconciliation.ts";

test("passes only when source dispositions and destination counts balance", () => {
  assert.deepEqual(
    reconcileMigration(
      { total: 100, accepted: 80, exactDuplicates: 10, conflicts: 5, rejected: 5 },
      { created: 80, linkedDuplicates: 10, openConflicts: 5 },
    ),
    {
      status: "reconciled",
      sourceTotal: 100,
      accountedSourceTotal: 100,
      expectedDestinationRecords: 80,
      destinationCreatedRecords: 80,
      issues: [],
    },
  );
});

test("fails closed when one record is unaccounted", () => {
  const result = reconcileMigration(
    { total: 100, accepted: 79, exactDuplicates: 10, conflicts: 5, rejected: 5 },
    { created: 79, linkedDuplicates: 10, openConflicts: 5 },
  );
  assert.equal(result.status, "not-reconciled");
  assert.deepEqual(result.issues, ["Source dispositions account for 99 of 100 records."]);
});
```

- [ ] **Step 2: Run the tests and confirm failure**

```bash
node --experimental-strip-types --test tests/migration-reconciliation.test.ts
```

Expected: FAIL because the reconciliation module does not exist.

- [ ] **Step 3: Implement reconciliation**

Create `lib/migration/reconciliation.ts`:

```ts
export type MigrationCounts = {
  total: number;
  accepted: number;
  exactDuplicates: number;
  conflicts: number;
  rejected: number;
};

export type MigrationDestinationCounts = {
  created: number;
  linkedDuplicates: number;
  openConflicts: number;
};

export type MigrationReconciliation = {
  status: "reconciled" | "not-reconciled";
  sourceTotal: number;
  accountedSourceTotal: number;
  expectedDestinationRecords: number;
  destinationCreatedRecords: number;
  issues: string[];
};

function validCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function reconcileMigration(
  source: MigrationCounts,
  destination: MigrationDestinationCounts,
): MigrationReconciliation {
  const issues: string[] = [];
  const values = [...Object.values(source), ...Object.values(destination)];
  if (values.some((value) => !validCount(value))) {
    issues.push("Every migration count must be a non-negative safe integer.");
  }
  const accountedSourceTotal =
    source.accepted + source.exactDuplicates + source.conflicts + source.rejected;
  if (accountedSourceTotal !== source.total) {
    issues.push(
      `Source dispositions account for ${accountedSourceTotal} of ${source.total} records.`,
    );
  }
  if (destination.created !== source.accepted) {
    issues.push(
      `Destination created ${destination.created}; expected ${source.accepted}.`,
    );
  }
  if (destination.linkedDuplicates !== source.exactDuplicates) {
    issues.push(
      `Destination linked ${destination.linkedDuplicates} duplicates; expected ${source.exactDuplicates}.`,
    );
  }
  if (destination.openConflicts !== source.conflicts) {
    issues.push(
      `Destination retained ${destination.openConflicts} conflicts; expected ${source.conflicts}.`,
    );
  }
  return {
    status: issues.length === 0 ? "reconciled" : "not-reconciled",
    sourceTotal: source.total,
    accountedSourceTotal,
    expectedDestinationRecords: source.accepted,
    destinationCreatedRecords: destination.created,
    issues,
  };
}
```

- [ ] **Step 4: Add adversarial coverage**

Add tests for negative counts, fractional counts, values above
`Number.MAX_SAFE_INTEGER`, destination-created mismatch, duplicate mismatch,
conflict mismatch, and multiple simultaneous issues.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types --test tests/migration-reconciliation.test.ts
npm run test:unit
npm run typecheck
npm run lint
git diff --check
git add lib/migration/reconciliation.ts tests/migration-reconciliation.test.ts package.json
git commit -m "feat: add migration reconciliation gate"
```

---

### Task 7: Document the Consolidated Foundation and Run the Release Gate

**Files:**
- Create: `docs/migration/LEGACY_CONSOLIDATION.md`
- Modify: `README.md`
- Modify: `docs/KNOWN_LIMITATIONS.md`
- Modify: `docs/SCORING_AND_UNDERWRITING.md`

**Interfaces:**
- Produces the operating contract for later platform-foundation and
  seller-revenue-loop plans.
- Changes no runtime behavior.

- [ ] **Step 1: Write the consolidation document**

Create `docs/migration/LEGACY_CONSOLIDATION.md` with these exact sections:

```markdown
# Legacy Consolidation

## Authority

The current TypeScript application is the product source of truth. External
archives are read-only evidence and migration inputs.

## Adopted behavior

- MassGIS town/use-code/field and pagination knowledge
- evidence-preserving intake and duplicate review
- configurable underwriting policy
- minimum approved comparable threshold
- legacy lifecycle state mapping
- buyer criteria and proof-of-funds freshness
- human approval for consequential actions

## Deliberately excluded data

Raw SQLite databases, real seller/owner/buyer rows, comparable exports,
proof-of-funds files, absolute personal paths, and generated dashboards
containing production records are not committed.

## Migration sequence

1. Inspect source schema and counts read-only.
2. Export through an approved private migration process.
3. Normalize through typed contracts.
4. Preview duplicates, conflicts, restrictions, and rejected records.
5. Apply to an isolated destination.
6. Produce reconciliation evidence.
7. Obtain cutover approval.
8. Preserve rollback until post-cutover acceptance.

## Underwriting boundary

The reference policy is configurable and is not a universal investment rule,
valuation, or appraisal. Final underwriting blocks below the approved evidence
threshold unless a versioned human override is recorded.

## Next subsystem

The next plan is the production platform foundation: identity, organizations,
authorization, durable persistence, jobs, audit, backup, recovery, export,
retention, and deletion.
```

- [ ] **Step 2: Update the README**

Add a “Consolidated foundation” section that links:

- `docs/migration/MASSGIS_INTEGRATION_EVIDENCE.md`
- `docs/migration/LEGACY_ASSET_REGISTER.md`
- `docs/migration/LEGACY_CONSOLIDATION.md`

State that the new reference underwriting module is not yet wired to formal
offers or the educational Deal Lab.

- [ ] **Step 3: Update known limitations**

Record:

- no raw legacy production records have been migrated;
- the inspection tool emits schema and counts only;
- organization identity and durable lifecycle persistence remain deferred to
  the next subsystem;
- formal offer generation remains disabled;
- reference parity does not constitute appraisal or legal approval.

- [ ] **Step 4: Update scoring and underwriting documentation**

Document the configurable reference-policy formula, policy version, synthetic
fixture, three-approved-comparable block, validation failures, and the
distinction between the current Deal Lab and the future evidence-ranged case
system.

- [ ] **Step 5: Run the complete release gate**

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:render
git diff --check
```

Expected: every command passes.

- [ ] **Step 6: Run the privacy inspection**

```bash
git diff --cached --name-only
rg -n "dealflow\\.db|leads_real|comps_real|Synthetic Owner|1 Test Way|/Users/" \
  scripts lib tests docs README.md
```

Expected:

- no database, raw data export, archive extraction, or proof-of-funds file is
  staged;
- synthetic PII appears only inside isolated tests;
- no absolute personal path appears in committed runtime code or documents.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/KNOWN_LIMITATIONS.md docs/SCORING_AND_UNDERWRITING.md docs/migration/LEGACY_CONSOLIDATION.md
git commit -m "docs: complete Tradewind consolidation foundation"
```

## Plan Self-Review

### Specification coverage

- Asset authority and non-duplication: Tasks 1–2
- Existing MassGIS preservation: Task 1
- Legacy state preservation: Task 3
- Underwriting behavior and evidence refusal: Task 4
- Safe legacy evidence inspection: Task 5
- Reconciliation and cutover gate: Task 6
- Privacy, documentation, and full verification: Task 7

The seller revenue loop, production identity, organization isolation, provider
connections, buyer CRM replacement, closing, billing, and horizontal platform
are intentionally separate subsystem plans in the program roadmap.

### Type consistency

- `LegacyDealState` maps exhaustively to the existing `PipelineStage`.
- `UnderwritingPolicy`, `UnderwritingEvidence`, and `UnderwritingResult` are
  defined before use.
- `MigrationCounts`, `MigrationDestinationCounts`, and
  `MigrationReconciliation` use non-negative integer counts.
- Manifest and inspection utilities expose summaries, not record contents.

### Scope check

This plan ends at a stable consolidated foundation. It does not duplicate the
active MassGIS work, activate production providers, migrate PII, or begin the
seller revenue-loop subsystem.
