import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyData } from "../lib/import-export.ts";
import { convertAutomatedLeadToDeal } from "../lib/lead-conversion.ts";
import { mergeDealIntoWorkspace, workspaceSliceForDeal } from "../lib/opportunity-merge.ts";
import type { SellerWorkspaceTask } from "../lib/types.ts";

test("mergeDealIntoWorkspace is idempotent and keeps unrelated workspace rows", () => {
  const now = "2026-08-18T15:00:00.000Z";
  const conversion = convertAutomatedLeadToDeal({
    id: "lead_1",
    source: { identity: "massgis:fall-river", recordId: "1", retrievedAt: now },
    provider: "massgis",
    providerPropertyId: "1",
    address: "10 Harbor Way",
    city: "Fall River",
    state: "MA",
    zip: "02720",
    estimatedValue: null,
    ownerNames: [],
    ownerType: null,
    ownerOccupied: null,
    enrichmentStatus: "pending",
  }, new Date(now));
  assert.equal(conversion.ok, true);
  if (!conversion.ok) return;
  const task: SellerWorkspaceTask = {
    id: "task-1",
    propertyRecordId: conversion.deal.id,
    createdAt: now,
    updatedAt: now,
    title: "Call title",
    status: "todo",
    dueAt: now,
    notes: "",
  };
  const empty = createEmptyData(now);
  const first = mergeDealIntoWorkspace(empty, conversion.deal, {
    ...empty.sellerPropertyWorkspace,
    tasks: [task],
  });
  const second = mergeDealIntoWorkspace(first, conversion.deal, {
    ...empty.sellerPropertyWorkspace,
    tasks: [task],
  });
  assert.equal(first.deals.length, 1);
  assert.equal(second.deals.length, 1);
  assert.equal(second.sellerPropertyWorkspace.tasks.length, 1);
  assert.equal(workspaceSliceForDeal(second.sellerPropertyWorkspace, conversion.deal.id).tasks[0]?.id, "task-1");
});
