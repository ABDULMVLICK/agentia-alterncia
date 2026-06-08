import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "./settings";

let _client: Anthropic | null = null;
let _clientKey: string | null = null;

export function llm(): Anthropic {
  const key = getSetting("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY manquant — configure-la dans Paramètres");
  // Rebuild client if the key changed (user updated it from UI)
  if (_client && _clientKey === key) return _client;
  _client = new Anthropic({ apiKey: key });
  _clientKey = key;
  return _client;
}

export function getModel(): string {
  return getSetting("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
}

/** @deprecated use getModel() so updates from the UI take effect */
export const MODEL = "claude-sonnet-4-6";

/**
 * Call Claude with strict JSON-only output. Retries once on bad JSON.
 */
export async function jsonCompletion<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  schema?: string; // free-text description of expected shape, embedded in system prompt
}): Promise<T> {
  const sys = opts.schema
    ? `${opts.system}\n\nRéponds UNIQUEMENT avec du JSON valide qui matche:\n${opts.schema}\nPas de markdown, pas de \`\`\`json, pas de texte autour.`
    : `${opts.system}\n\nRéponds UNIQUEMENT avec du JSON valide. Pas de markdown.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await llm().messages.create({
      model: getModel(),
      max_tokens: opts.maxTokens ?? 2000,
      system: sys,
      messages: [{ role: "user", content: opts.user }],
    });
    const text = r.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("")
      .trim();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch (e) {
      if (attempt === 1) throw new Error(`LLM JSON parse failed: ${text.slice(0, 200)}`);
    }
  }
  throw new Error("unreachable");
}

export async function textCompletion(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const r = await llm().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return r.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("")
    .trim();
}
