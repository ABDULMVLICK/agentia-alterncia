import { jsonCompletion } from "./llm";
import type { NormalizedOffer } from "./france-travail";
import type { StudentLite } from "./firestore";
import type { ScoredMatch } from "./matching";

export interface DraftedEmail {
  subject: string;
  body: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
}

const SCHEMA = `{
  "subject": "string (objet du mail, court, accroche)",
  "body": "string (corps du mail en français, ton pro et chaleureux, 150-220 mots, signature 'Léa — équipe Alterncia')"
}`;

/**
 * Generate the prospection email a recruiter receives.
 * The pitch: "we noticed your offer X, we have a near-perfect candidate Y on Alterncia,
 *            create a free account to see their profile + contact them."
 */
export async function draftEmail(
  offer: NormalizedOffer,
  student: StudentLite,
  match: ScoredMatch
): Promise<DraftedEmail> {
  const system = `Tu es Léa, chargée de prospection chez Alterncia (plateforme française de matching alternance/stage).
Tu rédiges un email FROID à un recruteur/RH d'une entreprise qui vient de publier une offre.
Objectif : l'inviter à créer un compte gratuit Alterncia pour découvrir UN candidat qui matche son offre à plus de ${match.score}%.

Règles de copywriting :
- Objet : moins de 60 caractères, accroche concrète, pas de spam ("Découvrez", "Offre exclusive" sont interdits).
- Corps : 150-220 mots, ton humain, direct, jamais corporate.
- Mentionner SPÉCIFIQUEMENT l'intitulé de l'offre et le nom de l'entreprise dans la 1ère phrase pour prouver qu'on a lu.
- Donner 2-3 raisons précises du match (extrait des "reasons" fournies), sans dévoiler l'identité du candidat.
- Présenter Alterncia en une seule phrase.
- CTA unique : "créez votre compte gratuit pour accéder au profil complet" + URL https://alterncia.fr/employeur/inscription
- Pas d'emojis. Pas de "j'espère que vous allez bien".
- Signature : "Léa — équipe Alterncia\nalterncia.fr"`;

  const user = JSON.stringify(
    {
      offre: {
        titre: offer.title,
        entreprise: offer.company,
        ville: offer.city,
        contrat: offer.contractType,
      },
      candidat_anonyme: {
        diplome_recherche: student.diplomeRecherche ?? student.diplome,
        secteur: student.sectorId,
        metiers: student.metiers,
        top_competences: (student.competences ?? []).slice(0, 5).map((c) => c.competence),
        ville: student.city,
      },
      score_match: match.score,
      raisons_du_match: match.reasons,
    },
    null,
    2
  );

  return await jsonCompletion<DraftedEmail>({
    system,
    user,
    schema: SCHEMA,
    maxTokens: 1200,
  });
}
