"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"

import { api } from "@convex/_generated/api"
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

function readConvexErrorMessage(e: unknown): string {
  if (e instanceof ConvexError) {
    const d = e.data as { message?: string }
    if (typeof d?.message === "string") return d.message
  }
  if (e instanceof Error) return e.message
  return String(e)
}

export function TodayScreen({
  dateIso,
  tasks,
  todayMinis,
}: {
  dateIso: string
  tasks: OverallTask[]
  todayMinis: MiniTask[]
}) {
  const [error, setError] = useState<string | null>(null)
  const updateChecklist = useMutation(api.checklist.update)

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

  const onToggleComplete = useCallback(
    async (miniTaskId: string, completed: boolean) => {
      setError(null)
      try {
        await updateChecklist({ id: miniTaskId, completed })
      } catch (e) {
        setError(readConvexErrorMessage(e))
      }
    },
    [updateChecklist]
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
            Mark steps complete; parent task progress updates from completed time
            blocks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive mb-3 text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <TodayChecklist
            dateLabel={dateLabel}
            summaryLine="Focus on must-do items first; optional blocks are bonus depth."
            items={todayMinis}
            tasksById={tasksById}
            onToggleComplete={onToggleComplete}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary">
          Regenerate plan
        </Button>
      </div>
    </div>
  )
}
