import { NextResponse } from "next/server";
import { uploadFile } from "@/features/responses/server/service";
import { FORM_ID_RE } from "@/features/forms/schema";
import { clientIp, rateLimit } from "@/server/rate-limit";

export async function POST(req: Request, ctx: RouteContext<"/api/forms/[id]/upload">) {
  const { id } = await ctx.params;
  if (!FORM_ID_RE.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Refuse oversized bodies before buffering them (uploads are capped at 25 MB; allow multipart overhead).
  const len = Number(req.headers.get("content-length") ?? "0");
  if (!len || len > 26 * 1024 * 1024) return NextResponse.json({ error: "File must be under 25 MB." }, { status: 413 });
  if (!(await rateLimit(`upload:${await clientIp()}`, 30, 60)))
    return NextResponse.json({ error: "Too many uploads. Wait a minute." }, { status: 429 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  const field = fd?.get("field");
  if (!(file instanceof File) || typeof field !== "string")
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  const res = await uploadFile(id, field, file);
  return "error" in res ? NextResponse.json(res, { status: 400 }) : NextResponse.json(res, { status: 201 });
}
