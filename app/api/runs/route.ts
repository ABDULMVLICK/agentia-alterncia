import { NextResponse } from "next/server";
import { rows } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await rows(
      `SELECT id, mode, status, started_at, finished_at, offers_fetched, matches_found, error
       FROM runs ORDER BY started_at DESC LIMIT 50`
    );
    return NextResponse.json({ runs: r });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
