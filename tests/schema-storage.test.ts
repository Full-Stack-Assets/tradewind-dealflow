import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyData,
  serializePipelineCsv,
  validateImport,
} from "../lib/import-export.ts";
import {
  clearStoredWorkspace,
  LEGACY_LOCAL_DATA_KEY,
  LOCAL_DATA_KEY,
  MAX_WORKSPACE_BYTES,
  mutateStoredWorkspace,
  readStoredWorkspace,
  replaceStoredWorkspace,
  shouldOfferWorkspaceClear,
  writeStoredWorkspace,
  type WorkspaceLockManager,
} from "../lib/local-storage.ts";

function makeVersionOneWorkspace(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    updatedAt: "2026-07-27T12:00:00.000Z",
    preferences: { selectedState: null, participationPath: null },
    deals: [],
    buyers: [],
    analyses: [],
    curriculum: {},
    weekProgress: {},
    readinessChecks: {},
    compliance: {
      sellerWindow: {
        startDate: "",
        verifiedHolidays: [],
        holidayCalendarVerified: false,
        attorneyConfirmed: false,
      },
      assigneeWindow: {
        startDate: "",
        verifiedHolidays: [],
        holidayCalendarVerified: false,
        attorneyConfirmed: false,
      },
      outreachChecks: {},
      marketingChecks: {},
    },
    dealDeskDraft: {
      dealId: "",
      submitterName: "",
      submitterEmail: "",
      summary: "",
      requestedStructure: "",
      qualificationChecks: {},
      consentToReview: false,
    },
  };
}

function makeVersionOneDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: "legacy-deal",
    createdAt: "2026-07-27T12:00:00.000Z",
    updatedAt: "2026-07-27T12:00:00.000Z",
    state: "MA",
    address: "10 Harbor Way",
    city: "Boston",
    propertyType: "Single-family",
    source: "Municipal assessor",
    ownerContactStatus: "Not researched",
    stage: "Research",
    nextAction: "Verify title",
    notes: "",
    askingPrice: 250_000,
    rehabLevel: "Light",
    strategies: ["Assignment"],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
    ...overrides,
  };
}

test("v1 migration preserves DNC and never invents provenance", () => {
  const v1 = makeVersionOneWorkspace();
  (v1.deals as unknown[]).push(makeVersionOneDeal({
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
  assert.equal(
    result.data.deals[0]?.researchRestrictions[0]?.createdAt,
    "2026-07-27T12:00:00.000Z",
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

test("v2 validation rejects contact holds that are not represented by an active structured restriction", () => {
  for (const ownerContactStatus of [
    "Owner opted out",
    "Owner opt-out",
    "OptOut",
    "DNC",
    "Identity-dispute",
  ]) {
    const candidate = createEmptyData("2026-07-27T12:00:00.000Z");
    candidate.deals.push({
      id: "unsafe-contact-state",
      createdAt: "2026-07-27T12:00:00.000Z",
      updatedAt: "2026-07-27T12:00:00.000Z",
      state: "MA",
      address: "10 Harbor Way",
      city: "Boston",
      market: "Boston",
      propertyType: "Single-family homes",
      source: "Municipal assessor",
      ownerContactStatus,
      stage: "Research",
      nextAction: "Research only",
      notes: "",
      askingPrice: 250_000,
      rehabLevel: "Light",
      sourceAssertions: [],
      factConflicts: [],
      researchRestrictions: [],
      strategies: [],
      executedAgreement: false,
      equitableInterestRecorded: false,
      legalTitleDisclosureReady: false,
      attorneyReviewComplete: false,
    });

    const result = validateImport(candidate);
    assert.equal(result.ok, false, ownerContactStatus);
  }
});

test("strict current buy-box imports reject invalid freshness, thresholds, and weights", () => {
  const candidates = [
    (data: ReturnType<typeof createEmptyData>) => {
      data.buyBox.maxVerificationAgeDays = 0;
    },
    (data: ReturnType<typeof createEmptyData>) => {
      data.buyBox.financialThresholds.preferredEquityPercent = 20;
      data.buyBox.financialThresholds.minimumEquityPercent = 30;
    },
    (data: ReturnType<typeof createEmptyData>) => {
      data.buyBox.weights.propertyFit = -1;
    },
    (data: ReturnType<typeof createEmptyData>) => {
      for (const key of Object.keys(data.buyBox.weights) as Array<
        keyof typeof data.buyBox.weights
      >) {
        data.buyBox.weights[key] = 0;
      }
    },
  ];

  for (const mutate of candidates) {
    const candidate = createEmptyData("2026-07-27T12:00:00.000Z");
    mutate(candidate);
    assert.equal(validateImport(candidate).ok, false);
  }
});

test("legacy global buy-box markets migrate only to known states without cross-state leakage", () => {
  const candidate = createEmptyData("2026-07-27T12:00:00.000Z") as unknown as {
    buyBox: Record<string, unknown>;
  };
  delete candidate.buyBox.marketsByState;
  candidate.buyBox.markets = [
    "Fall River",
    "Providence",
    "Bristol County",
    "Unknown custom market",
  ];
  candidate.buyBox.states = ["MA", "RI"];

  const result = validateImport(candidate);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.buyBox.marketsByState, {
    MA: ["bristol county", "fall river"],
    RI: ["bristol county", "providence"],
  });
});

test("pipeline CSV neutralizes spreadsheet formulas", () => {
  const data = createEmptyData();
  data.deals.push({
    id: "formula-deal",
    createdAt: "2026-07-27T12:00:00.000Z",
    updatedAt: "2026-07-27T12:00:00.000Z",
    state: "MA",
    address: '=HYPERLINK("bad")',
    city: "Boston",
    market: "Boston",
    propertyType: "Single-family",
    source: "Municipal assessor",
    ownerContactStatus: "Not researched",
    stage: "Research",
    nextAction: "Verify title",
    notes: "",
    askingPrice: null,
    rehabLevel: null,
    sourceAssertions: [],
    factConflicts: [],
    researchRestrictions: [],
    strategies: [],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
  });
  assert.match(serializePipelineCsv(data.deals), /'=/);
});

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  let setItemCalls = 0;
  return {
    get setItemCalls() {
      return setItemCalls;
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      setItemCalls += 1;
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

function throwingStorage(errorName: string, currentValue: string) {
  const storage = memoryStorage({ [LOCAL_DATA_KEY]: currentValue });
  return {
    getItem: storage.getItem,
    removeItem: storage.removeItem,
    setItem() {
      const error = new Error("sensitive browser detail");
      error.name = errorName;
      throw error;
    },
  };
}

function immediateLocks(onRequest?: (name: string) => void): WorkspaceLockManager {
  return {
    request: async <T>(name: string, callback: () => Promise<T> | T) => {
      onRequest?.(name);
      return callback();
    },
  };
}

test("current v2 storage is preferred over a valid legacy snapshot", () => {
  const current = createEmptyData("2026-07-28T10:00:00.000Z");
  current.revision = 3;
  const storage = memoryStorage({
    [LOCAL_DATA_KEY]: JSON.stringify(current),
    [LEGACY_LOCAL_DATA_KEY]: JSON.stringify(makeVersionOneWorkspace()),
  });

  const result = readStoredWorkspace(
    storage,
    new Date("2026-07-28T12:00:00Z"),
  );

  assert.equal(result.status, "current");
  assert.equal(result.data.revision, 3);
});

test("corrupt current storage recovers valid legacy without overwriting it", () => {
  const storage = memoryStorage({
    [LOCAL_DATA_KEY]: "{broken",
    [LEGACY_LOCAL_DATA_KEY]: JSON.stringify(makeVersionOneWorkspace()),
  });

  const result = readStoredWorkspace(
    storage,
    new Date("2026-07-28T12:00:00Z"),
  );

  assert.equal(result.status, "recovered-legacy");
  assert.equal(result.data.schemaVersion, 2);
  assert.equal(storage.getItem(LOCAL_DATA_KEY), "{broken");
  assert.equal(storage.setItemCalls, 0);
});

test("storage is corrupt when every present snapshot is invalid", () => {
  const storage = memoryStorage({
    [LOCAL_DATA_KEY]: "{broken",
    [LEGACY_LOCAL_DATA_KEY]: JSON.stringify({ schemaVersion: 1 }),
  });

  const result = readStoredWorkspace(storage);

  assert.equal(result.status, "corrupt");
  assert.equal("data" in result, false);
});

test("storage is empty only when both keys are absent", () => {
  const result = readStoredWorkspace(
    memoryStorage(),
    new Date("2026-07-28T12:00:00Z"),
  );

  assert.equal(result.status, "empty");
  assert.equal(result.data.schemaVersion, 2);
  assert.equal(result.data.revision, 0);
});

test("bounded write preserves the old value on quota failure", () => {
  const storage = throwingStorage("QuotaExceededError", '{"old":true}');

  const result = writeStoredWorkspace(storage, createEmptyData());

  assert.equal(result.ok, false);
  assert.equal(storage.getItem(LOCAL_DATA_KEY), '{"old":true}');
  if (!result.ok) {
    assert.doesNotMatch(result.message, /sensitive browser detail|\{"old"/);
  }
});

test("oversized workspace is rejected before setItem", () => {
  const storage = memoryStorage();
  const data = createEmptyData();
  data.dealDeskDraft.summary = "x".repeat(MAX_WORKSPACE_BYTES);

  const result = writeStoredWorkspace(storage, data);

  assert.equal(result.ok, false);
  assert.equal(storage.setItemCalls, 0);
});

test("locked mutation reads latest data, validates, stamps, and increments revision", async () => {
  const current = createEmptyData("2026-07-28T10:00:00.000Z");
  current.revision = 7;
  const storage = memoryStorage({
    [LOCAL_DATA_KEY]: JSON.stringify(current),
  });
  const requestedNames: string[] = [];

  const result = await mutateStoredWorkspace(
    storage,
    immediateLocks((name) => requestedNames.push(name)),
    (latest) => ({
      ...latest,
      preferences: { ...latest.preferences, selectedState: "MA" },
    }),
    new Date("2026-07-28T12:00:00Z"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(requestedNames, ["tradewind-dealflow:workspace-write"]);
  const saved = JSON.parse(storage.getItem(LOCAL_DATA_KEY) ?? "{}");
  assert.equal(saved.revision, 8);
  assert.equal(saved.updatedAt, "2026-07-28T12:00:00.000Z");
  assert.equal(saved.preferences.selectedState, "MA");
});

test("default mutation time is obtained only after the lock is granted", async () => {
  const storage = memoryStorage();
  let lockHeld = false;
  const locks: WorkspaceLockManager = {
    request: async <T>(_name: string, callback: () => Promise<T> | T) => {
      lockHeld = true;
      const result = await callback();
      lockHeld = false;
      return result;
    },
  };

  const result = await mutateStoredWorkspace(
    storage,
    locks,
    (latest) => latest,
    () => {
      assert.equal(lockHeld, true);
      return new Date("2026-07-28T12:00:00Z");
    },
  );

  assert.equal(result.ok, true);
  const saved = JSON.parse(storage.getItem(LOCAL_DATA_KEY) ?? "{}");
  assert.equal(saved.updatedAt, "2026-07-28T12:00:00.000Z");
});

test("locked mutation blocks corrupt storage before calling the updater", async () => {
  const storage = memoryStorage({ [LOCAL_DATA_KEY]: "{broken" });
  let updaterCalled = false;

  const result = await mutateStoredWorkspace(
    storage,
    immediateLocks(),
    (latest) => {
      updaterCalled = true;
      return latest;
    },
  );

  assert.equal(result.ok, false);
  assert.equal(updaterCalled, false);
  assert.equal(storage.setItemCalls, 0);
});

test("locked replacement restores a validated backup over corrupt storage", async () => {
  const storage = memoryStorage({ [LOCAL_DATA_KEY]: "{broken" });
  const replacement = createEmptyData("2026-07-28T10:00:00.000Z");
  replacement.revision = 4;
  replacement.preferences.selectedState = "RI";
  const requestedNames: string[] = [];

  const result = await replaceStoredWorkspace(
    storage,
    immediateLocks((name) => requestedNames.push(name)),
    replacement,
    new Date("2026-07-28T12:00:00Z"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(requestedNames, ["tradewind-dealflow:workspace-write"]);
  assert.equal(storage.setItemCalls, 1);
  const saved = JSON.parse(storage.getItem(LOCAL_DATA_KEY) ?? "{}");
  assert.equal(saved.revision, 5);
  assert.equal(saved.updatedAt, "2026-07-28T12:00:00.000Z");
  assert.equal(saved.preferences.selectedState, "RI");
});

test("locked replacement increments the latest valid local revision", async () => {
  const current = createEmptyData("2026-07-28T09:00:00.000Z");
  current.revision = 7;
  const storage = memoryStorage({
    [LOCAL_DATA_KEY]: JSON.stringify(current),
  });
  const replacement = createEmptyData("2026-07-28T10:00:00.000Z");
  replacement.revision = 2;

  const result = await replaceStoredWorkspace(
    storage,
    immediateLocks(),
    replacement,
    new Date("2026-07-28T12:00:00Z"),
  );

  assert.equal(result.ok, true);
  const saved = JSON.parse(storage.getItem(LOCAL_DATA_KEY) ?? "{}");
  assert.equal(saved.revision, 8);
});

test("locked replacement rejects an invalid backup before writing", async () => {
  const storage = memoryStorage({ [LOCAL_DATA_KEY]: "{broken" });
  const result = await replaceStoredWorkspace(
    storage,
    immediateLocks(),
    { schemaVersion: 2 } as never,
  );

  assert.equal(result.ok, false);
  assert.equal(storage.setItemCalls, 0);
});

test("locked replacement rejects an oversized backup before writing", async () => {
  const storage = memoryStorage({ [LOCAL_DATA_KEY]: "{broken" });
  const oversized = createEmptyData();
  oversized.dealDeskDraft.summary = "x".repeat(MAX_WORKSPACE_BYTES);
  const result = await replaceStoredWorkspace(
    storage,
    immediateLocks(),
    oversized,
  );

  assert.equal(result.ok, false);
  assert.equal(storage.setItemCalls, 0);
});

test("corrupt storage offers the clear-control UI gate despite empty fallback data", () => {
  const readResult = readStoredWorkspace(
    memoryStorage({ [LOCAL_DATA_KEY]: "{broken" }),
  );

  assert.equal(readResult.status, "corrupt");
  assert.equal(shouldOfferWorkspaceClear(false, readResult.status), true);
});

test("storage mutations do not use an unlocked fallback", async () => {
  const storage = memoryStorage();

  const mutationResult = await mutateStoredWorkspace(
    storage,
    null,
    (latest) => latest,
  );
  const replacementResult = await replaceStoredWorkspace(
    storage,
    null,
    createEmptyData(),
  );

  assert.equal(mutationResult.ok, false);
  assert.equal(replacementResult.ok, false);
  assert.equal(storage.setItemCalls, 0);
});

test("clear removes current and legacy snapshots inside the workspace lock", async () => {
  const storage = memoryStorage({
    [LOCAL_DATA_KEY]: "{broken",
    [LEGACY_LOCAL_DATA_KEY]: JSON.stringify(makeVersionOneWorkspace()),
  });
  const requestedNames: string[] = [];

  const result = await clearStoredWorkspace(
    storage,
    immediateLocks((name) => requestedNames.push(name)),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(requestedNames, ["tradewind-dealflow:workspace-write"]);
  assert.equal(storage.getItem(LOCAL_DATA_KEY), null);
  assert.equal(storage.getItem(LEGACY_LOCAL_DATA_KEY), null);
});
