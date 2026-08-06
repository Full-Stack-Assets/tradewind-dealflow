import assert from "node:assert/strict";
import test from "node:test";

import { runAutomatedLeadCycle } from "../server/automated-lead-runner.ts";
import { approvePolicy } from "../server/ingestion-store.ts";
import type { SourcePolicy } from "../lib/ingestion/policy.ts";
import { closeTestD1, createTestD1 } from "./helpers/d1.ts";

const NOW = new Date("2026-08-06T12:00:00.000Z");

function policy(): SourcePolicy {
  return {
    adapter: "massgis-parcels-v1",
    endpoint: "https://services1.arcgis.com/hGdibHYSPO59RG1h/ArcGIS/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0/query",
    townIds: [95],
    outFields: ["OBJECTID", "GlobalID", "LOC_ID", "MAP_PAR_ID", "PROP_ID", "TOTAL_VAL", "FY", "LS_DATE", "LS_PRICE", "USE_CODE", "SITE_ADDR", "CITY", "ZIP", "YEAR_BUILT", "BLD_AREA", "UNITS"],
    useCodes: ["101"],
    unitCounts: [1],
    maximumAssessedValue: 750000,
    maximumYearBuilt: 1990,
    minimumLastSaleAgeYears: null,
    pageSize: 2,
    maxRecordsPerRun: 100,
    scheduleEnabled: true,
    scheduleTimeZone: "America/New_York",
    scheduleHour: 8,
    scheduleMinute: 0,
  };
}

function feature(id: number) {
  return { attributes: {
    OBJECTID: id,
    GlobalID: `parcel-${id}`,
    LOC_ID: `loc-${id}`,
    MAP_PAR_ID: `map-${id}`,
    PROP_ID: `prop-${id}`,
    TOTAL_VAL: 400000,
    FY: 2025,
    LS_DATE: 1_704_067_200_000,
    LS_PRICE: 350000,
    USE_CODE: "101",
    SITE_ADDR: `${id} Main St`,
    CITY: "Fall River",
    ZIP: "02720",
    YEAR_BUILT: 1975,
    BLD_AREA: 1800,
    UNITS: 1,
  } };
}

test("automated cycle stages MassGIS leads without a provider secret or manual import", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const approved = await approvePolicy(db, policy(), "operator", NOW);
  let calls = 0;
  const result = await runAutomatedLeadCycle({
    env: { DB: db },
    policy: approved,
    organizationId: "org-a",
    actorId: "scheduler",
    idempotencyKey: "cycle-1",
    now: NOW,
    fetchOptions: {
      fetch: async () => {
        calls += 1;
        return new Response(JSON.stringify({ features: [feature(1)] }));
      },
      retrievedAt: NOW.toISOString(),
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.staged, 1);
  assert.equal(result.leadsUpserted, 1);
  assert.equal(result.enrichmentSkipped, 1);
  const lead = await db.prepare("SELECT provider, enrichment_status, owner_names_json FROM automated_leads").first<{ provider: string; enrichment_status: string; owner_names_json: string }>();
  assert.deepEqual(lead, { provider: "massgis", enrichment_status: "needs_enrichment", owner_names_json: "[]" });
});

test("activated RentCast enrichment is matched and persisted without retaining provider response data", async (t) => {
  const db = await createTestD1();
  t.after(() => closeTestD1(db));
  const approved = await approvePolicy(db, policy(), "operator", NOW);
  const result = await runAutomatedLeadCycle({
    env: { DB: db, RENTCAST_API_KEY: "test-only-not-a-real-key", RENTCAST_ENABLED: "true", RENTCAST_DATA_USE_APPROVAL: "approved" },
    policy: approved,
    organizationId: "org-a",
    actorId: "scheduler",
    idempotencyKey: "cycle-2",
    now: NOW,
    fetchOptions: {
      fetch: async () => new Response(JSON.stringify({ features: [feature(1)] })),
      retrievedAt: NOW.toISOString(),
    },
    rentCastProvider: {
      async searchProperties() {
        return {
          properties: [{
            provider: "rentcast" as const,
            providerPropertyId: "rc-1",
            address: "1 Main St",
            city: "Fall River",
            state: "MA",
            zip: "02720",
            estimatedValue: 425000,
            ownerNames: ["Example Owner"],
            ownerType: "Individual",
            ownerMailingAddress: null,
            ownerOccupied: false,
          }],
          totalCount: 1,
          nextOffset: null,
        };
      },
    },
  });
  assert.equal(result.enriched, 1);
  const lead = await db.prepare("SELECT provider, provider_property_id, owner_names_json FROM automated_leads").first<{ provider: string; provider_property_id: string; owner_names_json: string }>();
  assert.deepEqual(lead, { provider: "rentcast", provider_property_id: "rc-1", owner_names_json: '["Example Owner"]' });
  const attempt = await db.prepare("SELECT status, response_status, error_code FROM lead_enrichment_attempts").first<{ status: string; response_status: number | null; error_code: string | null }>();
  assert.deepEqual(attempt, { status: "succeeded", response_status: 200, error_code: null });
  const columns = await db.prepare("PRAGMA table_info(lead_enrichment_attempts)").all<{ name: string }>();
  assert.equal(columns.results.some((column: { name: string }) => /api|secret|token/i.test(column.name)), false);
});
