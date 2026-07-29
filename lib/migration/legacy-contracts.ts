import type { PipelineStage } from "../types.ts";

export type LegacyDealState =
  | "LEAD"
  | "UNDERWRITTEN"
  | "OFFER_SENT"
  | "UNDER_CONTRACT"
  | "ASSIGNED"
  | "CLOSED"
  | "DEAD";

export type LegacyLeadRecord = {
  id: number;
  address: string;
  city: string;
  owner: string | null;
  ownerMail: string | null;
  propertyType: string;
  asking: number | null;
  state: LegacyDealState;
  distressScore: number | null;
  arv: number | null;
  repairs: number | null;
  mao: number | null;
  spread: number | null;
  contractPrice: number | null;
  assignedTo: string | null;
};

export type LegacyMigrationIssue = {
  recordId: string;
  code:
    | "missing-address"
    | "unsupported-property-type"
    | "invalid-money"
    | "unknown-state"
    | "personal-data-withheld";
  message: string;
};

const STAGE_MAP: Record<LegacyDealState, PipelineStage> = {
  LEAD: "Research",
  UNDERWRITTEN: "Qualified",
  OFFER_SENT: "Offer",
  UNDER_CONTRACT: "Contract",
  ASSIGNED: "Closing",
  CLOSED: "Closed",
  DEAD: "Archived",
};

export function mapLegacyStage(state: LegacyDealState): PipelineStage {
  return STAGE_MAP[state];
}

export function isLegacyDealState(value: string): value is LegacyDealState {
  return Object.hasOwn(STAGE_MAP, value);
}

export function parseLegacyMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed.replaceAll(",", "").replace("$", ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeLegacyPropertyType(value: string): string {
  const normalized = value.trim().toLowerCase().replaceAll("-", " ").replace(/\s+/g, " ");
  if (["sfh", "single family", "single family homes"].includes(normalized)) {
    return "Single-family homes";
  }
  if (["2 family", "2 unit", "duplex", "duplexes"].includes(normalized)) {
    return "Duplexes";
  }
  if (["3 family", "3 unit", "triplex", "triplexes"].includes(normalized)) {
    return "Triplexes";
  }
  if (["4 family", "4 unit", "four unit residential"].includes(normalized)) {
    return "Four-unit residential";
  }
  return `Unsupported: ${normalized}`;
}
