"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { MOCK_AVAILABILITY } from "@/lib/mock/momentum"
import type { WeeklyAvailability } from "@/lib/types/momentum"
import { miniTasksForFocus } from "@/lib/momentum/plan-minis"
import {
  buildCalendarPlanForWindow,
  computePlanningRange,
  eachISODateInRange,
  extendCalendarRangeWithWorkDates,
  formatInclusiveRangeLabel,
} from "@/lib/momentum/planning-window"
import { countRangeDays } from "@/lib/momentum/week-grid"
import type {
  MiniTask,
  OverallTask,
  PlanningPeriodPreset,
  UserPlan,
} from "@/lib/types/momentum"

import { GoogleScheduleSync } from "./google-schedule-sync"
import { IcsExportPanel } from "./ics-export-panel"
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
  onGeneratePlan,
  generateBusy = false,
  generateError = null,
}: {
  tasks: OverallTask[]
  plan: UserPlan
  minisByParent: Map<string, MiniTask[]>
  scheduleAnchor?: Date
  weeklyAvailability?: WeeklyAvailability
  /** Full replan: segmentation agent (`/decompose`) then deterministic scheduler (Convex). */
  onGeneratePlan?: (args: { periodStart: string; periodEnd: string; preset: PlanningPeriodPreset }) => void | Promise<void>
  generateBusy?: boolean
  generateError?: string | null
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

  const rangeForCalendar = useMemo(
    () =>
      extendCalendarRangeWithWorkDates(
        range.periodStart,
        range.periodEnd,
        tasks,
        minisByParent
      ),
    [range.periodStart, range.periodEnd, tasks, minisByParent]
  )

  const calendarPlan = useMemo(
    () =>
      buildCalendarPlanForWindow(
        plan,
        rangeForCalendar.periodStart,
        rangeForCalendar.periodEnd,
        weeklyAvailability,
        tasks
      ),
    [plan, rangeForCalendar.periodStart, rangeForCalendar.periodEnd, tasks, weeklyAvailability]
  )

  const dayCount = useMemo(
    () => countRangeDays(rangeForCalendar.periodStart, rangeForCalendar.periodEnd),
    [rangeForCalendar.periodStart, rangeForCalendar.periodEnd]
  )

  const useWeekPaging = preset !== "month" && dayCount > 7
  const weekPageCount = Math.ceil(dayCount / 7)
  const [weekPage, setWeekPage] = useState(0)
  const calendarScrollRef = useRef<HTMLDivElement>(null)
  const pendingCalendarScrollTop = useRef<number | null>(null)

  useEffect(() => {
    setWeekPage((p) => Math.min(p, Math.max(0, weekPageCount - 1)))
  }, [weekPageCount, rangeForCalendar.periodStart, rangeForCalendar.periodEnd])

  useLayoutEffect(() => {
    if (pendingCalendarScrollTop.current === null) return
    const top = pendingCalendarScrollTop.current
    pendingCalendarScrollTop.current = null
    const el = calendarScrollRef.current
    if (el) el.scrollTop = top
  }, [weekPage])

  const bumpWeekPage = useCallback((fn: (p: number) => number) => {
    const el = calendarScrollRef.current
    pendingCalendarScrollTop.current = el?.scrollTop ?? 0
    setWeekPage(fn)
  }, [])

  const displayPlan = useMemo(() => {
    if (!useWeekPaging) return calendarPlan
    const dates = eachISODateInRange(
      rangeForCalendar.periodStart,
      rangeForCalendar.periodEnd
    )
    const start = weekPage * 7
    const sliceDates = dates.slice(start, start + 7)
    if (sliceDates.length === 0) return calendarPlan
    return buildCalendarPlanForWindow(
      plan,
      sliceDates[0]!,
      sliceDates[sliceDates.length - 1]!,
      weeklyAvailability,
      tasks
    )
  }, [
    useWeekPaging,
    weekPage,
    calendarPlan,
    rangeForCalendar.periodStart,
    rangeForCalendar.periodEnd,
    plan,
    weeklyAvailability,
    tasks,
  ])

  const calendarLayout: ScheduleCalendarLayout = useMemo(() => {
    if (preset === "month") return "weekGrid"
    return "singleRow"
  }, [preset])

  const exportPlan = useWeekPaging ? displayPlan : calendarPlan
  const exportRangeLabel = useWeekPaging
    ? formatInclusiveRangeLabel(
        displayPlan.meta.periodStart,
        displayPlan.meta.periodEnd
      )
    : formatInclusiveRangeLabel(
        rangeForCalendar.periodStart,
        rangeForCalendar.periodEnd
      )

  const handlePresetChange = (p: PlanningPeriodPreset) => {
    const top = calendarScrollRef.current?.scrollTop ?? 0
    setWeekPage(0)
    if (p === "custom") {
      const seed =
        preset === "custom"
          ? customEnd
          : computePlanningRange(preset, scheduleAnchor).periodEnd
      setCustomEnd(seed)
    }
    setPreset(p)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (calendarScrollRef.current) {
          calendarScrollRef.current.scrollTop = top
        }
      })
    })
  }

  const tasksById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks]
  )

  const focusedTask = taskId ? tasksById.get(taskId) : undefined

  const setTaskQuery = useCallback(
    (id: string | null) => {
      if (!id) {
        router.push("/schedule", { scroll: false })
        return
      }
      const q = new URLSearchParams(searchParams.toString())
      q.set("task", id)
      router.push(`/schedule?${q.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const minisForFocus = useMemo(() => {
    if (!focusedTask) return []
    return miniTasksForFocus(
      plan,
      focusedTask.id,
      minisByParent.get(focusedTask.id) ?? []
    )
  }, [plan, focusedTask, minisByParent])

  return (
    <div className="-mx-4 -mt-8 -mb-8 flex h-[calc(100dvh-4.5rem)] flex-col overflow-hidden sm:-mx-6">
      <div className="bg-background/95 supports-backdrop-filter:backdrop-blur-sm flex shrink-0 items-center gap-3 border-b px-4 py-3.5 sm:px-5 sm:py-4">
        <PlanningPeriodControls
          variant="toolbar"
          preset={preset}
          onPresetChange={handlePresetChange}
          periodStart={rangeForCalendar.periodStart}
          periodEnd={
            preset === "custom" ? customEnd : rangeForCalendar.periodEnd
          }
          onPeriodEndChange={setCustomEnd}
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          {onGeneratePlan ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs sm:text-sm"
              data-testid="schedule-generate-plan"
              disabled={generateBusy}
              onClick={() =>
                void onGeneratePlan({
                  periodStart: range.periodStart,
                  periodEnd: range.periodEnd,
                  preset,
                })
              }
            >
              {generateBusy ? "Planning…" : "Generate plan"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs sm:text-sm"
            asChild
          >
            <Link href="/dashboard" scroll={false}>
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
      {generateError ? (
        <div className="bg-destructive/10 text-destructive shrink-0 px-2 py-1.5 text-xs sm:px-3">
          {generateError}
        </div>
      ) : null}

      {useWeekPaging ? (
        <div className="bg-muted/30 flex shrink-0 flex-col items-center gap-1 border-b px-2 py-1.5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={weekPage <= 0}
              onClick={() =>
                bumpWeekPage((p) => Math.max(0, p - 1))
              }
            >
              Previous week
            </Button>
            <Button
              type="button"
              variant={weekPage === 0 ? "secondary" : "outline"}
              size="sm"
              className="text-xs"
              disabled={weekPage === 0}
              onClick={() => {
                pendingCalendarScrollTop.current =
                  calendarScrollRef.current?.scrollTop ?? 0
                setWeekPage(0)
              }}
            >
              This week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={weekPage >= weekPageCount - 1}
              onClick={() =>
                bumpWeekPage((p) => Math.min(weekPageCount - 1, p + 1))
              }
            >
              Next week
            </Button>
          </div>
          <span className="text-muted-foreground text-[11px] tabular-nums">
            Week {weekPage + 1} of {weekPageCount}
          </span>
        </div>
      ) : null}

      <div className="shrink-0 px-2 pt-2 sm:px-3">
        <IcsExportPanel
          plan={exportPlan}
          tasksById={tasksById}
          rangeLabel={exportRangeLabel}
          googleSync={<GoogleScheduleSync plan={exportPlan} tasksById={tasksById} />}
        />
      </div>

      <div
        ref={calendarScrollRef}
        className="bg-background min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
      >
        <div
          className={
            calendarLayout === "weekGrid"
              ? "flex min-h-[min(48vh,26rem)] flex-col pb-10 sm:min-h-[min(52vh,32rem)]"
              : "min-h-[min(48vh,26rem)] pb-10 sm:min-h-[min(52vh,32rem)]"
          }
        >
          <ScheduleCalendar
            plan={displayPlan}
            tasksById={tasksById}
            today={scheduleAnchor}
            layout={calendarLayout}
            onSelectMini={(parentId) => setTaskQuery(parentId)}
            onSelectOverall={setTaskQuery}
            className={
              calendarLayout === "weekGrid"
                ? "min-h-full p-2 sm:p-3"
                : "p-2 sm:p-3"
            }
          />
        </div>
      </div>

      <Sheet
        open={!!focusedTask}
        onOpenChange={(o) => {
          if (!o) setTaskQuery(null)
        }}
      >
        <SheetContent
          className="gap-6 overflow-y-auto p-6 pb-10 pt-5 sm:max-w-md sm:p-8 sm:pb-12"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
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
