import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

const g = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
// prepare:false keeps it PgBouncer (transaction mode) safe; one shared client across HMR reloads.
const client = g.pg ?? postgres(env.DATABASE_URL, { prepare: false, max: 10 });
if (process.env.NODE_ENV !== "production") g.pg = client;

export const db = drizzle(client, { schema });
