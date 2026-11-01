import { isIP } from "node:net";

export const BACKOFF_MS = [1000, 4000] as const;
export const MAX_ATTEMPTS = 3;

function v4Parts(ip: string): number[] {
  return ip.split(".").map(Number);
}

function isBlockedV4(ip: string): boolean {
  const [a, b] = v4Parts(ip) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && v4Parts(ip)[2] === 0) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Expand an IPv6 literal to 8 hextets, or null if malformed. */
function v6Hextets(ip: string): number[] | null {
  let s = ip.split("%")[0] ?? ip;
  const dot = s.lastIndexOf(".");
  if (dot !== -1) {
    const colon = s.lastIndexOf(":");
    const q = v4Parts(s.slice(colon + 1));
    if (q.length !== 4 || q.some((n) => !(n >= 0 && n <= 255))) return null;
    const hex = (x: number, y: number) => (((x as number) << 8) | (y as number)).toString(16);
    s = `${s.slice(0, colon + 1)}${hex(q[0] as number, q[1] as number)}:${hex(q[2] as number, q[3] as number)}`;
  }
  const [head, tail, extra] = s.split("::");
  if (extra !== undefined) return null;
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = tail === undefined ? 0 : 8 - h.length - t.length;
  if (fill < 0 || (tail === undefined && h.length !== 8)) return null;
  const out = [...h, ...Array<string>(fill).fill("0"), ...t].map((x) => Number.parseInt(x, 16));
  return out.length === 8 && out.every((n) => n >= 0 && n <= 0xffff) ? out : null;
}

/** True if the address is not a public unicast destination (fail closed on anything unparseable). */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedV4(ip);
  if (kind !== 6) return true;
  const g = v6Hextets(ip);
  if (!g) return true;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [number, number, number, number, number, number, number, number];
  const embedded = `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0xffff || g5 === 0)) {
    return isBlockedV4(embedded); // ::ffff:a.b.c.d and ::a.b.c.d; :: and ::1 map to 0.0.0.x, blocked
  }
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return isBlockedV4(embedded); // NAT64
  if ((g0 & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  return false;
}

export type Lookup = (host: string) => Promise<{ address: string }[]>;

/** Returns a reason string if the URL must not be fetched, else null. Resolves every A/AAAA record. */
export async function checkWebhookUrl(raw: string, lookup: Lookup): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "invalid url";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "protocol not allowed";
  if (u.username || u.password) return "credentials in url";
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host) return "empty host";
  if (isIP(host)) return isBlockedIp(host) ? "blocked address" : null;
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host);
  } catch {
    return "dns failure";
  }
  if (addrs.length === 0) return "dns failure";
  return addrs.some((a) => isBlockedIp(a.address)) ? "blocked address" : null;
}

export function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/** Single-attempt verdict for an HTTP status: 3xx counts as delivered; 408/429/5xx retry; other 4xx are permanent. */
export function classifyStatus(status: number): "ok" | "retry" | "permanent" {
  if (status < 400) return "ok";
  return status === 408 || isRetryableStatus(status) ? "retry" : "permanent";
}
