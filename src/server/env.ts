import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const optional = z.string().optional().transform((v) => v || undefined);

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    AUTH_SECRET: z.string().min(32),
    AUTH_GOOGLE_ID: optional,
    AUTH_GOOGLE_SECRET: optional,
    ANTHROPIC_API_KEY: optional,
    FORMLOOM_MODEL: z.string().default("claude-opus-5-5"),
    STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
    /** Which proxy header to trust for the client IP: none (socket only), cloudflare (cf-connecting-ip), proxy (last x-forwarded-for hop). */
    TRUST_PROXY: z.enum(["none", "cloudflare", "proxy"]).default("none"),
    /** Shared secret for POST /api/jobs/deliveries (cron). Unset = endpoint disabled. */
    JOB_KEY: optional,
    /** Resend API key. Unset = response emails are not sent. */
    RESEND_API_KEY: optional,
    /** From address Resend has verified, e.g. Formloom <forms@example.com>. */
    MAIL_FROM: optional,
    R2_ACCOUNT_ID: optional,
    R2_ACCESS_KEY_ID: optional,
    R2_SECRET_ACCESS_KEY: optional,
    R2_BUCKET: optional,
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    FORMLOOM_MODEL: process.env.FORMLOOM_MODEL,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    TRUST_PROXY: process.env.TRUST_PROXY,
    JOB_KEY: process.env.JOB_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
});
