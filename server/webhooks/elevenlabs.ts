import type { D1Bindings } from "../d1.ts";
import { requiredSecret, type ProviderEnvironment } from "../providers/provider-config.ts";

const MAX_BODY_BYTES = 512 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 300;

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/iu.test(value)) return null;
  return new Uint8Array(value.match(/.{2}/gu)?.map((part) => Number.parseInt(part, 16)) ?? []);
}

function parseSignature(value: string): { timestamp: number; signature: Uint8Array } | null {
  const fields = new Map(value.split(",").map((part) => part.split("=", 2) as [string, string]));
  const timestamp = Number(fields.get("t"));
  const signature = hexToBytes(fields.get("v0") ?? "");
  if (!Number.isInteger(timestamp) || !signature) return null;
  return { timestamp, signature };
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signElevenLabsPayload(rawBody: string, secret: string, timestamp: number): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(`${timestamp}.${rawBody}`));
  return `t=${timestamp},v0=${toHex(signature)}`;
}

export async function verifyElevenLabsSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header || !secret) return false;
  const parsed = parseSignature(header);
  if (!parsed || Math.abs(nowSeconds - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const signatureBytes = new Uint8Array(parsed.signature.length);
  signatureBytes.set(parsed.signature);
  return crypto.subtle.verify("HMAC", await hmacKey(secret), signatureBytes.buffer, new TextEncoder().encode(`${parsed.timestamp}.${rawBody}`));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function handleElevenLabsWebhook(
  request: Request,
  env: D1Bindings & ProviderEnvironment,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) return json({ error: "request body is too large" }, 413);
  const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const secret = requiredSecret(env.ELEVENLABS_WEBHOOK_SECRET, "ELEVENLABS_WEBHOOK_SECRET");
  if (!(await verifyElevenLabsSignature(rawBody, request.headers.get("ElevenLabs-Signature"), secret))) return json({ error: "invalid signature" }, 401);
  let payload: unknown;
  try { payload = JSON.parse(rawBody) as unknown; } catch { return json({ error: "invalid JSON" }, 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ error: "invalid event" }, 400);
  const event = payload as { type?: unknown; event_timestamp?: unknown; data?: unknown };
  if (typeof event.type !== "string" || !event.type || typeof event.event_timestamp !== "number" || !event.data || typeof event.data !== "object") return json({ error: "invalid event" }, 400);
  const data = event.data as Record<string, unknown>;
  const eventId = typeof data.conversation_id === "string" ? data.conversation_id : typeof data.request_id === "string" ? data.request_id : `${event.event_timestamp}:${event.type}:${await sha256(rawBody)}`;
  const receivedAt = new Date().toISOString();
  const result = await env.DB.prepare("INSERT OR IGNORE INTO control_plane_webhook_events (event_id, provider, event_type, payload_json, received_at) VALUES (?, 'elevenlabs', ?, ?, ?)").bind(eventId, event.type, rawBody, receivedAt).run();
    const duplicate = result.meta?.changes === 0;
  return json({ received: true, ...(duplicate ? { duplicate: true } : {}) });
}
