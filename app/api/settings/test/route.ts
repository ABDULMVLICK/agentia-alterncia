import { NextResponse } from "next/server";
import { llm, getModel } from "@/lib/llm";
import { searchOffers } from "@/lib/france-travail";
import { searchAdzuna, isAdzunaConfigured } from "@/lib/adzuna";
import { firestore } from "@/lib/firestore";
import { warmSettingsCache, getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Verify that each external integration actually works with the configured creds.
 * Returns per-service status so the user can fix what's broken before launching a run.
 */
export async function POST() {
  await warmSettingsCache();
  const results: Record<string, { ok: boolean; detail: string }> = {};

  // Anthropic — tiny ping with 1 token max
  try {
    const r = await llm().messages.create({
      model: getModel(),
      max_tokens: 5,
      messages: [{ role: "user", content: "ping" }],
    });
    const text = r.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("");
    results.anthropic = { ok: true, detail: `modèle OK (${text.slice(0, 30)})` };
  } catch (e: any) {
    results.anthropic = { ok: false, detail: e.message };
  }

  // Job source — test whichever provider is configured (Adzuna preferred, FT fallback).
  const useAdzuna = isAdzunaConfigured();
  const ftConfigured = !!getSetting("FRANCE_TRAVAIL_CLIENT_ID") && !!getSetting("FRANCE_TRAVAIL_CLIENT_SECRET");

  if (useAdzuna) {
    try {
      const offers = await searchAdzuna({ what: "alternance", resultsPerPage: 1 });
      results.adzuna = { ok: true, detail: `API accessible (${offers.length} échantillon)` };
    } catch (e: any) {
      results.adzuna = { ok: false, detail: e.message };
    }
  } else if (ftConfigured) {
    try {
      const offers = await searchOffers({ range: "0-0", motsCles: "alternance" });
      results.franceTravail = { ok: true, detail: `API accessible (${offers.length} échantillon)` };
    } catch (e: any) {
      results.franceTravail = { ok: false, detail: e.message };
    }
  } else {
    results.jobSource = {
      ok: false,
      detail: "Aucune source d'offres configurée — remplis Adzuna OU France Travail.",
    };
  }

  // Firebase — list 1 user doc
  try {
    const snap = await firestore().collection("users").limit(1).get();
    results.firebase = { ok: true, detail: `Firestore OK (${snap.size} doc échantillon)` };
  } catch (e: any) {
    results.firebase = { ok: false, detail: e.message };
  }

  const allOk = Object.values(results).every((r) => r.ok);
  return NextResponse.json({ ok: allOk, results });
}
