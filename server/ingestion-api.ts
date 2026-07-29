import { canonicalJson, type SourcePolicy } from "../lib/ingestion/policy.ts";
import type { D1Bindings } from "./d1.ts";
import {
  approvePolicy,
  getActivePolicy,
  listRecords,
  listRuns,
  markRecordsImported,
} from "./ingestion-store.ts";
import { runIngestion } from "./ingestion-runner.ts";

const MAX_JSON_BYTES = 64 * 1024;

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function actorId(request: Request): Promise<string | null> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return email ? sha256(email) : null;
}

async function readJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new Error("content-type must be application/json");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) throw new Error("request body is too large");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_JSON_BYTES) throw new Error("request body is too large");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("request body must be valid JSON");
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("request body must be an object");
  return value as Record<string, unknown>;
}

export async function handleIngestionApi(
  request: Request,
  env: D1Bindings,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/sources/")) return null;
  const actor = await actorId(request);
  if (!actor) return json({ error: "authenticated user required" }, 401);

  try {
    if (request.method === "GET" && url.pathname === "/api/sources/policy") {
      return json({ policy: await getActivePolicy(env.DB) });
    }
    if (request.method === "POST" && url.pathname === "/api/sources/policy/approve") {
      const body = asObject(await readJson(request));
      return json({
        policy: await approvePolicy(env.DB, body.policy as SourcePolicy, actor),
      }, 201);
    }
    if (request.method === "POST" && url.pathname === "/api/sources/runs") {
      await readJson(request);
      const idempotencyKey = request.headers.get("idempotency-key")?.trim();
      if (!idempotencyKey || idempotencyKey.length > 200) {
        return json({ error: "a valid Idempotency-Key header is required" }, 400);
      }
      const policy = await getActivePolicy(env.DB);
      if (!policy) return json({ error: "approve a source policy first" }, 409);
      const run = await runIngestion({
        db: env.DB,
        policy,
        trigger: "operator",
        idempotencyKey,
        actorId: actor,
        signal: request.signal,
      });
      return json({ run }, 201);
    }
    if (request.method === "GET" && url.pathname === "/api/sources/runs") {
      return json({ runs: await listRuns(env.DB, Number(url.searchParams.get("limit") ?? "5")) });
    }
    if (request.method === "GET" && url.pathname === "/api/sources/records") {
      const classification = url.searchParams.get("classification");
      const allowed = ["safe", "exact-duplicate", "changed", "exception"] as const;
      const selected = allowed.find((item) => item === classification);
      return json({ records: await listRecords(env.DB, selected) });
    }
    if (request.method === "POST" && url.pathname === "/api/sources/records/imported") {
      const body = asObject(await readJson(request));
      if (!Array.isArray(body.recordIds) || body.recordIds.some((id) => typeof id !== "string")) {
        return json({ error: "recordIds must be an array of strings" }, 400);
      }
      return json({ acknowledged: await markRecordsImported(env.DB, body.recordIds, actor) });
    }
    if (request.method === "GET" && url.pathname === "/api/sources/audit") {
      const result = await env.DB.prepare(
        "SELECT sequence, id, occurred_at, actor_id, event_type, aggregate_type, aggregate_id, metadata_json, previous_hash, event_hash FROM audit_events ORDER BY sequence ASC",
      ).all<Record<string, unknown>>();
      return new Response(canonicalJson({ events: result.results }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": "attachment; filename=tradewind-source-audit.json",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }
    return json({ error: "source API route not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "source API request failed";
    const status = /already in progress|no longer active/i.test(message) ? 409 : 400;
    return json({ error: message }, status);
  }
}

