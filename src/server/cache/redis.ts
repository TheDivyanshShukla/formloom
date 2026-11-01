import "server-only";
import Redis from "ioredis";
import { env } from "@/server/env";

const g = globalThis as unknown as { redis?: Redis; redisSub?: Redis };

const make = () =>
  // Queue briefly while (re)connecting, but give up fast so a Redis outage never stalls requests.
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, commandTimeout: 800, connectTimeout: 2000 });

export const redis = g.redis ?? make();
/** Dedicated subscriber connection (a subscribed client can't run other commands). */
export const redisSub = g.redisSub ?? make();

// Swallow connection noise: the cache is best-effort and every caller has a fallback.
redis.on("error", () => {});
redisSub.on("error", () => {});

if (process.env.NODE_ENV !== "production") {
  g.redis = redis;
  g.redisSub = redisSub;
}
