import { isIP } from "node:net";

export type TrustProxy = "none" | "cloudflare" | "proxy";

/** Pick the client IP from request headers according to how much of the proxy chain we trust. */
export function parseClientIp(h: { get(name: string): string | null }, mode: TrustProxy): string {
  if (mode === "none") return "direct";
  const raw =
    mode === "cloudflare"
      ? h.get("cf-connecting-ip")
      : (h.get("x-forwarded-for")?.split(",").at(-1) ?? h.get("x-real-ip"));
  const ip = raw?.trim();
  return ip && isIP(ip) ? ip : "unknown";
}
