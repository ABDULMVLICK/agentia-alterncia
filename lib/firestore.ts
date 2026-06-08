import { cert, deleteApp, getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getSetting } from "./settings";

let _app: App | null = null;
let _db: Firestore | null = null;
let _appSignature: string | null = null;

function svcAccount(): object | null {
  const inline = getSetting("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (inline) {
    try {
      // Accept either raw JSON or base64-encoded JSON
      const raw = inline.trim().startsWith("{") ? inline : Buffer.from(inline, "base64").toString("utf-8");
      return JSON.parse(raw);
    } catch (e) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON / base64-JSON");
    }
  }
  return null;
}

export function firestore(): Firestore {
  const sa = svcAccount();
  const projectId = getSetting("FIREBASE_PROJECT_ID") || (sa as any)?.project_id;
  const signature = `${projectId ?? ""}:${(sa as any)?.client_email ?? ""}`;

  // If creds changed since last init, rebuild from scratch
  if (_app && _appSignature !== signature) {
    try {
      deleteApp(_app);
    } catch {}
    _app = null;
    _db = null;
  }

  if (_db) return _db;

  if (!_app) {
    const existing = getApps()[0];
    if (existing && _appSignature === null) {
      // First call this process — adopt the global app if there's one
      _app = existing;
    } else if (sa) {
      _app = initializeApp({ credential: cert(sa as any), projectId }, `agent-${Date.now()}`);
    } else {
      _app = initializeApp({ projectId }, `agent-${Date.now()}`);
    }
  }
  _appSignature = signature;
  _db = getFirestore(_app!);
  return _db;
}

// ----------------------------------------------------------------------------
// Student fetching
// ----------------------------------------------------------------------------

export interface StudentLite {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  contractType?: string;
  diplome?: string;
  diplomeRecherche?: string;
  sectorId?: string;
  metiers?: string[];
  competences?: { competence: string; niveau: string }[];
  softSkills?: string[];
  langues?: { langue: string; niveau: string }[];
  city?: string;
  mobility?: string;
  startYear?: number;
  startMonth?: number;
  duration?: string;
  rythme?: string;
  raw: Record<string, unknown>;
}

/**
 * Fetch all active students (stagiaires + alternants + chercheurs_emploi) from Alterncia.
 * Maps the messy Firestore shape into a flat profile usable by the matcher.
 */
export async function fetchActiveStudents(limit = 2000): Promise<StudentLite[]> {
  const db = firestore();
  const STUDENT_ROLES = ["stagiaire", "alternant", "chercheur_emploi"];
  const out: StudentLite[] = [];

  for (const role of STUDENT_ROLES) {
    const snap = await db
      .collection("users")
      .where("role", "==", role)
      .where("isActive", "==", true)
      .where("isBlock", "==", false)
      .limit(Math.ceil(limit / STUDENT_ROLES.length))
      .get();

    for (const doc of snap.docs) {
      const d = doc.data();
      const q = (d.questionnaireV3 ?? d.questionnaire ?? {}) as any;
      out.push({
        id: doc.id,
        email: d.email ?? "",
        firstName: d.firstName ?? d.prenom ?? "",
        lastName: d.lastName ?? d.nom ?? "",
        role: d.role,
        contractType: q.typeContrat,
        diplome: q.niveauDiplome,
        diplomeRecherche: q.niveauRecherche,
        sectorId: q.secteurId,
        metiers: q.metiers ?? [],
        competences: q.competencesTechniques ?? [],
        softSkills: q.softSkills ?? [],
        langues: q.langues ?? [],
        city: d.city ?? d.ville ?? d.address?.city,
        mobility: d.mobility ?? d.mobilite,
        startYear: q.dateDebutAnnee,
        startMonth: q.dateDebutMois,
        duration: q.dureeContrat,
        rythme: q.rythme,
        raw: d,
      });
    }
  }
  return out;
}
