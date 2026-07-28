import type {
  DataConfidence,
  DealFlowData,
  DealRecord,
  FactConflict,
  PropertyFactSnapshot,
  RehabLevel,
  SourceAssertion,
  SourceUsageClassification,
  StateCode,
} from "./types.ts";
import { MAX_CSV_COLUMNS, MAX_CSV_DATA_ROWS } from "./csv.ts";

const REQUIRED_HEADERS = [
  "source",
  "source_record_id",
  "retrieved_at",
  "state",
  "address",
  "city",
  "market",
  "usage_classification",
  "confidence",
  "last_verified_at",
] as const;

const OPTIONAL_HEADERS = [
  "property_type",
  "asking_price",
  "rehab_level",
  "owner_contact_status",
  "next_action",
  "notes",
] as const;

const ALLOWED_HEADERS = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]);
const PROHIBITED_HEADERS = new Set([
  "race", "racial", "ethnicity", "ethnic", "religion", "religious", "sex", "gender",
  "sexual_orientation", "disability", "age", "date_of_birth", "dob", "marital_status",
  "familial_status", "national_origin", "citizenship", "immigration_status",
  "neighborhood_composition", "owner", "owner_name", "seller_name", "contact_name",
  "phone", "telephone", "mobile", "email", "owner_phone", "owner_email", "contact_phone",
  "contact_email",
]);
const USAGE_CLASSIFICATIONS: readonly SourceUsageClassification[] = [
  "Public record",
  "Licensed provider",
  "Direct submission",
  "Authorized CRM",
  "Operator research",
  "Restricted — research only",
];
const CONFIDENCES: readonly DataConfidence[] = ["Low", "Medium", "High"];
const REHAB_LEVELS: readonly RehabLevel[] = ["Light", "Moderate", "Heavy"];

export type LeadImportCandidate = {
  source: string;
  sourceRecordId: string;
  retrievedAt: string;
  state: StateCode;
  address: string;
  city: string;
  market: string;
  propertyType: string | null;
  askingPrice: number | null;
  rehabLevel: RehabLevel | null;
  ownerContactStatus: string | null;
  nextAction: string | null;
  notes: string | null;
  usageClassification: SourceUsageClassification;
  confidence: DataConfidence;
  lastVerifiedAt: string;
};

export type LeadCsvValidationResult =
  | { ok: true; candidates: LeadImportCandidate[]; errors: [] }
  | { ok: false; candidates: LeadImportCandidate[]; errors: string[] };

export type PreviewItem = {
  rowNumber: number;
  candidate: LeadImportCandidate;
  reason: string;
};

export type PlannedNewLead = {
  rowNumber: number;
  candidate: LeadImportCandidate;
  localKey: string;
};

export type PlannedSourceUpdate = {
  rowNumber: number;
  candidate: LeadImportCandidate;
  dealId: string | null;
  plannedDealRowNumber: number | null;
};

export type PossibleDuplicate = PreviewItem & {
  matchingDealIds: string[];
  matchingPlannedRows: number[];
};

export type PlannedAttachment = {
  rowNumber: number;
  candidate: LeadImportCandidate;
  dealId: string;
};

export type LeadImportPlan = {
  baseRevision: number;
  workspaceFingerprint: string;
  newRows: PlannedNewLead[];
  changedSourceRows: PlannedSourceUpdate[];
  exactReimports: PreviewItem[];
  possibleDuplicates: PossibleDuplicate[];
  rejected: PreviewItem[];
  attachments: PlannedAttachment[];
};

export type ImportApplyResult =
  | { ok: true; data: DealFlowData }
  | { ok: false; error: string };

type ImportTarget =
  | { kind: "existing"; dealId: string }
  | { kind: "planned"; rowNumber: number };

type IndexedTarget = {
  target: ImportTarget;
  fingerprints: Set<string>;
};

const PROPERTY_FACT_FIELDS: readonly (keyof PropertyFactSnapshot)[] = [
  "state",
  "address",
  "city",
  "market",
  "propertyType",
  "askingPrice",
  "rehabLevel",
  "ownerContactStatus",
  "nextAction",
  "notes",
];

const STALE_PLAN_ERROR =
  "The workspace changed after preview. Review the file again.";

export function validateLeadCsv(table: string[][], now: Date): LeadCsvValidationResult {
  if (table.length === 0) return invalid("The CSV must include a header row.");
  if (table.length - 1 > MAX_CSV_DATA_ROWS) {
    return invalid("CSV exceeds the maximum number of data rows.");
  }
  const headerRow = table[0];
  if (!headerRow || headerRow.length > MAX_CSV_COLUMNS) {
    return invalid("CSV exceeds the maximum number of columns.");
  }

  const headers = headerRow.map(normalizeHeader);
  const headerErrors: string[] = [];
  const seen = new Set<string>();
  for (const header of headers) {
    if (!header) {
      headerErrors.push("CSV contains an empty column header.");
    } else if (isProhibitedHeader(header)) {
      headerErrors.push(`CSV contains prohibited column: ${header}.`);
    } else if (seen.has(header)) {
      headerErrors.push(`CSV contains duplicate column: ${header}.`);
    } else if (!ALLOWED_HEADERS.has(header)) {
      headerErrors.push(`CSV contains unknown column: ${header}.`);
    }
    seen.add(header);
  }
  for (const header of REQUIRED_HEADERS) {
    if (!seen.has(header)) headerErrors.push(`CSV is missing required column: ${header}.`);
  }
  if (headerErrors.length > 0) return { ok: false, candidates: [], errors: headerErrors };

  const candidates: LeadImportCandidate[] = [];
  const errors: string[] = [];
  for (let index = 1; index < table.length; index += 1) {
    const row = table[index];
    const rowNumber = index + 1;
    if (!row || row.length !== headers.length) {
      errors.push(`Row ${rowNumber} has a different number of fields than the header.`);
      continue;
    }
    const values = Object.fromEntries(headers.map((header, fieldIndex) => [header, row[fieldIndex] ?? ""]));
    const result = validateRow(values, rowNumber, now);
    if (typeof result === "string") errors.push(result);
    else candidates.push(result);
  }
  return errors.length === 0
    ? { ok: true, candidates, errors: [] }
    : { ok: false, candidates, errors };
}

export function planLeadImport(
  data: DealFlowData,
  candidates: LeadImportCandidate[],
): LeadImportPlan {
  const plan: LeadImportPlan = {
    baseRevision: data.revision,
    workspaceFingerprint: fingerprintWorkspace(data),
    newRows: [],
    changedSourceRows: [],
    exactReimports: [],
    possibleDuplicates: [],
    rejected: [],
    attachments: [],
  };
  const identities = new Map<string, Map<string, IndexedTarget>>();
  const properties = new Map<string, Map<string, ImportTarget>>();

  for (const deal of data.deals) {
    addPropertyTarget(properties, propertyKeyFromDeal(deal), {
      kind: "existing",
      dealId: deal.id,
    });
    for (const assertion of deal.sourceAssertions) {
      addIdentityTarget(
        identities,
        sourceIdentity(assertion.source, assertion.sourceRecordId),
        { kind: "existing", dealId: deal.id },
        assertion.fingerprint,
      );
    }
  }

  candidates.forEach((candidate, index) => {
    const rowNumber = index + 2;
    const identity = sourceIdentity(candidate.source, candidate.sourceRecordId);
    const fingerprint = fingerprintCandidate(candidate);
    const identityMatches = identities.get(identity);
    if (identityMatches && identityMatches.size > 1) {
      plan.rejected.push({
        rowNumber,
        candidate,
        reason:
          "This source identity is attached to multiple existing deals and must be repaired before import.",
      });
      return;
    }
    if (identityMatches && identityMatches.size === 1) {
      const indexed = identityMatches.values().next().value as IndexedTarget;
      if (indexed.fingerprints.has(fingerprint)) {
        plan.exactReimports.push({
          rowNumber,
          candidate,
          reason: "This exact source snapshot was imported previously.",
        });
        return;
      }
      plan.changedSourceRows.push({
        rowNumber,
        candidate,
        dealId:
          indexed.target.kind === "existing" ? indexed.target.dealId : null,
        plannedDealRowNumber:
          indexed.target.kind === "planned" ? indexed.target.rowNumber : null,
      });
      indexed.fingerprints.add(fingerprint);
      return;
    }

    const propertyMatches = properties.get(propertyKeyFromCandidate(candidate));
    if (propertyMatches && propertyMatches.size > 0) {
      const targets = [...propertyMatches.values()];
      plan.possibleDuplicates.push({
        rowNumber,
        candidate,
        reason:
          "The normalized property matches another record; confirm an existing deal before attaching this source.",
        matchingDealIds: targets.flatMap((target) =>
          target.kind === "existing" ? [target.dealId] : []
        ),
        matchingPlannedRows: targets.flatMap((target) =>
          target.kind === "planned" ? [target.rowNumber] : []
        ),
      });
      return;
    }

    const target: ImportTarget = { kind: "planned", rowNumber };
    plan.newRows.push({
      rowNumber,
      candidate,
      localKey: stableId("lead", identity),
    });
    addIdentityTarget(identities, identity, target, fingerprint);
    addPropertyTarget(properties, propertyKeyFromCandidate(candidate), target);
  });

  return plan;
}

export function attachPossibleDuplicate(
  plan: LeadImportPlan,
  rowNumber: number,
  dealId: string,
): LeadImportPlan {
  const possible = plan.possibleDuplicates.find(
    (item) => item.rowNumber === rowNumber,
  );
  if (!possible) {
    throw new Error("The selected row is not an unresolved possible duplicate.");
  }
  if (!possible.matchingDealIds.includes(dealId)) {
    throw new Error(
      "A possible duplicate can attach only to a listed existing deal.",
    );
  }
  return {
    ...plan,
    possibleDuplicates: plan.possibleDuplicates.filter(
      (item) => item.rowNumber !== rowNumber,
    ),
    attachments: [
      ...plan.attachments,
      { rowNumber, candidate: possible.candidate, dealId },
    ],
  };
}

export function applyLeadImportPlan(
  data: DealFlowData,
  plan: LeadImportPlan,
  now: Date,
): ImportApplyResult {
  if (
    data.revision !== plan.baseRevision ||
    fingerprintWorkspace(data) !== plan.workspaceFingerprint
  ) {
    return { ok: false, error: STALE_PLAN_ERROR };
  }

  const next = structuredClone(data);
  const appliedAt = now.toISOString();
  const usedDealIds = new Set(next.deals.map((deal) => deal.id));
  const plannedDeals = new Map<number, DealRecord>();
  let changed = false;

  for (const item of plan.newRows) {
    const assertion = createSourceAssertion(item.candidate, appliedAt);
    const dealId = uniqueStableId(
      stableId(
        "deal",
        sourceIdentity(item.candidate.source, item.candidate.sourceRecordId),
      ),
      usedDealIds,
    );
    const facts = assertion.facts;
    const deal: DealRecord = {
      id: dealId,
      createdAt: appliedAt,
      updatedAt: appliedAt,
      state: facts.state,
      address: facts.address,
      city: facts.city,
      market: facts.market,
      propertyType: facts.propertyType,
      source: assertion.source,
      ownerContactStatus: facts.ownerContactStatus,
      stage: "Research",
      nextAction:
        facts.nextAction ||
        "Research property facts and confirm source eligibility.",
      notes: facts.notes,
      askingPrice: facts.askingPrice,
      rehabLevel: facts.rehabLevel,
      sourceAssertions: [assertion],
      factConflicts: [],
      researchRestrictions: [],
      strategies: [],
      executedAgreement: false,
      equitableInterestRecorded: false,
      legalTitleDisclosureReady: false,
      attorneyReviewComplete: false,
    };
    addSourceRestriction(deal, assertion, appliedAt);
    next.deals.push(deal);
    plannedDeals.set(item.rowNumber, deal);
    changed = true;
  }

  for (const item of plan.changedSourceRows) {
    const deal = item.dealId
      ? next.deals.find((candidateDeal) => candidateDeal.id === item.dealId)
      : plannedDeals.get(item.plannedDealRowNumber ?? -1);
    if (!deal) {
      return {
        ok: false,
        error: "The import plan references a property that is no longer available.",
      };
    }
    appendAssertion(deal, item.candidate, appliedAt);
    changed = true;
  }

  for (const item of plan.attachments) {
    const deal = next.deals.find(
      (candidateDeal) => candidateDeal.id === item.dealId,
    );
    if (!deal) {
      return {
        ok: false,
        error: "The import plan references a property that is no longer available.",
      };
    }
    appendAssertion(deal, item.candidate, appliedAt);
    changed = true;
  }

  if (changed) next.updatedAt = appliedAt;
  return { ok: true, data: next };
}

export function resolveFactConflict(
  data: DealFlowData,
  dealId: string,
  conflictId: string,
  selectedSide: "Canonical" | "Asserted",
  basis: string,
  now: Date,
): DealFlowData {
  if (selectedSide !== "Canonical" && selectedSide !== "Asserted") {
    throw new Error("Select either the canonical or asserted value.");
  }
  const normalizedBasis = normalizeText(basis);
  if (!normalizedBasis) {
    throw new Error("A conflict-resolution basis is required.");
  }
  const next = structuredClone(data);
  const deal = next.deals.find((candidateDeal) => candidateDeal.id === dealId);
  if (!deal) throw new Error("The selected deal does not exist.");
  const conflict = deal.factConflicts.find(
    (candidateConflict) => candidateConflict.id === conflictId,
  );
  if (!conflict) throw new Error("The selected fact conflict does not exist.");
  if (conflict.status === "Resolved") {
    throw new Error("The selected fact conflict is already resolved.");
  }
  const selectedValue =
    selectedSide === "Asserted"
      ? conflict.assertedValue
      : conflict.canonicalValue;
  if (!isValidFactValue(conflict.field, selectedValue)) {
    throw new Error(
      `The ${conflict.field} conflict does not contain a valid value.`,
    );
  }

  if (selectedSide === "Asserted") {
    setCanonicalFact(deal, conflict.field, selectedValue);
  }
  const resolvedAt = now.toISOString();
  conflict.status = "Resolved";
  conflict.resolution = {
    selectedSide,
    basis: normalizedBasis,
    resolvedAt,
  };
  deal.updatedAt = resolvedAt;
  next.updatedAt = resolvedAt;
  return next;
}

function appendAssertion(
  deal: DealRecord,
  candidate: LeadImportCandidate,
  appliedAt: string,
): void {
  const assertion = createSourceAssertion(candidate, appliedAt);
  if (
    deal.sourceAssertions.some(
      (existing) => existing.fingerprint === assertion.fingerprint,
    )
  ) {
    return;
  }
  deal.sourceAssertions.push(assertion);
  addFactConflicts(deal, assertion, appliedAt);
  addSourceRestriction(deal, assertion, appliedAt);
  deal.updatedAt = appliedAt;
}

function createSourceAssertion(
  candidate: LeadImportCandidate,
  importedAt: string,
): SourceAssertion {
  const fingerprint = fingerprintCandidate(candidate);
  return {
    id: stableId("assertion", fingerprint),
    source: normalizeText(candidate.source),
    sourceRecordId: normalizeText(candidate.sourceRecordId),
    retrievedAt: normalizeTimestamp(candidate.retrievedAt),
    usageClassification: candidate.usageClassification,
    confidence: candidate.confidence,
    lastVerifiedAt: normalizeTimestamp(candidate.lastVerifiedAt),
    importedAt,
    fingerprint,
    facts: factsFromCandidate(candidate),
  };
}

function addFactConflicts(
  deal: DealRecord,
  assertion: SourceAssertion,
  detectedAt: string,
): void {
  for (const field of PROPERTY_FACT_FIELDS) {
    const canonicalValue = deal[field];
    const assertedValue = assertion.facts[field];
    if (canonicalJson(canonicalValue) === canonicalJson(assertedValue)) continue;
    const duplicate = deal.factConflicts.some(
      (conflict) =>
        conflict.field === field &&
        canonicalJson(conflict.canonicalValue) ===
          canonicalJson(canonicalValue) &&
        canonicalJson(conflict.assertedValue) ===
          canonicalJson(assertedValue),
    );
    if (duplicate) continue;
    const identity = canonicalJson({
      dealId: deal.id,
      field,
      canonicalValue,
      assertedValue,
    });
    const conflict: FactConflict = {
      id: stableId("conflict", identity),
      field,
      canonicalValue,
      assertedValue,
      sourceAssertionId: assertion.id,
      detectedAt,
      status: "Unresolved",
      resolution: null,
    };
    deal.factConflicts.push(conflict);
  }
}

function addSourceRestriction(
  deal: DealRecord,
  assertion: SourceAssertion,
  createdAt: string,
): void {
  if (assertion.usageClassification !== "Restricted — research only") return;
  if (
    deal.researchRestrictions.some(
      (restriction) =>
        restriction.code === "Source restricted" &&
        restriction.sourceAssertionId === assertion.id,
    )
  ) {
    return;
  }
  deal.researchRestrictions.push({
    id: stableId(
      "restriction",
      canonicalJson({
        code: "Source restricted",
        sourceAssertionId: assertion.id,
      }),
    ),
    code: "Source restricted",
    source: "Source assertion",
    sourceAssertionId: assertion.id,
    reason: "This source is restricted to research use.",
    createdAt,
    resolvedAt: null,
    resolutionNote: "",
  });
}

function factsFromCandidate(
  candidate: LeadImportCandidate,
): PropertyFactSnapshot {
  return {
    state: candidate.state,
    address: normalizeText(candidate.address),
    city: normalizeText(candidate.city),
    market: normalizeText(candidate.market),
    propertyType: normalizeText(candidate.propertyType ?? ""),
    askingPrice: candidate.askingPrice,
    rehabLevel: candidate.rehabLevel,
    ownerContactStatus: normalizeText(candidate.ownerContactStatus ?? ""),
    nextAction: normalizeText(candidate.nextAction ?? ""),
    notes: normalizeText(candidate.notes ?? ""),
  };
}

function fingerprintCandidate(candidate: LeadImportCandidate): string {
  const facts = factsFromCandidate(candidate);
  const normalizedFacts = Object.fromEntries(
    PROPERTY_FACT_FIELDS.map((field) => {
      const value = facts[field];
      return [
        field,
        typeof value === "string" ? normalizeComparableText(value) : value,
      ];
    }),
  );
  return fnv1a(
    canonicalJson({
      sourceIdentity: sourceIdentity(
        candidate.source,
        candidate.sourceRecordId,
      ),
      retrievedAt: normalizeTimestamp(candidate.retrievedAt),
      lastVerifiedAt: normalizeTimestamp(candidate.lastVerifiedAt),
      usageClassification: candidate.usageClassification,
      confidence: candidate.confidence,
      facts: normalizedFacts,
    }),
  );
}

function fingerprintWorkspace(data: DealFlowData): string {
  return fnv1a(canonicalJson(data));
}

function sourceIdentity(source: string, sourceRecordId: string): string {
  return `${normalizeIdentityPart(source)}\u001f${normalizeIdentityPart(sourceRecordId)}`;
}

function normalizeIdentityPart(value: string): string {
  return normalizeComparableText(value).toLocaleLowerCase("en-US");
}

function propertyKeyFromDeal(deal: DealRecord): string {
  return propertyKey(deal.state, deal.city, deal.address);
}

function propertyKeyFromCandidate(candidate: LeadImportCandidate): string {
  return propertyKey(candidate.state, candidate.city, candidate.address);
}

function propertyKey(state: StateCode, city: string, address: string): string {
  return [
    state,
    normalizeIdentityPart(city),
    normalizeIdentityPart(address).replace(/[.,]/g, ""),
  ].join("\u001f");
}

function normalizeComparableText(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

function addIdentityTarget(
  index: Map<string, Map<string, IndexedTarget>>,
  identity: string,
  target: ImportTarget,
  fingerprint: string,
): void {
  const targets = index.get(identity) ?? new Map<string, IndexedTarget>();
  const key = targetKey(target);
  const indexed = targets.get(key) ?? {
    target,
    fingerprints: new Set<string>(),
  };
  indexed.fingerprints.add(fingerprint);
  targets.set(key, indexed);
  index.set(identity, targets);
}

function addPropertyTarget(
  index: Map<string, Map<string, ImportTarget>>,
  property: string,
  target: ImportTarget,
): void {
  const targets = index.get(property) ?? new Map<string, ImportTarget>();
  targets.set(targetKey(target), target);
  index.set(property, targets);
}

function targetKey(target: ImportTarget): string {
  return target.kind === "existing"
    ? `existing:${target.dealId}`
    : `planned:${target.rowNumber}`;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${fnv1a(value)}`;
}

function uniqueStableId(base: string, used: Set<string>): string {
  let candidateId = base;
  let suffix = 2;
  while (used.has(candidateId)) {
    candidateId = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidateId);
  return candidateId;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function normalizeTimestamp(value: string): string {
  const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (calendar) {
    return new Date(
      Date.UTC(
        Number(calendar[1]),
        Number(calendar[2]) - 1,
        Number(calendar[3]),
      ),
    ).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function isValidFactValue(
  field: keyof PropertyFactSnapshot,
  value: string | number | null,
): boolean {
  if (field === "askingPrice") {
    return (
      value === null ||
      (typeof value === "number" && Number.isFinite(value) && value >= 0)
    );
  }
  if (field === "rehabLevel") {
    return value === null || REHAB_LEVELS.includes(value as RehabLevel);
  }
  if (field === "state") return value === "MA" || value === "RI";
  return typeof value === "string";
}

function setCanonicalFact(
  deal: DealRecord,
  field: keyof PropertyFactSnapshot,
  value: string | number | null,
): void {
  switch (field) {
    case "askingPrice":
      deal.askingPrice = value as number | null;
      return;
    case "rehabLevel":
      deal.rehabLevel = value as RehabLevel | null;
      return;
    case "state":
      deal.state = value as StateCode;
      return;
    case "address":
    case "city":
    case "market":
    case "propertyType":
    case "ownerContactStatus":
    case "nextAction":
    case "notes":
      deal[field] = value as string;
  }
}

function validateRow(values: Record<string, string>, rowNumber: number, now: Date): LeadImportCandidate | string {
  const required = (header: typeof REQUIRED_HEADERS[number]): string | null => {
    const value = normalizeText(values[header]);
    return value === "" ? null : value;
  };
  const source = required("source");
  const sourceRecordId = required("source_record_id");
  const retrievedAt = required("retrieved_at");
  const state = required("state");
  const address = required("address");
  const city = required("city");
  const market = required("market");
  const usageClassification = required("usage_classification");
  const confidence = required("confidence");
  const lastVerifiedAt = required("last_verified_at");
  for (const [header, value] of Object.entries({ source, source_record_id: sourceRecordId, retrieved_at: retrievedAt, state, address, city, market, usage_classification: usageClassification, confidence, last_verified_at: lastVerifiedAt })) {
    if (value === null) return rowError(rowNumber, header, "is required");
  }
  if (
    source === null || sourceRecordId === null || retrievedAt === null || state === null ||
    address === null || city === null || market === null || usageClassification === null ||
    confidence === null || lastVerifiedAt === null
  ) return rowError(rowNumber, "required field", "is required");

  const normalizedRetrievedAt = parseImportDate(retrievedAt, now);
  if (!normalizedRetrievedAt.ok) return rowError(rowNumber, "retrieved_at", normalizedRetrievedAt.error);
  const normalizedLastVerifiedAt = parseImportDate(lastVerifiedAt, now);
  if (!normalizedLastVerifiedAt.ok) return rowError(rowNumber, "last_verified_at", normalizedLastVerifiedAt.error);
  if (state !== "MA" && state !== "RI") return rowError(rowNumber, "state", "has an invalid value");
  if (!USAGE_CLASSIFICATIONS.includes(usageClassification as SourceUsageClassification)) return rowError(rowNumber, "usage_classification", "has an invalid value");
  if (!CONFIDENCES.includes(confidence as DataConfidence)) return rowError(rowNumber, "confidence", "has an invalid value");

  const askingPrice = optionalText(values.asking_price);
  let parsedPrice: number | null = null;
  if (askingPrice !== null) {
    const parsed = parseAskingPrice(askingPrice);
    if (typeof parsed === "string") return rowError(rowNumber, "asking_price", parsed);
    parsedPrice = parsed;
  }

  const rehabLevel = optionalText(values.rehab_level);
  if (rehabLevel !== null && !REHAB_LEVELS.includes(rehabLevel as RehabLevel)) return rowError(rowNumber, "rehab_level", "has an invalid value");

  return {
    source,
    sourceRecordId,
    retrievedAt: normalizedRetrievedAt.value,
    state,
    address,
    city,
    market,
    propertyType: optionalText(values.property_type),
    askingPrice: parsedPrice,
    rehabLevel: rehabLevel as RehabLevel | null,
    ownerContactStatus: optionalText(values.owner_contact_status),
    nextAction: optionalText(values.next_action),
    notes: optionalText(values.notes),
    usageClassification: usageClassification as SourceUsageClassification,
    confidence: confidence as DataConfidence,
    lastVerifiedAt: normalizedLastVerifiedAt.value,
  };
}

function normalizeHeader(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US")
    .replace(/[ -]+/g, "_");
}

function isProhibitedHeader(header: string): boolean {
  return PROHIBITED_HEADERS.has(header) ||
    /^(?:owner|seller|contact)_(?:name|first_name|last_name|phone|phone_number|telephone|mobile|email|email_address)$/.test(header) ||
    /^(?:race|racial|ethnicity|ethnic|religion|religious|sex|gender|sexual_orientation|disability|age|date_of_birth|dob|marital_status|familial_status|national_origin|citizenship|immigration_status|neighborhood_composition)(?:_|$)/.test(header);
}

function normalizeText(value: string | undefined): string {
  return String(value ?? "").normalize("NFKC").trim();
}

function optionalText(value: string | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized === "" ? null : normalized;
}

function parseAskingPrice(value: string): number | string {
  const match = /^(?:0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return "must be a non-negative dollar or cents value";
  const cents = match[1] ?? "";
  const [dollars] = value.split(".");
  const minorUnits = BigInt(dollars as string) * BigInt(100) + BigInt((cents + "00").slice(0, 2));
  if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    return "must be safely representable without precision loss";
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed.toFixed(cents.length) !== value) {
    return "must be safely representable without precision loss";
  }
  return parsed;
}

function parseImportDate(value: string, now: Date): { ok: true; value: string } | { ok: false; error: string } {
  let date: Date | null = null;
  const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (calendar) {
    const year = Number(calendar[1]);
    const month = Number(calendar[2]);
    const day = Number(calendar[3]);
    if (!validCalendarDate(year, month, day)) return { ok: false, error: "must be a valid calendar date" };
    date = new Date(Date.UTC(year, month - 1, day));
  } else {
    const timestamp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!timestamp) return { ok: false, error: "must be an ISO date-time with an explicit timezone" };
    const year = Number(timestamp[1]);
    const month = Number(timestamp[2]);
    const day = Number(timestamp[3]);
    const hour = Number(timestamp[4]);
    const minute = Number(timestamp[5]);
    const second = Number(timestamp[6] ?? "0");
    const zone = timestamp[8] as string;
    if (!validCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59 || !validTimezone(zone)) {
      return { ok: false, error: "must be a valid ISO date-time with an explicit timezone" };
    }
    date = new Date(value);
    if (Number.isNaN(date.getTime())) return { ok: false, error: "must be a valid ISO date-time with an explicit timezone" };
  }
  if (date.getTime() > now.getTime()) return { ok: false, error: "must not be in the future" };
  return { ok: true, value: date.toISOString() };
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validTimezone(value: string): boolean {
  if (value === "Z") return true;
  const match = /^[+-](\d{2}):(\d{2})$/.exec(value);
  return match !== null && Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

function rowError(rowNumber: number, field: string, message: string): string {
  return `Row ${rowNumber}, ${field}: ${message}.`;
}

function invalid(error: string): LeadCsvValidationResult {
  return { ok: false, candidates: [], errors: [error] };
}
