import { canonicalJson } from "../lib/ingestion/policy.ts";
import { hashCanonicalEnvelope, type ApprovalRequirement, type CanonicalExecutionEnvelope } from "../lib/control-plane/control-plane-core.ts";
import type { D1Bindings } from "./d1.ts";
import { createApprovalRequest, decideApproval, listApprovalQueue } from "./control-plane-store.ts";

const MAX_JSON_BYTES = 128 * 1024;

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

async function actorId(request: Request): Promise<string | null> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) throw new Error("content-type must be application/json");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_JSON_BYTES) throw new Error("request body is too large");
  const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("request body must be an object");
  return parsed as Record<string, unknown>;
}

function organizationId(request: Request, actor: string): string {
  return request.headers.get("oai-authenticated-user-organization-id")?.trim() || `actor:${actor}`;
}

function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  return (!origin || origin === url.origin) && request.headers.get("sec-fetch-site") !== "cross-site";
}

function approvalPath(pathname: string): { requestId: string } | null {
  const match = /^\/api\/control-plane\/approvals\/([^/]+)\/decision$/u.exec(pathname);
  return match ? { requestId: decodeURIComponent(match[1]) } : null;
}

export async function handleControlPlaneApi(request: Request, env: D1Bindings): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/control-plane/")) return null;
  if (!isSameOrigin(request, url)) return json({ error: "same-origin request required" }, 403);
  const actor = await actorId(request);
  if (!actor) return json({ error: "authenticated user required" }, 401);
  const org = organizationId(request, actor);
  try {
    if (request.method === "GET" && url.pathname === "/api/control-plane/approvals") return json({ approvals: await listApprovalQueue(env.DB, org) });
    if (request.method === "POST" && url.pathname === "/api/control-plane/approvals") {
      const body = await readJson(request);
      const envelope = body.envelope as CanonicalExecutionEnvelope;
      const envelopeHash = body.envelopeHash;
      const requirement = body.requirement as ApprovalRequirement;
      if (!envelope || typeof envelopeHash !== "string" || !requirement) throw new Error("envelope, envelopeHash, and requirement are required");
      if (hashCanonicalEnvelope(envelope) !== envelopeHash) throw new Error("envelope hash does not match canonical envelope");
      const result = await createApprovalRequest(env.DB, {
        organizationId: org,
        actionId: String(body.actionId),
        actionType: String(body.actionType),
        targetEntityId: String(body.targetEntityId),
        envelope,
        envelopeHash,
        requirement,
        requesterActorId: String(body.requesterActorId || actor),
        expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
        idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
      });
      return json({ approval: result.item }, result.existing ? 200 : 201);
    }
    const decision = approvalPath(url.pathname);
    if (request.method === "POST" && decision) {
      const body = await readJson(request);
      const result = await decideApproval(env.DB, {
        organizationId: org,
        requestId: decision.requestId,
        approverActorId: actor,
        approverRole: String(body.role),
        decision: body.decision === "REJECTED" ? "REJECTED" : "APPROVED",
        envelopeHash: String(body.envelopeHash),
        comments: typeof body.comments === "string" ? body.comments : undefined,
      });
      return json({ approval: result });
    }
    return json({ error: "control-plane route not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "control-plane request failed";
    const status = /not found/i.test(message) ? 404 : /stale|expired|authority|requester|already|is /i.test(message) ? 409 : 400;
    return new Response(canonicalJson({ error: message }), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
}
