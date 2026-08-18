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
  const nextWorkspace = { ...data.sellerPropertyWorkspace };
  for (const key of WORKSPACE_KEYS) {
    const existingIds = new Set(nextWorkspace[key].map((item) => item.id));
    nextWorkspace[key] = [
      ...nextWorkspace[key],
      ...workspace[key].filter((item) => !existingIds.has(item.id)),
    ];
  }
  return {
    ...data,
    deals,
    sellerPropertyWorkspace: nextWorkspace,
  };
}
