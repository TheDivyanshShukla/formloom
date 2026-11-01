import { responsesCsv } from "@/features/responses/server/service";

/** Live CSV feed: =IMPORTDATA("<url>") in Google Sheets, Data > From Web in Excel. */
export async function GET(req: Request, ctx: RouteContext<"/api/forms/[id]/csv">) {
  const { id } = await ctx.params;
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const csv = await responsesCsv(id, key);
  if (csv === null) return new Response("Not found", { status: 404 });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `inline; filename="responses-${id}.csv"`,
      "cache-control": "no-store",
    },
  });
}
