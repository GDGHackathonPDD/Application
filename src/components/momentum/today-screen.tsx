"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { MiniTask, OverallTask } from "@/lib/types/momentum"

import { TodayChecklist } from "./today-checklist"

export function TodayScreen({
  dateIso,
  tasks,
  openMinis,
  checkedMinis,
  onToggleComplete,
  onRegeneratePlan,
  regenerateBusy = false,
  regenerateError = null,
}: {
  dateIso: string
  tasks: OverallTask[]
  openMinis: MiniTask[]
  checkedMinis: MiniTask[]
  onToggleComplete?: (miniTaskId: string, completed: boolean) => void | Promise<void>
  /** When set, “Regenerate plan” runs full replan (segmentation agent + deterministic scheduler). */
  onRegeneratePlan?: () => void | Promise<void>
  regenerateBusy?: boolean
  regenerateError?: string | null
}) {
  const tasksById = new Map(tasks.map((t) => [t.id, t]))

  const dateLabel = new Date(dateIso + "T12:00:00").toLocaleDateString(
    "en",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-muted-foreground text-sm">
            Incomplete steps from your plan, ordered by assignment deadline—not
            locked to a single calendar day.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Do by deadline</CardTitle>
          <CardDescription>
            Each step shows when the assignment is due. The suggested day is only
            how your plan spreads work—tick off when you finish the step. Checks
            update on screen right away; the server saves in the background.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TodayChecklist
            todayIso={dateIso}
            headingLabel={dateLabel}
            summaryLine="Soonest deadlines first; optional blocks are bonus depth."
            openItems={openMinis}
            checkedItems={checkedMinis}
            tasksById={tasksById}
            onToggleComplete={onToggleComplete}
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            data-testid="regenerate-plan"
            disabled={regenerateBusy || !onRegeneratePlan}
            onClick={() => void onRegeneratePlan?.()}
          >
            {regenerateBusy ? "Regenerating…" : "Regenerate plan (recovery steps)"}
          </Button>
        </div>
        {regenerateError ? (
          <p className="text-destructive text-sm" role="alert">
            {regenerateError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
