import { NextRequest, NextResponse } from "next/server";
import { verify, COOKIE_NAME } from "@/lib/auth-token";

/**
 * Site-wide password gate.
 *
 * Activates only when AGENT_ACCESS_PASSWORD is set — keeps local dev open.
 * Public paths: /login (the form) and /api/auth/* (the form's endpoints).
 */

const PUBLIC_PATHS = ["/login", "/api/auth/"];

export async function middleware(req: NextRequest) {
  const password = process.env.AGENT_ACCESS_PASSWORD;
  if (!password) return NextResponse.next(); // dev / not configured → open

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (await verify(token, password)) return NextResponse.next();

  // API: return JSON 401, do NOT redirect (fetch() doesn't follow HTML redirects gracefully)
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Pages: bounce to /login with `next=` so we can come back after login
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Exclude static assets + favicon so they don't trigger the gate
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
