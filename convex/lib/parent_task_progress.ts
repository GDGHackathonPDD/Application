import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Derives overall task progress from mini-task completion weighted by `minutes`.
 * If there are no mini tasks for this parent, leaves `progressPercent` unchanged (manual entry).
 */
export async function syncParentProgressFromMiniTasks(
  ctx: MutationCtx,
  parentTaskId: Id<"tasks">
): Promise<void> {
  const parent = await ctx.db.get(parentTaskId);
  if (!parent || parent.parentTaskId !== undefined) return;

  const minis = await ctx.db
    .query("miniTasks")
    .withIndex("by_parent_task", (q) => q.eq("parentTaskId", parentTaskId))
    .collect();

  if (minis.length === 0) return;

  const totalMinutes = minis.reduce((s, m) => s + Math.max(0, m.minutes), 0);
  let progressPercent: number;
  if (totalMinutes <= 0) {
    const done = minis.filter((m) => m.completed).length;
    progressPercent = Math.round((done / minis.length) * 100);
  } else {
    const doneMinutes = minis
      .filter((m) => m.completed)
      .reduce((s, m) => s + Math.max(0, m.minutes), 0);
    progressPercent = Math.min(100, Math.round((doneMinutes / totalMinutes) * 100));
  }

  await ctx.db.patch(parentTaskId, {
    progressPercent,
    updatedAt: Date.now(),
  });
}
