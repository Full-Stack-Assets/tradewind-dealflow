import { canonicalJson, MASSGIS_FIELDS, type MassGisField, type SourcePolicy, validatePolicy } from "./policy.ts";

const OWNER_FIELDS = new Set(["OWNER1", "OWN_ADDR", "OWN_CITY", "OWN_STATE", "OWN_ZIP", "OWN_CO"]);
const TEXT_FIELDS = new Set<MassGisField>([
  "GlobalID", "MAP_PAR_ID", "LOC_ID", "PROP_ID", "LOT_UNITS", "USE_CODE", "USE_DESC",
  "SITE_ADDR", "CITY", "ZIP",
]);
const NUMBER_FIELDS = new Set<MassGisField>([
  "OBJECTID", "TOWN_ID", "TOTAL_VAL", "BLDG_VAL", "LAND_VAL", "FY", "LOT_SIZE",
  "LS_PRICE", "YEAR_BUILT", "BLD_AREA", "UNITS",
]);
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 10_000;

export type MassGisFeature = {
  attributes: Record<string, unknown>;
};

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

export type MassGisRecordRejection = {
  sourceRecordId: string | null;
  reason: "owner-contact-field" | "unapproved-field" | "malformed-record" | "invalid-number" | "impossible-date";
};

export type MassGisFetchResult = {
  records: MassGisCandidate[];
  rejections: MassGisRecordRejection[];
};

export type FetchMassGisRecordsOptions = {
  fetch?: typeof globalThis.fetch;
  retrievedAt?: string;
  timeoutMs?: number;
  now?: Date;
  signal?: AbortSignal;
  onPage?: (page: MassGisFetchResult) => Promise<void> | void;
};

class TransientMassGisError extends Error {}

class MassGisRecordValidationError extends Error {
  readonly reason: MassGisRecordRejection["reason"];

  constructor(reason: MassGisRecordRejection["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

function quotedStrings(values: string[]): string {
  return values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ");
}

function finiteNumber(value: number, field: string): string {
  if (!Number.isFinite(value)) throw new Error(`nonfinite number for ${field}`);
  return String(value);
}

function saleCutoff(minimumAgeYears: number, now: Date): string {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - minimumAgeYears, now.getUTCMonth(), now.getUTCDate()));
  return cutoff.toISOString().slice(0, 10);
}

function buildWhere(policy: SourcePolicy, now: Date): string {
  const clauses = [`TOWN_ID IN (${policy.townIds.map((value) => finiteNumber(value, "TOWN_ID")).join(", ")})`];
  if (policy.useCodes.length > 0) clauses.push(`USE_CODE IN (${quotedStrings(policy.useCodes)})`);
  if (policy.unitCounts.length > 0) clauses.push(`UNITS IN (${policy.unitCounts.map((value) => finiteNumber(value, "UNITS")).join(", ")})`);
  if (policy.maximumAssessedValue !== null) clauses.push(`TOTAL_VAL <= ${finiteNumber(policy.maximumAssessedValue, "TOTAL_VAL")}`);
  if (policy.maximumYearBuilt !== null) clauses.push(`YEAR_BUILT <= ${finiteNumber(policy.maximumYearBuilt, "YEAR_BUILT")}`);
  if (policy.minimumLastSaleAgeYears !== null) clauses.push(`LS_DATE <= DATE '${saleCutoff(policy.minimumLastSaleAgeYears, now)}'`);
  return clauses.join(" AND ");
}

export function buildQuery(policy: SourcePolicy, resultOffset: number, now = new Date()): URLSearchParams {
  const validated = validatePolicy(policy);
  if (!validated.ok) throw new Error(validated.error);
  if (!Number.isInteger(resultOffset) || resultOffset < 0) throw new Error("result offset must be a non-negative integer");
  const approved = validated.value;
  const query = new URLSearchParams({
    f: "json",
    where: buildWhere(approved, now),
    outFields: approved.outFields.join(","),
    returnGeometry: "false",
    orderByFields: "OBJECTID ASC",
    resultOffset: String(resultOffset),
    resultRecordCount: String(approved.pageSize),
  });
  return query;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseMassGisDate(value: unknown): Date | null {
  if (value === null) return null;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(normalized);
  if (compact) {
    const year = Number(compact[1]);
    const month = Number(compact[2]);
    const day = Number(compact[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day
      ? date
      : null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(normalized);
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day) return null;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isPossibleDate(value: unknown): boolean {
  return value === null || parseMassGisDate(value) !== null;
}

function validateFeature(feature: unknown, approvedFields: readonly string[], requireApprovedFields: boolean): MassGisFeature {
  if (!isRecord(feature) || !isRecord(feature.attributes) || "geometry" in feature) {
    throw new MassGisRecordValidationError("malformed-record", "malformed MassGIS feature");
  }
  const attributes = feature.attributes;
  for (const [field, value] of Object.entries(attributes)) {
    if (OWNER_FIELDS.has(field)) {
      throw new MassGisRecordValidationError("owner-contact-field", "unapproved field");
    }
    if (!MASSGIS_FIELDS.includes(field as MassGisField) || !approvedFields.includes(field)) {
      throw new MassGisRecordValidationError("unapproved-field", "unapproved field");
    }
    if (NUMBER_FIELDS.has(field as MassGisField) && value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new MassGisRecordValidationError("invalid-number", "nonfinite number or invalid numeric field");
    }
    if (TEXT_FIELDS.has(field as MassGisField) && value !== null && typeof value !== "string") {
      throw new MassGisRecordValidationError("malformed-record", "invalid text field");
    }
    if (field === "LS_DATE" && !isPossibleDate(value)) throw new MassGisRecordValidationError("impossible-date", "impossible date");
  }
  if (!("OBJECTID" in attributes) || typeof attributes.OBJECTID !== "number" || !Number.isInteger(attributes.OBJECTID) || attributes.OBJECTID < 0) {
    throw new MassGisRecordValidationError("malformed-record", "malformed MassGIS feature: OBJECTID is required");
  }
  if (requireApprovedFields) {
    for (const field of approvedFields) {
      if (!(field in attributes)) throw new MassGisRecordValidationError("malformed-record", "malformed MassGIS feature: missing approved field");
    }
  }
  return { attributes };
}

function validateMassGisPageEnvelope(page: unknown, policy: SourcePolicy): unknown[] {
  const validated = validatePolicy(policy);
  if (!validated.ok) throw new Error(validated.error);
  if (!isRecord(page)) throw new Error("malformed MassGIS page");
  if ("error" in page) throw new Error("ArcGIS error envelope");
  if (!Array.isArray(page.features) || page.features.length > validated.value.pageSize) {
    throw new Error("malformed MassGIS page features");
  }
  for (const feature of page.features) {
    if (!isRecord(feature) || !isRecord(feature.attributes)) continue;
    if ("geometry" in feature) throw new Error("unexpected geometry in MassGIS response");
    for (const field of Object.keys(feature.attributes)) {
      if (!OWNER_FIELDS.has(field) && !MASSGIS_FIELDS.includes(field as MassGisField)) {
        throw new Error("unknown field in MassGIS response schema");
      }
    }
  }
  return page.features;
}

export function validateMassGisPage(page: unknown, policy: SourcePolicy): MassGisFeature[] {
  const validated = validatePolicy(policy);
  if (!validated.ok) throw new Error(validated.error);
  return validateMassGisPageEnvelope(page, validated.value)
    .map((feature) => validateFeature(feature, validated.value.outFields, true));
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIsoDate(value: unknown): string | null {
  return parseMassGisDate(value)?.toISOString() ?? null;
}

function sourceIdentity(attributes: Record<string, unknown>): string {
  const globalId = text(attributes.GlobalID);
  if (globalId) return globalId;
  const components = [attributes.TOWN_ID, attributes.LOC_ID, attributes.MAP_PAR_ID, attributes.PROP_ID];
  if (components.some((value) => value === null || value === undefined || String(value).trim() === "")) {
    throw new Error("malformed MassGIS feature: no source identity");
  }
  return `massgis-parcels-v1:${components.map(String).join(":")}`;
}

function propertyType(useCode: string, units: number | null): string {
  if (useCode === "101") return "single-family homes";
  if (useCode === "104") return "duplexes";
  if (useCode === "105") return "triplexes";
  if (useCode === "111" && units === 4) return "four-unit residential";
  return "other residential";
}

function sha256(value: string): string {
  const words = new Uint32Array(64);
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const constants = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const rotate = (number: number, bits: number) => (number >>> bits) | (number << (32 - bits));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15];
      const b = words[index - 2];
      words[index] = (words[index - 16] + (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) + words[index - 7] + (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const first = (h + s1 + choice + constants[index] + words[index]) >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const second = (s0 + majority) >>> 0;
      [h, g, f, e, d, c, b, a] = [g, f, e, (d + first) >>> 0, c, b, a, (first + second) >>> 0];
    }
    hash[0] = (hash[0] + a) >>> 0; hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0; hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0; hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0; hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((part) => part.toString(16).padStart(8, "0")).join("");
}

export function normalizeMassGisRecord(feature: unknown, retrievedAt = new Date().toISOString()): MassGisCandidate {
  const { attributes } = validateFeature(feature, MASSGIS_FIELDS, false);
  const identity = sourceIdentity(attributes);
  const units = nullableNumber(attributes.UNITS);
  const candidate = {
    sourceIdentity: identity,
    sourceRecordId: String(attributes.OBJECTID),
    retrievedAt,
    address: text(attributes.SITE_ADDR),
    city: text(attributes.CITY),
    zip: text(attributes.ZIP),
    propertyType: propertyType(text(attributes.USE_CODE), units),
    assessedValue: nullableNumber(attributes.TOTAL_VAL),
    assessmentFiscalYear: nullableNumber(attributes.FY),
    useCode: text(attributes.USE_CODE),
    units,
    yearBuilt: nullableNumber(attributes.YEAR_BUILT),
    buildingArea: nullableNumber(attributes.BLD_AREA),
    lastSaleDate: toIsoDate(attributes.LS_DATE),
    lastSalePrice: nullableNumber(attributes.LS_PRICE),
  };
  const allowedAttributes = Object.fromEntries(MASSGIS_FIELDS.filter((field) => field in attributes).map((field) => [field, attributes[field]]));
  return {
    ...candidate,
    rawFingerprint: sha256(canonicalJson({ adapter: "massgis-parcels-v1", mappingVersion: 1, sourceIdentity: identity, attributes: allowedAttributes })),
    normalizedFingerprint: sha256(canonicalJson({ adapter: "massgis-parcels-v1", mappingVersion: 1, sourceIdentity: identity, candidate })),
  };
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function requestPage(
  url: URL,
  fetcher: typeof globalThis.fetch,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<unknown> {
  let lastError: unknown;
  for (let retry = 0; retry <= MAX_RETRIES; retry += 1) {
    if (signal?.aborted) throw new DOMException("The ingestion run was cancelled.", "AbortError");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      const response = await fetcher(url.toString(), { signal: requestSignal });
      if (!response.ok) {
        if (isTransientStatus(response.status)) throw new TransientMassGisError(`MassGIS HTTP ${response.status}`);
        throw new Error(`MassGIS HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
      if (!(error instanceof TransientMassGisError) && !timedOut) throw error;
      if (retry === MAX_RETRIES) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`MassGIS transient request failed after ${MAX_RETRIES} retries: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}

function usableObjectId(feature: unknown): number | null {
  if (!isRecord(feature) || !isRecord(feature.attributes)) return null;
  const objectId = feature.attributes.OBJECTID;
  return typeof objectId === "number" && Number.isInteger(objectId) && objectId >= 0 ? objectId : null;
}

function sourceRecordId(feature: unknown): string | null {
  const objectId = usableObjectId(feature);
  return objectId === null ? null : String(objectId);
}

function recordRejection(feature: unknown, error: unknown): MassGisRecordRejection {
  return {
    sourceRecordId: sourceRecordId(feature),
    reason: error instanceof MassGisRecordValidationError ? error.reason : "malformed-record",
  };
}

export async function fetchMassGisRecords(policy: SourcePolicy, options: FetchMassGisRecordsOptions = {}): Promise<MassGisFetchResult> {
  const validated = validatePolicy(policy);
  if (!validated.ok) throw new Error(validated.error);
  const approved = validated.value;
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error("fetch is unavailable");
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error("timeout must be a positive integer");
  const now = options.now ?? new Date(retrievedAt);
  if (!Number.isFinite(now.getTime())) throw new Error("retrievedAt must be an ISO timestamp");

  const records: MassGisCandidate[] = [];
  const rejections: MassGisRecordRejection[] = [];
  const identities = new Set<string>();
  let offset = 0;
  let previousObjectId = -1;
  let processedCount = 0;
  while (processedCount < approved.maxRecordsPerRun) {
    if (options.signal?.aborted) throw new DOMException("The ingestion run was cancelled.", "AbortError");
    const remaining = approved.maxRecordsPerRun - processedCount;
    const count = Math.min(approved.pageSize, remaining);
    const params = buildQuery({ ...approved, pageSize: count }, offset, now);
    const url = new URL(approved.endpoint);
    url.search = params.toString();
    const features = validateMassGisPageEnvelope(
      await requestPage(url, fetcher, timeoutMs, options.signal),
      { ...approved, pageSize: count },
    );
    if (features.length > count) throw new Error("MassGIS page exceeded requested count");
    const pageRecords: MassGisCandidate[] = [];
    const pageRejections: MassGisRecordRejection[] = [];
    for (const feature of features) {
      processedCount += 1;
      const objectId = usableObjectId(feature);
      if (objectId !== null) {
        if (objectId < previousObjectId) throw new Error("decreasing object ID in MassGIS pagination");
        previousObjectId = objectId;
      }
      let current: MassGisFeature;
      try {
        current = validateFeature(feature, approved.outFields, true);
      } catch (error) {
        const rejection = recordRejection(feature, error);
        rejections.push(rejection);
        pageRejections.push(rejection);
        continue;
      }
      let candidate: MassGisCandidate;
      try {
        candidate = normalizeMassGisRecord(current, retrievedAt);
      } catch (error) {
        const rejection = recordRejection(current, error);
        rejections.push(rejection);
        pageRejections.push(rejection);
        continue;
      }
      if (identities.has(candidate.sourceIdentity)) throw new Error("duplicate source identity in MassGIS pagination");
      identities.add(candidate.sourceIdentity);
      records.push(candidate);
      pageRecords.push(candidate);
    }
    await options.onPage?.({ records: pageRecords, rejections: pageRejections });
    if (features.length < count) break;
    offset += features.length;
  }
  return { records, rejections };
}
