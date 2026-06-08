import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = db()
      .prepare(
        `SELECT id, mode, status, started_at, finished_at, offers_fetched, matches_found, error
         FROM runs ORDER BY started_at DESC LIMIT 50`
      )
      .all();
    return NextResponse.json({ runs: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
