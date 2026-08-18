import type { DealRecord, SellerPropertyWorkspace } from "./types.ts";

export type DurableOpportunity = {
  id: string;
  sourceLeadId: string | null;
  dealId: string;
  deal: DealRecord;
  workspace: SellerPropertyWorkspace;
  createdAt: string;
  updatedAt: string;
};

async function readJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

export async function listDurableOpportunities(): Promise<DurableOpportunity[]> {
  const response = await fetch("/api/opportunities", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const body = await readJson<{ opportunities?: DurableOpportunity[]; error?: string }>(response);
  if (!response.ok) throw new Error(body.error ?? "Opportunity service unavailable.");
  return Array.isArray(body.opportunities) ? body.opportunities : [];
}

export async function promoteAutomatedLead(leadId: string): Promise<{
  opportunity: DurableOpportunity;
  reused: boolean;
}> {
  const response = await fetch("/api/opportunities", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ leadId }),
  });
  const body = await readJson<{
    opportunity?: DurableOpportunity;
    reused?: boolean;
    error?: string;
  }>(response);
  if (!response.ok || !body.opportunity) {
    throw new Error(body.error ?? "Opportunity service unavailable.");
  }
  return { opportunity: body.opportunity, reused: Boolean(body.reused) };
}

export async function persistOpportunityWorkspace(
  dealId: string,
  workspace: SellerPropertyWorkspace,
): Promise<DurableOpportunity> {
  const response = await fetch(`/api/opportunities/${encodeURIComponent(dealId)}/workspace`, {
    method: "PUT",
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ workspace }),
  });
  const body = await readJson<{ opportunity?: DurableOpportunity; error?: string }>(response);
  if (!response.ok || !body.opportunity) {
    throw new Error(body.error ?? "Opportunity service unavailable.");
  }
  return body.opportunity;
}
