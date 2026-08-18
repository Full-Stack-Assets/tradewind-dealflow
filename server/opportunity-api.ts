import { convertAutomatedLeadToDeal } from "../lib/lead-conversion.ts";
import type { SellerPropertyWorkspace } from "../lib/types.ts";
import { getAutomatedLead } from "./automated-lead-store.ts";
import type { D1Bindings } from "./d1.ts";
import {
  getOpportunityByDeal,
  getOpportunityByLead,
  listOpportunities,
  updateOpportunityWorkspace,
  upsertPromotedOpportunity,
} from "./opportunity-store.ts";

type OpportunityApiEnvironment = D1Bindings & {
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

function organizationId(request: Request, env: OpportunityApiEnvironment, actor: string): string {
  return request.headers.get("oai-authenticated-user-organization-id")?.trim()
    || env.DEALFLOW_ORGANIZATION_ID?.trim()
    || `actor:${actor}`;
}

function publicOpportunity(opportunity: Awaited<ReturnType<typeof getOpportunityByDeal>>) {
  if (!opportunity) return null;
  return {
    id: opportunity.id,
    sourceLeadId: opportunity.sourceLeadId,
    dealId: opportunity.dealId,
    deal: opportunity.deal,
    workspace: opportunity.workspace,
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
  };
}

export async function handleOpportunityApi(
  request: Request,
  env: OpportunityApiEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/opportunities")) return null;
  if (!isSameOrigin(request, url)) return json({ error: "same-origin request required" }, 403);
  const actor = await actorId(request);
  if (!actor) return json({ error: "authenticated user required" }, 401);
  const org = organizationId(request, env, actor);
  const now = new Date().toISOString();

  try {
    if (request.method === "GET" && url.pathname === "/api/opportunities") {
      const opportunities = await listOpportunities(env.DB, org);
      return json({ opportunities: opportunities.map((item) => publicOpportunity(item)) });
    }

    const dealMatch = /^\/api\/opportunities\/([^/]+)\/workspace$/u.exec(url.pathname);
    if (request.method === "PUT" && dealMatch) {
      const dealId = decodeURIComponent(dealMatch[1]);
      const body = await request.json() as { workspace?: SellerPropertyWorkspace };
      if (!body.workspace || typeof body.workspace !== "object") {
        return json({ error: "workspace payload required" }, 400);
      }
      const updated = await updateOpportunityWorkspace(env.DB, {
        organizationId: org,
        dealId,
        workspace: body.workspace,
        now,
      });
      return updated
        ? json({ opportunity: publicOpportunity(updated) })
        : json({ error: "opportunity not found" }, 404);
    }

    if (request.method === "POST" && url.pathname === "/api/opportunities") {
      const body = await request.json() as { leadId?: string };
      const leadId = body.leadId?.trim();
      if (!leadId) return json({ error: "leadId required" }, 400);
      const lead = await getAutomatedLead(env.DB, org, leadId);
      if (!lead) return json({ error: "lead not found" }, 404);
      const existing = await getOpportunityByLead(env.DB, org, lead.id);
      if (existing) {
        return json({ opportunity: publicOpportunity(existing), reused: true });
      }
      const conversion = convertAutomatedLeadToDeal(
        {
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
          ownerOccupied: lead.ownerOccupied,
          enrichmentStatus: lead.enrichmentStatus,
        },
        new Date(now),
      );
      if (!conversion.ok) return json({ error: conversion.error }, 400);
      const opportunity = await upsertPromotedOpportunity(env.DB, {
        organizationId: org,
        sourceLeadId: lead.id,
        deal: conversion.deal,
        now,
      });
      return json({
        opportunity: publicOpportunity(opportunity),
        reused: false,
      }, 201);
    }

    return json({ error: "opportunity route not found" }, 404);
  } catch {
    return json({ error: "opportunity service unavailable" }, 503);
  }
}
