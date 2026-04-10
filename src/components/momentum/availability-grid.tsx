"use client"

import {
  ArrowCounterClockwiseIcon,
  MinusIcon,
  PlusIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_BULK_HOURS_STEP,
  formatBulkHoursStepLabel,
} from "@/lib/momentum/bulk-hours-step"
import type { WeeklyAvailability } from "@/lib/types/momentum"

const DAYS: { key: keyof WeeklyAvailability; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
]

/** Add the same duration to every day, clamped to 0–24 h and 0.5 h steps. */
function addHoursToAllDays(
  value: WeeklyAvailability,
  delta: number
): WeeklyAvailability {
  const next: WeeklyAvailability = { ...value }
  for (const { key } of DAYS) {
    const raw = Math.round((next[key] + delta) * 2) / 2
    next[key] = Math.min(24, Math.max(0, raw))
  }
  return next
}

/** All days zero — used for reset. */
export const EMPTY_WEEKLY_AVAILABILITY: WeeklyAvailability = {
  sun: 0,
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
}

export function AvailabilityGrid({
  value,
  onChange,
  stepHours = DEFAULT_BULK_HOURS_STEP,
}: {
  value: WeeklyAvailability
  onChange: (next: WeeklyAvailability) => void
  /** Same increment/decrement as task bulk buttons (hours per day). */
  stepHours?: number
}) {
  const total = DAYS.reduce((sum, d) => sum + value[d.key], 0)
  const stepLabel = formatBulkHoursStepLabel(stepHours)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Weekly availability</p>
          <p className="text-muted-foreground text-xs">
            Hours you can realistically study each day (0.5 h steps). Add /
            subtract buttons use the bulk amount at the top of this section.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">
            <span className="text-muted-foreground">Week total: </span>
            <strong>{total.toFixed(1)} h</strong>
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              onChange(addHoursToAllDays(value, stepHours))
            }
          >
            <PlusIcon className="size-4" aria-hidden />
            Add {stepLabel} h each day
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              onChange(addHoursToAllDays(value, -stepHours))
            }
          >
            <MinusIcon className="size-4" aria-hidden />
            Subtract {stepLabel} h each day
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onChange({ ...EMPTY_WEEKLY_AVAILABILITY })}
          >
            <ArrowCounterClockwiseIcon className="size-4" aria-hidden />
            Reset availability
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DAYS.map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`avail-${key}`}>{label}</Label>
            <Input
              id={`avail-${key}`}
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={value[key]}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                onChange({
                  ...value,
                  [key]: Number.isFinite(n) ? n : 0,
                })
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
