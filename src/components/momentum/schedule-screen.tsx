"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { MOCK_AVAILABILITY } from "@/lib/mock/momentum"
import type { WeeklyAvailability } from "@/lib/types/momentum"
import {
  buildCalendarPlanForWindow,
  computePlanningRange,
} from "@/lib/momentum/planning-window"
import { countRangeDays } from "@/lib/momentum/week-grid"
import type {
  MiniTask,
  OverallTask,
  PlanningPeriodPreset,
  UserPlan,
} from "@/lib/types/momentum"

import { PlanningPeriodControls } from "./planning-period-controls"
import {
  ScheduleCalendar,
  type ScheduleCalendarLayout,
} from "./schedule-calendar"
import { TaskFocusPanel } from "./task-focus-panel"

export function ScheduleScreen({
  tasks,
  plan,
  minisByParent,
  scheduleAnchor = new Date(),
  weeklyAvailability = MOCK_AVAILABILITY,
}: {
  tasks: OverallTask[]
  plan: UserPlan
  minisByParent: Map<string, MiniTask[]>
  scheduleAnchor?: Date
  weeklyAvailability?: WeeklyAvailability
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const taskId = searchParams.get("task")

  const [preset, setPreset] = useState<PlanningPeriodPreset>("7")
  const [customEnd, setCustomEnd] = useState(() =>
    computePlanningRange("7", scheduleAnchor).periodEnd
  )

  const range = useMemo(
    () =>
      preset === "custom"
        ? computePlanningRange("custom", scheduleAnchor, customEnd)
        : computePlanningRange(preset, scheduleAnchor),
    [preset, customEnd, scheduleAnchor]
  )

  const calendarPlan = useMemo(
    () =>
      buildCalendarPlanForWindow(
        plan,
        range.periodStart,
        range.periodEnd,
        weeklyAvailability,
        tasks
      ),
    [plan, range.periodStart, range.periodEnd, tasks, weeklyAvailability]
  )

  const dayCount = useMemo(
    () => countRangeDays(range.periodStart, range.periodEnd),
    [range.periodStart, range.periodEnd]
  )

  const calendarLayout: ScheduleCalendarLayout = useMemo(() => {
    const multiWeek =
      preset === "month" || (preset === "custom" && dayCount > 7)
    return multiWeek ? "weekGrid" : "singleRow"
  }, [preset, dayCount])

  const handlePresetChange = (p: PlanningPeriodPreset) => {
    if (p === "custom") {
      const seed =
        preset === "custom"
          ? customEnd
          : computePlanningRange(preset, scheduleAnchor).periodEnd
      setCustomEnd(seed)
    }
    setPreset(p)
  }

  const tasksById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks]
  )

  const focusedTask = taskId ? tasksById.get(taskId) : undefined

  const setTaskQuery = useCallback(
    (id: string | null) => {
      if (!id) {
        router.push("/schedule")
        return
      }
      const q = new URLSearchParams(searchParams.toString())
      q.set("task", id)
      router.push(`/schedule?${q.toString()}`)
    },
    [router, searchParams]
  )

  const minisForFocus = focusedTask
    ? minisByParent.get(focusedTask.id) ?? []
    : []

  return (
    <div className="-mx-4 -mt-8 -mb-8 flex h-[calc(100dvh-4.5rem)] flex-col overflow-hidden sm:-mx-6">
      <div className="bg-background/95 supports-backdrop-filter:backdrop-blur-sm flex shrink-0 items-center gap-2 border-b px-2 py-2 sm:px-3">
        <PlanningPeriodControls
          variant="toolbar"
          preset={preset}
          onPresetChange={handlePresetChange}
          periodStart={range.periodStart}
          periodEnd={preset === "custom" ? customEnd : range.periodEnd}
          onPeriodEndChange={setCustomEnd}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs sm:text-sm"
          asChild
        >
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>

      <div className="bg-background min-h-0 flex-1 overflow-auto">
        <ScheduleCalendar
          plan={calendarPlan}
          tasksById={tasksById}
          today={scheduleAnchor}
          layout={calendarLayout}
          onSelectMini={(parentId) => setTaskQuery(parentId)}
          onSelectOverall={setTaskQuery}
          className={calendarLayout === "weekGrid" ? "min-h-full p-2 sm:p-3" : "p-2 sm:p-3"}
        />
      </div>

      <Sheet
        open={!!focusedTask}
        onOpenChange={(o) => {
          if (!o) setTaskQuery(null)
        }}
      >
        <SheetContent className="gap-6 overflow-y-auto p-6 pb-10 pt-5 sm:max-w-md sm:p-8 sm:pb-12">
          {focusedTask && (
            <>
              <SheetHeader className="space-y-1.5 p-0 pr-14 pt-1">
                <SheetTitle className="text-base">Task focus</SheetTitle>
              </SheetHeader>
              <div className="min-h-0">
                <TaskFocusPanel
                  task={focusedTask}
                  minis={minisForFocus}
                  updateSummary={plan.updateSummary}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
