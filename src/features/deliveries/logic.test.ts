import assert from "node:assert/strict";
import { test } from "node:test";
import { afterFailure, backoffMs, MAX_ATTEMPTS, shortError } from "./logic.ts";

test("backoff schedule 30s*4^(n-1), capped at 6h", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(backoffMs), [30e3, 120e3, 480e3, 1920e3, 7680e3, 21600e3, 21600e3]);
});

test("dead after 8 attempts or on permanent failure", () => {
  assert.equal(afterFailure(0, false, 0).dead, false);
  assert.equal(afterFailure(MAX_ATTEMPTS - 2, false, 0).dead, false);
  assert.equal(afterFailure(MAX_ATTEMPTS - 1, false, 0).dead, true);
  assert.equal(afterFailure(0, true, 0).dead, true);
  assert.equal(afterFailure(2, false, 1000).nextAt.getTime(), 1000 + backoffMs(3));
});

test("shortError truncates", () => {
  assert.equal(shortError("a".repeat(500)).length, 200);
});
