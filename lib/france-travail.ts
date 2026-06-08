/**
 * France Travail "Offres d'emploi v2" API client.
 * https://francetravail.io — free public OAuth2 API, perfect for stage/alternance.
 */

const TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";

import { getSetting } from "./settings";

interface TokenCache {
  token: string;
  expiresAt: number;
  // Bound to a specific (id+secret) pair — invalidated when settings change
  signature: string;
}
let tokenCache: TokenCache | null = null;

async function getToken(): Promise<string> {
  const id = getSetting("FRANCE_TRAVAIL_CLIENT_ID");
  const secret = getSetting("FRANCE_TRAVAIL_CLIENT_SECRET");
  if (!id || !secret) throw new Error("FRANCE_TRAVAIL_CLIENT_ID / SECRET manquant — configure-les dans Paramètres");
  const signature = `${id}:${secret}`;
  if (tokenCache && tokenCache.signature === signature && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
    scope: "api_offresdemploiv2 o2dsoffre",
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`FT token: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000, signature };
  return tokenCache.token;
}

export interface RawFTOffer {
  id: string;
  intitule: string;
  description: string;
  dateCreation: string;
  dateActualisation: string;
  lieuTravail?: { libelle?: string; codePostal?: string; commune?: string };
  romeCode?: string;
  romeLibelle?: string;
  appellationlibelle?: string;
  entreprise?: { nom?: string; description?: string; logo?: string; url?: string; entrepriseAdaptee?: boolean };
  typeContrat?: string;
  typeContratLibelle?: string;
  natureContrat?: string;
  experienceExige?: string;
  experienceLibelle?: string;
  formations?: { commentaire?: string; domaineLibelle?: string; niveauLibelle?: string; exigence?: string }[];
  langues?: { libelle?: string; exigence?: string }[];
  competences?: { libelle?: string; exigence?: string }[];
  qualitesProfessionnelles?: { libelle?: string }[];
  salaire?: { libelle?: string };
  dureeTravailLibelle?: string;
  dureeTravailLibelleConverti?: string;
  origineOffre?: { urlOrigine?: string; partenaires?: { nom?: string; url?: string; logo?: string }[] };
  contact?: { nom?: string; coordonnees1?: string; telephone?: string; courriel?: string; urlPostulation?: string };
  secteurActivite?: string;
  secteurActiviteLibelle?: string;
}

export interface FTSearchParams {
  /** Free-text query (mots-clés). */
  motsCles?: string;
  /**
   * Type de contrat :
   *  - "E2"  = Apprentissage
   *  - "FS"  = Stage
   *  - "DD" = CDD
   *  - "MIS" = Intérim
   * Multiple codes can be passed as comma-separated.
   */
  typeContrat?: string;
  /** Code département (ex: 75) ou région (ex: r:11). */
  departement?: string;
  /** Code ROME pour filtre métier. */
  codeROME?: string;
  /** Code NAF du secteur d'activité. */
  secteurActivite?: string;
  /** Number of results (max 150 per call). */
  range?: string; // "0-49"
  /** Date min (publication) ISO. */
  minCreationDate?: string;
}

export async function searchOffers(params: FTSearchParams): Promise<RawFTOffer[]> {
  const token = await getToken();
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  if (!q.has("range")) q.set("range", "0-49");

  const r = await fetch(`${SEARCH_URL}?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (r.status === 204) return []; // No content
  if (!r.ok) throw new Error(`FT search: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { resultats?: RawFTOffer[] };
  return j.resultats ?? [];
}

/**
 * Normalized shape used downstream by the matcher.
 */
export interface NormalizedOffer {
  source: "france-travail" | "employer-db";
  externalId: string;
  title: string;
  company: string;
  companyDescription?: string;
  companyUrl?: string;
  sector: string;
  contractType: string;
  city: string;
  postalCode: string;
  description: string;
  requiredCompetences: string[];
  softSkills: string[];
  langues: string[];
  niveauRequis?: string;
  experience?: string;
  url: string;
  postedAt: string;
  contactName?: string;
  contactEmail?: string;
  raw: RawFTOffer | unknown;
}

export function normalizeFTOffer(o: RawFTOffer): NormalizedOffer {
  // Map FT contract codes to our internal vocab
  const tc = (o.typeContrat ?? "").toUpperCase();
  const contractType =
    tc === "E2" ? "apprentissage"
    : tc === "FS" ? "stage"
    : tc === "CDI" ? "cdi"
    : tc === "CDD" || tc === "DD" ? "cdd"
    : tc === "MIS" ? "interim"
    : (o.typeContratLibelle?.toLowerCase() ?? "");

  return {
    source: "france-travail",
    externalId: o.id,
    title: o.intitule,
    company: o.entreprise?.nom ?? "Entreprise non communiquée",
    companyDescription: o.entreprise?.description,
    companyUrl: o.entreprise?.url,
    sector: o.secteurActiviteLibelle ?? o.romeLibelle ?? "",
    contractType,
    city: o.lieuTravail?.commune ?? o.lieuTravail?.libelle ?? "",
    postalCode: o.lieuTravail?.codePostal ?? "",
    description: o.description ?? "",
    requiredCompetences: (o.competences ?? []).map((c) => c.libelle ?? "").filter(Boolean),
    softSkills: (o.qualitesProfessionnelles ?? []).map((q) => q.libelle ?? "").filter(Boolean),
    langues: (o.langues ?? []).map((l) => l.libelle ?? "").filter(Boolean),
    niveauRequis: o.formations?.[0]?.niveauLibelle,
    experience: o.experienceLibelle,
    url: o.origineOffre?.urlOrigine ?? `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
    postedAt: o.dateCreation,
    contactName: o.contact?.nom,
    contactEmail: o.contact?.courriel,
    raw: o,
  };
}
