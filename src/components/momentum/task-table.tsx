"use client"

import { TrashIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  errors,
}: {
  tasks: OverallTask[]
  onChange: (id: string, patch: Partial<OverallTask>) => void
  onRemove: (id: string) => void
  errors?: Record<string, TaskRowErrors>
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Tasks</p>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Est. h</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Progress %</th>
              <th className="px-3 py-2 font-medium w-10" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const rowErr = errors?.[t.id]
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
                        {t.source === "canvas" && (
                          <span className="text-muted-foreground mt-1 inline-block text-[10px]">
                            From Canvas
                          </span>
                        )}
                        {t.source === "ics" && (
                          <span className="text-muted-foreground mt-1 inline-block text-[10px]">
                            From ICS import
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      type="date"
                      value={t.dueDate}
                      onChange={(e) =>
                        onChange(t.id, { dueDate: e.target.value })
                      }
                      aria-invalid={!!rowErr?.dueDate}
                      className={cn(rowErr?.dueDate && "border-destructive")}
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
