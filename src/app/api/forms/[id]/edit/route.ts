import { NextResponse } from "next/server";
import { z } from "zod";
import { getResponseForEdit, updateResponse } from "@/features/responses/server/edit";
import { clientIp, rateLimit } from "@/server/rate-limit";

const FileAnswer = z.object({ key: z.string().max(200), name: z.string().max(200), size: z.number(), type: z.string().max(200) });
const Body = z.object({
  token: z.string().min(1).max(200),
  answers: z.record(z.string().max(100), z.union([z.string().max(20_000), z.array(z.string().max(1000)).max(200), FileAnswer])),
});

const limited = async (id: string) => !(await rateLimit(`edit:${id}:${await clientIp()}`, 20, 60));
const tooMany = () => NextResponse.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
const notFound = () => NextResponse.json({ error: "This edit link is not valid." }, { status: 404 });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (await limited(id)) return tooMany();
  const res = await getResponseForEdit(id, new URL(req.url).searchParams.get("t") ?? "");
  return res ? NextResponse.json({ answers: res.answers }) : notFound();
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (await limited(id)) return tooMany();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  const res = await updateResponse(id, parsed.data.token, parsed.data.answers);
  if (!res.ok) return NextResponse.json({ error: res.error, errors: res.errors }, { status: res.status });
  return NextResponse.json({ ok: true, score: res.score });
}
