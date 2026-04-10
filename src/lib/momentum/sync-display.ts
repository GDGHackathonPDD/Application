/** Short timestamp for sync UIs (no seconds). */
export function formatCompactSyncTime(
  input: string | number | Date,
  locale?: string
): string {
  const d = input instanceof Date ? input : new Date(input)
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d)
}

/**
 * Strip `ok:` prefixes and trim server sync status for display.
 * e.g. `ok: 5 tasks synced` → `5 tasks synced`
 */
export function formatSyncStatusForDisplay(
  raw: string | undefined | null
): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()
  const ok = /^ok:\s*(.+)$/i.exec(s)
  if (ok) return ok[1]!.trim()
  if (s.startsWith("fetch_error:")) {
    const rest = s.slice("fetch_error:".length).trim()
    return rest.length > 72 ? `${rest.slice(0, 69)}…` : rest
  }
  return s.length > 80 ? `${s.slice(0, 77)}…` : s
}

/** Truncate long filenames for dense UI; keeps extension. */
export function truncateMiddleFilename(name: string, maxChars = 32): string {
  if (name.length <= maxChars) return name
  const lastDot = name.lastIndexOf(".")
  if (lastDot <= 0 || lastDot >= name.length - 1) {
    return `${name.slice(0, maxChars - 1)}…`
  }
  const ext = name.slice(lastDot)
  const base = name.slice(0, lastDot)
  const budget = maxChars - ext.length - 1
  if (budget < 6) return `${name.slice(0, maxChars - 1)}…`
  const left = Math.ceil((budget - 1) / 2)
  const right = Math.floor((budget - 1) / 2)
  return `${base.slice(0, left)}…${base.slice(-right)}${ext}`
}
