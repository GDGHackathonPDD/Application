"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

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
  initialTodayMinis,
  onRegeneratePlan,
  regenerateBusy = false,
  regenerateError = null,
}: {
  dateIso: string
  tasks: OverallTask[]
  initialTodayMinis: MiniTask[]
  /** When set, “Regenerate plan” runs recovery-mode (segmented) scheduling via Convex + Agent API. */
  onRegeneratePlan?: () => void | Promise<void>
  regenerateBusy?: boolean
  regenerateError?: string | null
}) {
  const [minis, setMinis] = useState(initialTodayMinis)

  useEffect(() => {
    setMinis(initialTodayMinis)
  }, [initialTodayMinis])

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
            Mini tasks from your schedule for this date.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Checklist</CardTitle>
          <CardDescription>
            Mark steps complete; progress rolls up when the backend is wired.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TodayChecklist
            dateLabel={dateLabel}
            summaryLine="Focus on must-do items first; optional blocks are bonus depth."
            items={minis}
            tasksById={tasksById}
            onToggleComplete={(id, done) =>
              setMinis((prev) =>
                prev.map((m) => (m.id === id ? { ...m, completed: done } : m))
              )
            }
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
