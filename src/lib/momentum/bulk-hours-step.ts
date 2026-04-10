/** Default bulk add/subtract step (hours) for tasks and weekly availability. */
export const DEFAULT_BULK_HOURS_STEP = 1

export const BULK_HOURS_MIN = 0.5
export const BULK_HOURS_MAX = 24

/** Clamp to 0.5 h steps between min and max; invalid values fall back to default. */
export function normalizeBulkHoursStep(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BULK_HOURS_STEP
  const rounded = Math.round(n * 2) / 2
  return Math.min(BULK_HOURS_MAX, Math.max(BULK_HOURS_MIN, rounded))
}

/** Short label for buttons (e.g. 1 vs 1.5). */
export function formatBulkHoursStepLabel(n: number): string {
  const r = normalizeBulkHoursStep(n)
  return r % 1 === 0 ? String(r) : r.toFixed(1)
}
