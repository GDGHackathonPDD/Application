import { Badge } from "@/components/ui/badge"
import type { FeasibilityStatus } from "@/lib/types/momentum"
import { cn } from "@/lib/utils"

const LABELS: Record<FeasibilityStatus, string> = {
  stable: "Stable",
  drifting: "Drifting",
  infeasible: "Infeasible",
  fragile: "Fragile",
}

export function StatusBadge({
  status,
  className,
}: {
  status: FeasibilityStatus
  className?: string
}) {
  const variant =
    status === "infeasible"
      ? "destructive"
      : status === "drifting" || status === "fragile"
        ? "secondary"
        : "default"

  return (
    <Badge
      variant={variant}
      className={cn("font-medium capitalize", className)}
    >
      {LABELS[status]}
    </Badge>
  )
}

/** Stacked next to feasibility — drift / execution health (independent of load vs capacity). */
export function DriftStatusBadges({
  fallingBehind,
  fallingBehindWork,
  atRisk,
  className,
}: {
  fallingBehind: boolean
  fallingBehindWork: boolean
  atRisk: boolean
  className?: string
}) {
  const showFallingBehind = fallingBehind || fallingBehindWork
  return (
    <span className={cn("flex flex-wrap items-center gap-2", className)}>
      {showFallingBehind ? (
        <Badge
          variant="outline"
          className="border-amber-500/55 bg-amber-500/12 font-medium text-amber-950 dark:border-amber-400/50 dark:bg-amber-500/15 dark:text-amber-50"
        >
          Falling behind
        </Badge>
      ) : null}
      {!showFallingBehind && atRisk ? (
        <Badge
          variant="outline"
          className="border-orange-500/50 bg-orange-500/10 font-medium text-orange-950 dark:border-orange-400/45 dark:bg-orange-500/12 dark:text-orange-50"
        >
          At risk
        </Badge>
      ) : null}
    </span>
  )
}
