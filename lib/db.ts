import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  _db = new Database(path.join(DATA_DIR, "agent.db"));
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      email TEXT,
      first_name TEXT,
      last_name TEXT,
      role TEXT,
      contract_type TEXT,
      diplome TEXT,
      diplome_recherche TEXT,
      sector_id TEXT,
      metiers TEXT,           -- JSON array
      competences TEXT,       -- JSON array of {competence, niveau}
      soft_skills TEXT,       -- JSON array
      langues TEXT,           -- JSON array
      city TEXT,
      mobility TEXT,
      start_year INTEGER,
      start_month INTEGER,
      duration TEXT,
      rythme TEXT,
      summary TEXT,           -- short LLM-ready profile summary
      raw TEXT,               -- full Firestore JSON
      synced_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      mode TEXT,              -- "scrape" | "employer_db"
      status TEXT,            -- running | completed | failed
      started_at INTEGER,
      finished_at INTEGER,
      offers_fetched INTEGER DEFAULT 0,
      matches_found INTEGER DEFAULT 0,
      params TEXT,            -- JSON
      error TEXT,
      logs TEXT               -- newline-separated log lines
    );

    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      source TEXT,            -- "france-travail" | "employer-db"
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
      raw TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_offers_run ON offers(run_id);

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      offer_id TEXT,
      student_id TEXT,
      score INTEGER,            -- 0-100
      reasons TEXT,             -- JSON array of strings
      gaps TEXT,                -- JSON array of strings
      contact_name TEXT,
      contact_role TEXT,
      contact_email TEXT,
      contact_linkedin TEXT,
      email_subject TEXT,
      email_body TEXT,
      status TEXT DEFAULT 'pending',  -- pending | sent | dismissed
      created_at INTEGER,
      FOREIGN KEY (run_id) REFERENCES runs(id),
      FOREIGN KEY (offer_id) REFERENCES offers(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE INDEX IF NOT EXISTS idx_matches_run ON matches(run_id);
    CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(score DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS employers (
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
    );
  `);
}

export function now(): number {
  return Date.now();
}

export function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
