import { type NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/features/integrations/google/server/service";
import { env } from "@/server/env";
import { currentUserId } from "@/server/auth";

export async function GET(req: NextRequest) {
  const base = env.NEXT_PUBLIC_APP_URL;
  const userId = await currentUserId();
  if (!userId) {
    // Come back here after signing in so the Google round trip is not lost.
    const back = new URL("/sign-in", base);
    back.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(back);
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(new URL("/forms?sheet=error", base));
  const r = await handleCallback(userId, code, state);
  if ("error" in r) {
    console.error("[sheets] callback failed:", r.error);
    const formId = state.includes(".") ? safeFormId(state) : null;
    return NextResponse.redirect(new URL(formId ? `/forms/${formId}?sheet=error` : "/forms?sheet=error", base));
  }
  return NextResponse.redirect(new URL(`/forms/${r.formId}?sheet=linked`, base));
}

/** Best-effort formId from an unverified state, only to land the user back on their form; must look like a form id. */
function safeFormId(state: string): string | null {
  try {
    const id = JSON.parse(Buffer.from(state.split(".")[0] ?? "", "base64url").toString("utf8")).formId;
    return typeof id === "string" && /^[A-Za-z0-9_-]{4,32}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
