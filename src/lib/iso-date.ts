/** Parse `YYYY-MM-DD` as a local calendar date (no UTC shift). */
export function parseIsoToLocalDate(iso: string): Date {
  const parts = iso.split("-").map(Number)
  const y = parts[0]!
  const m = parts[1]!
  const d = parts[2]!
  return new Date(y, m - 1, d)
}

export function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
