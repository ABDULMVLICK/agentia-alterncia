import { NextResponse } from "next/server";
import { ALL_SETTING_KEYS, setSetting, summarize, type SettingKey } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(summarize());
}

/**
 * Body: { values: Record<SettingKey, string | null> }
 * - `null` or empty string → deletes the DB value (falls back to env).
 * - String of just bullets ("••••xxxx") → ignored (user didn't change the secret).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { values: Partial<Record<SettingKey, string | null>> };
  if (!body.values || typeof body.values !== "object") {
    return NextResponse.json({ error: "values manquant" }, { status: 400 });
  }

  let updated = 0;
  for (const k of ALL_SETTING_KEYS) {
    if (!(k in body.values)) continue;
    const v = body.values[k];
    if (typeof v === "string" && v.startsWith("••••")) continue; // unchanged
    setSetting(k, v ?? null);
    updated++;
  }
  return NextResponse.json({ ok: true, updated, summary: summarize() });
}
