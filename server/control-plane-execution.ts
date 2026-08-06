import {
  evaluateExecutionAuthorization,
  type CanonicalExecutionEnvelope,
  type ExecutionAuthorizationSnapshot,
} from "../lib/control-plane/control-plane-core.ts";

export class ExecutionBlockedError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`authorization blocked: ${reasons.join(", ")}`);
    this.name = "ExecutionBlockedError";
    this.reasons = reasons;
  }
}

export async function executeAuthorizedAction<T>(
  snapshot: ExecutionAuthorizationSnapshot,
  adapter: (envelope: CanonicalExecutionEnvelope) => Promise<T>,
): Promise<T> {
  const authorization = evaluateExecutionAuthorization(snapshot);
  if (!authorization.authorized) throw new ExecutionBlockedError(authorization.reasons);
  return adapter(snapshot.envelope);
}
