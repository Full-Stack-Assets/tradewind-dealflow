import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function listZipEntries(filePath) {
  return execFileSync("unzip", ["-Z1", filePath], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
}

export async function buildLegacyAssetManifest(inputs, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error("inspection time must be valid");
  const assets = [];
  const ids = new Set();
  for (const input of inputs) {
    if (!input || typeof input.id !== "string" || !input.id.trim()) {
      throw new Error("every legacy asset requires a logical ID");
    }
    if (ids.has(input.id)) throw new Error(`duplicate legacy asset ID: ${input.id}`);
    ids.add(input.id);
    const basename = path.basename(input.path);
    const isArchive = /\.(zip|pages)$/i.test(basename);
    assets.push({
      id: input.id,
      kind: input.kind,
      basename,
      byteLength: statSync(input.path).size,
      sha256: await sha256File(input.path),
      archiveEntries: isArchive ? listZipEntries(input.path) : [],
    });
  }
  return {
    schemaVersion: 1,
    inspectedAt: now.toISOString(),
    assets: assets.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

async function main(argv) {
  const inputs = argv.map((filePath, index) => ({
    id: `legacy-asset-${index + 1}`,
    kind: "reference",
    path: filePath,
  }));
  process.stdout.write(`${JSON.stringify(await buildLegacyAssetManifest(inputs), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
