export const AI_FIELD_CONFIG = {
  dealDeskSummary: {
    label: "Deal Desk summary",
    instruction: "Turn the supplied notes into a concise evidence-first review request. Separate verified facts, assumptions, missing evidence, and the specific question for the reviewer.",
  },
  compEvidence: {
    label: "Comparable evidence",
    instruction: "Organize the supplied comparable-property notes into a concise evidence log with sources, dates, relevance, and unknowns. Do not invent comparable facts.",
  },
  repairEvidence: {
    label: "Repair evidence",
    instruction: "Organize the supplied repair notes into a concise evidence summary. Separate observed scope, source, estimate, assumptions, and unknowns. Do not estimate missing costs.",
  },
  riskNotes: {
    label: "Risk notes",
    instruction: "Rewrite the supplied notes as a concise risk register: known risk, evidence, possible impact, and next verification step. Do not add facts.",
  },
  conversationSummary: {
    label: "Conversation summary",
    instruction: "Draft a neutral, factual conversation summary from the supplied notes. Preserve uncertainty and do not infer motivation, ownership, consent, or commitments.",
  },
  conversationNextAction: {
    label: "Conversation next action",
    instruction: "Draft one conservative next research or review action from the supplied notes. Do not draft outreach, persuasion, legal advice, or a commitment.",
  },
  conversationNotes: {
    label: "Conversation notes",
    instruction: "Organize the supplied conversation notes into concise factual bullets with unknowns clearly marked. Do not add facts or contact instructions.",
  },
  taskNotes: {
    label: "Task notes",
    instruction: "Rewrite the supplied task notes into a concise, verifiable research checklist. Do not claim work was completed.",
  },
  comparableAdjustmentNotes: {
    label: "Comparable adjustment notes",
    instruction: "Organize the supplied adjustment notes into a concise list of supported differences and unresolved questions. Do not invent values.",
  },
  repairEvidenceSummary: {
    label: "Repair evidence summary",
    instruction: "Organize the supplied repair evidence into observed facts, source, scope, estimate basis, and unknowns. Do not invent costs or conditions.",
  },
  documentNotes: {
    label: "Document notes",
    instruction: "Rewrite the supplied document notes into a concise provenance and review checklist. Do not claim a document was received, verified, or approved unless stated.",
  },
  reviewSummary: {
    label: "Review summary",
    instruction: "Draft a concise review summary that separates verified evidence, unresolved conflicts, missing evidence, and requested reviewer decision. Do not approve anything.",
  },
} as const;

export type AIFieldKey = keyof typeof AI_FIELD_CONFIG;
