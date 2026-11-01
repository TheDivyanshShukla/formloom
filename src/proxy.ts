import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: real authorization happens server-side in requireUser() and services.
export function proxy(req: NextRequest) {
  const hasSession =
    req.cookies.has("authjs.session-token") || req.cookies.has("__Secure-authjs.session-token");
  if (hasSession) return NextResponse.next();
  const url = new URL("/sign-in", req.url);
  url.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/forms/:path*", "/team"] };
