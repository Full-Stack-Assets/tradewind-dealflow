import assert from "node:assert/strict";
import test from "node:test";

import { handleAiFieldGeneration } from "../server/ai-field-generation.ts";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://tradewind.example/api/ai/field-generation", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-email": "operator@example.com",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("AI field generation requires an authenticated same-origin request", async () => {
  const unauthenticated = await handleAiFieldGeneration(
    request({ field: "dealDeskSummary", sourceText: "facts" }, { "oai-authenticated-user-email": "" }),
    { OPENAI_API_KEY: "secret" },
    async () => { throw new Error("provider must not be called"); },
  );
  assert.equal(unauthenticated.status, 401);

  const crossOrigin = await handleAiFieldGeneration(
    request({ field: "dealDeskSummary", sourceText: "facts" }, { origin: "https://evil.example" }),
    { OPENAI_API_KEY: "secret" },
    async () => { throw new Error("provider must not be called"); },
  );
  assert.equal(crossOrigin.status, 403);
});

test("AI field generation allowlists fields, redacts contact patterns, and validates structured output", async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const response = await handleAiFieldGeneration(
    request({ field: "dealDeskSummary", sourceText: "Call operator@example.com at (508) 555-0123 about verified facts." }),
    { OPENAI_API_KEY: "secret", OPENAI_MODEL: "test-model" },
    async (url, init) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({
        model: "test-model",
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ text: "Verified facts draft." }) }] }],
      }), { status: 200 });
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { field: "dealDeskSummary", text: "Verified facts draft." });
  assert.equal(captured?.url, "https://api.openai.com/v1/responses");
  const payload = JSON.parse(String(captured?.init?.body)) as Record<string, unknown>;
  assert.equal(payload.store, false);
  assert.equal(payload.model, "test-model");
  assert.deepEqual((payload.text as { format: unknown }).format, {
    type: "json_schema",
    name: "generated_field",
    strict: true,
    schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
  });
  assert.match(JSON.stringify(payload), /\[redacted email\]/);
  assert.doesNotMatch(JSON.stringify(payload), /operator@example\.com|508\D*555\D*0123/);

  const forbidden = await handleAiFieldGeneration(
    request({ field: "ownerContact", sourceText: "do not process" }),
    { OPENAI_API_KEY: "secret" },
    async () => { throw new Error("provider must not be called"); },
  );
  assert.equal(forbidden.status, 400);
});

test("AI field generation fails closed when configuration or provider response is invalid", async () => {
  const missingKey = await handleAiFieldGeneration(
    request({ field: "riskNotes", sourceText: "known uncertainty" }),
    {},
    async () => { throw new Error("provider must not be called"); },
  );
  assert.equal(missingKey.status, 503);

  const badProvider = await handleAiFieldGeneration(
    request({ field: "riskNotes", sourceText: "known uncertainty" }),
    { OPENAI_API_KEY: "secret" },
    async () => new Response(JSON.stringify({ error: { message: "provider details must not escape" } }), { status: 500 }),
  );
  assert.equal(badProvider.status, 502);
  assert.deepEqual(await badProvider.json(), { error: "AI generation is temporarily unavailable." });
});
