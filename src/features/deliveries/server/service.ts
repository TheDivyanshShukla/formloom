import "server-only";
import { eq, sql } from "drizzle-orm";
import { appendToSheetResult } from "@/features/integrations/google/server/service";
import { sendWebhookOnce } from "@/features/responses/server/webhook";
import { db } from "@/server/db";
import { deliveries } from "@/server/db/schema";
import { afterFailure, LEASE_MS, shortError } from "../logic";

/*
 * Durable outbox over the `deliveries` table: enqueue inside the request, run due jobs inside `after()`
 * and from the cron route. Exponential backoff, a cap on attempts, then `deadAt`.
 */
export type Job =
  | { formId: string; kind: "webhook"; target: string; payload: unknown }
  | { formId: string; kind: "sheet"; payload: Record<string, string> };

export async function enqueue(jobs: Job[]): Promise<void> {
  if (jobs.length === 0) return;
  await db.insert(deliveries).values(
    jobs.map((j) => ({ formId: j.formId, kind: j.kind, target: j.kind === "webhook" ? j.target : null, payload: j.payload })),
  );
}

type Row = typeof deliveries.$inferSelect;
type Outcome = { ok: true } | { ok: false; permanent: boolean; reason: string };

async function attempt(r: Row): Promise<Outcome> {
  if (r.kind === "webhook") {
    if (!r.target) return { ok: false, permanent: true, reason: "no target" };
    const o = await sendWebhookOnce(r.target, r.payload);
    return o.ok ? o : { ok: false, permanent: !o.retry, reason: o.reason };
  }
  return appendToSheetResult(r.formId, r.payload as Record<string, string>);
}

/** Claim and run up to `limit` due jobs (safe to call concurrently from many instances). Never throws. */
export async function runDue(limit = 25): Promise<{ ran: number; failed: number }> {
  let ran = 0;
  let failed = 0;
  try {
    // Claim: lock due rows, push next_at out by a lease so a crashed runner's rows come back later.
    const rows = await db.transaction(async (tx) => {
      const due = (await tx.execute(sql`
        select id from deliveries
        where done_at is null and dead_at is null and next_at <= now()
        order by next_at limit ${limit} for update skip locked`)) as unknown as { id: number }[];
      if (due.length === 0) return [];
      return tx
        .update(deliveries)
        .set({ nextAt: sql`now() + ${LEASE_MS / 1000} * interval '1 second'` })
        .where(sql`${deliveries.id} in (${sql.join(due.map((d) => sql`${d.id}`), sql`, `)})`)
        .returning();
    });
    for (const r of rows) {
      ran++;
      try {
        const o = await attempt(r);
        if (o.ok) {
          await db.update(deliveries).set({ doneAt: new Date(), lastError: null }).where(eq(deliveries.id, r.id));
          continue;
        }
        failed++;
        const f = afterFailure(r.attempts, o.permanent, Date.now());
        await db
          .update(deliveries)
          .set({ attempts: f.attempts, lastError: shortError(o.reason), nextAt: f.nextAt, deadAt: f.dead ? new Date() : null })
          .where(eq(deliveries.id, r.id));
      } catch (e) {
        failed++; // row keeps its lease and is retried when it expires
        console.error(JSON.stringify({ event: "delivery.error", id: r.id, reason: e instanceof Error ? e.name : "error" }));
      }
    }
  } catch (e) {
    console.error(JSON.stringify({ event: "delivery.claim_failed", reason: e instanceof Error ? e.name : "error" }));
  }
  return { ran, failed };
}
