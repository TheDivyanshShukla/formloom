import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClientIp } from "./rate-limit.logic.ts";

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });

test("none trusts nothing", () => {
  assert.equal(parseClientIp(h({ "x-forwarded-for": "1.2.3.4", "cf-connecting-ip": "1.2.3.4" }), "none"), "direct");
});
test("cloudflare uses cf-connecting-ip only", () => {
  assert.equal(parseClientIp(h({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }), "cloudflare"), "9.9.9.9");
  assert.equal(parseClientIp(h({ "x-forwarded-for": "1.1.1.1" }), "cloudflare"), "unknown");
});
test("proxy uses the LAST xff entry, spoofed prefix ignored", () => {
  assert.equal(parseClientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }), "proxy"), "203.0.113.7");
  assert.equal(parseClientIp(h({ "x-real-ip": "2001:db8::1" }), "proxy"), "2001:db8::1");
});
test("garbage becomes unknown", () => {
  assert.equal(parseClientIp(h({ "x-forwarded-for": "not-an-ip" }), "proxy"), "unknown");
  assert.equal(parseClientIp(h({}), "proxy"), "unknown");
});
