export type AutomatedLeadListItem = {
  id: string;
  source: {
    identity: string;
    recordId: string;
    retrievedAt: string;
  };
  provider: "massgis" | "rentcast";
  providerPropertyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  estimatedValue: number | null;
  ownerNames: string[];
  ownerType: string | null;
  ownerMailingAddress: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  } | null;
  ownerOccupied: boolean | null;
  enrichmentStatus: string;
  updatedAt: string;
};

export async function getAutomatedLeads(
  options: { limit?: number; offset?: number; status?: string } = {},
): Promise<AutomatedLeadListItem[]> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  if (options.status) params.set("status", options.status);
  const query = params.toString();
  const response = await fetch(`/api/leads${query ? `?${query}` : ""}`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const body = await response.json() as { leads?: AutomatedLeadListItem[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Automated lead service unavailable.");
  return Array.isArray(body.leads) ? body.leads : [];
}
