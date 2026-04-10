import type {
  OverallTask,
  PlanningPeriodPreset,
  UserPlan,
  WeeklyAvailability,
} from "@/lib/types/momentum"

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

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0, 0)
}

export function eachISODateInRange(startIso: string, endIso: string): string[] {
  const out: string[] = []
  let cur = atNoon(startIso)
  const end = atNoon(endIso)
  while (cur <= end) {
    out.push(toISODate(cur))
    cur = addDays(cur, 1)
  }
  return out
}

/** Map getDay() 0=Sun … 6=Sat to weekly availability keys */
function hoursForWeekday(d: Date, w: WeeklyAvailability): number {
  const map: number[] = [w.sun, w.mon, w.tue, w.wed, w.thu, w.fri, w.sat]
  return map[d.getDay()] ?? 0
}

export function formatInclusiveRangeLabel(
  startIso: string,
  endIso: string
): string {
  const start = atNoon(startIso)
  const end = atNoon(endIso)
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
  return `${start.toLocaleDateString("en", opts)} → ${end.toLocaleDateString("en", opts)} (inclusive)`
}

export function computePlanningRange(
  preset: PlanningPeriodPreset,
  anchor: Date,
  customEndIso?: string
): { periodStart: string; periodEnd: string; label: string } {
  const periodStart = toISODate(anchor)
  let periodEnd: string

  if (preset === "custom") {
    const end = customEndIso && customEndIso >= periodStart ? customEndIso : periodStart
    periodEnd = end
  } else if (preset === "7") {
    periodEnd = toISODate(addDays(anchor, 6))
  } else {
    periodEnd = toISODate(endOfMonth(anchor))
  }

  const span = eachISODateInRange(periodStart, periodEnd).length
  const label = `${formatInclusiveRangeLabel(periodStart, periodEnd)} · ${span} days`

  return { periodStart, periodEnd, label }
}

/**
 * Slice/expand plan.days to the inclusive window, padding missing dates using
 * weekly availability and optional task due markers.
 */
export function buildCalendarPlanForWindow(
  plan: UserPlan,
  periodStart: string,
  periodEnd: string,
  availability: WeeklyAvailability,
  tasks: OverallTask[]
): UserPlan {
  const byDate = new Map(plan.days.map((d) => [d.date, { ...d }]))
  const dates = eachISODateInRange(periodStart, periodEnd)

  const duesByDate = new Map<string, Set<string>>()
  for (const t of tasks) {
    if (!duesByDate.has(t.dueDate)) duesByDate.set(t.dueDate, new Set())
    duesByDate.get(t.dueDate)!.add(t.id)
  }

  const days = dates.map((date) => {
    const existing = byDate.get(date)
    const d = atNoon(date)
    const dueIds = [...(duesByDate.get(date) ?? [])]

    if (existing) {
      const merged = new Set([...existing.overallDueTaskIds, ...dueIds])
      return {
        ...existing,
        overallDueTaskIds: [...merged],
      }
    }

    return {
      date,
      availableHours: hoursForWeekday(d, availability),
      scheduledMinutes: 0,
      overallDueTaskIds: dueIds,
      blocks: [],
    }
  })

  return {
    ...plan,
    meta: {
      ...plan.meta,
      periodStart,
      periodEnd,
    },
    days,
  }
}
