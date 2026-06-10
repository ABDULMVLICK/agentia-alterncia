import { exec, genId, now } from "./db";
import { searchOffers, normalizeFTOffer, type FTSearchParams, type NormalizedOffer } from "./france-travail";
import { searchAdzuna, normalizeAdzuna, isAdzunaConfigured } from "./adzuna";
import { loadCachedStudents, countCachedStudents, syncStudents } from "./students-cache";
import { preFilter, scoreOffer } from "./matching";
import { findContact, listEmployers } from "./enrich";
import { draftEmail } from "./email";
import { getSetting, warmSettingsCache } from "./settings";

export type RunMode = "scrape" | "employer_db";

export interface RunParams {
  mode: RunMode;
  motsCles?: string;
  contractType?: "apprentissage" | "stage" | "alternance";
  departement?: string;
  maxOffers?: number;
  minScore?: number;
  maxMatchesPerOffer?: number;
}

interface RunHandle {
  runId: string;
  log: (msg: string) => Promise<void>;
}

async function startRun(mode: RunMode, params: RunParams): Promise<RunHandle> {
  const runId = genId("run");
  const lines: string[] = [];
  await exec(
    `INSERT INTO runs (id, mode, status, started_at, params, logs) VALUES (?, ?, 'running', ?, ?, '')`,
    [runId, mode, now(), JSON.stringify(params)]
  );

  return {
    runId,
    log: async (msg: string) => {
      const ts = new Date().toISOString().slice(11, 19);
      const line = `[${ts}] ${msg}`;
      lines.push(line);
      try {
        await exec("UPDATE runs SET logs = ? WHERE id = ?", [lines.join("\n"), runId]);
      } catch {
        /* swallow log persist errors so the pipeline keeps moving */
      }
      // eslint-disable-next-line no-console
      console.log(`[${runId}] ${msg}`);
    },
  };
}

async function finishRun(runId: string, status: "completed" | "failed", error?: string) {
  await exec(`UPDATE runs SET status = ?, finished_at = ?, error = ? WHERE id = ?`, [
    status,
    now(),
    error ?? null,
    runId,
  ]);
}

async function setRunCounters(runId: string, offersFetched: number, matchesFound: number) {
  await exec(`UPDATE runs SET offers_fetched = ?, matches_found = ? WHERE id = ?`, [
    offersFetched,
    matchesFound,
    runId,
  ]);
}

// ----------------------------------------------------------------------------
// Main entry point.
// On serverful hosts: fire-and-forget; the API route returns immediately.
// On serverless (Vercel): the API route should await runAgent() because background
// work after a function returns is killed. We surface this by always awaiting
// `runAgent` from the route — caller decides via `await` or not.
// ----------------------------------------------------------------------------

export async function runAgent(params: RunParams): Promise<string> {
  await warmSettingsCache();
  const minScore = params.minScore ?? Number(getSetting("AGENT_MIN_SCORE") ?? 72);
  const maxOffers = params.maxOffers ?? Number(getSetting("AGENT_MAX_OFFERS_PER_RUN") ?? 40);
  const maxMatchesPerOffer =
    params.maxMatchesPerOffer ?? Number(getSetting("AGENT_MAX_MATCHES_PER_OFFER") ?? 3);

  const handle = await startRun(params.mode, params);
  const { runId, log } = handle;

  // We don't `await` the inner IIFE — the route returns runId immediately and the
  // pipeline keeps going. On Vercel the function's maxDuration must cover the run.
  (async () => {
    try {
      await log(`🚀 Démarrage de l'agent (mode: ${params.mode})`);

      // ---- 1. Make sure students are loaded ----
      let studentCount = await countCachedStudents();
      if (studentCount === 0) {
        await log("📚 Aucun étudiant en cache — synchronisation depuis Firestore…");
        const r = await syncStudents();
        studentCount = r.count;
      }
      await log(`👥 ${studentCount} étudiants disponibles en cache`);
      const students = await loadCachedStudents();

      // ---- 2. Fetch offers ----
      await log(`🔍 Récupération des offres…`);
      const offers = await fetchOffers(params, log, maxOffers);
      await setRunCounters(runId, offers.length, 0);
      await log(`📋 ${offers.length} offres récupérées`);

      // ---- 3. For each offer: prefilter → LLM score → contact → email ----
      let totalMatches = 0;
      for (const [i, offer] of offers.entries()) {
        await log(`(${i + 1}/${offers.length}) ${offer.title} @ ${offer.company}`);

        const offerId = genId("off");
        await exec(
          `INSERT INTO offers (id, run_id, source, external_id, title, company, sector,
              contract_type, city, postal_code, description, url, posted_at, raw)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
            JSON.stringify(offer.raw),
          ]
        );

        const candidates = preFilter(offer, students);
        if (candidates.length === 0) {
          await log(`   ↳ aucun candidat compatible (pre-filter)`);
          continue;
        }

        let scored;
        try {
          scored = await scoreOffer(offer, candidates, maxMatchesPerOffer);
        } catch (e: any) {
          await log(`   ⚠️  scoring LLM échoué: ${e.message}`);
          continue;
        }

        const kept = scored.filter((m) => m.score >= minScore);
        if (kept.length === 0) {
          await log(`   ↳ ${scored.length} candidats notés, aucun ≥ ${minScore}`);
          continue;
        }

        await log(`   ✓ ${kept.length} match(s) (top: ${kept[0].score})`);

        const contact = await findContact(offer);

        for (const m of kept) {
          const student = students.find((s) => s.id === m.studentId);
          if (!student) continue;

          let email;
          try {
            email = await draftEmail(offer, student, m);
          } catch (e: any) {
            await log(`   ⚠️  email LLM échoué pour ${student.firstName}: ${e.message}`);
            continue;
          }

          const matchId = genId("mat");
          await exec(
            `INSERT INTO matches (id, run_id, offer_id, student_id, score, reasons, gaps,
                contact_name, contact_role, contact_email, contact_linkedin,
                email_subject, email_body, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [
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
              now(),
            ]
          );
          totalMatches++;
        }

        await setRunCounters(runId, offers.length, totalMatches);
      }

      await log(`🎉 Terminé · ${offers.length} offres traitées · ${totalMatches} matches générés`);
      await finishRun(runId, "completed");
    } catch (e: any) {
      await log(`❌ ÉCHEC: ${e.message}`);
      await finishRun(runId, "failed", e.message);
    }
  })();

  return runId;
}

// ----------------------------------------------------------------------------
// Offer fetching: France Travail (scrape) or DB-based query (employer_db mode)
// ----------------------------------------------------------------------------

/**
 * Pick the configured job-search provider.
 * Order: Adzuna first (instant signup) → France Travail (richer data when available).
 */
function pickProvider(): "adzuna" | "france-travail" {
  if (isAdzunaConfigured()) return "adzuna";
  return "france-travail";
}

async function fetchOffers(
  params: RunParams,
  log: (m: string) => Promise<void>,
  maxOffers: number
): Promise<NormalizedOffer[]> {
  const provider = pickProvider();
  await log(`   → Provider: ${provider}`);

  // Build a keyword query that includes the contract-type signal when needed
  // (Adzuna doesn't have an "apprentissage" filter — we encode it in the query).
  const contractKeyword =
    params.contractType === "apprentissage" || params.contractType === "alternance"
      ? "alternance"
      : params.contractType === "stage"
      ? "stage"
      : "";
  const enrichedQuery = [params.motsCles, contractKeyword].filter(Boolean).join(" ").trim();

  if (params.mode === "scrape") {
    if (provider === "adzuna") {
      await log(`   → Adzuna search: ${enrichedQuery} | where=${params.departement ?? ""}`);
      const raws = await searchAdzuna({
        what: enrichedQuery || undefined,
        where: params.departement,
        resultsPerPage: Math.min(maxOffers, 50),
      });
      return raws.slice(0, maxOffers).map((r) => normalizeAdzuna(r, params.contractType));
    }
    // France Travail fallback
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
    await log(`   → France Travail search: ${JSON.stringify(fp)}`);
    const raws = await searchOffers(fp);
    return raws.slice(0, maxOffers).map(normalizeFTOffer);
  }

  // employer_db mode: for each employer, search by company name on the picked provider
  await log(`   → Mode base employeurs (${provider})`);
  const employers = await listEmployers(100);
  await log(`   → ${employers.length} employeurs en base`);
  const offers: NormalizedOffer[] = [];

  for (const emp of employers.slice(0, 30)) {
    if (offers.length >= maxOffers) break;
    try {
      let normalized: NormalizedOffer[] = [];
      if (provider === "adzuna") {
        const raws = await searchAdzuna({
          what: `"${emp.company}" ${contractKeyword}`.trim(),
          resultsPerPage: 20,
        });
        normalized = raws.slice(0, 3).map((r) => normalizeAdzuna(r, params.contractType));
      } else {
        const raws = await searchOffers({ motsCles: `"${emp.company}"`, range: "0-19" });
        normalized = raws.slice(0, 3).map(normalizeFTOffer);
      }
      await log(`     ${emp.company}: ${normalized.length} offres trouvées`);
      for (const n of normalized) {
        // If the public listing doesn't expose a contact, fall back to the employer DB row
        if (!n.contactEmail && emp.contactEmail) {
          n.contactName = emp.contactName;
          n.contactEmail = emp.contactEmail;
        }
        offers.push(n);
        if (offers.length >= maxOffers) break;
      }
    } catch (e: any) {
      await log(`     ⚠️  ${emp.company}: ${e.message}`);
    }
  }
  return offers;
}
