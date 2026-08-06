import assert from "node:assert/strict";
import test from "node:test";
import { sha256Hex } from "../lib/sha256.ts";

test("pure TypeScript SHA-256 matches standard vectors", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
