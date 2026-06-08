import type { NormalizedOffer } from "./france-travail";
import type { StudentLite } from "./firestore";
import { jsonCompletion } from "./llm";

const DIPLOME_RANK: Record<string, number> = {
  college: 1,
  lycee: 2,
  "cap-bep": 3,
  bac: 4,
  bac2: 5,
  bac3: 6,
  bac5: 7,
};

/**
 * Cheap rule-based pre-filter — applied before invoking the LLM to keep cost bounded.
 * Returns students that could plausibly match the offer (hard filters only).
 */
export function preFilter(offer: NormalizedOffer, students: StudentLite[]): StudentLite[] {
  return students.filter((s) => {
    // Contract type alignment (only enforce if offer + student both declare one)
    if (offer.contractType && s.contractType && offer.contractType !== s.contractType) return false;

    // Diplôme: student's targeted level must be ≥ offer requirement
    if (offer.niveauRequis) {
      const req = inferDiplomeRank(offer.niveauRequis);
      const got = DIPLOME_RANK[s.diplomeRecherche ?? s.diplome ?? ""] ?? 0;
      if (req > 0 && got > 0 && got < req) return false;
    }
    return true;
  });
}

function inferDiplomeRank(label: string): number {
  const l = label.toLowerCase();
  if (l.includes("bac+5") || l.includes("master") || l.includes("ingénieur")) return 7;
  if (l.includes("bac+3") || l.includes("licence")) return 6;
  if (l.includes("bac+2") || l.includes("bts") || l.includes("dut")) return 5;
  if (l.includes("bac")) return 4;
  if (l.includes("cap") || l.includes("bep")) return 3;
  return 0;
}

// ----------------------------------------------------------------------------
// LLM scoring — one call per offer, batches the top N pre-filtered students.
// ----------------------------------------------------------------------------

export interface ScoredMatch {
  studentId: string;
  score: number; // 0-100
  reasons: string[];
  gaps: string[];
}

const SCORING_SCHEMA = `{
  "matches": [
    {
      "studentId": "string (must be one of the provided ids)",
      "score": number (0-100, integer),
      "reasons": ["3-4 raisons concrètes du match"],
      "gaps": ["1-3 limites éventuelles"]
    }
  ]
}`;

export async function scoreOffer(
  offer: NormalizedOffer,
  candidates: StudentLite[],
  topK = 5
): Promise<ScoredMatch[]> {
  if (candidates.length === 0) return [];

  const slim = candidates.slice(0, 25).map((s) => ({
    id: s.id,
    role: s.role,
    diplome: s.diplomeRecherche ?? s.diplome,
    contractType: s.contractType,
    sectorId: s.sectorId,
    metiers: s.metiers,
    competences: (s.competences ?? []).map((c) => `${c.competence}:${c.niveau}`).slice(0, 12),
    softSkills: s.softSkills?.slice(0, 8),
    langues: (s.langues ?? []).map((l) => `${l.langue}:${l.niveau}`),
    city: s.city,
    rythme: s.rythme,
  }));

  const offerForLlm = {
    title: offer.title,
    company: offer.company,
    sector: offer.sector,
    contractType: offer.contractType,
    city: offer.city,
    niveauRequis: offer.niveauRequis,
    experience: offer.experience,
    competencesRequises: offer.requiredCompetences,
    softSkills: offer.softSkills,
    langues: offer.langues,
    description: offer.description.slice(0, 1500),
  };

  const system = `Tu es l'agent de matching d'Alterncia, une plateforme française d'alternance/stage.
Tu reçois UNE offre d'emploi et une liste de candidats étudiants pré-filtrés.
Tu dois noter chaque candidat de 0 à 100 sur sa pertinence pour CETTE offre.
Critères de pondération :
- Adéquation métier / secteur : 25%
- Compétences techniques requises vs maîtrisées : 30%
- Localisation et mobilité : 15%
- Soft skills attendus : 15%
- Langues, rythme, diplôme : 15%
Sois strict. Un score >= 80 = très bon fit. >= 90 = candidat évident.
Ne retourne QUE les ${topK} meilleurs candidats avec un score >= 60.`;

  const user = `Offre :\n${JSON.stringify(offerForLlm, null, 2)}\n\nCandidats :\n${JSON.stringify(slim, null, 2)}\n\nClasse-les par score décroissant.`;

  const result = await jsonCompletion<{ matches: ScoredMatch[] }>({
    system,
    user,
    schema: SCORING_SCHEMA,
    maxTokens: 2000,
  });

  return (result.matches ?? [])
    .filter((m) => candidates.some((c) => c.id === m.studentId))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
