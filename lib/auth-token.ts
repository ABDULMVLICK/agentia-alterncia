/**
 * Web Crypto HMAC token helpers — runs in both Node and Edge runtimes
 * (used from middleware.ts AND from app/api/auth/login).
 *
 * The cookie value is hex(HMAC-SHA256(password, "agent-access-v1")). A visitor who
 * knows the password can mint a valid cookie themselves, but since the cookie is
 * HttpOnly + Secure, the password effectively *is* the secret.
 */

const ENC = new TextEncoder();
const MESSAGE = "agent-access-v1";

async function hmacHex(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENC.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(MESSAGE));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sign(password: string): Promise<string> {
  return hmacHex(password);
}

/** Timing-safe comparison so attackers can't infer the prefix from response time. */
export async function verify(token: string | undefined, password: string): Promise<boolean> {
  if (!token) return false;
  const expected = await hmacHex(password);
  if (expected.length !== token.length) return false;
  let r = 0;
  for (let i = 0; i < expected.length; i++) {
    r |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return r === 0;
}

export const COOKIE_NAME = "agent_auth";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
