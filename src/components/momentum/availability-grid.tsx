"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export function AvailabilityGrid({
  value,
  onChange,
}: {
  value: WeeklyAvailability
  onChange: (next: WeeklyAvailability) => void
}) {
  const total = DAYS.reduce((sum, d) => sum + value[d.key], 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Weekly availability</p>
          <p className="text-muted-foreground text-xs">
            Hours you can realistically study each day (0.5 h steps).
          </p>
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">Week total: </span>
          <strong>{total.toFixed(1)} h</strong>
        </p>
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
                const raw = Number.isFinite(n) ? n : 0
                const clamped = Math.min(24, Math.max(0, raw))
                onChange({
                  ...value,
                  [key]: clamped,
                })
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
