import assert from "node:assert/strict";
import test from "node:test";

import {
  createRentCastProvider,
  RentCastProviderError,
} from "../server/providers/rentcast.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("sends a bounded, server-authenticated RentCast property search", async () => {
  let request: Request | undefined;
  const provider = createRentCastProvider(
    { RENTCAST_API_KEY: "test-only-not-a-real-key" },
    async (input, init) => {
      request = new Request(input, init);
      return jsonResponse([
        {
          id: "rc_123",
          addressLine1: "123 Main Street",
          city: "Fall River",
          state: "MA",
          zipCode: "02720",
          owner: { names: ["Example Owner"] },
        },
      ]);
    },
  );

  const result = await provider.searchProperties({ city: "Fall River", state: "ma", limit: 999, offset: 4 });
  assert.ok(request);
  const url = new URL(request.url);
  assert.equal(request.method, "GET");
  assert.equal(request.headers.get("X-Api-Key"), "test-only-not-a-real-key");
  assert.equal(url.origin, "https://api.rentcast.io");
  assert.equal(url.pathname, "/v1/properties");
  assert.equal(url.searchParams.get("city"), "Fall River");
  assert.equal(url.searchParams.get("state"), "MA");
  assert.equal(url.searchParams.get("limit"), "500");
  assert.equal(url.searchParams.get("offset"), "4");
  assert.equal(url.searchParams.get("includeTotalCount"), "true");
  assert.equal(result.properties[0]?.provider, "rentcast");
  assert.equal(result.nextOffset, null);
});

test("fails before network access when the runtime secret is absent", async () => {
  let called = false;
  const provider = createRentCastProvider({}, async () => {
    called = true;
    return jsonResponse([]);
  });

  await assert.rejects(
    provider.searchProperties({ zipCode: "02720" }),
    /RENTCAST_API_KEY is not configured/,
  );
  assert.equal(called, false);
});

test("retries one transient provider response and returns safe errors for auth failures", async () => {
  let calls = 0;
  const provider = createRentCastProvider(
    { RENTCAST_API_KEY: "test-only-not-a-real-key" },
    async () => {
      calls += 1;
      return calls === 1
        ? new Response("busy", { status: 503 })
        : jsonResponse({ data: [], totalCount: 0 });
    },
  );
  assert.deepEqual(await provider.searchProperties({ address: "123 Main Street" }), {
    properties: [],
    totalCount: 0,
    nextOffset: null,
  });
  assert.equal(calls, 2);

  const unauthorized = createRentCastProvider(
    { RENTCAST_API_KEY: "test-only-not-a-real-key" },
    async () => new Response("unauthorized details", { status: 401 }),
  );
  await assert.rejects(
    unauthorized.searchProperties({ address: "123 Main Street" }),
    (error: unknown) => error instanceof RentCastProviderError
      && error.status === 401
      && error.retryable === false
      && error.message === "RentCast property search failed",
  );
});

test("requires a bounded location search", async () => {
  const provider = createRentCastProvider({ RENTCAST_API_KEY: "test-only-not-a-real-key" });
  await assert.rejects(
    provider.searchProperties({ limit: 1 }),
    /requires address, zipCode, or city and state/,
  );
});
