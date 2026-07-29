import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { inspectLegacyDatabase } from "../scripts/inspect-legacy-dealflow.mjs";

async function digest(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

test("reports counts and schema without returning row values or changing the source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tradewind-legacy-db-"));
  const databasePath = path.join(directory, "synthetic.db");
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE leads (id INTEGER PRIMARY KEY, owner TEXT, address TEXT, state TEXT);
    CREATE TABLE comps (id INTEGER PRIMARY KEY, address TEXT);
    CREATE TABLE buyers (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE events (id INTEGER PRIMARY KEY, what TEXT);
    CREATE TABLE secrets (id INTEGER PRIMARY KEY, value TEXT);
    INSERT INTO leads (owner, address, state)
      VALUES ('Synthetic Owner', '1 Test Way', 'LEAD'),
             ('Another Synthetic Owner', '2 Test Way', 'UNDERWRITTEN');
    INSERT INTO secrets (value) VALUES ('must not emit');
  `);
  database.close();
  const before = await digest(databasePath);

  const summary = inspectLegacyDatabase(databasePath);
  assert.equal(summary.tables.leads.rowCount, 2);
  assert.deepEqual(summary.leadStates, { LEAD: 1, UNDERWRITTEN: 1 });
  assert.equal("secrets" in summary.tables, false);
  assert.equal(await digest(databasePath), before);
  const serialized = JSON.stringify(summary);
  for (const forbidden of [
    "Synthetic Owner", "1 Test Way", "must not emit", directory,
  ]) assert.equal(serialized.includes(forbidden), false);
});

test("reports missing expected tables without querying absent or unknown tables", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tradewind-legacy-db-"));
  const databasePath = path.join(directory, "partial.db");
  const database = new DatabaseSync(databasePath);
  database.exec("CREATE TABLE leads (id INTEGER PRIMARY KEY, state TEXT);");
  database.close();
  const summary = inspectLegacyDatabase(databasePath);
  assert.deepEqual(summary.missingTables, ["buyers", "comps", "events"]);
  assert.deepEqual(Object.keys(summary.tables), ["leads"]);
  assert.deepEqual(summary.leadStates, {});
});

test("invalid database paths fail the CLI with a nonzero exit", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/inspect-legacy-dealflow.mjs", "/definitely/not/a/database.db"],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
});
