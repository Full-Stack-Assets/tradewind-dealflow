import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const wranglerPath = resolve("dist/server/wrangler.json");
const deployHelperPath = resolve(
  "dist/standalone/node_modules/vinext/dist/deploy.js",
);
const obsoleteFlag = 'compatibility_flags: ["nodejs_compat"],';

const wrangler = JSON.parse(await readFile(wranglerPath, "utf8"));
if (wrangler.compatibility_date !== "2026-08-04") {
  throw new Error("Sites build must use the 2026-08-04 compatibility baseline");
}
if (wrangler.compatibility_flags?.includes("nodejs_compat")) {
  throw new Error("Sites build still declares the obsolete nodejs_compat flag");
}

// vinext 0.0.50 ships a deployment-only helper that still emits the flag.
// Sites packages the standalone tree, so remove that stale declaration until
// a verified vinext upgrade makes this compatibility patch unnecessary.
const deployHelper = await readFile(deployHelperPath, "utf8");
const preparedHelper = deployHelper.replace(obsoleteFlag, "compatibility_flags: [],");
if (preparedHelper.includes(obsoleteFlag)) {
  throw new Error("Unable to remove obsolete nodejs_compat from vinext deploy helper");
}
if (preparedHelper !== deployHelper) {
  await writeFile(deployHelperPath, preparedHelper);
}
