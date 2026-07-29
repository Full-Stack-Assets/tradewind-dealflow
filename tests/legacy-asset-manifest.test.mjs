import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildLegacyAssetManifest,
  sha256File,
} from "../scripts/legacy-asset-manifest.mjs";

test("hashes an asset deterministically", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tradewind-manifest-"));
  const file = path.join(directory, "reference.txt");
  await writeFile(file, "synthetic reference only\n", "utf8");
  assert.equal(
    await sha256File(file),
    "8ad61598b32e0a4c17b1324c66ee922a6090541231f40c29ee659aef77dd3d7a",
  );
});

test("manifest omits absolute paths and contents", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tradewind-manifest-"));
  const file = path.join(directory, "reference.txt");
  await writeFile(file, "synthetic seller name must not be emitted", "utf8");
  const manifest = await buildLegacyAssetManifest([
    { id: "reference-design", path: file, kind: "document" },
  ]);
  const serialized = JSON.stringify(manifest);
  assert.equal(serialized.includes(directory), false);
  assert.equal(serialized.includes("synthetic seller name"), false);
  assert.equal(manifest.assets[0].basename, "reference.txt");
});
