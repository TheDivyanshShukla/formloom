import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redis } from "@/server/cache/redis";
import { env } from "@/server/env";
import { parseClientIp } from "./rate-limit.logic";

/**
 * Sliding-window limiter on a Redis sorted set. Fails closed: if Redis is unreachable the
 * request is refused, so abuse can't slip through during an outage.
 */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `rl:${bucket}`;
  const now = Date.now();
  try {
    const res = await redis
      .multi()
      .zremrangebyscore(key, 0, now - windowSec * 1000)
      .zadd(key, now, `${now}:${randomUUID()}`)
      .zcard(key)
      .expire(key, windowSec)
      .exec();
    const count = Number(res?.[2]?.[1] ?? Infinity);
    return count <= limit;
  } catch {
    return false;
  }
}

/** Honours env.TRUST_PROXY: only headers our own edge sets are believed (see rate-limit.logic.ts). */
export async function clientIp(): Promise<string> {
  return parseClientIp(await headers(), env.TRUST_PROXY);
}
