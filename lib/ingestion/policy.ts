export const MASSGIS_ENDPOINT = "https://services1.arcgis.com/hGdibHYSPO59RG1h/ArcGIS/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0/query" as const;

export const MASSGIS_FIELDS = [
  "OBJECTID", "GlobalID", "MAP_PAR_ID", "LOC_ID", "TOWN_ID", "PROP_ID",
  "TOTAL_VAL", "BLDG_VAL", "LAND_VAL", "FY", "LOT_SIZE", "LOT_UNITS",
  "LS_DATE", "LS_PRICE", "USE_CODE", "USE_DESC", "SITE_ADDR", "CITY", "ZIP",
  "YEAR_BUILT", "BLD_AREA", "UNITS",
] as const;

export type MassGisField = typeof MASSGIS_FIELDS[number];

export type SourcePolicy = {
  adapter: "massgis-parcels-v1";
  endpoint: typeof MASSGIS_ENDPOINT;
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

export type PolicyValidation =
  | { ok: true; value: SourcePolicy }
  | { ok: false; error: string };

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableFinite(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function canonicalArray<T extends string | number>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

export function canonicalizePolicy(policy: SourcePolicy): SourcePolicy {
  return {
    ...policy,
    townIds: canonicalArray(policy.townIds),
    outFields: canonicalArray(policy.outFields) as MassGisField[],
    useCodes: canonicalArray(policy.useCodes),
    unitCounts: canonicalArray(policy.unitCounts),
  };
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

export function validatePolicy(policy: unknown): PolicyValidation {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return { ok: false, error: "policy must be an object" };
  const value = policy as Record<string, unknown>;
  if (value.adapter !== "massgis-parcels-v1" || value.endpoint !== MASSGIS_ENDPOINT) return { ok: false, error: "unapproved MassGIS source" };
  if (!isNumberArray(value.townIds) || value.townIds.length === 0 || value.townIds.some((townId) => !Number.isInteger(townId) || townId < 1 || townId > 351)) return { ok: false, error: "town IDs must be integers from 1 through 351" };
  if (!isStringArray(value.outFields) || value.outFields.length === 0 || value.outFields.some((field) => !MASSGIS_FIELDS.includes(field as MassGisField))) return { ok: false, error: "outFields contains an unapproved field" };
  if (!isStringArray(value.useCodes) || !isNumberArray(value.unitCounts)) return { ok: false, error: "filter arrays are invalid" };
  if (!isNullableFinite(value.maximumAssessedValue) || !isNullableFinite(value.maximumYearBuilt) || !isNullableFinite(value.minimumLastSaleAgeYears)) return { ok: false, error: "numeric filters are invalid" };
  if (!isInteger(value.pageSize) || value.pageSize < 1 || value.pageSize > 2000) return { ok: false, error: "page size must be from 1 through 2000" };
  if (!isInteger(value.maxRecordsPerRun) || value.maxRecordsPerRun < 100 || value.maxRecordsPerRun > 100000) return { ok: false, error: "run cap must be from 100 through 100000" };
  if (typeof value.scheduleEnabled !== "boolean" || value.scheduleTimeZone !== "America/New_York" || !isInteger(value.scheduleHour) || value.scheduleHour < 0 || value.scheduleHour > 23 || !isInteger(value.scheduleMinute) || value.scheduleMinute < 0 || value.scheduleMinute > 59) return { ok: false, error: "schedule is invalid" };
  return { ok: true, value: canonicalizePolicy(value as SourcePolicy) };
}

export async function hashPolicy(policy: SourcePolicy): Promise<string> {
  const validated = validatePolicy(policy);
  if (!validated.ok) throw new Error(validated.error);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(validated.value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function applyStoredPolicyToDraft(
  draft: SourcePolicy,
  storedPolicy: SourcePolicy,
  edited: boolean,
): SourcePolicy {
  return edited ? draft : storedPolicy;
}

export function syncInitialPolicyFromHydration(
  draft: SourcePolicy,
  maximumEstimatedValue: number,
  state: { hydrated: boolean; synced: boolean; edited: boolean; storedPolicyLoaded?: boolean },
): { policy: SourcePolicy; synced: boolean } {
  if (state.storedPolicyLoaded) return { policy: draft, synced: true };
  if (!state.hydrated || state.synced) return { policy: draft, synced: state.synced };
  if (state.edited || maximumEstimatedValue <= 0) return { policy: draft, synced: true };
  return {
    policy: { ...draft, maximumAssessedValue: maximumEstimatedValue },
    synced: true,
  };
}
