import type { OverallTask, UserPlan } from "@/lib/types/momentum"

function addOneCalendarDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${day}`
}

/** Google expects `dateTime` + `timeZone` without a numeric offset (local wall time). */
function formatLocalDateTimeNoOffset(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  const s = String(d.getSeconds()).padStart(2, "0")
  return `${y}-${mo}-${day}T${h}:${mi}:${s}`
}

export type GooglePushEventPayload = {
  uid: string
  summary: string
  description?: string
  kind: "timed" | "allday"
  startDateTime?: string
  endDateTime?: string
  startDate?: string
  endDate?: string
}

/**
 * Same event set as {@link buildPlanIcsDocument}, structured for Google Calendar API
 * (AiGenda Calendar push).
 */
export function buildPlanGooglePushPayload(
  plan: UserPlan,
  tasksById: Map<string, OverallTask>
): { timeZone: string; events: GooglePushEventPayload[] } {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const events: GooglePushEventPayload[] = []

  for (const day of plan.days) {
    const parentIdsWithBlock = new Set(day.blocks.map((b) => b.parentTaskId))

    let cursor = new Date(`${day.date}T09:00:00`)

    for (const block of day.blocks) {
      const minutes = Math.max(1, block.minutes)
      const start = new Date(cursor)
      const end = new Date(cursor)
      end.setMinutes(end.getMinutes() + minutes)

      const parentTitle = tasksById.get(block.parentTaskId)?.title
      const summary = block.title
      const desc =
        parentTitle != null && parentTitle.length > 0
          ? `Parent: ${parentTitle}`
          : undefined

      events.push({
        uid: `mini-${block.miniTaskId}`,
        summary,
        description: desc,
        kind: "timed",
        startDateTime: formatLocalDateTimeNoOffset(start),
        endDateTime: formatLocalDateTimeNoOffset(end),
      })

      cursor = end
    }

    for (const taskId of day.overallDueTaskIds) {
      if (parentIdsWithBlock.has(taskId)) continue
      const task = tasksById.get(taskId)
      const title = task?.title ?? taskId
      const startDate = day.date
      const endDate = addOneCalendarDay(day.date)

      events.push({
        uid: `due-${taskId}-${day.date}`,
        summary: `Due: ${title}`,
        kind: "allday",
        startDate,
        endDate,
      })
    }
  }

  return { timeZone, events }
}
