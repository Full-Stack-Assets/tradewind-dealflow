import { sha256Hex } from "../sha256.ts";

// ============================================================================
// 1. Required Domain Types
// ============================================================================

export type UUID = string;
export type ISODateTime = string;
export type SHA256Hash = string; // Format: sha256:<64 lowercase hex characters>

export interface Money {
  currency: "USD";
  minorUnits: number; // Integer minor units (e.g. cents)
}

export type PolicyGate =
  | "OUTREACH_CONSENT"
  | "OFFER_THRESHOLD"
  | "CONTRACT_EXECUTION"
  | "SELLER_CONTACT_INGESTION"
  | "DOCUMENT_PUBLISH"
  | "RANGE_PUBLISH"
  | "FACT_SHEET_EXPORT"
  | (string & {});

export type PolicyDecisionResult = "ALLOW" | "DENY" | "REVIEW_REQUIRED";

export type ConsequentialActionType =
  | "SEND_OUTREACH"
  | "SUBMIT_OFFER"
  | "EXECUTE_CONTRACT"
  | "PUBLISH_DOCUMENT"
  | "EXPORT_FACT_SHEET"
  | "INGEST_OWNER_CONTACT"
  | (string & {});

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "INVALIDATED";

export type ActionExecutionState =
  | "DRAFT"
  | "POLICY_EVALUATION"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "READY"
  | "EXECUTING"
  | "EXECUTED"
  | "RECEIPTED"
  | "DENIED"
  | "INVALIDATED"
  | "EXPIRED"
  | "FAILED"
  | "CANCELLED";

export interface ExecutionDestination {
  type: string;
  channelId?: string;
  endpoint?: string;
  targetSystem?: string;
  metadata?: Record<string, unknown>;
}

export interface ActorReference {
  actorId: string;
  type: "HUMAN" | "SYSTEM" | "AGENT";
  email?: string;
  organizationId?: string;
  role?: string;
}

export interface EvidenceReference {
  evidenceId: string;
  type: string;
  contentHash: SHA256Hash;
  retrievedAt: ISODateTime;
  source?: string;
}

export interface CanonicalExecutionEnvelope {
  schemaVersion: number | string;
  actionId: UUID;
  organizationId: UUID;
  actionType: ConsequentialActionType;
  propertyId?: UUID;
  sellerId?: UUID;
  dealId?: UUID;
  documentId?: UUID;
  documentVersion?: string | number;
  destination: ExecutionDestination | string;
  recipient?: string;
  endpointReference?: string;
  payload: Record<string, unknown>;
  requestingActor: ActorReference;
  requestTimestamp: ISODateTime;
  idempotencyKey: string;
  policySetVersion: string;
  workflowVersion: string;
  evidenceReferences: EvidenceReference[];
  executionDeadline?: ISODateTime;
}

export interface ApprovalRequirement {
  requirementId?: string;
  role: string;
  minimumApprovals: number;
  scope?: string;
  separationOfDutiesRequired?: boolean;
}

export interface PolicyEvidenceSnapshot {
  evidenceId: string;
  type: string;
  contentHash: SHA256Hash;
  retrievedAt: ISODateTime;
  current: boolean;
  expiresAt?: ISODateTime;
}

export interface PolicyDecision {
  decisionId?: string;
  gate?: PolicyGate;
  result: PolicyDecisionResult;
  policySetVersion?: string;
  envelopeHash: SHA256Hash;
  actionId: UUID;
  organizationId: UUID;
  actionType?: ConsequentialActionType;
  expiresAt?: ISODateTime;
  requiredApprovals?: ApprovalRequirement[];
  evaluatedAt?: ISODateTime;
}

export interface ApprovalDecision {
  approvalId?: string;
  requestId?: string;
  approver: ActorReference;
  decision: "APPROVE" | "REJECT";
  decidedAt: ISODateTime;
  expiresAt?: ISODateTime;
  comments?: string;
}

export interface ApprovalInvalidation {
  invalidationId?: string;
  reason: string;
  invalidatedAt: ISODateTime;
  invalidatedBy?: ActorReference;
}

export interface ApprovalRequest {
  requestId: UUID;
  actionId: UUID;
  organizationId: UUID;
  actionType: ConsequentialActionType;
  envelopeHash: SHA256Hash;
  requirement: ApprovalRequirement;
  requestedAt: ISODateTime;
  expiresAt?: ISODateTime;
  status?: ApprovalStatus;
  decisions?: ApprovalDecision[];
  invalidations?: ApprovalInvalidation[];
}

export interface ResolvedApproverAuthority {
  authorityId?: string;
  actorId: string;
  organizationId: UUID;
  role: string;
  scope: string;
  activeFrom: ISODateTime;
  activeUntil?: ISODateTime;
  revoked?: boolean;
  revokedAt?: ISODateTime;
}

export interface ExecutionErrorDetails {
  code: string;
  message: string;
  details?: unknown;
  timestamp?: ISODateTime;
}

export interface ExecutionAuthorizationSnapshot {
  actionState: ActionExecutionState;
  actionId: UUID;
  organizationId: UUID;
  actionType: ConsequentialActionType;
  envelope: CanonicalExecutionEnvelope;
  computedEnvelopeHash?: SHA256Hash;
  policyDecision: PolicyDecision;
  approvalRequests?: ApprovalRequest[];
  approverAuthorities?: ResolvedApproverAuthority[];
  evidenceSnapshots?:
    | EvidenceReference[]
    | PolicyEvidenceSnapshot[]
    | Record<string, { current: boolean; contentHash?: SHA256Hash; expiresAt?: ISODateTime }>;
  adapterId?: string;
  authorizedAdapters?: string[];
  globalKillSwitch: boolean;
  channelKillSwitch?: boolean;
  currentTime: ISODateTime;
  unresolvedPriorAttempts?: Array<{ attemptId: string; outcome: string }>;
}

export interface ExecutionAuthorizationResult {
  authorized: boolean;
  reasons: string[];
}

// ============================================================================
// 2. Canonicalization Engine
// ============================================================================

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalizationError";
  }
}

export function canonicalize(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return undefined as unknown as string;
  }

  const type = typeof value;

  if (type === "boolean") {
    return value ? "true" : "false";
  }

  if (type === "string") {
    return JSON.stringify(value);
  }

  if (type === "number") {
    const num = value as number;
    if (Number.isNaN(num)) {
      throw new CanonicalizationError("NaN is not supported in canonicalization");
    }
    if (!Number.isFinite(num)) {
      throw new CanonicalizationError("Infinity is not supported in canonicalization");
    }
    if (!Number.isInteger(num)) {
      throw new CanonicalizationError(`Floating-point number ${num} is not supported`);
    }
    if (!Number.isSafeInteger(num)) {
      throw new CanonicalizationError(`Non-safe integer ${num} is not supported`);
    }
    return String(num);
  }

  if (type === "bigint") {
    throw new CanonicalizationError("BigInt is not supported in canonicalization");
  }

  if (type === "symbol") {
    throw new CanonicalizationError("Symbol is not supported in canonicalization");
  }

  if (type === "function") {
    throw new CanonicalizationError("Function is not supported in canonicalization");
  }

  if (type === "object") {
    if (value instanceof Date) {
      throw new CanonicalizationError("Date instances are not supported in canonicalization");
    }
    if (value instanceof Map) {
      throw new CanonicalizationError("Map instances are not supported in canonicalization");
    }
    if (value instanceof Set) {
      throw new CanonicalizationError("Set instances are not supported in canonicalization");
    }
    if (ArrayBuffer.isView(value)) {
      throw new CanonicalizationError("Typed arrays are not supported in canonicalization");
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype && proto !== Array.prototype) {
      throw new CanonicalizationError("Class instances or objects with custom prototypes are not supported");
    }

    if (Array.isArray(value)) {
      const parts: string[] = [];
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item === undefined) {
          throw new CanonicalizationError(`Rejecting undefined array element at index ${i}`);
        }
        const itemStr = canonicalize(item);
        if (itemStr === undefined) {
          throw new CanonicalizationError(`Unsupported value in array at index ${i}`);
        }
        parts.push(itemStr);
      }
      return `[${parts.join(",")}]`;
    }

    // Plain object: sort keys lexicographically and omit undefined values
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs: string[] = [];

    for (const key of keys) {
      const val = obj[key];
      if (val === undefined) {
        continue; // Rule 5: Omit undefined object properties
      }
      const valStr = canonicalize(val);
      if (valStr !== undefined) {
        pairs.push(`${JSON.stringify(key)}:${valStr}`);
      }
    }

    return `{${pairs.join(",")}}`;
  }

  throw new CanonicalizationError(`Unsupported type '${type}' in canonicalization`);
}

export function normalizeEvidenceReference(ref: EvidenceReference): EvidenceReference {
  if (!ref || typeof ref !== "object") {
    throw new CanonicalizationError("Invalid EvidenceReference");
  }
  const normalized: EvidenceReference = {
    evidenceId: String(ref.evidenceId),
    type: String(ref.type),
    contentHash: String(ref.contentHash),
    retrievedAt: String(ref.retrievedAt),
  };
  if (ref.source !== undefined) {
    normalized.source = String(ref.source);
  }
  return normalized;
}

export function compareEvidenceReferences(a: EvidenceReference, b: EvidenceReference): number {
  const normA = normalizeEvidenceReference(a);
  const normB = normalizeEvidenceReference(b);

  const idCmp = normA.evidenceId.localeCompare(normB.evidenceId);
  if (idCmp !== 0) return idCmp;

  const typeCmp = normA.type.localeCompare(normB.type);
  if (typeCmp !== 0) return typeCmp;

  const hashCmp = normA.contentHash.localeCompare(normB.contentHash);
  if (hashCmp !== 0) return hashCmp;

  const dateCmp = normA.retrievedAt.localeCompare(normB.retrievedAt);
  if (dateCmp !== 0) return dateCmp;

  const sourceA = normA.source ?? "";
  const sourceB = normB.source ?? "";
  return sourceA.localeCompare(sourceB);
}

export function normalizeEnvelope(envelope: CanonicalExecutionEnvelope): CanonicalExecutionEnvelope {
  if (!envelope || typeof envelope !== "object") {
    throw new CanonicalizationError("Invalid CanonicalExecutionEnvelope");
  }

  const normalized: Record<string, unknown> = {};

  for (const key of Object.keys(envelope)) {
    const val = (envelope as unknown as Record<string, unknown>)[key];
    if (val !== undefined) {
      normalized[key] = val;
    }
  }

  if (Array.isArray(envelope.evidenceReferences)) {
    const normRefs = envelope.evidenceReferences.map((ref) => normalizeEvidenceReference(ref));
    normRefs.sort(compareEvidenceReferences);
    normalized.evidenceReferences = normRefs;
  }

  return normalized as unknown as CanonicalExecutionEnvelope;
}

export function hashCanonicalEnvelope(envelope: CanonicalExecutionEnvelope): SHA256Hash {
  const normalized = normalizeEnvelope(envelope);
  const jsonText = canonicalize(normalized);
  const hex = sha256Hex(jsonText);
  return `sha256:${hex.toLowerCase()}`;
}

// ============================================================================
// 3. Finite State Machine (FSM)
// ============================================================================

export const ALLOWED_TRANSITIONS: Record<ActionExecutionState, ReadonlyArray<ActionExecutionState>> = {
  DRAFT: ["POLICY_EVALUATION", "CANCELLED"],
  POLICY_EVALUATION: ["REVIEW_REQUIRED", "READY", "DENIED", "INVALIDATED", "FAILED"],
  REVIEW_REQUIRED: ["APPROVED", "DENIED", "INVALIDATED", "EXPIRED", "CANCELLED"],
  APPROVED: ["READY", "INVALIDATED", "EXPIRED", "CANCELLED"],
  READY: ["EXECUTING", "INVALIDATED", "EXPIRED", "CANCELLED"],
  EXECUTING: ["EXECUTED", "FAILED"],
  EXECUTED: ["RECEIPTED", "FAILED"],
  INVALIDATED: ["POLICY_EVALUATION", "CANCELLED"],
  EXPIRED: ["POLICY_EVALUATION", "CANCELLED"],
  FAILED: ["POLICY_EVALUATION", "CANCELLED"],
  RECEIPTED: [],
  DENIED: [],
  CANCELLED: [],
};

export class InvalidStateTransitionError extends Error {
  readonly fromState: ActionExecutionState;
  readonly toState: ActionExecutionState;

  constructor(fromState: ActionExecutionState, toState: ActionExecutionState) {
    super(`Invalid state transition from '${fromState}' to '${toState}'`);
    this.name = "InvalidStateTransitionError";
    this.fromState = fromState;
    this.toState = toState;
  }
}

export function isTransitionAllowed(fromState: ActionExecutionState, toState: ActionExecutionState): boolean {
  const allowed = ALLOWED_TRANSITIONS[fromState];
  if (!allowed) return false;
  return allowed.includes(toState);
}

export function assertTransitionAllowed(fromState: ActionExecutionState, toState: ActionExecutionState): void {
  if (!isTransitionAllowed(fromState, toState)) {
    throw new InvalidStateTransitionError(fromState, toState);
  }
}

// ============================================================================
// 4. Execution Authorization Predicate
// ============================================================================

export const AUTHORIZATION_FAILURE_CODES = {
  ACTION_NOT_READY: "ACTION_NOT_READY",
  ORGANIZATION_MISMATCH: "ORGANIZATION_MISMATCH",
  ACTION_ID_MISMATCH: "ACTION_ID_MISMATCH",
  ACTION_TYPE_MISMATCH: "ACTION_TYPE_MISMATCH",
  POLICY_ENVELOPE_HASH_MISMATCH: "POLICY_ENVELOPE_HASH_MISMATCH",
  POLICY_EXPIRED: "POLICY_EXPIRED",
  POLICY_DENIED: "POLICY_DENIED",
  NO_APPROVAL_REQUIREMENTS_DECLARED: "NO_APPROVAL_REQUIREMENTS_DECLARED",
  MISSING_APPROVAL: "MISSING_APPROVAL",
  APPROVAL_EXPIRED: "APPROVAL_EXPIRED",
  APPROVAL_ENVELOPE_MISMATCH: "APPROVAL_ENVELOPE_MISMATCH",
  APPROVAL_ACTION_MISMATCH: "APPROVAL_ACTION_MISMATCH",
  APPROVAL_ORGANIZATION_MISMATCH: "APPROVAL_ORGANIZATION_MISMATCH",
  APPROVAL_TARGET_ACTION_MISMATCH: "APPROVAL_TARGET_ACTION_MISMATCH",
  UNAUTHORIZED_APPROVER_ROLE: "UNAUTHORIZED_APPROVER_ROLE",
  AUTHORITY_SCOPE_MISMATCH: "AUTHORITY_SCOPE_MISMATCH",
  AUTHORITY_REVOKED: "AUTHORITY_REVOKED",
  AUTHORITY_INACTIVE_FUTURE: "AUTHORITY_INACTIVE_FUTURE",
  AUTHORITY_EXPIRED: "AUTHORITY_EXPIRED",
  SEPARATION_OF_DUTIES_VIOLATION: "SEPARATION_OF_DUTIES_VIOLATION",
  GLOBAL_KILL_SWITCH_ACTIVE: "GLOBAL_KILL_SWITCH_ACTIVE",
  CHANNEL_KILL_SWITCH_ACTIVE: "CHANNEL_KILL_SWITCH_ACTIVE",
  STALE_EVIDENCE: "STALE_EVIDENCE",
  UNAUTHORIZED_ADAPTER: "UNAUTHORIZED_ADAPTER",
  UNRESOLVED_EXECUTION_ATTEMPT: "UNRESOLVED_EXECUTION_ATTEMPT",
  EXECUTION_DEADLINE_ELAPSED: "EXECUTION_DEADLINE_ELAPSED",
  MALFORMED_SNAPSHOT: "MALFORMED_SNAPSHOT",
} as const;

export function evaluateExecutionAuthorization(
  snapshot: ExecutionAuthorizationSnapshot,
): ExecutionAuthorizationResult {
  const reasons: string[] = [];

  if (!snapshot || typeof snapshot !== "object" || !snapshot.envelope || !snapshot.currentTime) {
    return {
      authorized: false,
      reasons: [AUTHORIZATION_FAILURE_CODES.MALFORMED_SNAPSHOT],
    };
  }

  const {
    actionState,
    actionId,
    organizationId,
    actionType,
    envelope,
    computedEnvelopeHash,
    policyDecision,
    approvalRequests = [],
    approverAuthorities = [],
    evidenceSnapshots,
    adapterId,
    authorizedAdapters,
    globalKillSwitch,
    channelKillSwitch,
    currentTime,
    unresolvedPriorAttempts = [],
  } = snapshot;

  const now = new Date(currentTime).getTime();

  // 1. Validate action state is READY
  if (actionState !== "READY") {
    reasons.push(AUTHORIZATION_FAILURE_CODES.ACTION_NOT_READY);
  }

  // 2. Validate global kill switch is inactive
  if (globalKillSwitch === true) {
    reasons.push(AUTHORIZATION_FAILURE_CODES.GLOBAL_KILL_SWITCH_ACTIVE);
  }

  // 3. Validate channel kill switch is inactive when represented
  if (channelKillSwitch === true) {
    reasons.push(AUTHORIZATION_FAILURE_CODES.CHANNEL_KILL_SWITCH_ACTIVE);
  }

  // 4. Validate organization ID alignment
  if (organizationId !== envelope.organizationId || (policyDecision && policyDecision.organizationId !== organizationId)) {
    reasons.push(AUTHORIZATION_FAILURE_CODES.ORGANIZATION_MISMATCH);
  }

  // 5. Validate action ID alignment
  if (actionId !== envelope.actionId || (policyDecision && policyDecision.actionId !== actionId)) {
    reasons.push(AUTHORIZATION_FAILURE_CODES.ACTION_ID_MISMATCH);
  }

  // 6. Validate action type alignment
  if (actionType !== envelope.actionType || (policyDecision && policyDecision.actionType && policyDecision.actionType !== actionType)) {
    reasons.push(AUTHORIZATION_FAILURE_CODES.ACTION_TYPE_MISMATCH);
  }

  // 7. Validate envelope hash
  let expectedHash: SHA256Hash;
  try {
    expectedHash = hashCanonicalEnvelope(envelope);
  } catch {
    reasons.push(AUTHORIZATION_FAILURE_CODES.MALFORMED_SNAPSHOT);
    expectedHash = "";
  }

  if (computedEnvelopeHash && computedEnvelopeHash !== expectedHash) {
    reasons.push(AUTHORIZATION_FAILURE_CODES.POLICY_ENVELOPE_HASH_MISMATCH);
  }

  if (policyDecision && policyDecision.envelopeHash !== expectedHash) {
    reasons.push(AUTHORIZATION_FAILURE_CODES.POLICY_ENVELOPE_HASH_MISMATCH);
  }

  // 8. Validate policy result
  if (policyDecision) {
    if (policyDecision.result === "DENY") {
      reasons.push(AUTHORIZATION_FAILURE_CODES.POLICY_DENIED);
    }

    if (policyDecision.expiresAt) {
      const policyExp = new Date(policyDecision.expiresAt).getTime();
      if (now >= policyExp) {
        reasons.push(AUTHORIZATION_FAILURE_CODES.POLICY_EXPIRED);
      }
    }
  }

  // 9. Validate execution deadline
  if (envelope.executionDeadline) {
    const deadline = new Date(envelope.executionDeadline).getTime();
    if (now >= deadline) {
      reasons.push(AUTHORIZATION_FAILURE_CODES.EXECUTION_DEADLINE_ELAPSED);
    }
  }

  // 10. Validate adapter authorization
  if (adapterId !== undefined) {
    if (authorizedAdapters && !authorizedAdapters.includes(adapterId)) {
      reasons.push(AUTHORIZATION_FAILURE_CODES.UNAUTHORIZED_ADAPTER);
    }
  }

  // 11. Validate unresolved prior execution attempts
  if (Array.isArray(unresolvedPriorAttempts) && unresolvedPriorAttempts.length > 0) {
    const hasUnknown = unresolvedPriorAttempts.some(
      (attempt) => attempt.outcome === "EXECUTION_OUTCOME_UNKNOWN",
    );
    if (hasUnknown) {
      reasons.push(AUTHORIZATION_FAILURE_CODES.UNRESOLVED_EXECUTION_ATTEMPT);
    }
  }

  // 12. Validate evidence currency
  if (Array.isArray(envelope.evidenceReferences) && envelope.evidenceReferences.length > 0) {
    for (const ref of envelope.evidenceReferences) {
      let isCurrent = false;

      if (Array.isArray(evidenceSnapshots)) {
        const snap = (evidenceSnapshots as Array<EvidenceReference | PolicyEvidenceSnapshot>).find(
          (s) => s.evidenceId === ref.evidenceId || s.type === ref.type,
        );
        if (snap) {
          const contentMatch = snap.contentHash === ref.contentHash;
          const snapCurrent = "current" in snap ? snap.current : true;
          const notExpired = !("expiresAt" in snap) || !snap.expiresAt || new Date(snap.expiresAt).getTime() > now;
          if (contentMatch && snapCurrent && notExpired) {
            isCurrent = true;
          }
        }
      } else if (evidenceSnapshots && typeof evidenceSnapshots === "object") {
        const snapMap = evidenceSnapshots as Record<string, { current: boolean; contentHash?: SHA256Hash; expiresAt?: ISODateTime }>;
        const snap = snapMap[ref.evidenceId] || snapMap[ref.type];
        if (snap) {
          const contentMatch = !snap.contentHash || snap.contentHash === ref.contentHash;
          const notExpired = !snap.expiresAt || new Date(snap.expiresAt).getTime() > now;
          if (snap.current && contentMatch && notExpired) {
            isCurrent = true;
          }
        }
      }

      if (!isCurrent) {
        reasons.push(AUTHORIZATION_FAILURE_CODES.STALE_EVIDENCE);
      }
    }
  }

  // 13. Validate approval requirements if REVIEW_REQUIRED
  if (policyDecision && policyDecision.result === "REVIEW_REQUIRED") {
    const reqs = policyDecision.requiredApprovals;
    if (!reqs || reqs.length === 0) {
      reasons.push(AUTHORIZATION_FAILURE_CODES.NO_APPROVAL_REQUIREMENTS_DECLARED);
    } else {
      for (const req of reqs) {
        // Collect all approval decisions for this requirement
        const validApproverActorIds = new Set<string>();

        for (const reqObj of approvalRequests) {
          // Verify approval request alignment
          if (reqObj.envelopeHash !== expectedHash) {
            reasons.push(AUTHORIZATION_FAILURE_CODES.APPROVAL_ENVELOPE_MISMATCH);
          }
          if (reqObj.actionId !== actionId) {
            reasons.push(AUTHORIZATION_FAILURE_CODES.APPROVAL_ACTION_MISMATCH);
          }
          if (reqObj.organizationId !== organizationId) {
            reasons.push(AUTHORIZATION_FAILURE_CODES.APPROVAL_ORGANIZATION_MISMATCH);
          }
          if (reqObj.actionType !== actionType) {
            reasons.push(AUTHORIZATION_FAILURE_CODES.APPROVAL_TARGET_ACTION_MISMATCH);
          }
          if (reqObj.expiresAt && new Date(reqObj.expiresAt).getTime() <= now) {
            reasons.push(AUTHORIZATION_FAILURE_CODES.APPROVAL_EXPIRED);
          }

          if (reqObj.decisions && Array.isArray(reqObj.decisions)) {
            for (const dec of reqObj.decisions) {
              if (dec.decision !== "APPROVE") continue;

              if (dec.expiresAt && new Date(dec.expiresAt).getTime() <= now) {
                reasons.push(AUTHORIZATION_FAILURE_CODES.APPROVAL_EXPIRED);
                continue;
              }

              const approver = dec.approver;
              if (!approver || !approver.actorId) continue;

              // Check approver authority
              const authority = approverAuthorities.find(
                (auth) => auth.actorId === approver.actorId,
              );

              if (!authority) {
                reasons.push(AUTHORIZATION_FAILURE_CODES.UNAUTHORIZED_APPROVER_ROLE);
                continue;
              }

              if (authority.organizationId !== organizationId) {
                reasons.push(AUTHORIZATION_FAILURE_CODES.APPROVAL_ORGANIZATION_MISMATCH);
                continue;
              }

              if (authority.role !== req.role) {
                reasons.push(AUTHORIZATION_FAILURE_CODES.UNAUTHORIZED_APPROVER_ROLE);
                continue;
              }

              if (
                req.scope &&
                authority.scope !== req.scope &&
                authority.scope !== "GLOBAL" &&
                authority.scope !== "ALL"
              ) {
                reasons.push(AUTHORIZATION_FAILURE_CODES.AUTHORITY_SCOPE_MISMATCH);
                continue;
              }

              if (authority.revoked || (authority.revokedAt && new Date(authority.revokedAt).getTime() <= now)) {
                reasons.push(AUTHORIZATION_FAILURE_CODES.AUTHORITY_REVOKED);
                continue;
              }

              if (new Date(authority.activeFrom).getTime() > now) {
                reasons.push(AUTHORIZATION_FAILURE_CODES.AUTHORITY_INACTIVE_FUTURE);
                continue;
              }

              if (authority.activeUntil && new Date(authority.activeUntil).getTime() <= now) {
                reasons.push(AUTHORIZATION_FAILURE_CODES.AUTHORITY_EXPIRED);
                continue;
              }

              // Check Separation of Duties
              if (req.separationOfDutiesRequired) {
                if (approver.actorId === envelope.requestingActor.actorId) {
                  reasons.push(AUTHORIZATION_FAILURE_CODES.SEPARATION_OF_DUTIES_VIOLATION);
                  continue;
                }
              }

              // Distinct human approver satisfied
              validApproverActorIds.add(approver.actorId);
            }
          }
        }

        if (validApproverActorIds.size < req.minimumApprovals) {
          reasons.push(AUTHORIZATION_FAILURE_CODES.MISSING_APPROVAL);
        }
      }
    }
  }

  // Deduplicate failure reasons
  const uniqueReasons = Array.from(new Set(reasons));

  return {
    authorized: uniqueReasons.length === 0,
    reasons: uniqueReasons,
  };
}
