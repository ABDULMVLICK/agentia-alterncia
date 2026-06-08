/**
 * Decision-maker enrichment.
 *
 * Sources, in order of preference:
 *  1. The offer's own contact field (when France Travail provides one — best signal).
 *  2. The employer-DB stored locally (the client's existing employer email list).
 *  3. A heuristic email guess based on common corporate patterns — surfaced as low-confidence.
 */

import { db, exec, rows } from "./db";
import type { NormalizedOffer } from "./france-travail";

export interface Contact {
  name?: string;
  role?: string;
  email?: string;
  linkedin?: string;
  source: "offer" | "employer-db" | "guessed" | "none";
  confidence: "high" | "medium" | "low";
}

export async function findContact(offer: NormalizedOffer): Promise<Contact> {
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
  const r = await exec(
    `SELECT contact_name, contact_role, contact_email
     FROM employers
     WHERE LOWER(company) = LOWER(?)
        OR LOWER(company) LIKE LOWER(?)
     LIMIT 1`,
    [offer.company, `%${offer.company}%`]
  );
  const match = r.rows[0] as unknown as
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
    if (guess) return { email: guess, source: "guessed", confidence: "low" };
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

export async function upsertEmployers(input: EmployerRow[]): Promise<number> {
  const valid = input.filter((r) => !!r.company);
  if (valid.length === 0) return 0;

  const c = await db();
  const sql = `INSERT INTO employers (id, company, website, sector, city, contact_name, contact_email, contact_role, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      company = excluded.company,
      website = excluded.website,
      sector = excluded.sector,
      city = excluded.city,
      contact_name = excluded.contact_name,
      contact_email = excluded.contact_email,
      contact_role = excluded.contact_role,
      notes = excluded.notes`;

  await c.batch(
    valid.map((r) => {
      const id = `emp_${(r.contactEmail ?? r.company).toLowerCase().replace(/[^a-z0-9]/g, "")}`.slice(0, 64);
      return {
        sql,
        args: [
          id,
          r.company,
          r.website ?? null,
          r.sector ?? null,
          r.city ?? null,
          r.contactName ?? null,
          r.contactEmail ?? null,
          r.contactRole ?? null,
          r.notes ?? null,
          Date.now(),
        ],
      };
    }),
    "write"
  );
  return valid.length;
}

export async function listEmployers(limit = 500): Promise<EmployerRow[]> {
  return await rows<EmployerRow>(
    `SELECT company, website, sector, city, contact_name as contactName, contact_email as contactEmail,
            contact_role as contactRole, notes
     FROM employers ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export async function countEmployers(): Promise<number> {
  const r = await exec("SELECT COUNT(*) as c FROM employers");
  return Number((r.rows[0] as any).c);
}
