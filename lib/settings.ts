import { exec, row, now } from "./db";

/**
 * DB-backed settings, falling back to env vars.
 * Values entered via the UI take precedence over the .env so the client can manage
 * her own API keys without touching deployment config.
 */

export type SettingKey =
  | "ANTHROPIC_API_KEY"
  | "ANTHROPIC_MODEL"
  | "FRANCE_TRAVAIL_CLIENT_ID"
  | "FRANCE_TRAVAIL_CLIENT_SECRET"
  | "ADZUNA_APP_ID"
  | "ADZUNA_APP_KEY"
  | "FIREBASE_SERVICE_ACCOUNT_JSON"
  | "FIREBASE_PROJECT_ID"
  | "AGENT_MIN_SCORE"
  | "AGENT_MAX_OFFERS_PER_RUN"
  | "AGENT_MAX_MATCHES_PER_OFFER";

/**
 * In-memory cache so sync code paths (e.g. inside the LLM/HTTP libs, called per-request)
 * don't have to await the DB every time. Refreshed on every settings POST.
 */
let _cache: Partial<Record<SettingKey, string>> = {};
let _cacheLoaded = false;

async function loadCache() {
  const r = await exec("SELECT key, value FROM settings");
  const next: Partial<Record<SettingKey, string>> = {};
  for (const row of r.rows) {
    next[row.key as SettingKey] = row.value as string;
  }
  _cache = next;
  _cacheLoaded = true;
}

export async function warmSettingsCache(): Promise<void> {
  await loadCache();
}

/**
 * Synchronous getter — returns the cached DB value if loaded, then env, then undefined.
 * Call `warmSettingsCache()` once before tight loops so the cache is populated.
 */
export function getSetting(key: SettingKey): string | undefined {
  if (_cacheLoaded && _cache[key]) return _cache[key];
  return process.env[key];
}

export function hasDbSetting(key: SettingKey): boolean {
  return _cacheLoaded && !!_cache[key];
}

export async function setSetting(key: SettingKey, value: string | null): Promise<void> {
  if (value === null || value === "") {
    await exec("DELETE FROM settings WHERE key = ?", [key]);
    delete _cache[key];
    return;
  }
  await exec(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    [key, value, now()]
  );
  _cache[key] = value;
}

export interface SettingsSummary {
  configured: Record<SettingKey, boolean>;
  fromDb: Record<SettingKey, boolean>;
  hint: Record<SettingKey, string | null>;
  plain: Partial<Record<SettingKey, string>>;
}

const SECRET_KEYS: SettingKey[] = [
  "ANTHROPIC_API_KEY",
  "FRANCE_TRAVAIL_CLIENT_ID",
  "FRANCE_TRAVAIL_CLIENT_SECRET",
  "ADZUNA_APP_ID",
  "ADZUNA_APP_KEY",
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

export async function summarize(): Promise<SettingsSummary> {
  await loadCache();
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
