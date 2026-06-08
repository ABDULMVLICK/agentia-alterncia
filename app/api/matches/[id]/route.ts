import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = db()
    .prepare(
      `SELECT m.*,
              o.title as offer_title, o.company, o.city, o.contract_type, o.url, o.description as offer_description, o.sector,
              s.first_name, s.last_name, s.email as student_email, s.role, s.diplome, s.diplome_recherche,
              s.sector_id, s.city as student_city, s.metiers, s.competences, s.soft_skills, s.langues
       FROM matches m
       JOIN offers o ON o.id = m.offer_id
       JOIN students s ON s.id = m.student_id
       WHERE m.id = ?`
    )
    .get(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ match: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { status?: "pending" | "sent" | "dismissed" };
  if (!body.status) return NextResponse.json({ error: "status manquant" }, { status: 400 });
  db().prepare("UPDATE matches SET status = ? WHERE id = ?").run(body.status, id);
  return NextResponse.json({ ok: true });
}
