import { db, now } from "./db";
import { fetchActiveStudents, type StudentLite } from "./firestore";

/**
 * Sync Alterncia students from Firestore into the local SQLite mirror.
 * Avoids hammering Firestore on every agent run and lets the agent run offline-ish.
 */
export async function syncStudents(): Promise<{ count: number }> {
  const students = await fetchActiveStudents();
  const stmt = db().prepare(`
    INSERT INTO students (id, email, first_name, last_name, role, contract_type, diplome, diplome_recherche,
      sector_id, metiers, competences, soft_skills, langues, city, mobility, start_year, start_month,
      duration, rythme, raw, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email=excluded.email, first_name=excluded.first_name, last_name=excluded.last_name,
      contract_type=excluded.contract_type, diplome=excluded.diplome,
      diplome_recherche=excluded.diplome_recherche, sector_id=excluded.sector_id,
      metiers=excluded.metiers, competences=excluded.competences,
      soft_skills=excluded.soft_skills, langues=excluded.langues, city=excluded.city,
      mobility=excluded.mobility, start_year=excluded.start_year, start_month=excluded.start_month,
      duration=excluded.duration, rythme=excluded.rythme, raw=excluded.raw, synced_at=excluded.synced_at
  `);
  const tx = db().transaction((rows: StudentLite[]) => {
    for (const s of rows) {
      stmt.run(
        s.id,
        s.email,
        s.firstName,
        s.lastName,
        s.role,
        s.contractType ?? null,
        s.diplome ?? null,
        s.diplomeRecherche ?? null,
        s.sectorId ?? null,
        JSON.stringify(s.metiers ?? []),
        JSON.stringify(s.competences ?? []),
        JSON.stringify(s.softSkills ?? []),
        JSON.stringify(s.langues ?? []),
        s.city ?? null,
        s.mobility ?? null,
        s.startYear ?? null,
        s.startMonth ?? null,
        s.duration ?? null,
        s.rythme ?? null,
        JSON.stringify(s.raw ?? {}),
        now()
      );
    }
  });
  tx(students);
  return { count: students.length };
}

export function loadCachedStudents(): StudentLite[] {
  const rows = db()
    .prepare(
      `SELECT id, email, first_name, last_name, role, contract_type, diplome, diplome_recherche,
              sector_id, metiers, competences, soft_skills, langues, city, mobility,
              start_year, start_month, duration, rythme, raw FROM students`
    )
    .all() as any[];
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    role: r.role,
    contractType: r.contract_type ?? undefined,
    diplome: r.diplome ?? undefined,
    diplomeRecherche: r.diplome_recherche ?? undefined,
    sectorId: r.sector_id ?? undefined,
    metiers: safeJson(r.metiers, []),
    competences: safeJson(r.competences, []),
    softSkills: safeJson(r.soft_skills, []),
    langues: safeJson(r.langues, []),
    city: r.city ?? undefined,
    mobility: r.mobility ?? undefined,
    startYear: r.start_year ?? undefined,
    startMonth: r.start_month ?? undefined,
    duration: r.duration ?? undefined,
    rythme: r.rythme ?? undefined,
    raw: safeJson(r.raw, {}),
  }));
}

export function countCachedStudents(): number {
  const r = db().prepare("SELECT COUNT(*) as c FROM students").get() as { c: number };
  return r.c;
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
