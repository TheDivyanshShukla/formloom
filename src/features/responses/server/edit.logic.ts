import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Constant-time equality of two hex hashes (false on length mismatch). */
export function hashesEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
