"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  FeasibilityPayload,
  MiniTask,
  OverallTask,
  UserPlan,
  WeeklyAvailability,
} from "@/lib/types/momentum"
import { MOCK_AVAILABILITY } from "@/lib/mock/momentum"
import { miniTasksForFocus } from "@/lib/momentum/plan-minis"
import {
  buildCalendarPlanForWindow,
  formatInclusiveRangeLabel,
} from "@/lib/momentum/planning-window"
import { getVisibleWeekRange } from "@/lib/momentum/week-grid"

import { FeasibilityBanner } from "./feasibility-banner"
import { IcsExportPanel } from "./ics-export-panel"
import { PlanUpdateCallout } from "./plan-update-callout"
import { ScheduleCalendar } from "./schedule-calendar"
import { StatusBadge } from "./status-badge"
import { TaskFocusPanel } from "./task-focus-panel"

export function DashboardClient({
  tasks,
  plan,
  feasibility,
  initialMinisByParent,
  weekAnchor = new Date(),
  weeklyAvailability = MOCK_AVAILABILITY,
}: {
  tasks: OverallTask[]
  plan: UserPlan
  feasibility: FeasibilityPayload
  initialMinisByParent: Map<string, MiniTask[]>
  /** Calendar “today” / week window anchor */
  weekAnchor?: Date
  weeklyAvailability?: WeeklyAvailability
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const taskId = searchParams.get("task")

  const tasksById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks]
  )

  const focusedTask = taskId ? tasksById.get(taskId) : undefined

  const [weekOffset, setWeekOffset] = useState(0)
  const pendingWindowScrollY = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (pendingWindowScrollY.current === null) return
    const y = pendingWindowScrollY.current
    pendingWindowScrollY.current = null
    window.scrollTo({ top: y, left: 0, behavior: "auto" })
  }, [weekOffset])

  const { weekPlan, weekRangeLabel } = useMemo(() => {
    const { periodStart, periodEnd } = getVisibleWeekRange(
      weekAnchor,
      weekOffset
    )
    return {
      weekPlan: buildCalendarPlanForWindow(
        plan,
        periodStart,
        periodEnd,
        weeklyAvailability,
        tasks
      ),
      weekRangeLabel: formatInclusiveRangeLabel(periodStart, periodEnd),
    }
  }, [plan, tasks, weekAnchor, weekOffset, weeklyAvailability])

  const setTaskQuery = useCallback(
    (id: string | null) => {
      if (!id) {
        router.push("/dashboard", { scroll: false })
        return
      }
      const q = new URLSearchParams(searchParams.toString())
      q.set("task", id)
      router.push(`/dashboard?${q.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const minisForFocus = useMemo(() => {
    if (!focusedTask) return []
    return miniTasksForFocus(
      plan,
      focusedTask.id,
      initialMinisByParent.get(focusedTask.id) ?? []
    )
  }, [plan, focusedTask, initialMinisByParent])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Recovery</h1>
            <StatusBadge status={feasibility.status} />
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm">
            {feasibility.headline}
          </p>
          <p className="text-muted-foreground text-sm">{feasibility.subtext}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/today">Today</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/schedule" scroll={false}>
              Full schedule
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Remaining work"
          value={`${feasibility.remainingHours.toFixed(1)} h`}
        />
        <MetricCard
          title="Available (window)"
          value={`${feasibility.availableHours.toFixed(1)} h`}
        />
        <MetricCard
          title="Gap / shortfall"
          value={
            feasibility.shortfallHours != null
              ? `+${feasibility.shortfallHours.toFixed(1)} h`
              : "—"
          }
        />
        <MetricCard
          title="Overload score"
          value={
            feasibility.overloadScore != null
              ? String(feasibility.overloadScore)
              : "—"
          }
        />
      </div>

      <FeasibilityBanner feasibility={feasibility} />

      {plan.updateSummary && (
        <PlanUpdateCallout
          updatedAt={plan.updatedAt}
          updateReason={plan.updateReason}
          updateSummary={plan.updateSummary}
        />
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Weekly schedule</CardTitle>
              <p className="text-muted-foreground text-sm tabular-nums">
                {weekRangeLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  pendingWindowScrollY.current = window.scrollY
                  setWeekOffset((w) => w - 1)
                }}
              >
                Previous week
              </Button>
              <Button
                type="button"
                variant={weekOffset === 0 ? "secondary" : "outline"}
                size="sm"
                disabled={weekOffset === 0}
                onClick={() => {
                  pendingWindowScrollY.current = window.scrollY
                  setWeekOffset(0)
                }}
              >
                This week
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  pendingWindowScrollY.current = window.scrollY
                  setWeekOffset((w) => w + 1)
                }}
              >
                Next week
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pb-8">
          <IcsExportPanel
            plan={weekPlan}
            tasksById={tasksById}
            rangeLabel={weekRangeLabel}
          />
          <div className="min-h-[min(48vh,26rem)] pb-4 sm:min-h-[min(52vh,32rem)]">
            <ScheduleCalendar
              plan={weekPlan}
              layout="singleRow"
              tasksById={tasksById}
              today={weekAnchor}
              onSelectMini={(parentId) => setTaskQuery(parentId)}
              onSelectOverall={setTaskQuery}
            />
          </div>
        </CardContent>
      </Card>

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

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
