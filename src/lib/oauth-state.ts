import { createHmac, randomUUID, timingSafeEqual } from "crypto";

/**
 * Signed OAuth `state` so the callback does not rely on cookies (Google’s redirect
 * back to localhost can drop SameSite cookies in some browsers).
 */
export function createOAuthState(clerkUserId: string): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_SECRET for OAuth state signing");
  }
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = JSON.stringify({
    sub: clerkUserId,
    exp,
    n: randomUUID(),
  });
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyOAuthState(state: string): { sub: string } | null {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(payload) as { sub?: string; exp?: number };
    if (typeof data.sub !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    return { sub: data.sub };
  } catch {
    return null;
  }
}
