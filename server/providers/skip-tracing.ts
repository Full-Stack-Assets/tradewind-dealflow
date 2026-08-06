import { requiredSecret, type ProviderEnvironment } from "./provider-config.ts";

export interface SkipTracingRequest {
  parcelId: string;
  address: string;
  sourceReference: string;
}

export interface SkipTracingResult {
  status: "matched" | "not_found";
  phone?: string;
  email?: string;
  dnc?: boolean;
}

export interface SkipTracingProvider {
  enrich(request: SkipTracingRequest, signal?: AbortSignal): Promise<SkipTracingResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createConfiguredSkipTracingProvider(
  env: ProviderEnvironment,
  fetchImpl: typeof fetch = fetch,
): SkipTracingProvider {
  return {
    async enrich(request, signal) {
      const apiKey = requiredSecret(env.SKIP_TRACING_API_KEY, "SKIP_TRACING_API_KEY");
      const endpoint = requiredSecret(env.SKIP_TRACING_API_URL, "SKIP_TRACING_API_URL");
      if (!request.parcelId || !request.address || !request.sourceReference) throw new Error("skip-tracing request provenance is incomplete");
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(request),
        signal,
      });
      if (!response.ok) throw new Error(`skip-tracing provider failed with status ${response.status}`);
      const body = await response.json() as unknown;
      if (!isRecord(body)) throw new Error("skip-tracing provider response is invalid");
      const phone = typeof body.phone === "string" ? body.phone : undefined;
      const email = typeof body.email === "string" ? body.email : undefined;
      const dnc = typeof body.dnc === "boolean" ? body.dnc : undefined;
      return phone || email ? { status: "matched", phone, email, dnc } : { status: "not_found", dnc };
    },
  };
}
