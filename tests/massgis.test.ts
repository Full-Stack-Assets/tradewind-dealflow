import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQuery,
  fetchMassGisRecords,
  normalizeMassGisRecord,
  validateMassGisPage,
} from "../lib/ingestion/massgis.ts";
import type { SourcePolicy } from "../lib/ingestion/policy.ts";

function validPolicy(overrides: Partial<SourcePolicy> = {}): SourcePolicy {
  return {
    adapter: "massgis-parcels-v1",
    endpoint: "https://services1.arcgis.com/hGdibHYSPO59RG1h/ArcGIS/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0/query",
    townIds: [35, 1],
    outFields: [
      "OBJECTID", "GlobalID", "MAP_PAR_ID", "LOC_ID", "TOWN_ID", "PROP_ID",
      "TOTAL_VAL", "FY", "LS_DATE", "LS_PRICE", "USE_CODE", "SITE_ADDR", "CITY",
      "ZIP", "YEAR_BUILT", "BLD_AREA", "UNITS",
    ],
    useCodes: ["101", "104", "105", "111"],
    unitCounts: [1, 2, 3, 4],
    maximumAssessedValue: 750_000,
    maximumYearBuilt: 1990,
    minimumLastSaleAgeYears: null,
    pageSize: 2_000,
    maxRecordsPerRun: 5_000,
    scheduleEnabled: true,
    scheduleTimeZone: "America/New_York",
    scheduleHour: 2,
    scheduleMinute: 0,
    ...overrides,
  };
}

function feature(overrides: Record<string, unknown> = {}) {
  return {
    attributes: {
      OBJECTID: 10,
      GlobalID: "parcel-10",
      MAP_PAR_ID: "12-34",
      LOC_ID: "loc-10",
      TOWN_ID: 35,
      PROP_ID: "prop-10",
      TOTAL_VAL: 400_000,
      FY: 2025,
      LS_DATE: 1_704_067_200_000,
      LS_PRICE: 350_000,
      USE_CODE: "101",
      SITE_ADDR: "10 Main St",
      CITY: "Example",
      ZIP: "02110",
      YEAR_BUILT: 1975,
      BLD_AREA: 1_800,
      UNITS: 1,
      ...overrides,
    },
  };
}

function pageWithField(field: string) {
  return { features: [feature({ [field]: "must-not-retain" })] };
}

test("query is paginated, deterministic, geometry-free, and owner-free", () => {
  const query = buildQuery(validPolicy(), 2_000);
  assert.equal(query.get("resultOffset"), "2000");
  assert.equal(query.get("resultRecordCount"), "2000");
  assert.equal(query.get("orderByFields"), "OBJECTID ASC");
  assert.equal(query.get("returnGeometry"), "false");
  assert.equal(query.get("f"), "json");
  assert.equal(
    (query.get("outFields") ?? "").split(",").some((field) => ["OWNER1", "OWN_ADDR", "OWN_CITY", "OWN_STATE", "OWN_ZIP", "OWN_CO"].includes(field)),
    false,
  );
  assert.match(query.get("where") ?? "", /^TOWN_ID IN \(1, 35\)/);
});

test("unexpected owner data rejects the page", () => {
  assert.throws(
    () => validateMassGisPage(pageWithField("OWNER1"), validPolicy()),
    /unapproved field/i,
  );
});

test("page validation rejects malformed data before normalization", () => {
  assert.throws(
    () => validateMassGisPage({ error: { code: 400, message: "bad request" } }, validPolicy()),
    /ArcGIS error/i,
  );
  assert.throws(
    () => validateMassGisPage({ features: [feature({ LS_DATE: "2025-02-30" })] }, validPolicy()),
    /impossible date/i,
  );
  assert.throws(
    () => validateMassGisPage({ features: [feature({ TOTAL_VAL: Number.POSITIVE_INFINITY })] }, validPolicy()),
    /nonfinite number/i,
  );
  assert.throws(
    () => validateMassGisPage({ features: [feature({ UNKNOWN_FIELD: "schema drift" })] }, validPolicy()),
    /unknown field.*schema/i,
  );
});

test("official residential codes map without inventing motivation", () => {
  assert.equal(normalizeMassGisRecord(feature({ USE_CODE: "101" })).propertyType, "single-family homes");
  assert.equal(normalizeMassGisRecord(feature({ USE_CODE: "104" })).propertyType, "duplexes");
  assert.equal(normalizeMassGisRecord(feature({ USE_CODE: "105" })).propertyType, "triplexes");
  assert.equal(normalizeMassGisRecord(feature({ USE_CODE: "111", UNITS: 4 })).propertyType, "four-unit residential");
  const candidate = normalizeMassGisRecord(feature(), "2026-07-29T00:00:00.000Z");
  assert.equal(candidate.assessedValue, 400_000);
  assert.equal(candidate.lastSalePrice, 350_000);
  assert.equal("askingPrice" in candidate, false);
  assert.equal("sellerMotivation" in candidate, false);
});

test("fetches safe siblings while excluding malformed and owner-field records with reasons", async () => {
  const calls: URL[] = [];
  const result = await fetchMassGisRecords(validPolicy({ pageSize: 4, maxRecordsPerRun: 100 }), {
    retrievedAt: "2026-07-29T00:00:00.000Z",
    fetch: async (input) => {
      const url = new URL(input.toString());
      calls.push(url);
      const offset = Number(url.searchParams.get("resultOffset"));
      const features = offset === 0
        ? [
          feature({ OBJECTID: 1, GlobalID: "one" }),
          feature({ OBJECTID: 2, GlobalID: "two", OWNER1: "must-not-retain" }),
          feature({ OBJECTID: 3, GlobalID: "three", CITY: undefined }),
          feature({ OBJECTID: 4, GlobalID: "four" }),
        ]
        : [];
      return new Response(JSON.stringify({ features }), { status: 200 });
    },
  });

  assert.deepEqual(result.records.map((record) => record.sourceRecordId), ["1", "4"]);
  assert.deepEqual(result.rejections, [
    { sourceRecordId: "2", reason: "owner-contact-field" },
    { sourceRecordId: "3", reason: "malformed-record" },
  ]);
  assert.doesNotMatch(JSON.stringify(result.rejections), /must-not-retain/);
  assert.deepEqual(calls.map((url) => url.searchParams.get("resultRecordCount")), ["4", "4"]);
  assert.deepEqual(calls.map((url) => url.searchParams.get("resultOffset")), ["0", "4"]);
  assert.equal("attributes" in result.records[0], false);
  assert.equal(result.records[0].retrievedAt, "2026-07-29T00:00:00.000Z");
});

test("never requests more records than the approved run cap", async () => {
  const counts: string[] = [];
  const result = await fetchMassGisRecords(validPolicy({ pageSize: 60, maxRecordsPerRun: 100 }), {
    fetch: async (input) => {
      const url = new URL(input.toString());
      const count = Number(url.searchParams.get("resultRecordCount"));
      counts.push(String(count));
      const offset = Number(url.searchParams.get("resultOffset"));
      return new Response(JSON.stringify({
        features: Array.from({ length: count }, (_, index) => feature({
          OBJECTID: offset + index + 1,
          GlobalID: `parcel-${offset + index + 1}`,
        })),
      }), { status: 200 });
    },
  });
  assert.equal(result.records.length, 100);
  assert.deepEqual(result.rejections, []);
  assert.deepEqual(counts, ["60", "40"]);
});

test("rejected full pages consume the approved run cap", async () => {
  const counts: string[] = [];
  const result = await fetchMassGisRecords(validPolicy({ pageSize: 50, maxRecordsPerRun: 100 }), {
    fetch: async (input) => {
      const url = new URL(input.toString());
      const count = Number(url.searchParams.get("resultRecordCount"));
      counts.push(String(count));
      const offset = Number(url.searchParams.get("resultOffset"));
      return new Response(JSON.stringify({
        features: Array.from({ length: count }, (_, index) => feature({
          OBJECTID: offset === 0 && index === 0 ? "not-an-object-id" : offset + index + 1,
          GlobalID: `rejected-${offset + index + 1}`,
          OWNER1: "must-not-retain",
        })),
      }), { status: 200 });
    },
  });
  assert.deepEqual(result.records, []);
  assert.equal(result.rejections.length, 100);
  assert.deepEqual(result.rejections[0], { sourceRecordId: null, reason: "invalid-number" });
  assert.deepEqual(counts, ["50", "50"]);
  assert.doesNotMatch(JSON.stringify(result.rejections), /must-not-retain/);
});

test("a rejected record cannot hide a decreasing object ID", async () => {
  await assert.rejects(
    () => fetchMassGisRecords(validPolicy({ pageSize: 2, maxRecordsPerRun: 100 }), {
      fetch: async () => new Response(JSON.stringify({ features: [
        feature({ OBJECTID: 2, GlobalID: "two" }),
        feature({ OBJECTID: 1, GlobalID: "one", OWNER1: "must-not-retain" }),
      ] }), { status: 200 }),
    }),
    /decreasing object ID/i,
  );
});

test("retries only transient responses and rejects decreasing object IDs", async () => {
  let attempts = 0;
  const transientResult = await fetchMassGisRecords(validPolicy({ pageSize: 2, maxRecordsPerRun: 100 }), {
    fetch: async () => {
      attempts += 1;
      if (attempts < 4) return new Response("busy", { status: 429 });
      return new Response(JSON.stringify({ features: [] }), { status: 200 });
    },
  });
  assert.equal(attempts, 4);
  assert.deepEqual(transientResult, { records: [], rejections: [] });

  await assert.rejects(
    () => fetchMassGisRecords(validPolicy({ pageSize: 2, maxRecordsPerRun: 100 }), {
      fetch: async () => new Response(JSON.stringify({ features: [
        feature({ OBJECTID: 2, GlobalID: "two" }),
        feature({ OBJECTID: 1, GlobalID: "one" }),
      ] }), { status: 200 }),
    }),
    /decreasing object ID/i,
  );
});
