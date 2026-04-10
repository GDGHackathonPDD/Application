/**
 * AES-256-GCM encryption for Google OAuth refresh tokens at rest.
 * Set `GOOGLE_OAUTH_ENCRYPTION_KEY` in Convex env to a base64-encoded 32-byte key
 * (`openssl rand -base64 32`).
 */

function keyBytes(): Uint8Array {
  const raw = process.env.GOOGLE_OAUTH_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error("Missing GOOGLE_OAUTH_ENCRYPTION_KEY");
  }
  const cleaned = raw.trim();
  const decoded = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  if (decoded.length !== 32) {
    throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY must be base64 for exactly 32 bytes");
  }
  return decoded;
}

async function importKey(usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const raw = keyBytes();
  const keyData = new Uint8Array(raw);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

/** Returns base64(iv || ciphertext) for storage in Convex. */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await importKey("encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc);
  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptToken(serialized: string): Promise<string> {
  const combined = Uint8Array.from(atob(serialized), (c) => c.charCodeAt(0));
  if (combined.length < 13) {
    throw new Error("Invalid encrypted token payload");
  }
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await importKey("decrypt");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
