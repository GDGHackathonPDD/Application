"use client"

import { CalendarPlusIcon, DownloadSimpleIcon } from "@phosphor-icons/react"
import { useCallback, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  buildPlanIcsDocument,
  defaultMomentumIcsFilename,
} from "@/lib/momentum/plan-to-ics"
import type { OverallTask, UserPlan } from "@/lib/types/momentum"
import { cn } from "@/lib/utils"

/** Shared width for export + Google sync actions so they align in the panel. */
export const EXPORT_PANEL_ACTION_CLASS =
  "w-full shrink-0 justify-center sm:w-64 sm:self-center"

export function IcsExportPanel({
  plan,
  tasksById,
  rangeLabel,
  className,
  googleSync,
}: {
  plan: UserPlan
  tasksById: Map<string, OverallTask>
  rangeLabel?: string
  className?: string
  /** Optional block shown below the .ics download (e.g. Google AiGenda sync). */
  googleSync?: ReactNode
}) {
  const label =
    rangeLabel ??
    `${plan.meta.periodStart} → ${plan.meta.periodEnd} (inclusive)`

  const handleDownload = useCallback(() => {
    const ics = buildPlanIcsDocument(plan, tasksById)
    const blob = new Blob([ics], {
      type: "text/calendar;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = defaultMomentumIcsFilename(plan)
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [plan, tasksById])

  return (
    <section
      id="export-calendar-ics"
      className={cn(
        "rounded-xl border border-dashed border-primary/35 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="bg-background/80 text-primary ring-border flex size-11 shrink-0 items-center justify-center rounded-lg ring-1">
            <CalendarPlusIcon className="size-6" weight="duotone" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-foreground text-base font-semibold tracking-tight">
              Export this calendar (.ics)
            </h2>
            <p className="text-muted-foreground text-sm leading-snug">
              Download a standard calendar file for Apple Calendar, Google
              Calendar, or Outlook. Times use your browser&apos;s local timezone
              as floating local times.
            </p>
            <p className="text-foreground/90 text-xs font-medium tabular-nums">
              {label}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          className={EXPORT_PANEL_ACTION_CLASS}
          onClick={handleDownload}
        >
          <DownloadSimpleIcon className="size-5" aria-hidden />
          Download .ics file
        </Button>
      </div>

      {googleSync ? (
        <div className="border-border mt-4 border-t pt-4">{googleSync}</div>
      ) : null}
    </section>
  )
}
