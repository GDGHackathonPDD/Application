"use client"

import { useMemo } from "react"

import { buildAlignedWeekRows } from "@/lib/momentum/week-grid"
import { cn } from "@/lib/utils"
import type { OverallTask, UserPlan } from "@/lib/types/momentum"

import { ScheduleDayCell } from "./schedule-day-cell"

const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

export type ScheduleCalendarLayout =
  | "horizontal"
  | "weekGrid"
  | "twoRowStrip"
  | "singleRow"

function chunkDays<T>(items: T[], chunkSize: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    rows.push(items.slice(i, i + chunkSize))
  }
  return rows
}

export function ScheduleCalendar({
  plan,
  tasksById,
  today = new Date(),
  onSelectMini,
  onSelectOverall,
  layout = "horizontal",
  className,
}: {
  plan: UserPlan
  tasksById: Map<string, OverallTask>
  today?: Date
  onSelectMini?: (parentTaskId: string, miniTaskId: string) => void
  onSelectOverall?: (taskId: string) => void
  layout?: ScheduleCalendarLayout
  className?: string
}) {
  const daysByDate = useMemo(
    () => new Map(plan.days.map((d) => [d.date, d])),
    [plan.days]
  )

  const weekRows = useMemo(
    () =>
      layout === "weekGrid"
        ? buildAlignedWeekRows(
            plan.meta.periodStart,
            plan.meta.periodEnd,
            daysByDate
          )
        : null,
    [layout, plan.meta.periodEnd, plan.meta.periodStart, daysByDate]
  )

  if (layout === "weekGrid" && weekRows) {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
        <div className="bg-background/95 supports-backdrop-filter:backdrop-blur-sm sticky top-0 z-20 grid grid-cols-7 gap-2 border-b py-2">
          {WEEK_LABELS.map((d) => (
            <div
              key={d}
              className="text-muted-foreground text-center text-[11px] font-medium tracking-wide uppercase"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 pt-3">
          {weekRows.map((row) => {
            const first = row.cells[0]
            const rowKey =
              first.kind === "out" ? first.date : first.day.date
            return (
            <div
              key={rowKey}
              className="grid min-h-[14rem] grid-cols-7 items-start gap-2 sm:min-h-[16rem]"
            >
              {row.cells.map((cell) => {
                if (cell.kind === "out") {
                  return (
                    <ScheduleDayCell
                      key={cell.date}
                      day={null}
                      dateIso={cell.date}
                      isPadding
                      tasksById={tasksById}
                      today={today}
                      compact
                      onSelectMini={onSelectMini}
                      onSelectOverall={onSelectOverall}
                    />
                  )
                }
                return (
                  <ScheduleDayCell
                    key={cell.day.date}
                    day={cell.day}
                    dateIso={cell.day.date}
                    isPadding={false}
                    tasksById={tasksById}
                    today={today}
                    compact
                    onSelectMini={onSelectMini}
                    onSelectOverall={onSelectOverall}
                  />
                )
              })}
            </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (layout === "twoRowStrip") {
    const rows = chunkDays(plan.days, 7)
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 sm:gap-4",
          className
        )}
      >
        {rows.map((rowDays, rowIdx) => (
          <div
            key={rowDays[0]?.date ?? rowIdx}
            className={cn(
              "rounded-2xl border p-2 shadow-sm sm:p-3",
              rowIdx === 0
                ? "border-border/60 bg-card/40"
                : "border-border/50 bg-muted/25"
            )}
          >
            <div className="grid min-h-0 grid-cols-7 items-start gap-2">
              {rowDays.map((day) => (
                <ScheduleDayCell
                  key={day.date}
                  day={day}
                  dateIso={day.date}
                  isPadding={false}
                  tasksById={tasksById}
                  today={today}
                  compact
                  onSelectMini={onSelectMini}
                  onSelectOverall={onSelectOverall}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (layout === "singleRow") {
    return (
      <div
        className={cn("grid min-h-0 items-start gap-2", className)}
        style={{
          gridTemplateColumns: `repeat(${plan.days.length}, minmax(0, 1fr))`,
        }}
      >
        {plan.days.map((day) => (
          <ScheduleDayCell
            key={day.date}
            day={day}
            dateIso={day.date}
            isPadding={false}
            tasksById={tasksById}
            today={today}
            onSelectMini={onSelectMini}
            onSelectOverall={onSelectOverall}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]",
        className
      )}
    >
      <div className="flex min-w-max items-start gap-3">
        {plan.days.map((day) => (
          <ScheduleDayCell
            key={day.date}
            day={day}
            dateIso={day.date}
            isPadding={false}
            tasksById={tasksById}
            today={today}
            onSelectMini={onSelectMini}
            onSelectOverall={onSelectOverall}
          />
        ))}
      </div>
    </div>
  )
}
