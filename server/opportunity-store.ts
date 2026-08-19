import type { DealRecord, SellerPropertyWorkspace } from "../lib/types.ts";
import type { D1Database } from "./d1.ts";

export type OpportunityWorkspace = SellerPropertyWorkspace;

export type PromotedOpportunity = {
  id: string;
  organizationId: string;
  sourceLeadId: string | null;
  dealId: string;
  deal: DealRecord;
  workspace: OpportunityWorkspace;
  createdAt: string;
  updatedAt: string;
};

type StoredOpportunity = {
  id: string;
  organization_id: string;
  source_lead_id: string | null;
  deal_id: string;
  deal_json: string;
  workspace_json: string;
  created_at: string;
  updated_at: string;
};

export const EMPTY_OPPORTUNITY_WORKSPACE: OpportunityWorkspace = {
  conversationLogs: [],
  tasks: [],
  comparableRanges: [],
  repairRanges: [],
  documents: [],
  reviewDrafts: [],
  approvalRequests: [],
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function fromRow(row: StoredOpportunity): PromotedOpportunity {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceLeadId: row.source_lead_id,
    dealId: row.deal_id,
    deal: parseJson(row.deal_json, {} as DealRecord),
    workspace: parseJson(row.workspace_json, EMPTY_OPPORTUNITY_WORKSPACE),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOpportunityByLead(
  db: D1Database,
  organizationId: string,
  sourceLeadId: string,
): Promise<PromotedOpportunity | null> {
  const row = await db
    .prepare(
      "SELECT * FROM promoted_opportunities WHERE organization_id = ? AND source_lead_id = ? LIMIT 1",
    )
    .bind(organizationId, sourceLeadId)
    .first<StoredOpportunity>();
  return row ? fromRow(row) : null;
}

export async function getOpportunityByDeal(
  db: D1Database,
  organizationId: string,
  dealId: string,
): Promise<PromotedOpportunity | null> {
  const row = await db
    .prepare(
      "SELECT * FROM promoted_opportunities WHERE organization_id = ? AND deal_id = ? LIMIT 1",
    )
    .bind(organizationId, dealId)
    .first<StoredOpportunity>();
  return row ? fromRow(row) : null;
}

export async function listOpportunities(
  db: D1Database,
  organizationId: string,
): Promise<PromotedOpportunity[]> {
  const result = await db
    .prepare(
      "SELECT * FROM promoted_opportunities WHERE organization_id = ? ORDER BY updated_at DESC",
    )
    .bind(organizationId)
    .all<StoredOpportunity>();
  return result.results.map(fromRow);
}

export async function upsertPromotedOpportunity(
  db: D1Database,
  input: {
    organizationId: string;
    sourceLeadId: string | null;
    deal: DealRecord;
    workspace?: OpportunityWorkspace;
    now: string;
  },
): Promise<PromotedOpportunity> {
  const existing = input.sourceLeadId
    ? await getOpportunityByLead(db, input.organizationId, input.sourceLeadId)
    : await getOpportunityByDeal(db, input.organizationId, input.deal.id);
  const workspace = input.workspace ?? existing?.workspace ?? EMPTY_OPPORTUNITY_WORKSPACE;
  if (existing) {
    await db
      .prepare(
        `UPDATE promoted_opportunities
         SET deal_json = ?, workspace_json = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
      )
      .bind(
        JSON.stringify(input.deal),
        JSON.stringify(workspace),
        input.now,
        existing.id,
        input.organizationId,
      )
      .run();
    return {
      ...existing,
      deal: input.deal,
      workspace,
      updatedAt: input.now,
    };
  }

  const id = `opp_${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO promoted_opportunities (
        id, organization_id, source_lead_id, deal_id, deal_json, workspace_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.organizationId,
      input.sourceLeadId,
      input.deal.id,
      JSON.stringify(input.deal),
      JSON.stringify(workspace),
      input.now,
      input.now,
    )
    .run();
  return {
    id,
    organizationId: input.organizationId,
    sourceLeadId: input.sourceLeadId,
    dealId: input.deal.id,
    deal: input.deal,
    workspace,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export async function updateOpportunityWorkspace(
  db: D1Database,
  input: {
    organizationId: string;
    dealId: string;
    workspace: OpportunityWorkspace;
    now: string;
  },
): Promise<PromotedOpportunity | null> {
  const existing = await getOpportunityByDeal(db, input.organizationId, input.dealId);
  if (!existing) return null;
  await db
    .prepare(
      `UPDATE promoted_opportunities
       SET workspace_json = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
    )
    .bind(JSON.stringify(input.workspace), input.now, existing.id, input.organizationId)
    .run();
  return {
    ...existing,
    workspace: input.workspace,
    updatedAt: input.now,
  };
}
