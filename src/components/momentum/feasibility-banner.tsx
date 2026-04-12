import { InfoIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { FeasibilityPayload } from "@/lib/types/momentum"
import { cn } from "@/lib/utils"

export function FeasibilityBanner({
  feasibility,
  className,
}: {
  feasibility: FeasibilityPayload
  className?: string
}) {
  const isAlert =
    feasibility.status === "infeasible" || feasibility.status === "fragile"

  if (isAlert) {
    return (
      <Alert variant="destructive" className={className}>
        <WarningCircleIcon className="size-4" />
        <AlertTitle>{feasibility.headline}</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{feasibility.subtext}</p>
          {feasibility.taskWindowShortfalls && feasibility.taskWindowShortfalls.length > 0 ? (
            <ul className="list-inside list-disc text-sm">
              {feasibility.taskWindowShortfalls.map((t) => (
                <li key={`${t.title}-${t.dueDate}`}>
                  <span className="font-medium">{t.title}</span> — needs ~{t.remainingHours.toFixed(1)} h
                  before the due date, ~{t.availableHours.toFixed(1)} h available
                  {t.overdue ? " (overdue — horizon only)" : ""}, short ~{t.shortfallHours.toFixed(1)} h
                </li>
              ))}
            </ul>
          ) : null}
          {feasibility.suggestions.length > 0 && (
            <ul className="list-inside list-disc text-sm">
              {feasibility.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div
      role="status"
      className={cn(
        "grid w-full gap-0.5 rounded-lg border border-border bg-muted/30 px-4 py-3 text-left text-sm",
        className
      )}
    >
      <div className="flex gap-2.5">
        <InfoIcon className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" />
        <div className="space-y-2">
          <p className="font-heading font-medium">{feasibility.headline}</p>
          <p className="text-muted-foreground text-sm">{feasibility.subtext}</p>
          {feasibility.taskWindowShortfalls && feasibility.taskWindowShortfalls.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {feasibility.taskWindowShortfalls.map((t) => (
                <li key={`${t.title}-${t.dueDate}`}>
                  {t.title} — ~{t.remainingHours.toFixed(1)} h vs ~{t.availableHours.toFixed(1)} h available
                  {t.overdue ? " (overdue)" : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {feasibility.suggestions.length > 0 && (
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {feasibility.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
