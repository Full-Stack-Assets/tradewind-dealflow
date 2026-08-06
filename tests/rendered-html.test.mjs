import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
const wranglerConfigUrl = new URL("../dist/server/wrangler.json", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);

async function render(path = "/") {
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("public home states the product, prices, and limitations without fake proof", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Tradewind DealFlow/i);
  assert.match(html, /New England Wholesale OS/i);
  assert.match(html, /90-Day First-Deal Execution System/i);
  assert.match(html, /\$79/);
  assert.match(html, /\$1,497/);
  assert.match(html, /\$497/);
  assert.match(html, /not a guarantee/i);
  assert.match(html, /not legal, tax, financial, brokerage, appraisal, or investment advice/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
  assert.doesNotMatch(html, /testimonial|closed [0-9]+ deals|earned \$|guaranteed income/i);
});

test("public responses carry baseline browser security headers", async () => {
  const response = await render("/");

  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /object-src 'none'/,
  );
  assert.match(
    response.headers.get("permissions-policy") ?? "",
    /camera=\(\)/,
  );
});

test("workspace shell keeps the primary navigation to five focused choices", async () => {
  const response = await render("/dashboard");
  const html = await response.text();
  assert.equal((html.match(/class="nav-link(?: active)?"/g) ?? []).length, 5);
  assert.match(html, /Start here/i);
  assert.match(html, /Sources/i);
  assert.match(html, /Pipeline/i);
  assert.match(html, /Deal work/i);
  assert.match(html, /Reference/i);
});

test("generated deployment config omits the obsolete nodejs compatibility flag", async () => {
  const config = JSON.parse(await readFile(wranglerConfigUrl, "utf8"));
  assert.equal(config.compatibility_date, "2026-08-04");
  assert.equal(config.compatibility_flags?.includes("nodejs_compat") ?? false, false);
});

const routes = [
  ["/dashboard", /Current operating snapshot/i, /Inspecting browser workspace/i],
  ["/deal-lab", /Deal Lab/i, /Generate with AI/i],
  ["/pipeline", /Pipeline/i, /Automated lead intake/i],
  ["/sources", /MassGIS standing policy/i, /Automatic handoff/i],
  ["/approvals", /Approval Queue/i, /Hash-bound human review/i],
  ["/buyers", /Buyer workspace/i, /No buyer profiles yet/i],
  ["/seller-property", /Seller\/Property Workspace/i, /Drafts unpublished/i],
  ["/academy", /Academy/i, /12 learning modules/i],
  ["/compliance", /Compliance workspace/i, /January 1, 2027/i],
  ["/resources", /Resource center/i, /Last reviewed: July 27, 2026/i],
  ["/deal-desk", /Deal Desk/i, /does not create representation, agency, financing, acceptance/i],
];

for (const [path, heading, requiredCopy] of routes) {
  test(`${path} renders an honest, accessible workspace`, async () => {
    const response = await render(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, heading);
    assert.match(html, requiredCopy);
    assert.match(html, /Skip to main content/i);
    assert.match(html, /stored only in this browser|Execution remains fail-closed|Human approval remains required|MassGIS runs on schedule|Approve one bounded/i);
    assert.doesNotMatch(html, /123 Main St|Jane Seller|Acme Buyers|demo property|sample buyer/i);
  });
}

test("deal lab exposes reviewable AI drafting controls for material notes", async () => {
  const response = await render("/deal-lab");
  const html = await response.text();

  assert.match(html, /Generate with AI/i);
  assert.match(html, /data-ai-field="compEvidence"/i);
  assert.match(html, /data-ai-field="repairEvidence"/i);
  assert.match(html, /data-ai-field="riskNotes"/i);
});

test("compliance route separates Massachusetts and Rhode Island with official sources", async () => {
  const response = await render("/compliance");
  const html = await response.text();

  assert.match(html, /Massachusetts lane/i);
  assert.match(html, /Rhode Island lane/i);
  assert.match(html, /chapter 410/i);
  assert.match(html, /three-business-day/i);
  assert.match(html, /https:\/\/malegislature\.gov\/Laws\/GeneralLaws\/PartI\/TitleXVI\/Chapter112\/Section87PP/i);
  assert.match(html, /https:\/\/webserver\.rilegislature\.gov\/PublicLaws\/law26\/law26410\.htm/i);
  assert.match(html, /educational and operational software/i);
});

test("pages with multiple guarded actions do not reuse accessible IDs", async () => {
  const response = await render("/pipeline");
  const html = await response.text();
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  assert.deepEqual([...new Set(duplicates)], []);
});

test("pipeline renders the automated lead engine and hard action boundaries", async () => {
  const response = await render("/pipeline");
  const html = await response.text();

  assert.match(html, /Automated lead intake/i);
  assert.match(html, /D1 records|MassGIS records in D1/i);
  assert.match(html, /No CSV upload/i);
  assert.match(html, /No automated leads yet|Loading automated leads/i);
  assert.doesNotMatch(
    html,
    /Send campaign|Text owner|Email owner|Autodial|Upload property CSV/i,
  );
});

test("sources renders bounded approval, scheduling, and audit without manual intake", async () => {
  const response = await render("/sources");
  const html = await response.text();

  assert.match(html, /MassGIS Property Tax Parcels/i);
  assert.match(html, /Approval diff/i);
  assert.match(html, /Minimum last-sale age/i);
  assert.match(html, /Latest source run counts/i);
  assert.match(html, /Grouped, not per-record approval/i);
  assert.match(html, /there is no browser import step/i);
  assert.doesNotMatch(html, /Import all safe records|Download audit|Run now/i);
  assert.doesNotMatch(html, /MassGIS ingestion release/i);
  assert.doesNotMatch(html, /Send campaign|Text owner|Email owner|Autodial|OWNER1|OWN_ADDR/i);
});

test("pipeline and dashboard render their concise source operating health", async () => {
  const pipeline = await (await render("/pipeline")).text();
  const dashboard = await (await render("/dashboard")).text();

  assert.match(pipeline, /Owner matched|Automated lead totals/i);
  assert.match(dashboard, /Next scheduled run/i);
});

test("dashboard withholds factual output until browser storage is hydrated", async () => {
  const response = await render("/dashboard");
  const html = await response.text();

  assert.match(html, /Current operating snapshot/i);
  assert.match(html, /Inspecting browser workspace/i);
  assert.match(html, /System and local storage/i);
  assert.match(html, /Not enough data/i);
  assert.doesNotMatch(
    html,
    /Active buy box|Qualification by launch status|No authorized property records are available to rank|Serialized writes available|0 imported of 0/i,
  );
  assert.doesNotMatch(
    html,
    /Projected revenue|Seller motivation|Recent seller activity|Approval rate|Last configuration change/i,
  );
});

test("health endpoint keeps ingestion as an optional product capability", async () => {
  const response = await render("/healthz");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "tradewind-dealflow",
    release: "acquisitions-os",
    outreach: "disabled",
    ingestion: {
      manual: "disabled",
      scheduled: "enabled",
      ownerContactFields: "disabled",
      leadAutomation: "available",
      ownerEnrichment: "disabled",
    },
  });
});
