import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const runId = url.searchParams.get("run");
    const minScore = Number(url.searchParams.get("min") ?? 0);
    const where: string[] = ["m.score >= ?"];
    const args: any[] = [minScore];
    if (runId) {
      where.push("m.run_id = ?");
      args.push(runId);
    }
    const rows = db()
      .prepare(
        `SELECT m.id, m.run_id, m.score, m.reasons, m.gaps, m.contact_name, m.contact_email,
                m.contact_role, m.email_subject, m.status, m.created_at,
                o.title as offer_title, o.company, o.city, o.contract_type, o.url,
                s.first_name, s.last_name, s.role, s.diplome, s.diplome_recherche, s.sector_id, s.city as student_city
         FROM matches m
         JOIN offers o ON o.id = m.offer_id
         JOIN students s ON s.id = m.student_id
         WHERE ${where.join(" AND ")}
         ORDER BY m.score DESC, m.created_at DESC
         LIMIT 200`
      )
      .all(...args);
    return NextResponse.json({ matches: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
