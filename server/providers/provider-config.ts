export interface ProviderEnvironment {
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_AGENT_ID?: string;
  ELEVENLABS_PHONE_ID?: string;
  ELEVENLABS_WEBHOOK_SECRET?: string;
  RENTCAST_API_KEY?: string;
  SKIP_TRACING_API_KEY?: string;
  SKIP_TRACING_API_URL?: string;
}

export function requiredSecret(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is not configured`);
  return value.trim();
}
