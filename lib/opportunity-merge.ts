import type { DealFlowData, DealRecord, SellerPropertyWorkspace } from "./types.ts";

const WORKSPACE_KEYS = [
  "conversationLogs",
  "tasks",
  "comparableRanges",
  "repairRanges",
  "documents",
  "reviewDrafts",
  "approvalRequests",
] as const;

export function workspaceSliceForDeal(
  workspace: SellerPropertyWorkspace,
  dealId: string,
): SellerPropertyWorkspace {
  return {
    conversationLogs: workspace.conversationLogs.filter((item) => item.propertyRecordId === dealId),
    tasks: workspace.tasks.filter((item) => item.propertyRecordId === dealId),
    comparableRanges: workspace.comparableRanges.filter((item) => item.propertyRecordId === dealId),
    repairRanges: workspace.repairRanges.filter((item) => item.propertyRecordId === dealId),
    documents: workspace.documents.filter((item) => item.propertyRecordId === dealId),
    reviewDrafts: workspace.reviewDrafts.filter((item) => item.propertyRecordId === dealId),
    approvalRequests: workspace.approvalRequests.filter((item) => item.propertyRecordId === dealId),
  };
}

export function mergeDealIntoWorkspace(
  data: DealFlowData,
  deal: DealRecord,
  workspace: SellerPropertyWorkspace = {
    conversationLogs: [],
    tasks: [],
    comparableRanges: [],
    repairRanges: [],
    documents: [],
    reviewDrafts: [],
    approvalRequests: [],
  },
): DealFlowData {
  const hasDeal = data.deals.some((item) => item.id === deal.id);
  const addedAny = WORKSPACE_KEYS.some((key) => {
    const existingIds = new Set(data.sellerPropertyWorkspace[key].map((item) => item.id));
    return workspace[key].some((item) => !existingIds.has(item.id));
  });
  if (hasDeal && !addedAny) return data;

  const deals = hasDeal
    ? data.deals.map((item) => (item.id === deal.id ? deal : item))
    : [...data.deals, deal];
  const nextWorkspace: SellerPropertyWorkspace = {
    conversationLogs: mergeById(data.sellerPropertyWorkspace.conversationLogs, workspace.conversationLogs),
    tasks: mergeById(data.sellerPropertyWorkspace.tasks, workspace.tasks),
    comparableRanges: mergeById(data.sellerPropertyWorkspace.comparableRanges, workspace.comparableRanges),
    repairRanges: mergeById(data.sellerPropertyWorkspace.repairRanges, workspace.repairRanges),
    documents: mergeById(data.sellerPropertyWorkspace.documents, workspace.documents),
    reviewDrafts: mergeById(data.sellerPropertyWorkspace.reviewDrafts, workspace.reviewDrafts),
    approvalRequests: mergeById(data.sellerPropertyWorkspace.approvalRequests, workspace.approvalRequests),
  };
  return {
    ...data,
    deals,
    sellerPropertyWorkspace: nextWorkspace,
  };
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const existingIds = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !existingIds.has(item.id))];
}
