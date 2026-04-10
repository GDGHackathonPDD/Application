import { effectiveMinutesFromAvailableHours } from "@convex/lib/availability_cap"
import { cn } from "@/lib/utils"
import type { OverallTask, PlanDay } from "@/lib/types/momentum"

import { OverallTaskMarker } from "./overall-task-marker"
import { PlanBlock } from "./plan-block"

const weekdayFmt = new Intl.DateTimeFormat("en", { weekday: "short" })
const dayFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" })

function isSameDay(iso: string, today: Date) {
  const d = new Date(iso + "T12:00:00")
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
}

export function ScheduleDayCell({
  day,
  dateIso,
  isPadding,
  tasksById,
  today,
  compact,
  onSelectMini,
  onSelectOverall,
}: {
  day: PlanDay | null
  dateIso: string
  isPadding: boolean
  tasksById: Map<string, OverallTask>
  today: Date
  compact?: boolean
  onSelectMini?: (parentTaskId: string, miniTaskId: string) => void
  onSelectOverall?: (taskId: string) => void
}) {
  if (isPadding || !day) {
    return (
      <div
        className={cn(
          "flex min-h-[100px] flex-col rounded-xl border border-dashed bg-muted/20 p-2 shadow-none",
          compact && "min-h-[88px] p-1.5"
        )}
        aria-hidden
      >
        <p className="text-muted-foreground text-[11px] font-medium tabular-nums">
          {weekdayFmt.format(new Date(dateIso + "T12:00:00"))}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {dayFmt.format(new Date(dateIso + "T12:00:00"))}
        </p>
      </div>
    )
  }

  const isToday = isSameDay(day.date, today)
  const capacityH = effectiveMinutesFromAvailableHours(day.availableHours) / 60
  const plannedH = day.scheduledMinutes / 60
  const cap = Math.min(plannedH / Math.max(capacityH, 0.01), 1)

  /** List every deadline on this day. Do not hide a task just because it also has a Planned chunk — the mini title often does not match the assignment name. */
  const dueTaskIds = day.overallDueTaskIds.filter((id) => tasksById.has(id))

  return (
    <div
      className={cn(
        "flex min-h-[100px] min-w-0 flex-col gap-1.5 overflow-y-auto rounded-xl border bg-card p-2 shadow-xs",
        compact &&
          "max-h-[min(26rem,52vh)] min-h-0 gap-1 p-1.5 sm:max-h-[min(28rem,55vh)]",
        isToday &&
          "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <div>
        <p className="text-muted-foreground text-[11px] font-medium uppercase">
          {weekdayFmt.format(new Date(day.date + "T12:00:00"))}
        </p>
        <p className="text-sm font-medium leading-tight">
          {dayFmt.format(new Date(day.date + "T12:00:00"))}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[10px]">
          {day.availableHours}h avail
        </p>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${cap * 100}%` }}
        />
      </div>
      <p className="text-muted-foreground text-[10px]">
        {plannedH.toFixed(1)}h / {day.availableHours}h
      </p>

      {dueTaskIds.length > 0 && (
        <div
          className={cn(
            "space-y-1",
            compact &&
              dueTaskIds.length > 1 &&
              "grid grid-cols-2 gap-1 space-y-0"
          )}
        >
          <p
            className={cn(
              "text-muted-foreground text-[9px] font-medium uppercase",
              compact &&
                dueTaskIds.length > 1 &&
                "col-span-2"
            )}
          >
            Due today
          </p>
          <p
            className={cn(
              "text-muted-foreground text-[9px] leading-snug",
              compact &&
                dueTaskIds.length > 1 &&
                "col-span-2"
            )}
          >
            Deadlines on this date (overall task). Planned chunks for the same
            assignment appear below.
          </p>
          {dueTaskIds.map((id) => {
            const t = tasksById.get(id)
            if (!t) return null
            return (
              <OverallTaskMarker
                key={id}
                task={t}
                onSelect={() => onSelectOverall?.(id)}
              />
            )
          })}
        </div>
      )}

      <div
        className={cn(
          "min-h-0 space-y-1",
          compact && day.blocks.length > 1 && "grid grid-cols-2 gap-1 space-y-0"
        )}
      >
        <p
          className={cn(
            "text-muted-foreground text-[9px] font-medium uppercase",
            compact && day.blocks.length > 1 && "col-span-2"
          )}
        >
          Planned
        </p>
        {day.blocks.length === 0 ? (
          <p
            className={cn(
              "text-muted-foreground py-1 text-center text-[10px]",
              compact && "col-span-2"
            )}
          >
            —
          </p>
        ) : (
          day.blocks.map((b) => {
            const parent = tasksById.get(b.parentTaskId)
            const color = parent?.color ?? "#888"
            return (
              <PlanBlock
                key={b.miniTaskId}
                block={b}
                parentColor={color}
                onSelect={() => onSelectMini?.(b.parentTaskId, b.miniTaskId)}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
