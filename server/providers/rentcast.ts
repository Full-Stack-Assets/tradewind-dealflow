import {
  normalizeRentCastProperties,
  type AutomatedLeadRecord,
} from "../../lib/automation/lead-contracts.ts";
import { requiredSecret, type ProviderEnvironment } from "./provider-config.ts";

const RENTCAST_PROPERTIES_URL = "https://api.rentcast.io/v1/properties";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MAX_RETRIES = 1;
const MAX_RETRY_DELAY_MS = 1_000;

export type RentCastPropertySearchInput = {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  limit?: number;
  offset?: number;
};

export type RentCastPropertySearchResult = {
  properties: AutomatedLeadRecord[];
  totalCount: number | null;
  nextOffset: number | null;
};

export class RentCastProviderError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, status: number | null, retryable: boolean) {
    super(message);
    this.name = "RentCastProviderError";
    this.status = status;
    this.retryable = retryable;
  }
}

export interface RentCastProvider {
  searchProperties(
    input: RentCastPropertySearchInput,
    signal?: AbortSignal,
  ): Promise<RentCastPropertySearchResult>;
}

function boundedInteger(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.max(0, Math.min(max, value as number));
}

function hasSearchLocation(input: RentCastPropertySearchInput): boolean {
  return Boolean(input.address?.trim() || input.zipCode?.trim() || (input.city?.trim() && input.state?.trim()));
}

function retryDelayMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(MAX_RETRY_DELAY_MS, seconds * 1_000)
    : 0;
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs === 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
    }, { once: true });
  });
}

export function createRentCastProvider(
  env: ProviderEnvironment,
  fetchImpl: typeof fetch = fetch,
): RentCastProvider {
  return {
    async searchProperties(input, signal) {
      const apiKey = requiredSecret(env.RENTCAST_API_KEY, "RENTCAST_API_KEY");
      if (!hasSearchLocation(input)) throw new Error("RentCast property search requires address, zipCode, or city and state");

      const limit = boundedInteger(input.limit, DEFAULT_LIMIT, MAX_LIMIT);
      const offset = boundedInteger(input.offset, 0, Number.MAX_SAFE_INTEGER);
      const url = new URL(RENTCAST_PROPERTIES_URL);
      for (const [key, value] of Object.entries({
        address: input.address,
        city: input.city,
        state: input.state?.toUpperCase(),
        zipCode: input.zipCode,
      })) {
        if (value?.trim()) url.searchParams.set(key, value.trim());
      }
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("includeTotalCount", "true");

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        const response = await fetchImpl(url, {
          method: "GET",
          headers: {
            accept: "application/json",
            "X-Api-Key": apiKey,
          },
          signal,
        });
        if (response.ok) {
          const body = await response.json() as unknown;
          const properties = normalizeRentCastProperties(body);
          const totalCount = typeof body === "object" && body !== null && !Array.isArray(body)
            && typeof (body as Record<string, unknown>).totalCount === "number"
            ? (body as Record<string, unknown>).totalCount as number
            : null;
          const nextOffset = properties.length === limit ? offset + properties.length : null;
          return { properties, totalCount, nextOffset };
        }

        const retryable = retryableStatus(response.status);
        if (!retryable || attempt === MAX_RETRIES) {
          throw new RentCastProviderError("RentCast property search failed", response.status, retryable);
        }
        await waitForRetry(retryDelayMs(response), signal);
      }

      throw new RentCastProviderError("RentCast property search failed", null, false);
    },
  };
}
