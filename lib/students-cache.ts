import { db, exec, now } from "./db";
import { fetchActiveStudents, type StudentLite } from "./firestore";

/**
 * Sync Alterncia students from Firestore into the local LibSQL mirror.
 * Avoids hammering Firestore on every agent run and lets the agent run offline-ish.
 */
export async function syncStudents(): Promise<{ count: number }> {
  const students = await fetchActiveStudents();
  if (students.length === 0) return { count: 0 };

  const c = await db();
  const sql = `INSERT INTO students (id, email, first_name, last_name, role, contract_type, diplome, diplome_recherche,
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
      duration=excluded.duration, rythme=excluded.rythme, raw=excluded.raw, synced_at=excluded.synced_at`;

  // Chunked batches to avoid huge payloads on the LibSQL HTTP transport.
  const CHUNK = 200;
  for (let i = 0; i < students.length; i += CHUNK) {
    const slice = students.slice(i, i + CHUNK);
    await c.batch(
      slice.map((s) => ({
        sql,
        args: [
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
          now(),
        ],
      })),
      "write"
    );
  }
  return { count: students.length };
}

export async function loadCachedStudents(): Promise<StudentLite[]> {
  const r = await exec(
    `SELECT id, email, first_name, last_name, role, contract_type, diplome, diplome_recherche,
            sector_id, metiers, competences, soft_skills, langues, city, mobility,
            start_year, start_month, duration, rythme, raw FROM students`
  );
  return r.rows.map((rr) => {
    const x = rr as any;
    return {
      id: x.id,
      email: x.email,
      firstName: x.first_name,
      lastName: x.last_name,
      role: x.role,
      contractType: x.contract_type ?? undefined,
      diplome: x.diplome ?? undefined,
      diplomeRecherche: x.diplome_recherche ?? undefined,
      sectorId: x.sector_id ?? undefined,
      metiers: safeJson(x.metiers, []),
      competences: safeJson(x.competences, []),
      softSkills: safeJson(x.soft_skills, []),
      langues: safeJson(x.langues, []),
      city: x.city ?? undefined,
      mobility: x.mobility ?? undefined,
      startYear: x.start_year ?? undefined,
      startMonth: x.start_month ?? undefined,
      duration: x.duration ?? undefined,
      rythme: x.rythme ?? undefined,
      raw: safeJson(x.raw, {}),
    };
  });
}

export async function countCachedStudents(): Promise<number> {
  const r = await exec("SELECT COUNT(*) as c FROM students");
  return Number((r.rows[0] as any).c);
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
