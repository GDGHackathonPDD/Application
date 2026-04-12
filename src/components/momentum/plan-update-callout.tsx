"use client"

import { ClockClockwiseIcon, XIcon } from "@phosphor-icons/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { PlanUpdateReason } from "@/lib/types/momentum"
import { cn } from "@/lib/utils"

const REASON_COPY: Record<PlanUpdateReason, string> = {
  initial: "Your schedule was created.",
  manual_regenerate: "Your schedule was updated when you clicked Regenerate.",
  auto_drift: "Your schedule was updated automatically because you’re behind.",
  tasks_changed: "Your schedule was updated after your tasks changed.",
  availability_changed:
    "Your schedule was updated after your daily availability changed.",
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMin = Math.round((now - then) / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin} min ago`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `${h} h ago`
  return new Date(iso).toLocaleString()
}

export function PlanUpdateCallout({
  updatedAt,
  updateReason = "manual_regenerate",
  updateSummary,
  className,
}: {
  updatedAt: string
  updateReason?: PlanUpdateReason
  updateSummary?: string
  className?: string
}) {
  const [open, setOpen] = useState(true)
  if (!open) return null

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm shadow-xs",
        className
      )}
    >
      <ClockClockwiseIcon
        className="mt-0.5 size-5 shrink-0 text-primary"
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          {REASON_COPY[updateReason]}
          <span className="text-muted-foreground font-normal">
            {" "}
            · Updated {formatRelative(updatedAt)}
          </span>
        </p>
        {updateSummary && (
          <p className="text-muted-foreground">{updateSummary}</p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        onClick={() => setOpen(false)}
        aria-label="Dismiss schedule update notice"
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  )
}
