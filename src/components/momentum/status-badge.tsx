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
