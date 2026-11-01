import { timingSafeEqual } from "node:crypto";
import { runDue } from "@/features/deliveries/server/service";
import { env } from "@/server/env";


function keyMatches(given: string | null, want: string) {
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!env.JOB_KEY) return new Response(null, { status: 404 });
  if (!keyMatches(req.headers.get("x-job-key"), env.JOB_KEY)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await runDue(100));
}
