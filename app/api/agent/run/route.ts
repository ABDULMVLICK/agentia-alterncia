import { NextRequest, NextResponse } from "next/server";
import { runAgent, type RunParams } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel: allow long-running agent pipeline (up to 60s on hobby plan).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RunParams;
    if (!body.mode || (body.mode !== "scrape" && body.mode !== "employer_db")) {
      return NextResponse.json({ error: "mode invalide (scrape | employer_db)" }, { status: 400 });
    }
    const runId = await runAgent(body);
    return NextResponse.json({ runId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
