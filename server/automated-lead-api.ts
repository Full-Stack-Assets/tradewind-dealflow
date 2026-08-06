import { getAutomatedLead, listAutomatedLeads } from "./automated-lead-store.ts";
import type { D1Bindings } from "./d1.ts";
import { isRentCastActivated, type ProviderEnvironment } from "./providers/provider-config.ts";

type AutomatedLeadApiEnvironment = D1Bindings & ProviderEnvironment & {
  DEALFLOW_ORGANIZATION_ID?: string;
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

async function actorId(request: Request): Promise<string | null> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  return (!origin || origin === url.origin) && request.headers.get("sec-fetch-site") !== "cross-site";
}

function organizationId(request: Request, env: AutomatedLeadApiEnvironment, actor: string): string {
  return request.headers.get("oai-authenticated-user-organization-id")?.trim()
    || env.DEALFLOW_ORGANIZATION_ID?.trim()
    || `actor:${actor}`;
}

function publicLead(lead: Awaited<ReturnType<typeof getAutomatedLead>>) {
  if (!lead) return null;
  return {
    id: lead.id,
    source: {
      identity: lead.sourceIdentity,
      recordId: lead.sourceRecordId,
      retrievedAt: lead.sourceRetrievedAt,
    },
    provider: lead.provider,
    providerPropertyId: lead.providerPropertyId,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    zip: lead.zip,
    estimatedValue: lead.estimatedValue,
    ownerNames: lead.ownerNames,
    ownerType: lead.ownerType,
    ownerMailingAddress: lead.ownerMailingAddress,
    ownerOccupied: lead.ownerOccupied,
    enrichmentStatus: lead.enrichmentStatus,
    updatedAt: lead.updatedAt,
  };
}

export async function handleAutomatedLeadApi(
  request: Request,
  env: AutomatedLeadApiEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/leads")) return null;
  if (!isSameOrigin(request, url)) return json({ error: "same-origin request required" }, 403);
  const actor = await actorId(request);
  if (!actor) return json({ error: "authenticated user required" }, 401);
  const org = organizationId(request, env, actor);

  try {
    if (request.method === "GET" && url.pathname === "/api/leads/health") {
      await env.DB.prepare("SELECT 1 FROM automated_leads LIMIT 1").first<{ 1: number }>();
      const providerActivated = isRentCastActivated(env);
      return json({
        leadAutomation: "available",
        source: "massgis",
        ownerEnrichment: providerActivated ? "configured" : "disabled",
        provider: "rentcast",
      });
    }
    if (request.method === "GET" && url.pathname === "/api/leads") {
      const limit = Number(url.searchParams.get("limit") ?? "25");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const status = url.searchParams.get("status") ?? undefined;
      const leads = await listAutomatedLeads(env.DB, org, { limit, offset, status });
      return json({ leads: leads.map((lead) => publicLead(lead)) });
    }
    const match = /^\/api\/leads\/([^/]+)$/u.exec(url.pathname);
    if (request.method === "GET" && match) {
      const lead = await getAutomatedLead(env.DB, org, decodeURIComponent(match[1]));
      return lead ? json({ lead: publicLead(lead) }) : json({ error: "lead not found" }, 404);
    }
    return json({ error: "lead route not found" }, 404);
  } catch {
    return json({ error: "automated lead service unavailable" }, 503);
  }
}
