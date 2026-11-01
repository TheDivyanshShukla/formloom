import { readFile } from "@/features/responses/server/service";
import { currentUserId } from "@/server/auth";

export async function GET(_: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const uid = await currentUserId();
  if (!uid) return new Response("Sign in to view this file", { status: 401 });
  const key = (await ctx.params).key.join("/");
  const body = await readFile(uid, key);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(body), {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${key.split("/").pop()}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
