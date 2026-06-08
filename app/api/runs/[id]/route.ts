import { NextResponse } from "next/server";
import { row } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await row("SELECT * FROM runs WHERE id = ?", [id]);
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ run: r });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
