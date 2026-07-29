import {
  adaptQualificationForLaunch,
  type LaunchQualificationStatus,
} from "./launch-qualification.ts";
import {
  rankResearchQueue,
  type QualificationResult,
  type ResearchPriorityLabel,
} from "./qualification.ts";
import type { MutationResult, StorageReadResult } from "./local-storage.ts";
import type { DealFlowData } from "./types.ts";

const LAUNCH_STATUSES: LaunchQualificationStatus[] = [
  "Qualified",
  "Possible",
  "Research required",
  "Disqualified",
  "Compliance or specialist review",
];

export type LeadResearchItem = {
  dealId: string;
  address: string;
  location: string;
  href: string;
  priorityScore: number;
  priorityLabel: ResearchPriorityLabel;
  taskType: string;
  reason: string;
  qualificationStatus: LaunchQualificationStatus;
  qualificationScore: number | null;
  qualificationScoreLabel: QualificationResult["scoreLabel"];
};

export type LeadOperatingSnapshot = {
  buyBox: {
    configured: boolean;
    version: number;
  };
  propertyRecordCount: number;
  importedPropertyCount: number;
  qualificationCounts: Record<LaunchQualificationStatus, number>;
  dataGaps: {
    missingProvenanceRecords: number;
    unknownConfidenceRecords: number;
    missingVerificationRecords: number;
  };
  integrity: {
    unresolvedConflicts: number;
    activeRestrictions: number;
    recordsNeedingRemediation: number;
  };
  blocked: {
    contactBlockedRecords: number;
    complianceReviewRecords: number;
  };
  researchItems: LeadResearchItem[];
};

type LeadDashboardMutationIssue =
  Exclude<MutationResult, { ok: true }>["code"];

export type LeadDashboardAccess = {
  state: "loading" | "ready" | "corrupt" | "unavailable";
  snapshotAvailable: boolean;
  safeWritesAvailable: boolean;
};

export function resolveLeadDashboardAccess({
  hydrated,
  storageReadStatus,
  mutationIssue,
  writesSupported,
}: {
  hydrated: boolean;
  storageReadStatus: StorageReadResult["status"];
  mutationIssue: LeadDashboardMutationIssue | null;
  writesSupported: boolean;
}): LeadDashboardAccess {
  if (!hydrated) {
    return {
      state: "loading",
      snapshotAvailable: false,
      safeWritesAvailable: false,
    };
  }
  if (storageReadStatus === "corrupt" || mutationIssue === "corrupt") {
    return {
      state: "corrupt",
      snapshotAvailable: false,
      safeWritesAvailable: false,
    };
  }
  if (mutationIssue === "unavailable") {
    return {
      state: "unavailable",
      snapshotAvailable: false,
      safeWritesAvailable: false,
    };
  }
  const writeCapabilityBlocked =
    mutationIssue === "unsupported-lock" || mutationIssue === "quota";
  return {
    state: "ready",
    snapshotAvailable: true,
    safeWritesAvailable: writesSupported && !writeCapabilityBlocked,
  };
}

export function buildLeadOperatingSnapshot(
  data: DealFlowData,
  evaluationDate: Date,
): LeadOperatingSnapshot {
  const ranked = rankResearchQueue(
    data.deals,
    data.buyBox,
    evaluationDate,
  );
  const qualificationCounts = Object.fromEntries(
    LAUNCH_STATUSES.map((status) => [status, 0]),
  ) as Record<LaunchQualificationStatus, number>;

  let missingProvenanceRecords = 0;
  let unknownConfidenceRecords = 0;
  let missingVerificationRecords = 0;
  let unresolvedConflicts = 0;
  let activeRestrictions = 0;
  let recordsNeedingRemediation = 0;
  let contactBlockedRecords = 0;
  let complianceReviewRecords = 0;

  const dealById = new Map(data.deals.map((deal) => [deal.id, deal]));
  for (const item of ranked) {
    const deal = dealById.get(item.dealId);
    if (deal === undefined) continue;
    const launch = adaptQualificationForLaunch(item.qualification);
    qualificationCounts[launch.status] += 1;

    const missingProvenance = deal.sourceAssertions.length === 0;
    const unknownConfidence = item.qualification.sourceConfidence === null;
    const missingVerification =
      item.qualification.dataFreshness.lastVerifiedAt === null;
    const dealConflicts = deal.factConflicts.filter(
      ({ status }) => status === "Unresolved",
    ).length;
    const dealRestrictions = deal.researchRestrictions.filter(
      ({ resolvedAt }) => resolvedAt === null,
    ).length;

    if (missingProvenance) missingProvenanceRecords += 1;
    if (unknownConfidence) unknownConfidenceRecords += 1;
    if (missingVerification) missingVerificationRecords += 1;
    unresolvedConflicts += dealConflicts;
    activeRestrictions += dealRestrictions;
    if (
      dealConflicts > 0
      || dealRestrictions > 0
      || item.qualification.researchTasks.length > 0
    ) {
      recordsNeedingRemediation += 1;
    }
    if (launch.contact.blocked) contactBlockedRecords += 1;
    if (launch.status === "Compliance or specialist review") {
      complianceReviewRecords += 1;
    }
  }

  const researchItems = ranked.slice(0, 5).flatMap((item) => {
    const deal = dealById.get(item.dealId);
    if (deal === undefined) return [];
    const launch = adaptQualificationForLaunch(item.qualification);
    const task = item.qualification.researchTasks[0];
    return [{
      dealId: deal.id,
      address: deal.address,
      location: [deal.city, deal.state, deal.zip].filter(Boolean).join(", "),
      href: `/pipeline#property-${encodeURIComponent(deal.id)}`,
      priorityScore: item.researchPriority,
      priorityLabel: item.researchPriorityLabel,
      taskType: task?.taskType ?? "Review qualification evidence",
      reason: task?.reason ?? item.recommendedAction,
      qualificationStatus: launch.status,
      qualificationScore: launch.score,
      qualificationScoreLabel: launch.scoreLabel,
    }];
  });

  return {
    buyBox: {
      configured: data.buyBox.configured,
      version: data.buyBox.version,
    },
    propertyRecordCount: data.deals.length,
    importedPropertyCount: data.deals.filter(
      ({ sourceAssertions }) => sourceAssertions.length > 0,
    ).length,
    qualificationCounts,
    dataGaps: {
      missingProvenanceRecords,
      unknownConfidenceRecords,
      missingVerificationRecords,
    },
    integrity: {
      unresolvedConflicts,
      activeRestrictions,
      recordsNeedingRemediation,
    },
    blocked: {
      contactBlockedRecords,
      complianceReviewRecords,
    },
    researchItems,
  };
}
