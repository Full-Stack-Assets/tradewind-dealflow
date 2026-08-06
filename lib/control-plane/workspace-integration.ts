import {
  hashCanonicalEnvelope,
} from "./control-plane-core.ts";
import type { CanonicalExecutionEnvelope, ConsequentialActionType } from "./control-plane-core.ts";

export interface SellerPropertyWorkspaceDraft {
  workspaceId: string;
  organizationId: string;
  parcelId: string;
  address: string;
  townName: string;
  sellerName?: string;
  sellerPhone?: string; // Kept in local workspace, excluded from MassGIS intake
  agreedPurchasePriceMinorUnits?: number;
  targetAssignmentFeeMinorUnits?: number;
  estimatedRepairsMinorUnits?: number;
  closingDateISO?: string;
  evidenceReferences: CanonicalExecutionEnvelope["evidenceReferences"];
  requestedAtISO?: string;
}

/**
 * Converts a local Seller/Property workspace state into a canonical execution envelope
 * for contract generation or buyer assignment.
 */
export function createEnvelopeFromWorkspaceDraft(
  draft: SellerPropertyWorkspaceDraft,
  actionType: ConsequentialActionType
): { envelope: CanonicalExecutionEnvelope; envelopeHash: string } {
  const requestTimestamp = draft.requestedAtISO ?? new Date().toISOString();
  const envelope: CanonicalExecutionEnvelope = {
    schemaVersion: "tradewind.execution-envelope.v1",
    organizationId: draft.organizationId,
    actionId: `ACT-${draft.parcelId}`,
    actionType,
    propertyId: draft.parcelId,
    destination: {
      type: "CONTROL_PLANE_REVIEW",
      targetSystem: "tradewind-dealflow",
    },
    payload: {
      address: draft.address,
      townName: draft.townName,
      sellerName: draft.sellerName || "Subject to Verification",
      closingDateISO: draft.closingDateISO || "TBD",
      agreedPurchasePriceMinorUnits: draft.agreedPurchasePriceMinorUnits,
      targetAssignmentFeeMinorUnits: draft.targetAssignmentFeeMinorUnits,
      estimatedRepairsMinorUnits: draft.estimatedRepairsMinorUnits,
    },
    evidenceReferences: draft.evidenceReferences,
    requestingActor: {
      actorId: `workspace:${draft.workspaceId}`,
      type: "HUMAN",
      organizationId: draft.organizationId,
      role: "OPERATOR",
    },
    requestTimestamp,
    idempotencyKey: `workspace:${draft.workspaceId}:${actionType}:${draft.parcelId}`,
    policySetVersion: "tradewind.policy.v1",
    workflowVersion: "tradewind.workflow.v1",
  };

  const envelopeHash = hashCanonicalEnvelope(envelope);
  return { envelope, envelopeHash };
}
