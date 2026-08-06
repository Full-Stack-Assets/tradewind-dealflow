export type AutomatedLeadRecord = {
  provider: "dealmachine";
  providerPropertyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  estimatedValue: number | null;
  ownerName: string | null;
};

export type OwnerEnrichment = {
  provider: "dealmachine";
  providerPersonId: string;
  ownerName: string | null;
  phones: string[];
  emails: string[];
  dnc: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function envelopeData(value: unknown): Record<string, unknown> | null {
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

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown, keys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return stringValue(item);
      if (!isRecord(item)) return null;
      for (const key of keys) {
        const candidate = stringValue(item[key]);
        if (candidate) return candidate;
      }
      return null;
    })
    .filter((item): item is string => item !== null);
}

export function normalizeDealMachineProperty(value: unknown): AutomatedLeadRecord | null {
  const property = envelopeData(value);
  if (!property) return null;
  const providerPropertyId = stringValue(property.dm_property_id);
  const address = stringValue(property.address);
  const city = stringValue(property.city);
  const state = stringValue(property.state)?.toUpperCase();
  const zip = stringValue(property.zip ?? property.code);
  if (!providerPropertyId || !address || !city || !state || !zip) return null;
  return {
    provider: "dealmachine",
    providerPropertyId,
    address,
    city,
    state,
    zip,
    estimatedValue: numberValue(property.estimated_value),
    ownerName: stringValue(property.owner_name),
  };
}

export function normalizeDealMachinePerson(value: unknown): OwnerEnrichment | null {
  const person = envelopeData(value);
  if (!person) return null;
  const providerPersonId = stringValue(person.dm_person_id);
  if (!providerPersonId) return null;
  const phones = stringList(person.phones, ["number", "phone"]);
  const emails = stringList(person.emails, ["address", "email"]);
  const dnc = typeof person.dnc === "boolean" ? person.dnc : null;
  const ownerName = stringValue(person.full_name ?? person.owner_name ?? person.name);
  if (!ownerName && phones.length === 0 && emails.length === 0) return null;
  return {
    provider: "dealmachine",
    providerPersonId,
    ownerName,
    phones,
    emails,
    dnc,
  };
}
