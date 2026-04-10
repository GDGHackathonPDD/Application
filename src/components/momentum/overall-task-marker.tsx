import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { OverallTask } from "@/lib/types/momentum"

export function OverallTaskMarker({
  task,
  onSelect,
}: {
  task: OverallTask
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border border-dashed p-2 text-left text-xs transition-colors",
        "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
      style={{ borderColor: task.color }}
    >
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: task.color }}
          aria-hidden
        />
        <span className="line-clamp-2 font-medium">{task.title}</span>
      </div>
      <div className="mt-1.5">
        <Progress value={task.progressPercent} className="h-1" />
        <span className="text-muted-foreground mt-0.5 block">
          Due · {task.progressPercent}% done
        </span>
      </div>
    </button>
  )
}
