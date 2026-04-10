"use client"

import { CheckIcon, TrashIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IsoDatePicker } from "@/components/ui/iso-date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OverallTask, TaskPriority } from "@/lib/types/momentum"
import { cn } from "@/lib/utils"

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"]

function lastSourceLabel(t: OverallTask): string | null {
  const raw = t.lastSourceOfTruth
  if (raw === "canvas_ics") return "Canvas (feed)"
  if (raw === "ics_upload") return "ICS upload"
  if (raw === "google_calendar") return "Google"
  if (raw === "manual") return "Manual"
  if (t.source === "canvas") return "Canvas"
  if (t.source === "ics") return "ICS import"
  return null
}

export interface TaskRowErrors {
  title?: string
  dueDate?: string
  estimatedHours?: string
  progress?: string
}

export function TaskTable({
  tasks,
  onChange,
  onRemove,
  onMarkDone,
  errors,
}: {
  tasks: OverallTask[]
  onChange: (id: string, patch: Partial<OverallTask>) => void
  onRemove: (id: string) => void
  /** Sets progress to 100% (e.g. already finished before calendar import). */
  onMarkDone?: (id: string) => void
  errors?: Record<string, TaskRowErrors>
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Tasks</p>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Est. h</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Progress %</th>
              {onMarkDone ? (
                <th className="px-3 py-2 font-medium w-10" aria-label="Mark done" />
              ) : null}
              <th className="px-3 py-2 font-medium w-10" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const rowErr = errors?.[t.id]
              const sourceLine = lastSourceLabel(t)
              return (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-sm ring-1 ring-border"
                        style={{ backgroundColor: t.color }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <Input
                          value={t.title}
                          onChange={(e) =>
                            onChange(t.id, { title: e.target.value })
                          }
                          aria-invalid={!!rowErr?.title}
                          className={cn(rowErr?.title && "border-destructive")}
                        />
                        {rowErr?.title && (
                          <p className="text-destructive mt-1 text-xs">
                            {rowErr.title}
                          </p>
                        )}
                        {sourceLine ? (
                          <span className="text-muted-foreground mt-1 block text-[10px]">
                            Last source: {sourceLine}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <IsoDatePicker
                      value={t.dueDate}
                      onChange={(iso) => onChange(t.id, { dueDate: iso })}
                      aria-invalid={!!rowErr?.dueDate}
                      buttonClassName={cn(
                        "h-9 min-w-[10.25rem] max-w-[13rem] justify-between text-sm",
                        rowErr?.dueDate && "border-destructive"
                      )}
                    />
                    {rowErr?.dueDate && (
                      <p className="text-destructive mt-1 text-xs">
                        {rowErr.dueDate}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={t.estimatedHours}
                      onChange={(e) =>
                        onChange(t.id, {
                          estimatedHours: parseFloat(e.target.value) || 0,
                        })
                      }
                      aria-invalid={!!rowErr?.estimatedHours}
                      className={cn(
                        rowErr?.estimatedHours && "border-destructive"
                      )}
                    />
                    {rowErr?.estimatedHours && (
                      <p className="text-destructive mt-1 text-xs">
                        {rowErr.estimatedHours}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Select
                      value={t.priority}
                      onValueChange={(v) =>
                        onChange(t.id, { priority: v as TaskPriority })
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={t.progressPercent}
                      onChange={(e) =>
                        onChange(t.id, {
                          progressPercent: Math.min(
                            100,
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          ),
                        })
                      }
                      aria-invalid={!!rowErr?.progress}
                      className={cn(rowErr?.progress && "border-destructive")}
                    />
                    {rowErr?.progress && (
                      <p className="text-destructive mt-1 text-xs">
                        {rowErr.progress}
                      </p>
                    )}
                  </td>
                  {onMarkDone ? (
                    <td className="px-3 py-2 align-top">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="shrink-0"
                        disabled={t.progressPercent >= 100}
                        onClick={() => onMarkDone(t.id)}
                        title="Mark done (already finished)"
                        aria-label={`Mark ${t.title} done`}
                      >
                        <CheckIcon className="size-4" />
                      </Button>
                    </td>
                  ) : null}
                  <td className="px-3 py-2 align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemove(t.id)}
                      aria-label={`Remove ${t.title}`}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
