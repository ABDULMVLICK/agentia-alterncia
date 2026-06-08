import { db, now } from "./db";

/**
 * DB-backed settings, fall back to env vars.
 * Values entered through the UI take precedence over the .env file so the client
 * can manage her own API keys without touching deployment config.
 */

export type SettingKey =
  | "ANTHROPIC_API_KEY"
  | "ANTHROPIC_MODEL"
  | "FRANCE_TRAVAIL_CLIENT_ID"
  | "FRANCE_TRAVAIL_CLIENT_SECRET"
  | "FIREBASE_SERVICE_ACCOUNT_JSON"
  | "FIREBASE_PROJECT_ID"
  | "AGENT_MIN_SCORE"
  | "AGENT_MAX_OFFERS_PER_RUN"
  | "AGENT_MAX_MATCHES_PER_OFFER";

/** Returns DB value if present, otherwise process.env, otherwise undefined. */
export function getSetting(key: SettingKey): string | undefined {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (row?.value) return row.value;
  return process.env[key];
}

/** Whether the value is set in DB (true) or coming from env / undefined (false). */
export function hasDbSetting(key: SettingKey): boolean {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return !!row?.value;
}

export function setSetting(key: SettingKey, value: string | null): void {
  if (value === null || value === "") {
    db().prepare("DELETE FROM settings WHERE key = ?").run(key);
    return;
  }
  db()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
    )
    .run(key, value, now());
}

export interface SettingsSummary {
  /** Whether ANY value (DB or env) is currently configured for this key. */
  configured: Record<SettingKey, boolean>;
  /** Whether the value was overridden via the UI (DB) vs coming from env. */
  fromDb: Record<SettingKey, boolean>;
  /** Last 4 chars of secret values, for visual confirmation without leaking. */
  hint: Record<SettingKey, string | null>;
  /** Plain values for non-secret keys (model, limits) — safe to echo. */
  plain: Partial<Record<SettingKey, string>>;
}

const SECRET_KEYS: SettingKey[] = [
  "ANTHROPIC_API_KEY",
  "FRANCE_TRAVAIL_CLIENT_ID",
  "FRANCE_TRAVAIL_CLIENT_SECRET",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
];

const PLAIN_KEYS: SettingKey[] = [
  "ANTHROPIC_MODEL",
  "FIREBASE_PROJECT_ID",
  "AGENT_MIN_SCORE",
  "AGENT_MAX_OFFERS_PER_RUN",
  "AGENT_MAX_MATCHES_PER_OFFER",
];

const ALL_KEYS: SettingKey[] = [...SECRET_KEYS, ...PLAIN_KEYS];

export function summarize(): SettingsSummary {
  const configured = {} as Record<SettingKey, boolean>;
  const fromDb = {} as Record<SettingKey, boolean>;
  const hint = {} as Record<SettingKey, string | null>;
  const plain: Partial<Record<SettingKey, string>> = {};

  for (const k of ALL_KEYS) {
    const v = getSetting(k);
    configured[k] = !!v;
    fromDb[k] = hasDbSetting(k);
    if (SECRET_KEYS.includes(k)) {
      hint[k] = v ? `••••${v.slice(-4)}` : null;
    } else {
      hint[k] = null;
      if (v) plain[k] = v;
    }
  }
  return { configured, fromDb, hint, plain };
}

export const ALL_SETTING_KEYS = ALL_KEYS;
export const SECRET_SETTING_KEYS = SECRET_KEYS;
