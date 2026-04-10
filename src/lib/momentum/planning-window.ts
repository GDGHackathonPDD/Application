import type {
  MiniTask,
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

/**
 * Ensures the schedule never ends before an open task due date or an incomplete mini’s scheduled day.
 */
export function extendCalendarRangeWithWorkDates(
  periodStart: string,
  periodEnd: string,
  tasks: OverallTask[],
  minisByParent: Map<string, MiniTask[]>
): { periodStart: string; periodEnd: string } {
  let end = periodEnd
  for (const t of tasks) {
    if (t.dueDate > end) end = t.dueDate
  }
  for (const arr of minisByParent.values()) {
    for (const m of arr) {
      if (!m.completed && m.scheduledDate > end) end = m.scheduledDate
    }
  }
  return { periodStart, periodEnd: end }
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
    // Default schedule strip: 3 calendar days before anchor through 10 after (inclusive).
    const ps = toISODate(addDays(anchor, -3))
    const pe = toISODate(addDays(anchor, 10))
    const span = eachISODateInRange(ps, pe).length
    return {
      periodStart: ps,
      periodEnd: pe,
      label: `${formatInclusiveRangeLabel(ps, pe)} · ${span} days`,
    }
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
  /** Plan JSON can still list blocks after a parent task is deleted; only show blocks for current tasks. */
  const validParentIds = new Set(tasks.map((t) => t.id))

  const byDate = new Map(
    plan.days.map((d) => {
      const blocks = d.blocks
        .filter((b) => validParentIds.has(b.parentTaskId))
        .sort((a, b) => {
          if (a.parentTaskId !== b.parentTaskId) return a.parentTaskId.localeCompare(b.parentTaskId);
          return (a.planOrder ?? 0) - (b.planOrder ?? 0);
        })
      const scheduledMinutes = blocks.reduce((s, b) => s + b.minutes, 0)
      return [d.date, { ...d, blocks, scheduledMinutes }] as const
    })
  )
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
    /** Always from the user's current weekly template — not plan JSON snapshots (they go stale). */
    const templateHours = hoursForWeekday(d, availability)

    if (existing) {
      const merged = new Set(
        [...existing.overallDueTaskIds, ...dueIds].filter((id) => validParentIds.has(id))
      )
      return {
        ...existing,
        availableHours: templateHours,
        overallDueTaskIds: [...merged],
      }
    }

    return {
      date,
      availableHours: templateHours,
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
