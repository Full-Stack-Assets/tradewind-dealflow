export interface ProviderEnvironment {
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_AGENT_ID?: string;
  ELEVENLABS_PHONE_ID?: string;
  ELEVENLABS_WEBHOOK_SECRET?: string;
  RENTCAST_API_KEY?: string;
  RENTCAST_ENABLED?: string;
  RENTCAST_ALLOWED_MARKETS?: string;
  RENTCAST_DATA_USE_APPROVAL?: string;
  SKIP_TRACING_API_KEY?: string;
  SKIP_TRACING_API_URL?: string;
}

export function requiredSecret(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is not configured`);
  return value.trim();
}

export function isRentCastActivated(env: ProviderEnvironment): boolean {
  return Boolean(env.RENTCAST_API_KEY?.trim())
    && env.RENTCAST_ENABLED?.trim().toLowerCase() === "true"
    && env.RENTCAST_DATA_USE_APPROVAL?.trim().toLowerCase() === "approved";
}
