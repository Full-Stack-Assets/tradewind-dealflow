import { executeAuthorizedAction } from "../control-plane-execution.ts";
import type { ExecutionAuthorizationSnapshot } from "../../lib/control-plane/control-plane-core.ts";
import { requiredSecret, type ProviderEnvironment } from "./provider-config.ts";

export interface ElevenLabsOutboundResult {
  success: boolean;
  conversationId: string | null;
}

export function createElevenLabsOutboundAdapter(
  env: ProviderEnvironment,
  fetchImpl: typeof fetch = fetch,
) {
  return {
    async send(input: { snapshot: ExecutionAuthorizationSnapshot; toNumber: string }): Promise<ElevenLabsOutboundResult> {
      const apiKey = requiredSecret(env.ELEVENLABS_API_KEY, "ELEVENLABS_API_KEY");
      const agentId = requiredSecret(env.ELEVENLABS_AGENT_ID, "ELEVENLABS_AGENT_ID");
      const phoneId = requiredSecret(env.ELEVENLABS_PHONE_ID, "ELEVENLABS_PHONE_ID");
      if (!/^\+[1-9]\d{7,14}$/u.test(input.toNumber)) throw new Error("toNumber must be an E.164 phone number");
      return executeAuthorizedAction(input.snapshot, async () => {
        const response = await fetchImpl("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "xi-api-key": apiKey,
            "idempotency-key": input.snapshot.envelope.idempotencyKey,
          },
          body: JSON.stringify({ agent_id: agentId, agent_phone_number_id: phoneId, to_number: input.toNumber }),
        });
        if (!response.ok) throw new Error(`ElevenLabs outbound call failed with status ${response.status}`);
        const body = await response.json() as { success?: boolean; conversation_id?: string | null };
        return { success: body.success === true, conversationId: body.conversation_id ?? null };
      });
    },
  };
}
