import { NextResponse } from "next/server";
import { z } from "zod";
import { submitResponse } from "@/features/responses/server/service";
import { FORM_ID_RE } from "@/features/forms/schema";
import { clientIp, rateLimit } from "@/server/rate-limit";

const FileAnswer = z.object({ key: z.string().max(200), name: z.string().max(200), size: z.number(), type: z.string().max(200) });
const Body = z.object({
  answers: z.record(z.string().max(100), z.union([z.string().max(20_000), z.array(z.string().max(1000)).max(200), FileAnswer])),
});

export async function POST(req: Request, ctx: RouteContext<"/api/forms/[id]/responses">) {
  const { id } = await ctx.params;
  if (!FORM_ID_RE.test(id)) return NextResponse.json({ error: "This form does not exist." }, { status: 404 });
  if (!(await rateLimit(`submit:${id}:${await clientIp()}`, 10, 60)))
    return NextResponse.json({ error: "Too many submissions. Wait a minute and try again." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  const res = await submitResponse(id, parsed.data.answers);
  if (!res.ok) return NextResponse.json({ error: res.error, errors: res.errors }, { status: res.status });
  return NextResponse.json({ ok: true, editToken: res.editToken, score: res.score }, { status: 201 });
}
