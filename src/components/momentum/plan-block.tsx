import { cn } from "@/lib/utils"
import type { PlanBlockPayload } from "@/lib/types/momentum"

export function PlanBlock({
  block,
  parentColor,
  onSelect,
}: {
  block: PlanBlockPayload
  parentColor: string
  onSelect?: () => void
}) {
  const tierLabel =
    block.tier === "must"
      ? "Must"
      : block.tier === "should"
        ? "Should"
        : "Optional"

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-md border border-l-4 bg-muted/30 px-2 py-1.5 text-left text-xs transition-colors",
        "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
      style={{ borderLeftColor: parentColor }}
    >
      <span className="line-clamp-2 font-medium">{block.title}</span>
      <span className="text-muted-foreground flex items-center gap-2">
        <span>{block.minutes} min</span>
        <span className="rounded bg-background/80 px-1 py-0 text-[10px] uppercase tracking-wide">
          {tierLabel}
        </span>
      </span>
    </button>
  )
}
