/**
 * Adzuna API client — fast alternative to France Travail.
 * Free tier: 1000 calls/month, instant signup at developer.adzuna.com.
 *
 * Doesn't natively distinguish "alternance" vs CDI like FT does, so we encode
 * the contract type into the keyword query (`what`) instead.
 */

import { getSetting } from "./settings";
import type { NormalizedOffer } from "./france-travail";

const BASE = "https://api.adzuna.com/v1/api/jobs";

export interface AdzunaSearchParams {
  /** Mots-clés (l'agent y injecte "alternance"/"stage" si demandé). */
  what?: string;
  /** Localisation libre (ville, département, "Paris", "75"…). */
  where?: string;
  /** Page (1-indexed). */
  page?: number;
  /** Max 50. */
  resultsPerPage?: number;
  /**
   * Contract type — Adzuna ne supporte que `permanent` | `contract` | `part_time`.
   * Pour alternance/stage on filtre par mot-clé dans `what` à la place.
   */
  contractType?: "permanent" | "contract" | "part_time";
}

interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  contract_type?: string;
  contract_time?: string;
  category?: { label?: string; tag?: string };
  created: string;
  redirect_url: string;
  latitude?: number;
  longitude?: number;
  salary_min?: number;
  salary_max?: number;
}

interface AdzunaResponse {
  count: number;
  results: AdzunaJob[];
}

function creds() {
  const appId = getSetting("ADZUNA_APP_ID");
  const appKey = getSetting("ADZUNA_APP_KEY");
  if (!appId || !appKey)
    throw new Error("ADZUNA_APP_ID / ADZUNA_APP_KEY manquant — configure-les dans Paramètres");
  return { appId, appKey };
}

export function isAdzunaConfigured(): boolean {
  return !!getSetting("ADZUNA_APP_ID") && !!getSetting("ADZUNA_APP_KEY");
}

export async function searchAdzuna(params: AdzunaSearchParams): Promise<AdzunaJob[]> {
  const { appId, appKey } = creds();
  const country = "fr";
  const page = params.page ?? 1;
  const q = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(Math.min(params.resultsPerPage ?? 50, 50)),
    "content-type": "application/json",
  });
  if (params.what) q.set("what", params.what);
  if (params.where) q.set("where", params.where);
  if (params.contractType) q.set(`${params.contractType === "part_time" ? "part_time" : params.contractType}`, "1");

  const r = await fetch(`${BASE}/${country}/search/${page}?${q.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Adzuna search: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as AdzunaResponse;
  return j.results ?? [];
}

export function normalizeAdzuna(o: AdzunaJob, hintContractType?: string): NormalizedOffer {
  // Best-effort contract type. If the user asked for alternance/stage, propagate that
  // signal into the output so the pre-filter respects it.
  const lowText = `${o.title} ${o.description}`.toLowerCase();
  let contractType =
    hintContractType ??
    (lowText.includes("alternance") || lowText.includes("apprenti")
      ? "apprentissage"
      : lowText.includes("stage")
      ? "stage"
      : o.contract_type === "permanent"
      ? "cdi"
      : o.contract_type === "contract"
      ? "cdd"
      : "");

  // Coarse postal code extraction from location text (e.g. "Paris (75008)")
  const postal = o.location?.display_name?.match(/\b(\d{5})\b/)?.[1] ?? "";

  return {
    source: "france-travail", // pipeline uses this discriminator; we keep the union shape stable
    externalId: o.id,
    title: o.title,
    company: o.company?.display_name ?? "Entreprise non communiquée",
    sector: o.category?.label ?? "",
    contractType,
    city: o.location?.area?.[o.location.area.length - 1] ?? o.location?.display_name ?? "",
    postalCode: postal,
    description: stripHtml(o.description ?? "").slice(0, 5000),
    requiredCompetences: [],
    softSkills: [],
    langues: [],
    url: o.redirect_url,
    postedAt: o.created,
    raw: o,
  };
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
