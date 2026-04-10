import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Sets parent overall task progress from completed mini minutes / total mini minutes.
 * Skips when there are no mini tasks (keeps manual progress).
 */
export async function recalculateParentProgressFromMinis(
  ctx: MutationCtx,
  parentTaskId: Id<"tasks">
): Promise<void> {
  const parent = await ctx.db.get(parentTaskId);
  if (!parent || parent.parentTaskId !== undefined) {
    return;
  }

  const minis = await ctx.db
    .query("miniTasks")
    .withIndex("by_parent_task", (q) => q.eq("parentTaskId", parentTaskId))
    .collect();

  if (minis.length === 0) {
    return;
  }

  const totalMinutes = minis.reduce((s, m) => s + Math.max(0, m.minutes), 0);
  let progressPercent: number;
  if (totalMinutes <= 0) {
    const doneCount = minis.filter((m) => m.completed).length;
    progressPercent = Math.round((doneCount / minis.length) * 100);
  } else {
    const doneMinutes = minis
      .filter((m) => m.completed)
      .reduce((s, m) => s + Math.max(0, m.minutes), 0);
    progressPercent = Math.min(100, Math.round((doneMinutes / totalMinutes) * 100));
  }

  let status: "todo" | "in_progress" | "done" = "todo";
  if (progressPercent >= 100) status = "done";
  else if (progressPercent > 0) status = "in_progress";

  await ctx.db.patch(parentTaskId, {
    progressPercent,
    status,
    updatedAt: Date.now(),
  });
}
