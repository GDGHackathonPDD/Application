import type { PlanDay } from "@/lib/types/momentum"

function atNoon(isoDate: string): Date {
  return new Date(isoDate + "T12:00:00")
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** First day of the calendar week (Sunday) containing `d` — matches common Google Calendar (US) month grid */
function startOfWeekSunday(d: Date): Date {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

/**
 * Inclusive Sun–Sat range for the calendar week containing `anchor`, shifted by
 * `weekOffset` × 7 days (0 = week of `anchor`, −1 = previous week, etc.).
 */
export function getVisibleWeekRange(
  anchor: Date,
  weekOffset: number
): { periodStart: string; periodEnd: string } {
  const week0 = startOfWeekSunday(anchor)
  const start = addDays(week0, weekOffset * 7)
  const end = addDays(start, 6)
  return { periodStart: toISODate(start), periodEnd: toISODate(end) }
}

export type WeekCell =
  | { kind: "out"; date: string }
  | { kind: "in"; day: PlanDay }

export type WeekRow = { cells: WeekCell[] }

/**
 * Builds Sun–Sat rows covering the range, with leading/trailing cells outside
 * `[periodStart, periodEnd]` marked `out` (Google month-style padding).
 */
export function buildAlignedWeekRows(
  periodStart: string,
  periodEnd: string,
  daysByDate: Map<string, PlanDay>
): WeekRow[] {
  const start = atNoon(periodStart)
  const end = atNoon(periodEnd)
  let weekStart = startOfWeekSunday(start)
  const endWeekStart = startOfWeekSunday(end)

  const rows: WeekRow[] = []

  while (weekStart <= endWeekStart) {
    const cells: WeekCell[] = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i)
      const iso = toISODate(d)
      if (iso < periodStart || iso > periodEnd) {
        cells.push({ kind: "out", date: iso })
      } else {
        const day = daysByDate.get(iso)
        cells.push({
          kind: "in",
          day: day ?? {
            date: iso,
            availableHours: 0,
            scheduledMinutes: 0,
            overallDueTaskIds: [],
            blocks: [],
          },
        })
      }
    }
    rows.push({ cells })
    weekStart = addDays(weekStart, 7)
  }

  return rows
}

export function countRangeDays(periodStart: string, periodEnd: string): number {
  let n = 0
  let cur = atNoon(periodStart)
  const end = atNoon(periodEnd)
  while (cur <= end) {
    n += 1
    cur = addDays(cur, 1)
  }
  return n
}
