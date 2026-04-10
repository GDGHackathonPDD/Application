/** Canonical site origin for OAuth redirects (no trailing slash). */
export function getAppBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base || base.trim().length === 0) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL");
  }
  return base.replace(/\/$/, "");
}
