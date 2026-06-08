import { NextResponse } from "next/server";
import { syncStudents } from "@/lib/students-cache";
import { countCachedStudents } from "@/lib/students-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ cached: countCachedStudents() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const r = await syncStudents();
    return NextResponse.json({ ok: true, count: r.count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
