import "server-only";
import { LRUCache } from "lru-cache";
import { redis, redisSub } from "./redis";

const CHANNEL = "cache:invalidate";
const L1_TTL_MS = 5_000; // short: other instances may serve stale L1 for at most this long if pub/sub drops

const g = globalThis as unknown as { l1?: LRUCache<string, { v: unknown }>; subscribed?: boolean };
if (!g.l1) g.l1 = new LRUCache<string, { v: unknown }>({ max: 5_000, ttl: L1_TTL_MS });
const l1 = g.l1;

if (!g.subscribed) {
  g.subscribed = true;
  redisSub.subscribe(CHANNEL).catch(() => {});
  redisSub.on("message", (_ch, msg: string) => {
    for (const k of msg.split("\n")) l1.delete(k);
  });
}

export const cacheKeys = {
  publicForm: (id: string) => `form:pub:${id}`,
};

/** L1 LRU -> L2 Redis -> loader. Any cache failure falls through to the loader. */
export async function cached<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
  const hit = l1.get(key);
  if (hit) return hit.v as T;
  try {
    const raw = await redis.get(key);
    if (raw !== null) {
      const v = JSON.parse(raw) as T;
      l1.set(key, { v });
      return v;
    }
  } catch {}
  const v = await loader();
  l1.set(key, { v });
  redis.set(key, JSON.stringify(v), "EX", ttlSec).catch(() => {});
  return v;
}

export async function invalidate(...keys: string[]) {
  await drop(keys);
  // A reader that loaded the old row just before this write may still be filling the cache; drop again
  // once its fill has landed. ponytail: version stamps would close the window fully.
  setTimeout(() => void drop(keys), 1500).unref?.();
}

async function drop(keys: string[]) {
  for (const k of keys) l1.delete(k);
  try {
    await redis.del(...keys);
    await redis.publish(CHANNEL, keys.join("\n"));
  } catch {}
}
