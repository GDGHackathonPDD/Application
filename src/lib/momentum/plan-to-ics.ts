import type { OverallTask, UserPlan } from "@/lib/types/momentum"

/** RFC 5545 TEXT escaping for SUMMARY, DESCRIPTION, etc. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
}

/**
 * Fold content lines to max 75 octets per RFC 5545 (CRLF + space continuations).
 * Assumes ASCII / BMP; sufficient for our exported summaries.
 */
export function foldLine(line: string): string {
  if (line.length <= 75) return line
  const segments: string[] = []
  let rest = line
  segments.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 0) {
    const next = " " + rest
    if (next.length <= 75) {
      segments.push(next)
      break
    }
    segments.push(next.slice(0, 75))
    rest = next.slice(75)
  }
  return segments.join("\r\n")
}

function addOneCalendarDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${day}`
}

function formatIcsLocalFloating(dt: Date): string {
  const y = dt.getFullYear()
  const mo = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")
  const h = String(dt.getHours()).padStart(2, "0")
  const mi = String(dt.getMinutes()).padStart(2, "0")
  const s = String(dt.getSeconds()).padStart(2, "0")
  return `${y}${mo}${d}T${h}${mi}${s}`
}

function formatUtcStamp(d: Date): string {
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  const h = String(d.getUTCHours()).padStart(2, "0")
  const mi = String(d.getUTCMinutes()).padStart(2, "0")
  const s = String(d.getUTCSeconds()).padStart(2, "0")
  return `${y}${mo}${day}T${h}${mi}${s}Z`
}

function isoDateToIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, "")
}

function pushLine(lines: string[], name: string, value: string) {
  lines.push(foldLine(`${name}:${value}`))
}

/**
 * Build a VCALENDAR 2.0 document (METHOD:PUBLISH) for the plan window.
 */
export function buildPlanIcsDocument(
  plan: UserPlan,
  tasksById: Map<string, OverallTask>
): string {
  const out: string[] = []
  const stamp = formatUtcStamp(new Date())

  out.push(foldLine("BEGIN:VCALENDAR"))
  out.push(foldLine("VERSION:2.0"))
  out.push(foldLine("PRODID:-//Momentum Coach//Schedule Export//EN"))
  out.push(foldLine("CALSCALE:GREGORIAN"))
  out.push(foldLine("METHOD:PUBLISH"))

  for (const day of plan.days) {
    const parentIdsWithBlock = new Set(day.blocks.map((b) => b.parentTaskId))

    let cursor = new Date(`${day.date}T09:00:00`)

    for (const block of day.blocks) {
      const minutes = Math.max(1, block.minutes)
      const start = new Date(cursor)
      const end = new Date(cursor)
      end.setMinutes(end.getMinutes() + minutes)

      const parentTitle = tasksById.get(block.parentTaskId)?.title
      const summary = escapeIcsText(block.title)
      const desc =
        parentTitle != null && parentTitle.length > 0
          ? escapeIcsText(`Parent: ${parentTitle}`)
          : undefined

      out.push(foldLine("BEGIN:VEVENT"))
      pushLine(out, "UID", `momentum-mini-${block.miniTaskId}@momentum-coach`)
      pushLine(out, "DTSTAMP", stamp)
      pushLine(out, "DTSTART", formatIcsLocalFloating(start))
      pushLine(out, "DTEND", formatIcsLocalFloating(end))
      pushLine(out, "SUMMARY", summary)
      if (desc) pushLine(out, "DESCRIPTION", desc)
      out.push(foldLine("END:VEVENT"))

      cursor = end
    }

    for (const taskId of day.overallDueTaskIds) {
      if (parentIdsWithBlock.has(taskId)) continue
      const task = tasksById.get(taskId)
      const title = task?.title ?? taskId
      const startDate = isoDateToIcsDate(day.date)
      const endDate = isoDateToIcsDate(addOneCalendarDay(day.date))

      out.push(foldLine("BEGIN:VEVENT"))
      pushLine(
        out,
        "UID",
        `momentum-due-${taskId}-${day.date}@momentum-coach`
      )
      pushLine(out, "DTSTAMP", stamp)
      pushLine(out, "DTSTART;VALUE=DATE", startDate)
      pushLine(out, "DTEND;VALUE=DATE", endDate)
      pushLine(out, "SUMMARY", escapeIcsText(`Due: ${title}`))
      out.push(foldLine("END:VEVENT"))
    }
  }

  out.push(foldLine("END:VCALENDAR"))
  return out.join("\r\n")
}

export function defaultMomentumIcsFilename(plan: UserPlan): string {
  const { periodStart, periodEnd } = plan.meta
  return `momentum-schedule-${periodStart}_to_${periodEnd}.ics`
}
