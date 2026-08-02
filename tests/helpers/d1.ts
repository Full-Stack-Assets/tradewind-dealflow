import { readdir, readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";

const instances = new WeakMap<object, Miniflare>();

export async function createTestD1() {
  const miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } };",
    d1Databases: ["DB"],
  });
  const db = await miniflare.getD1Database("DB");
  const migrationsDirectory = new URL("../../drizzle/", import.meta.url);
  const migrations = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();
  for (const name of migrations) {
    const migration = await readFile(new URL(name, migrationsDirectory), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await db.prepare(statement).run();
    }
  }
  instances.set(db, miniflare);
  return db;
}

export async function closeTestD1(db: object): Promise<void> {
  const miniflare = instances.get(db);
  instances.delete(db);
  await miniflare?.dispose();
}

export async function tableNames(db: { prepare(sql: string): { all<T>(): Promise<{ results: T[] }> } }) {
  const result = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all<{ name: string }>();
  return result.results
    .map((row) => row.name)
    .filter((name) => !name.startsWith("_cf_"));
}
