"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PlanningPeriodPreset } from "@/lib/types/momentum"
import { cn } from "@/lib/utils"

const PRESETS = [
  ["7", "7 days"],
  ["month", "Month"],
  ["custom", "Custom"],
] as const

export function PlanningPeriodControls({
  preset,
  onPresetChange,
  periodStart,
  periodEnd,
  onPeriodEndChange,
  labelHint,
  className,
  variant = "default",
}: {
  preset: PlanningPeriodPreset
  onPresetChange: (p: PlanningPeriodPreset) => void
  periodStart: string
  periodEnd: string
  onPeriodEndChange: (isoDate: string) => void
  labelHint?: string
  className?: string
  /** Segmented strip (e.g. schedule page) — no headings, calendar-style */
  variant?: "default" | "toolbar"
}) {
  if (variant === "toolbar") {
    return (
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-2 sm:gap-3",
          className
        )}
      >
        <div
          className="inline-flex shrink-0 rounded-lg border border-border bg-muted/50 p-0.5"
          role="tablist"
          aria-label="Planning period"
        >
          {PRESETS.map(([id, text]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={preset === id}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                preset === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onPresetChange(id)}
            >
              {text}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <Input
            id="period-end-toolbar"
            type="date"
            value={periodEnd}
            min={periodStart}
            onChange={(e) => onPeriodEndChange(e.target.value)}
            className="h-8 w-[9.5rem] shrink-0 text-xs sm:w-36 sm:text-sm"
          />
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm font-medium">Planning period</p>
        <p className="text-muted-foreground text-xs">
          How far ahead manual and automatic recovery plans run.{" "}
          {labelHint}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([id, text]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={preset === id ? "default" : "outline"}
            onClick={() => onPresetChange(id)}
          >
            {id === "month" ? "Rest of month" : text}
          </Button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="period-end">Plan through (inclusive)</Label>
          <Input
            id="period-end"
            type="date"
            value={periodEnd}
            min={periodStart}
            onChange={(e) => onPeriodEndChange(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
