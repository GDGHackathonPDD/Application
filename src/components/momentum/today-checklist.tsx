"use client"

import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { MiniTask, OverallTask } from "@/lib/types/momentum"
import { cn } from "@/lib/utils"

export function TodayChecklist({
  dateLabel,
  summaryLine,
  items,
  tasksById,
  onToggleComplete,
}: {
  dateLabel: string
  summaryLine: string
  items: MiniTask[]
  tasksById: Map<string, OverallTask>
  onToggleComplete?: (miniTaskId: string, completed: boolean) => void
}) {
  const totalMin = items.reduce((a, m) => a + m.minutes, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{dateLabel}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{summaryLine}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {items.length} blocks · {totalMin} min total
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Nothing scheduled today—catch up on backlog or regenerate your plan.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((m) => {
            const parent = tasksById.get(m.parentTaskId)
            const color = parent?.color ?? "#888"
            return (
              <li
                key={m.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border bg-card p-3 shadow-xs"
                )}
              >
                <button
                  type="button"
                  className="mt-0.5 shrink-0 text-primary"
                  onClick={() => onToggleComplete?.(m.id, !m.completed)}
                  aria-pressed={m.completed}
                  aria-label={
                    m.completed ? "Mark incomplete" : "Mark complete"
                  }
                >
                  {m.completed ? (
                    <CheckCircleIcon className="size-6" weight="fill" />
                  ) : (
                    <CircleIcon className="size-6" />
                  )}
                </button>
                <div
                  className="min-w-0 flex-1 border-l-4 pl-3"
                  style={{ borderColor: color }}
                >
                  <p className="font-medium">{m.title}</p>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span>{m.minutes} min</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {m.tier}
                    </Badge>
                    {parent && (
                      <span className="truncate">{parent.title}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => onToggleComplete?.(m.id, !m.completed)}
                >
                  {m.completed ? "Undo" : "Mark complete"}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
