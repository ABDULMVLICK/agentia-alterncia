import type { Client, InValue, Row } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

/**
 * LibSQL/Turso client.
 *
 * Resolution:
 *  - Remote (Vercel / prod): `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` → uses the web client
 *    (HTTP-only, no native deps, works in any Node serverless runtime).
 *  - Local dev: `file:./data/agent.db` via the standard Node client (libsql native binding).
 *
 * Both expose the same `Client` API so app code is identical.
 */

let _client: Client | null = null;
let _migrationPromise: Promise<void> | null = null;

function localFileUrl(): string {
  const dataDir =
    process.env.AGENT_DATA_DIR ??
    (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? "/tmp/agent-data"
      : path.join(process.cwd(), "data"));
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch (e: any) {
    throw new Error(
      `Impossible de créer le dossier de données (${dataDir}): ${e.message}. ` +
        `Définis AGENT_DATA_DIR vers un chemin accessible en écriture.`
    );
  }
  return `file:${path.join(dataDir, "agent.db")}`;
}

async function makeClient(): Promise<Client> {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    // HTTP-only client — pure JS, no native bindings. Safe on any serverless runtime.
    const { createClient } = await import("@libsql/client/web");
    return createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  // Local dev: file mode (native libsql binding).
  const { createClient } = await import("@libsql/client");
  return createClient({ url: localFileUrl() });
}

export async function db(): Promise<Client> {
  if (!_client) _client = await makeClient();
  if (!_migrationPromise) _migrationPromise = migrate(_client);
  await _migrationPromise;
  return _client;
}

// Convenience wrappers — kept tiny so call sites stay readable.
export async function exec(sql: string, args: InValue[] = []) {
  const c = await db();
  return c.execute({ sql, args });
}
export async function row<T = Row>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  const r = await exec(sql, args);
  return r.rows[0] as T | undefined;
}
export async function rows<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
  const r = await exec(sql, args);
  return r.rows as T[];
}

async function migrate(c: Client) {
  // Each statement runs separately so the migration is portable across libsql variants.
  const stmts = [
    `CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      email TEXT,
      first_name TEXT,
      last_name TEXT,
      role TEXT,
      contract_type TEXT,
      diplome TEXT,
      diplome_recherche TEXT,
      sector_id TEXT,
      metiers TEXT,
      competences TEXT,
      soft_skills TEXT,
      langues TEXT,
      city TEXT,
      mobility TEXT,
      start_year INTEGER,
      start_month INTEGER,
      duration TEXT,
      rythme TEXT,
      summary TEXT,
      raw TEXT,
      synced_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      mode TEXT,
      status TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      offers_fetched INTEGER DEFAULT 0,
      matches_found INTEGER DEFAULT 0,
      params TEXT,
      error TEXT,
      logs TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      source TEXT,
      external_id TEXT,
      title TEXT,
      company TEXT,
      company_id TEXT,
      sector TEXT,
      contract_type TEXT,
      city TEXT,
      postal_code TEXT,
      description TEXT,
      url TEXT,
      posted_at TEXT,
      raw TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_offers_run ON offers(run_id)`,
    `CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      offer_id TEXT,
      student_id TEXT,
      score INTEGER,
      reasons TEXT,
      gaps TEXT,
      contact_name TEXT,
      contact_role TEXT,
      contact_email TEXT,
      contact_linkedin TEXT,
      email_subject TEXT,
      email_body TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_matches_run ON matches(run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(score DESC)`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS employers (
      id TEXT PRIMARY KEY,
      company TEXT,
      website TEXT,
      sector TEXT,
      city TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_role TEXT,
      notes TEXT,
      created_at INTEGER
    )`,
  ];
  for (const s of stmts) await c.execute(s);
}

export function now(): number {
  return Date.now();
}

export function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
