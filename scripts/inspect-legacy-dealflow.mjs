import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const EXPECTED_TABLES = ["buyers", "comps", "events", "leads"];

export function inspectLegacyDatabase(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const observed = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((row) => String(row.name))
      .filter((name) => !name.startsWith("sqlite_"));
    const missingTables = EXPECTED_TABLES.filter((name) => !observed.includes(name));
    const tables = {};
    for (const name of EXPECTED_TABLES.filter((value) => observed.includes(value))) {
      const columns = database
        .prepare(`PRAGMA table_info("${name}")`)
        .all()
        .map((row) => String(row.name))
        .sort();
      const rowCount = Number(
        database.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get().count,
      );
      tables[name] = { columns, rowCount };
    }
    const leadStates = "leads" in tables && tables.leads.columns.includes("state")
      ? Object.fromEntries(
          database
            .prepare('SELECT state, COUNT(*) AS count FROM "leads" GROUP BY state ORDER BY state')
            .all()
            .map((row) => [String(row.state), Number(row.count)]),
        )
      : {};
    return {
      schemaVersion: 1,
      databaseBasename: path.basename(databasePath),
      missingTables,
      tables,
      leadStates,
    };
  } finally {
    database.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const databasePath = process.argv[2];
  if (!databasePath) throw new Error("Usage: npm run legacy:inspect -- <dealflow.db>");
  process.stdout.write(`${JSON.stringify(inspectLegacyDatabase(databasePath), null, 2)}\n`);
}
