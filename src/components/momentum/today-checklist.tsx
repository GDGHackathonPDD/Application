"use client"

import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { MiniTask, OverallTask } from "@/lib/types/momentum"
import { cn } from "@/lib/utils"

function atNoon(iso: string): Date {
  return new Date(iso + "T12:00:00")
}

function formatScheduleDay(iso: string): string {
  return atNoon(iso).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function doByParts(
  parentDue: string | undefined,
  todayIso: string
): { line: string; overdue: boolean } {
  if (!parentDue) {
    return { line: "Do by — (no due date on task)", overdue: false }
  }
  const due = atNoon(parentDue)
  const today = atNoon(todayIso)
  const overdue = due < today
  const formatted = due.toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  if (overdue) {
    return { line: `Overdue · was due ${formatted}`, overdue: true }
  }
  return { line: `Do by ${formatted}`, overdue: false }
}

function MiniRow({
  m,
  todayIso,
  tasksById,
  variant,
  onToggleComplete,
}: {
  m: MiniTask
  todayIso: string
  tasksById: Map<string, OverallTask>
  variant: "open" | "checked"
  onToggleComplete?: (miniTaskId: string, completed: boolean) => void
}) {
  const parent = tasksById.get(m.parentTaskId)
  const color = parent?.color ?? "#888"
  const { line: doByLine, overdue } = doByParts(parent?.dueDate, todayIso)
  const suggested = formatScheduleDay(m.scheduledDate)
  const isChecked = variant === "checked"

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 shadow-xs",
        isChecked ? "border-muted bg-muted/20 opacity-90" : "bg-card",
        !isChecked && overdue && "border-amber-500/40 bg-amber-500/5"
      )}
    >
      <button
        type="button"
        className={cn(
          "mt-0.5 shrink-0",
          isChecked ? "text-muted-foreground" : "text-primary"
        )}
        onClick={() => onToggleComplete?.(m.id, !m.completed)}
        aria-pressed={m.completed}
        aria-label={m.completed ? "Mark incomplete" : "Mark complete"}
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
        <p className={cn("font-medium", isChecked && "text-muted-foreground line-through decoration-muted-foreground/60")}>
          {m.title}
        </p>
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            overdue && !isChecked
              ? "text-amber-700 dark:text-amber-400"
              : "text-foreground",
            isChecked && "text-muted-foreground line-through decoration-muted-foreground/50"
          )}
        >
          {doByLine}
        </p>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>Suggested: {suggested}</span>
          <span aria-hidden>·</span>
          <span>{m.minutes} min</span>
          <Badge variant="outline" className="text-[10px] uppercase">
            {m.tier}
          </Badge>
          {parent && (
            <span className="min-w-0 truncate">{parent.title}</span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant={isChecked ? "outline" : "secondary"}
        type="button"
        onClick={() => onToggleComplete?.(m.id, !m.completed)}
      >
        {isChecked ? "Undo" : "Done"}
      </Button>
    </li>
  )
}

export function TodayChecklist({
  todayIso,
  headingLabel,
  summaryLine,
  openItems,
  checkedItems,
  tasksById,
  onToggleComplete,
}: {
  todayIso: string
  headingLabel: string
  summaryLine: string
  openItems: MiniTask[]
  checkedItems: MiniTask[]
  tasksById: Map<string, OverallTask>
  onToggleComplete?: (miniTaskId: string, completed: boolean) => void
}) {
  const totalOpenMin = openItems.reduce((a, m) => a + m.minutes, 0)

  return (
    <div className="space-y-8">
      <div>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Working on {headingLabel}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">{summaryLine}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {openItems.length} open step{openItems.length === 1 ? "" : "s"} ·{" "}
          {totalOpenMin} min
        </p>
      </div>

      {openItems.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Nothing open here—check the panel below if you need to undo a step—or
          add tasks and regenerate your plan.
        </p>
      ) : (
        <ul className="space-y-2">
          {openItems.map((m) => (
            <MiniRow
              key={m.id}
              m={m}
              todayIso={todayIso}
              tasksById={tasksById}
              variant="open"
              onToggleComplete={onToggleComplete}
            />
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t pt-6">
        <div>
          <h3 className="text-sm font-semibold">Checked</h3>
          <p className="text-muted-foreground text-xs">
            Completed steps (most recent first). Use Undo to move a step back to
            open if you tapped by mistake.
          </p>
        </div>
        {checkedItems.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed border-muted p-6 text-center text-sm">
            No completed steps yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {checkedItems.map((m) => (
              <MiniRow
                key={m.id}
                m={m}
                todayIso={todayIso}
                tasksById={tasksById}
                variant="checked"
                onToggleComplete={onToggleComplete}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
