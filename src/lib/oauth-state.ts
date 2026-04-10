import { createHmac, randomUUID, timingSafeEqual } from "crypto";

/** Allowed post-OAuth paths (prevents open redirects). */
const ALLOWED_RETURN_PATHS = new Set(["/setup", "/schedule", "/dashboard"]);

function sanitizeReturnTo(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (!path.startsWith("/") || path.includes("//")) return undefined;
  if (!ALLOWED_RETURN_PATHS.has(path)) return undefined;
  return path;
}

/**
 * Signed OAuth `state` so the callback does not rely on cookies (Google’s redirect
 * back to localhost can drop SameSite cookies in some browsers).
 */
export function createOAuthState(clerkUserId: string, returnTo?: string): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_SECRET for OAuth state signing");
  }
  const exp = Date.now() + 10 * 60 * 1000;
  const rt = sanitizeReturnTo(returnTo);
  const payload = JSON.stringify({
    sub: clerkUserId,
    exp,
    n: randomUUID(),
    ...(rt ? { returnTo: rt } : {}),
  });
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyOAuthState(state: string): { sub: string; returnTo?: string } | null {
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
    const data = JSON.parse(payload) as {
      sub?: string;
      exp?: number;
      returnTo?: string;
    };
    if (typeof data.sub !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    const returnTo = sanitizeReturnTo(data.returnTo);
    return { sub: data.sub, ...(returnTo ? { returnTo } : {}) };
  } catch {
    return null;
  }
}
