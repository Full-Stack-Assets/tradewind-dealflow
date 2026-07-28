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
  readWorkspaceBackup,
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

function makeVersionTwoWorkspaceWithSourceAssertion() {
  const data = createEmptyData("2026-07-27T12:00:00.000Z");
  data.deals.push({
    id: "source-date-deal",
    createdAt: "2026-07-27T12:00:00.000Z",
    updatedAt: "2026-07-27T12:00:00.000Z",
    state: "MA",
    address: "10 Harbor Way",
    city: "Fall River",
    zip: "02720",
    market: "Bristol County",
    propertyType: "Single-family homes",
    source: "Municipal assessor",
    ownerContactStatus: "Not researched",
    stage: "Research",
    nextAction: "Verify ownership",
    notes: "",
    askingPrice: null,
    rehabLevel: null,
    sourceAssertions: [{
      id: "source-date-assertion",
      source: "Municipal assessor",
      sourceRecordId: "001",
      retrievedAt: "2026-07-20T00:00:00.000Z",
      usageClassification: "Public record",
      confidence: "Medium",
      lastVerifiedAt: "2026-07-21T00:00:00.000Z",
      importedAt: "2026-07-21T01:00:00.000Z",
      fingerprint: "source-date-fingerprint",
      facts: {
        state: "MA",
        address: "10 Harbor Way",
        city: "Fall River",
        zip: "02720",
        market: "Bristol County",
        propertyType: "Single-family homes",
        askingPrice: null,
        rehabLevel: null,
        ownerContactStatus: "Not researched",
        nextAction: "Verify ownership",
        notes: "",
      },
    }],
    factConflicts: [],
    researchRestrictions: [],
    strategies: [],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
  });
  return data;
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
  assert.equal(result.data.deals[0]?.zip, "");
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

test("older version-2 records migrate with blank ZIP and no fabricated source facts", () => {
  const candidate = createEmptyData("2026-07-27T12:00:00.000Z") as unknown as {
    deals: Array<Record<string, unknown>>;
  };
  candidate.deals.push({
    id: "legacy-v2-deal",
    createdAt: "2026-07-27T12:00:00.000Z",
    updatedAt: "2026-07-27T12:00:00.000Z",
    state: "MA",
    address: "10 Harbor Way",
    city: "Boston",
    market: "",
    propertyType: "",
    source: "Municipal assessor",
    ownerContactStatus: "Not researched",
    stage: "Research",
    nextAction: "Verify ownership",
    notes: "",
    askingPrice: null,
    rehabLevel: null,
    sourceAssertions: [{
      id: "legacy-assertion",
      source: "Municipal assessor",
      sourceRecordId: "001",
      retrievedAt: "2026-07-20T00:00:00.000Z",
      usageClassification: "Public record",
      confidence: "Medium",
      lastVerifiedAt: "2026-07-21T00:00:00.000Z",
      importedAt: "2026-07-21T01:00:00.000Z",
      fingerprint: "legacy-fingerprint",
      facts: {
        state: "MA",
        address: "10 Harbor Way",
        city: "Boston",
        market: "",
        propertyType: "",
        askingPrice: null,
        rehabLevel: null,
        ownerContactStatus: "Not researched",
        nextAction: "Verify ownership",
        notes: "",
      },
    }],
    factConflicts: [],
    researchRestrictions: [],
    strategies: [],
    executedAgreement: false,
    equitableInterestRecorded: false,
    legalTitleDisclosureReady: false,
    attorneyReviewComplete: false,
  });

  const result = validateImport(candidate);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.deals[0]?.zip, "");
  assert.equal(result.data.deals[0]?.sourceAssertions[0]?.facts.zip, "");
  assert.equal(
    result.data.deals[0]?.sourceAssertions[0]?.confidence,
    "Medium",
  );
  assert.equal(
    result.data.deals[0]?.sourceAssertions[0]?.lastVerifiedAt,
    "2026-07-21T00:00:00.000Z",
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
      zip: "02110",
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

test("strict current buy-box imports reject malformed timestamps without throwing", () => {
  for (const [configured, updatedAt] of [
    [false, "not-a-date"],
    [true, "July 27, 2026"],
  ] as const) {
    const candidate = createEmptyData("2026-07-27T12:00:00.000Z");
    candidate.buyBox.configured = configured;
    candidate.buyBox.updatedAt = updatedAt;
    let result: ReturnType<typeof validateImport> | undefined;

    assert.doesNotThrow(() => {
      result = validateImport(candidate);
    });
    assert.equal(result?.ok, false, `${String(configured)}: ${updatedAt}`);
  }
});

test("strict current buy-box import accepts a valid ISO timestamp with an explicit timezone", () => {
  const candidate = createEmptyData("2026-07-27T12:00:00.000Z");
  candidate.buyBox.updatedAt = "2026-07-27T08:00:00-04:00";

  const result = validateImport(candidate);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.buyBox.updatedAt, "2026-07-27T08:00:00-04:00");
});

test("configured launch-scope expansion is rejected by backup restore and stored hydration", async () => {
  const now = new Date("2026-07-28T12:00:00.000Z");
  const mutations: Array<(data: ReturnType<typeof createEmptyData>) => void> = [
    (data) => {
      data.buyBox.marketsByState.MA.push("plymouth county");
    },
    (data) => {
      data.buyBox.propertyTypes.push("mixed-use");
    },
  ];

  for (const mutate of mutations) {
    const expanded = createEmptyData("2026-07-27T12:00:00.000Z");
    mutate(expanded);
    const serialized = JSON.stringify(expanded);
    const bytes = new TextEncoder().encode(serialized).byteLength;

    const backup = await readWorkspaceBackup(
      { size: bytes, text: async () => serialized },
      now,
    );
    assert.equal(backup.ok, false);

    const hydrated = readStoredWorkspace(
      memoryStorage({ [LOCAL_DATA_KEY]: serialized }),
      now,
    );
    assert.equal(hydrated.status, "corrupt");
  }
});

test("an unconfigured record-free workspace remains valid before launch activation", () => {
  const data = createEmptyData("2026-07-27T12:00:00.000Z");
  data.buyBox.configured = false;
  data.buyBox.marketsByState.MA.push("plymouth county");
  data.buyBox.propertyTypes.push("mixed-use");
  assert.equal(data.deals.length, 0);

  const result = validateImport(
    data,
    new Date("2026-07-28T12:00:00.000Z"),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.buyBox.configured, false);
});

test("source provenance timestamps reject malformed and future values while verification may be null", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");
  for (const [field, value] of [
    ["retrievedAt", "not-a-date"],
    ["retrievedAt", "2026-07-29T00:00:00.000Z"],
    ["lastVerifiedAt", "July 27, 2026"],
    ["lastVerifiedAt", "2026-07-29T00:00:00.000Z"],
    ["importedAt", "2026-07-21"],
    ["importedAt", "2026-07-29T00:00:00.000Z"],
  ] as const) {
    const candidate = makeVersionTwoWorkspaceWithSourceAssertion();
    candidate.deals[0]!.sourceAssertions[0]![field] = value;
    assert.equal(validateImport(candidate, now).ok, false, `${field}: ${value}`);
  }

  const unknownVerification = makeVersionTwoWorkspaceWithSourceAssertion();
  unknownVerification.deals[0]!.sourceAssertions[0]!.lastVerifiedAt = null;
  assert.equal(validateImport(unknownVerification, now).ok, true);
});

test("configured legacy global buy-box market migrates within the frozen launch scope", () => {
  const candidate = createEmptyData("2026-07-27T12:00:00.000Z") as unknown as {
    buyBox: Record<string, unknown>;
  };
  delete candidate.buyBox.marketsByState;
  candidate.buyBox.markets = ["Bristol County"];
  candidate.buyBox.states = ["MA"];

  const result = validateImport(candidate);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.buyBox.marketsByState, {
    MA: ["bristol county"],
    RI: [],
  });
});

test("legacy multi-state import rejects an ambiguous custom market instead of deleting it", () => {
  const candidate = createEmptyData("2026-07-27T12:00:00.000Z") as unknown as {
    buyBox: Record<string, unknown>;
  };
  delete candidate.buyBox.marketsByState;
  candidate.buyBox.markets = [
    "Fall River",
    "Providence",
    "Operator Custom Market",
  ];
  candidate.buyBox.states = ["MA", "RI"];

  assert.equal(validateImport(candidate).ok, false);
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
    zip: "02110",
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

test("backup restore rejects an oversized file before reading it", async () => {
  let readCalls = 0;
  const result = await readWorkspaceBackup(
    {
      size: MAX_WORKSPACE_BYTES + 1,
      text: async () => {
        readCalls += 1;
        return "{}";
      },
    },
    new Date("2026-07-28T12:00:00.000Z"),
  );

  assert.equal(result.ok, false);
  assert.equal(readCalls, 0);
  if (!result.ok) assert.match(result.errors[0] ?? "", /too large|4 MiB/i);
});

test("backup restore converts file read failures into a safe validation result", async () => {
  const result = await readWorkspaceBackup(
    {
      size: 100,
      text: async () => {
        throw new Error("private filesystem detail");
      },
    },
    new Date("2026-07-28T12:00:00.000Z"),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors[0] ?? "", /could not be read/i);
    assert.doesNotMatch(result.errors.join(" "), /private filesystem detail/i);
  }
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
