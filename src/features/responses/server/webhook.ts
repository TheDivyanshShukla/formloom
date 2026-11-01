import "server-only";
import { lookup } from "node:dns/promises";
import { BACKOFF_MS, checkWebhookUrl, classifyStatus, isRetryableStatus, MAX_ATTEMPTS } from "./webhook.logic";

const dnsAll = (host: string) => lookup(host, { all: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST `body` as JSON to `url`. Public hosts only (re-resolved and re-checked each attempt), 10s timeout,
 * redirects not followed (a 3xx counts as delivered: Apps Script answers 302 after running), up to 3 attempts
 * with 1s/4s backoff on network errors, 5xx and 429. Never throws; one log line on final failure, no body.
 *
 * ponytail: DNS rebinding window between our lookup and fetch's own lookup remains; pin the checked IP
 * (custom undici dispatcher with connect.lookup) if webhooks ever target untrusted tenants.
 */
export async function deliverWebhook(url: string, body: unknown): Promise<void> {
  let reason = "unknown";
  try {
    const payload = JSON.stringify(body);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const blocked = await checkWebhookUrl(url, dnsAll);
      if (blocked) {
        reason = blocked;
        if (blocked !== "dns failure") break; // permanent
      } else {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload,
            redirect: "manual",
            signal: AbortSignal.timeout(10_000),
          });
          if (!isRetryableStatus(res.status) && (res.ok || res.status < 400 || res.type === "opaqueredirect")) return;
          reason = `status ${res.status}`;
          if (!isRetryableStatus(res.status)) break; // 4xx: permanent
        } catch (e) {
          reason = e instanceof Error ? e.name : "network error";
        }
      }
      if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1] ?? 4000);
    }
  } catch (e) {
    reason = e instanceof Error ? e.name : "error";
  }
  let host = "invalid";
  try {
    host = new URL(url).host;
  } catch {}
  console.error(JSON.stringify({ event: "webhook.failed", host, reason }));
}

export type OnceResult = { ok: true } | { ok: false; retry: boolean; reason: string };

/** One SSRF-guarded attempt (same rules as deliverWebhook, no sleeping or looping). Never throws. */
export async function sendWebhookOnce(url: string, body: unknown): Promise<OnceResult> {
  try {
    const blocked = await checkWebhookUrl(url, dnsAll);
    if (blocked) return { ok: false, retry: blocked === "dns failure", reason: blocked };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const v = classifyStatus(res.status);
    return v === "ok" ? { ok: true } : { ok: false, retry: v === "retry", reason: `status ${res.status}` };
  } catch (e) {
    return { ok: false, retry: true, reason: e instanceof Error ? e.name : "network error" };
  }
}
