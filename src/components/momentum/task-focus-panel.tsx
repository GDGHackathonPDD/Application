import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import type { MiniTask, OverallTask } from "@/lib/types/momentum"

const tierLabel = (t: MiniTask["tier"]) =>
  t === "must" ? "Must" : t === "should" ? "Should" : "Optional"

export function TaskFocusPanel({
  task,
  minis,
  updateSummary,
}: {
  task: OverallTask
  minis: MiniTask[]
  updateSummary?: string | null
}) {
  const remainingH = task.estimatedHours * (1 - task.progressPercent / 100)
  const nextIncomplete = minis.find((m) => !m.completed)

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="size-4 rounded-sm ring-1 ring-border"
            style={{ backgroundColor: task.color }}
            aria-hidden
          />
          <h2 className="text-lg font-semibold">{task.title}</h2>
          <Badge variant="outline" className="capitalize">
            {task.priority}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Due {task.dueDate}
        </p>
      </div>

      <p className="text-sm">
        You&apos;re working toward: <strong>{task.title}</strong>
      </p>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Overall progress</span>
          <span className="text-muted-foreground">
            {remainingH.toFixed(1)} h remaining of {task.estimatedHours} h
            estimated
          </span>
        </div>
        <Progress value={task.progressPercent} />
      </div>

      {updateSummary && (
        <p className="text-muted-foreground border-l-2 border-primary pl-3 text-sm">
          {updateSummary}
        </p>
      )}

      <Separator />

      <div>
        <h3 className="mb-4 text-sm font-medium">Mini tasks in this plan</h3>
        {minis.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No scheduled blocks for this task in the latest plan—try regenerating
            the plan or adding weekly availability.
          </p>
        ) : (
          <ul className="space-y-3">
            {minis.map((m) => (
              <li key={m.id}>
                <Card size="sm" className="border-l-4 py-4" style={{ borderLeftColor: task.color }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{m.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground flex flex-wrap gap-2 text-xs">
                    <span>{m.scheduledDate}</span>
                    <span>·</span>
                    <span>{m.minutes} min</span>
                    <span>·</span>
                    <span>{tierLabel(m.tier)}</span>
                    {m.completed && (
                      <Badge variant="secondary" className="text-[10px]">
                        Done
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {nextIncomplete && (
        <div className="rounded-lg bg-muted/50 p-4 text-sm">
          <span className="text-muted-foreground">Next step · </span>
          {nextIncomplete.title} ({nextIncomplete.minutes} min)
        </div>
      )}
    </div>
  )
}
