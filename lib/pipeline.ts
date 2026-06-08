import { db, genId, now } from "./db";
import { searchOffers, normalizeFTOffer, type FTSearchParams, type NormalizedOffer } from "./france-travail";
import { loadCachedStudents, countCachedStudents, syncStudents } from "./students-cache";
import { preFilter, scoreOffer } from "./matching";
import { findContact } from "./enrich";
import { draftEmail } from "./email";
import { listEmployers } from "./enrich";
import { getSetting } from "./settings";

export type RunMode = "scrape" | "employer_db";

export interface RunParams {
  mode: RunMode;
  /** Mots-clés (ex: "développeur web alternance"). */
  motsCles?: string;
  /** "apprentissage" | "stage" | "alternance" */
  contractType?: "apprentissage" | "stage" | "alternance";
  /** Code département (ex: "75"). */
  departement?: string;
  /** Max offres à traiter pour ce run. */
  maxOffers?: number;
  /** Score minimum pour conserver un match. */
  minScore?: number;
  /** Max matches par offre. */
  maxMatchesPerOffer?: number;
}

interface RunHandle {
  runId: string;
  log: (msg: string) => void;
}

function startRun(mode: RunMode, params: RunParams): RunHandle {
  const runId = genId("run");
  const lines: string[] = [];
  db()
    .prepare(
      `INSERT INTO runs (id, mode, status, started_at, params, logs) VALUES (?, ?, 'running', ?, ?, '')`
    )
    .run(runId, mode, now(), JSON.stringify(params));

  return {
    runId,
    log: (msg: string) => {
      const ts = new Date().toISOString().slice(11, 19);
      const line = `[${ts}] ${msg}`;
      lines.push(line);
      db().prepare("UPDATE runs SET logs = ? WHERE id = ?").run(lines.join("\n"), runId);
      // eslint-disable-next-line no-console
      console.log(`[${runId}] ${msg}`);
    },
  };
}

function finishRun(runId: string, status: "completed" | "failed", error?: string) {
  db()
    .prepare(`UPDATE runs SET status = ?, finished_at = ?, error = ? WHERE id = ?`)
    .run(status, now(), error ?? null, runId);
}

function setRunCounters(runId: string, offersFetched: number, matchesFound: number) {
  db()
    .prepare(`UPDATE runs SET offers_fetched = ?, matches_found = ? WHERE id = ?`)
    .run(offersFetched, matchesFound, runId);
}

// ----------------------------------------------------------------------------
// Main entry point — async, fire-and-forget. Status polled via /api/runs.
// ----------------------------------------------------------------------------

export async function runAgent(params: RunParams): Promise<string> {
  const minScore = params.minScore ?? Number(getSetting("AGENT_MIN_SCORE") ?? 72);
  const maxOffers = params.maxOffers ?? Number(getSetting("AGENT_MAX_OFFERS_PER_RUN") ?? 40);
  const maxMatchesPerOffer =
    params.maxMatchesPerOffer ?? Number(getSetting("AGENT_MAX_MATCHES_PER_OFFER") ?? 3);

  const handle = startRun(params.mode, params);
  const { runId, log } = handle;

  // Run async — the API route returns immediately, the pipeline keeps going.
  (async () => {
    try {
      log(`🚀 Démarrage de l'agent (mode: ${params.mode})`);

      // ---- 1. Make sure students are loaded ----
      let studentCount = countCachedStudents();
      if (studentCount === 0) {
        log("📚 Aucun étudiant en cache — synchronisation depuis Firestore…");
        const r = await syncStudents();
        studentCount = r.count;
      }
      log(`👥 ${studentCount} étudiants disponibles en cache`);
      const students = loadCachedStudents();

      // ---- 2. Fetch offers ----
      log(`🔍 Récupération des offres…`);
      const offers = await fetchOffers(params, log, maxOffers);
      setRunCounters(runId, offers.length, 0);
      log(`📋 ${offers.length} offres récupérées`);

      // ---- 3. For each offer: prefilter → LLM score → contact → email ----
      let totalMatches = 0;
      for (const [i, offer] of offers.entries()) {
        log(`(${i + 1}/${offers.length}) ${offer.title} @ ${offer.company}`);

        // Store offer
        const offerId = genId("off");
        db()
          .prepare(
            `INSERT INTO offers (id, run_id, source, external_id, title, company, sector,
              contract_type, city, postal_code, description, url, posted_at, raw)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            offerId,
            runId,
            offer.source,
            offer.externalId,
            offer.title,
            offer.company,
            offer.sector,
            offer.contractType,
            offer.city,
            offer.postalCode,
            offer.description.slice(0, 5000),
            offer.url,
            offer.postedAt,
            JSON.stringify(offer.raw)
          );

        const candidates = preFilter(offer, students);
        if (candidates.length === 0) {
          log(`   ↳ aucun candidat compatible (pre-filter)`);
          continue;
        }

        let scored;
        try {
          scored = await scoreOffer(offer, candidates, maxMatchesPerOffer);
        } catch (e: any) {
          log(`   ⚠️  scoring LLM échoué: ${e.message}`);
          continue;
        }

        const kept = scored.filter((m) => m.score >= minScore);
        if (kept.length === 0) {
          log(`   ↳ ${scored.length} candidats notés, aucun ≥ ${minScore}`);
          continue;
        }

        log(`   ✓ ${kept.length} match(s) (top: ${kept[0].score})`);

        // Resolve contact (1 call, shared across matches of this offer)
        const contact = findContact(offer);

        for (const m of kept) {
          const student = students.find((s) => s.id === m.studentId);
          if (!student) continue;

          let email;
          try {
            email = await draftEmail(offer, student, m);
          } catch (e: any) {
            log(`   ⚠️  email LLM échoué pour ${student.firstName}: ${e.message}`);
            continue;
          }

          const matchId = genId("mat");
          db()
            .prepare(
              `INSERT INTO matches (id, run_id, offer_id, student_id, score, reasons, gaps,
                contact_name, contact_role, contact_email, contact_linkedin,
                email_subject, email_body, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
            )
            .run(
              matchId,
              runId,
              offerId,
              student.id,
              m.score,
              JSON.stringify(m.reasons),
              JSON.stringify(m.gaps),
              contact.name ?? null,
              contact.role ?? null,
              contact.email ?? null,
              contact.linkedin ?? null,
              email.subject,
              email.body,
              now()
            );
          totalMatches++;
        }

        setRunCounters(runId, offers.length, totalMatches);
      }

      log(`🎉 Terminé · ${offers.length} offres traitées · ${totalMatches} matches générés`);
      finishRun(runId, "completed");
    } catch (e: any) {
      log(`❌ ÉCHEC: ${e.message}`);
      finishRun(runId, "failed", e.message);
    }
  })();

  return runId;
}

// ----------------------------------------------------------------------------
// Offer fetching: France Travail (scrape) or DB-based query (employer_db mode)
// ----------------------------------------------------------------------------

async function fetchOffers(
  params: RunParams,
  log: (m: string) => void,
  maxOffers: number
): Promise<NormalizedOffer[]> {
  if (params.mode === "scrape") {
    const fp: FTSearchParams = {
      motsCles: params.motsCles,
      typeContrat:
        params.contractType === "apprentissage" || params.contractType === "alternance"
          ? "E2"
          : params.contractType === "stage"
          ? "FS"
          : undefined,
      departement: params.departement,
      range: `0-${Math.min(maxOffers, 149)}`,
    };
    log(`   → France Travail search: ${JSON.stringify(fp)}`);
    const raws = await searchOffers(fp);
    return raws.slice(0, maxOffers).map(normalizeFTOffer);
  }

  // employer_db mode: fetch each employer's company name and search FT for offers from them
  log(`   → Mode base employeurs`);
  const employers = listEmployers(100);
  log(`   → ${employers.length} employeurs en base`);
  const offers: NormalizedOffer[] = [];
  for (const emp of employers.slice(0, 30)) {
    if (offers.length >= maxOffers) break;
    try {
      const raws = await searchOffers({
        motsCles: `"${emp.company}"`,
        range: "0-19",
      });
      log(`     ${emp.company}: ${raws.length} offres trouvées`);
      for (const r of raws.slice(0, 3)) {
        const n = normalizeFTOffer(r);
        // Inject employer DB contact if FT didn't expose one
        if (!n.contactEmail && emp.contactEmail) {
          n.contactName = emp.contactName;
          n.contactEmail = emp.contactEmail;
        }
        offers.push(n);
        if (offers.length >= maxOffers) break;
      }
    } catch (e: any) {
      log(`     ⚠️  ${emp.company}: ${e.message}`);
    }
  }
  return offers;
}
