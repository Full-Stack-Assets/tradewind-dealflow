import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
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

const routes = [
  ["/dashboard", /Current operating snapshot/i, /Inspecting browser workspace/i],
  ["/deal-lab", /Deal Lab/i, /ARV - Repairs - Holding\/Closing Costs - Buyer Profit - Wholesale Fee/i],
  ["/pipeline", /Pipeline/i, /Your pipeline is empty/i],
  ["/sources", /MassGIS standing policy/i, /Import all safe records/i],
  ["/buyers", /Buyer workspace/i, /No buyer profiles yet/i],
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
    assert.match(html, /stored only in this browser/i);
    assert.doesNotMatch(html, /123 Main St|Jane Seller|Acme Buyers|demo property|sample buyer/i);
  });
}

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

test("pipeline renders the local lead engine and hard action boundaries", async () => {
  const response = await render("/pipeline");
  const html = await response.text();

  assert.match(html, /Authorized CSV intake/i);
  assert.match(html, /Configure launch buy box/i);
  assert.match(html, /The selected file stays in this browser/i);
  assert.match(html, /Apply safe records/i);
  assert.match(html, /A score never authorizes contact/i);
  assert.match(html, /No real property records yet/i);
  assert.doesNotMatch(
    html,
    /Send campaign|Text owner|Email owner|Autodial|Upload property CSV/i,
  );
});

test("sources renders bounded approval, scheduling, intake, and audit without outreach", async () => {
  const response = await render("/sources");
  const html = await response.text();

  assert.match(html, /MassGIS Property Tax Parcels/i);
  assert.match(html, /Run now/i);
  assert.match(html, /Latest source run counts/i);
  assert.match(html, /Grouped, not per-record approval/i);
  assert.match(html, /Import all safe records/i);
  assert.match(html, /Download audit/i);
  assert.doesNotMatch(html, /Send campaign|Text owner|Email owner|Autodial|OWNER1|OWN_ADDR/i);
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

test("health endpoint reports the honest local-first release state", async () => {
  const response = await render("/healthz");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "tradewind-dealflow",
    release: "local-first",
    outreach: "disabled",
  });
});
