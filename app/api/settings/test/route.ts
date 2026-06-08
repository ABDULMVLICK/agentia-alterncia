import { NextResponse } from "next/server";
import { llm, getModel } from "@/lib/llm";
import { searchOffers } from "@/lib/france-travail";
import { firestore } from "@/lib/firestore";
import { warmSettingsCache } from "@/lib/settings";

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

  // France Travail — search for 1 offer
  try {
    const offers = await searchOffers({ range: "0-0", motsCles: "alternance" });
    results.franceTravail = { ok: true, detail: `API accessible (${offers.length} échantillon)` };
  } catch (e: any) {
    results.franceTravail = { ok: false, detail: e.message };
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
