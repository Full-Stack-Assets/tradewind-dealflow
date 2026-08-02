import { readdir, readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import type { D1Database } from "../../server/d1.ts";

const instances = new WeakMap<object, Miniflare>();

async function migrationNames(): Promise<string[]> {
  const migrationsDirectory = new URL("../../drizzle/", import.meta.url);
  return (await readdir(migrationsDirectory))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();
}

export async function applyTestD1Migrations(
  db: D1Database,
  options: { fromMigration?: number; throughMigration?: number } = {},
): Promise<void> {
  const migrationsDirectory = new URL("../../drizzle/", import.meta.url);
  for (const name of await migrationNames()) {
    const ordinal = Number(/^\d+/.exec(name)?.[0]);
    if (ordinal < (options.fromMigration ?? 0) || ordinal > (options.throughMigration ?? Infinity)) continue;
    const migration = await readFile(new URL(name, migrationsDirectory), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await db.prepare(statement).run();
    }
  }
}

export async function createTestD1(options: { throughMigration?: number } = {}) {
  const miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } };",
    d1Databases: ["DB"],
  });
  const db = await miniflare.getD1Database("DB");
  await applyTestD1Migrations(db, { throughMigration: options.throughMigration });
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
