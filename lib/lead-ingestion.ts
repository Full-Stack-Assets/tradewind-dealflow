import type {
  DataConfidence,
  RehabLevel,
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
