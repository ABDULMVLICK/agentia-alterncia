/**
 * Decision-maker enrichment.
 *
 * Two sources, in order of preference:
 *  1. The offer's own contact field (when France Travail provides one — best signal).
 *  2. The employer-DB stored locally (the client's existing employer email list).
 *  3. A heuristic email guess based on common corporate patterns (firstname.lastname@domain) —
 *     never used as-is; surfaced as "à vérifier" so the user double-checks.
 *
 * We deliberately do NOT call paid enrichment APIs (Hunter, Apollo) by default — the user can
 * plug them in later by replacing `guessFromDomain` with an API call.
 */

import { db } from "./db";
import type { NormalizedOffer } from "./france-travail";

export interface Contact {
  name?: string;
  role?: string;
  email?: string;
  linkedin?: string;
  source: "offer" | "employer-db" | "guessed" | "none";
  confidence: "high" | "medium" | "low";
}

export function findContact(offer: NormalizedOffer): Contact {
  // 1. From the offer itself
  if (offer.contactEmail) {
    return {
      name: offer.contactName,
      email: offer.contactEmail,
      source: "offer",
      confidence: "high",
    };
  }

  // 2. From the local employer DB (matched by company name fuzzy)
  const match = db()
    .prepare(
      `SELECT contact_name, contact_role, contact_email
       FROM employers
       WHERE LOWER(company) = LOWER(?)
          OR LOWER(company) LIKE LOWER(?)
       LIMIT 1`
    )
    .get(offer.company, `%${offer.company}%`) as
    | { contact_name: string; contact_role: string; contact_email: string }
    | undefined;

  if (match && match.contact_email) {
    return {
      name: match.contact_name,
      role: match.contact_role,
      email: match.contact_email,
      source: "employer-db",
      confidence: "high",
    };
  }

  // 3. Guess from corporate domain (low confidence)
  if (offer.companyUrl) {
    const guess = guessFromDomain(offer.companyUrl);
    if (guess) {
      return { email: guess, source: "guessed", confidence: "low" };
    }
  }

  return { source: "none", confidence: "low" };
}

function guessFromDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.includes(".")) return null;
    return `contact@${host}`;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Employer DB (CSV ingestion)
// ----------------------------------------------------------------------------

export interface EmployerRow {
  company: string;
  website?: string;
  sector?: string;
  city?: string;
  contactName?: string;
  contactEmail?: string;
  contactRole?: string;
  notes?: string;
}

export function upsertEmployers(rows: EmployerRow[]): number {
  const stmt = db().prepare(`
    INSERT INTO employers (id, company, website, sector, city, contact_name, contact_email, contact_role, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      company = excluded.company,
      website = excluded.website,
      sector = excluded.sector,
      city = excluded.city,
      contact_name = excluded.contact_name,
      contact_email = excluded.contact_email,
      contact_role = excluded.contact_role,
      notes = excluded.notes
  `);

  const tx = db().transaction((rs: EmployerRow[]) => {
    for (const r of rs) {
      if (!r.company) continue;
      const id = `emp_${(r.contactEmail ?? r.company).toLowerCase().replace(/[^a-z0-9]/g, "")}`.slice(0, 64);
      stmt.run(
        id,
        r.company,
        r.website ?? null,
        r.sector ?? null,
        r.city ?? null,
        r.contactName ?? null,
        r.contactEmail ?? null,
        r.contactRole ?? null,
        r.notes ?? null,
        Date.now()
      );
    }
  });
  tx(rows);
  return rows.length;
}

export function listEmployers(limit = 500): EmployerRow[] {
  const rows = db()
    .prepare(
      `SELECT company, website, sector, city, contact_name as contactName, contact_email as contactEmail,
              contact_role as contactRole, notes
       FROM employers ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as EmployerRow[];
  return rows;
}

export function countEmployers(): number {
  const r = db().prepare("SELECT COUNT(*) as c FROM employers").get() as { c: number };
  return r.c;
}
