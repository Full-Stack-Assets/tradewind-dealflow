export type OwnerMailingAddress = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

export type AutomatedLeadRecord = {
  provider: "massgis" | "rentcast";
  providerPropertyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  estimatedValue: number | null;
  ownerNames: string[];
  ownerType: string | null;
  ownerMailingAddress: OwnerMailingAddress | null;
  ownerOccupied: boolean | null;
};

export type OwnerEnrichment = {
  provider: "rentcast";
  providerPropertyId: string;
  ownerNames: string[];
  ownerType: string | null;
  ownerMailingAddress: OwnerMailingAddress | null;
  ownerOccupied: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function envelopeData(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null;
  if (!isRecord(value)) return null;
  const data = value.data;
  if (Array.isArray(data)) return isRecord(data[0]) ? data[0] : null;
  return isRecord(data) ? data : value;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function upperStringValue(value: unknown): string | null {
  const normalized = stringValue(value);
  return normalized?.toUpperCase() ?? null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ownerNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(stringValue)
    .filter((item): item is string => item !== null)
    .slice(0, 20);
}

function ownerMailingAddress(value: unknown): OwnerMailingAddress | null {
  if (!isRecord(value)) return null;
  const addressLine1 = stringValue(value.addressLine1 ?? value.address);
  const addressLine2 = stringValue(value.addressLine2);
  const city = stringValue(value.city);
  const state = upperStringValue(value.state);
  const zipCode = stringValue(value.zipCode ?? value.zip);
  if (!addressLine1 && !city && !state && !zipCode) return null;
  return { addressLine1, addressLine2, city, state, zipCode };
}

export function normalizeRentCastProperty(value: unknown): AutomatedLeadRecord | null {
  const property = envelopeData(value);
  if (!property) return null;
  const providerPropertyId = stringValue(property.id);
  const address = stringValue(property.addressLine1 ?? property.formattedAddress);
  const city = stringValue(property.city);
  const state = upperStringValue(property.state);
  const zip = stringValue(property.zipCode ?? property.zip);
  if (!providerPropertyId || !address || !city || !state || !zip) return null;

  const owner = isRecord(property.owner) ? property.owner : null;
  const names = ownerNames(owner?.names);
  const ownerType = stringValue(owner?.type);
  const mailingAddress = ownerMailingAddress(owner?.mailingAddress);
  const ownerOccupied = typeof property.ownerOccupied === "boolean" ? property.ownerOccupied : null;
  return {
    provider: "rentcast",
    providerPropertyId,
    address,
    city,
    state,
    zip,
    estimatedValue: numberValue(property.estimatedValue),
    ownerNames: names,
    ownerType,
    ownerMailingAddress: mailingAddress,
    ownerOccupied,
  };
}

export function normalizeRentCastProperties(value: unknown): AutomatedLeadRecord[] {
  const records = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.data)
      ? value.data
      : [];
  return records
    .map(normalizeRentCastProperty)
    .filter((record): record is AutomatedLeadRecord => record !== null);
}

export function normalizeRentCastOwner(value: unknown): OwnerEnrichment | null {
  const property = normalizeRentCastProperty(value);
  if (!property) return null;
  return {
    provider: "rentcast",
    providerPropertyId: property.providerPropertyId,
    ownerNames: property.ownerNames,
    ownerType: property.ownerType,
    ownerMailingAddress: property.ownerMailingAddress,
    ownerOccupied: property.ownerOccupied,
  };
}
