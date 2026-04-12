import type { MiniTask, UserPlan } from "@/lib/types/momentum"

function dedupeKey(m: Pick<MiniTask, "scheduledDate" | "title" | "minutes">): string {
  return `${m.scheduledDate}\0${m.title}\0${m.minutes}`
}

/** Mini tasks for a parent as defined in the stored plan (same source as the calendar). */
export function miniTasksFromPlanForParent(plan: UserPlan, parentId: string): MiniTask[] {
  const out: MiniTask[] = []
  for (const day of plan.days) {
    for (const b of day.blocks) {
      if (b.parentTaskId !== parentId) continue
      out.push({
        id: b.miniTaskId,
        parentTaskId: b.parentTaskId,
        title: b.title,
        scheduledDate: day.date,
        minutes: b.minutes,
        tier: b.tier,
        completed: false,
        planOrder: b.planOrder ?? 0,
      })
    }
  }
  out.sort((a, b) => {
    if (a.scheduledDate !== b.scheduledDate) return a.scheduledDate.localeCompare(b.scheduledDate);
    const o = (a.planOrder ?? 0) - (b.planOrder ?? 0);
    if (o !== 0) return o;
    return a.title.localeCompare(b.title);
  })
  return out
}

function mergeCompletionFromDb(planMinis: MiniTask[], dbMinis: MiniTask[]): MiniTask[] {
  const completed = new Map<string, boolean>()
  const dbId = new Map<string, string>()
  for (const m of dbMinis) {
    const k = dedupeKey(m)
    completed.set(k, m.completed)
    dbId.set(k, m.id)
  }
  return planMinis.map((m) => {
    const k = dedupeKey(m)
    return {
      ...m,
      id: dbId.get(k) ?? m.id,
      completed: completed.get(k) ?? false,
    }
  })
}

/**
 * Task focus should list the same steps the calendar shows. Prefer blocks from the
 * current plan; merge Convex `miniTasks` rows for stable ids and completion flags.
 */
export function miniTasksForFocus(
  plan: UserPlan,
  parentId: string,
  dbMinis: MiniTask[]
): MiniTask[] {
  const fromPlan = miniTasksFromPlanForParent(plan, parentId)
  if (fromPlan.length > 0) {
    return mergeCompletionFromDb(fromPlan, dbMinis)
  }
  return dbMinis
}
