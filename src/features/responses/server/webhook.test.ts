import assert from "node:assert/strict";
import { test } from "node:test";
import { BACKOFF_MS, checkWebhookUrl, isBlockedIp, classifyStatus, isRetryableStatus } from "./webhook.logic.ts";

test("blocks private/special IPs incl. mapped forms", () => {
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "100.127.255.255", "0.0.0.0", "0.1.2.3", "224.0.0.1", "255.255.255.255",
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "febf::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1", "not-an-ip",
  ]) assert.equal(isBlockedIp(ip), true, ip);
});

test("allows public IPs", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2606:4700::1111", "::ffff:8.8.8.8", "2001:db8::1"])
    assert.equal(isBlockedIp(ip), false, ip);
});

const pub = async () => [{ address: "93.184.216.34" }];

test("url checks", async () => {
  assert.equal(await checkWebhookUrl("https://example.com/h", pub), null);
  assert.equal(await checkWebhookUrl("ftp://example.com", pub), "protocol not allowed");
  assert.equal(await checkWebhookUrl("https://u:p@example.com", pub), "credentials in url");
  assert.equal(await checkWebhookUrl("nope", pub), "invalid url");
  assert.equal(await checkWebhookUrl("http://127.0.0.1:3000", pub), "blocked address");
  assert.equal(await checkWebhookUrl("http://[::1]/", pub), "blocked address");
  assert.equal(await checkWebhookUrl("http://[::ffff:169.254.169.254]/", pub), "blocked address");
  assert.equal(await checkWebhookUrl("http://2130706433/", pub), "blocked address"); // WHATWG normalises to 127.0.0.1
  assert.equal(await checkWebhookUrl("https://x.test", async () => [{ address: "8.8.8.8" }, { address: "10.0.0.5" }]), "blocked address");
  assert.equal(await checkWebhookUrl("https://x.test", async () => { throw new Error("nx"); }), "dns failure");
});

test("retry policy", () => {
  assert.deepEqual([...BACKOFF_MS], [1000, 4000]);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(302), false);
  assert.equal(isRetryableStatus(404), false);
});

test("classifyStatus", () => {
  for (const [st, v] of [[200, "ok"], [302, "ok"], [408, "retry"], [429, "retry"], [500, "retry"], [503, "retry"], [400, "permanent"], [404, "permanent"], [410, "permanent"]] as const)
    assert.equal(classifyStatus(st), v, String(st));
});
