import assert from "node:assert/strict";
import { test } from "node:test";
import { hashesEqual, hashToken, newToken } from "./edit.logic.ts";

test("token is 43 chars base64url and unique", () => {
  const t = newToken();
  assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(t, newToken());
});

test("hash is sha256 hex, deterministic", () => {
  assert.equal(hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("hashesEqual", () => {
  const h = hashToken("a");
  assert.equal(hashesEqual(h, hashToken("a")), true);
  assert.equal(hashesEqual(h, hashToken("b")), false);
  assert.equal(hashesEqual(h, "short"), false);
});
