import { NextResponse } from "next/server";
import { sign, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/auth-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { password?: string };
    const expected = process.env.AGENT_ACCESS_PASSWORD;

    // No password configured = open access; still issue a cookie so the UX feels coherent.
    if (!expected) {
      return NextResponse.json({ ok: true, openAccess: true });
    }

    if (!body.password || body.password !== expected) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }

    const token = await sign(expected);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
