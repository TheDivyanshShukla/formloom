import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// No "server-only" and no env import: secrets are passed in so node --test can import this.
const key = (secret: string) => createHash("sha256").update(`formloom:enc:${secret}`).digest();

/** AES-256-GCM; output is base64(iv | tag | ciphertext). */
export function encrypt(secret: string, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

export function decrypt(secret: string, blob: string): string {
  const b = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", key(secret), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

const mac = (secret: string, body: string) => createHmac("sha256", `formloom:state:${secret}`).update(body).digest("base64url");

/** HMAC-signed, expiring payload: base64url(json).mac */
export function signState(secret: string, data: { userId: string; formId: string }, ttlMs = 10 * 60_000, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: now + ttlMs })).toString("base64url");
  return `${body}.${mac(secret, body)}`;
}

export function verifyState(secret: string, state: string, now = Date.now()): { userId: string; formId: string } | null {
  const [body, sig, extra] = state.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = Buffer.from(mac(secret, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof p.userId !== "string" || typeof p.formId !== "string" || typeof p.exp !== "number" || p.exp < now) return null;
    return { userId: p.userId, formId: p.formId };
  } catch {
    return null;
  }
}
