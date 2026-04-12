import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Next integer to assign to a new overall task so planner orders parents sequentially
 * (lower = scheduled first). Uses max existing planSequence + 1.
 */
export async function nextPlanSequence(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<number> {
  const rows = await ctx.db
    .query("tasks")
    .withIndex("by_user_due", (q) => q.eq("userId", userId))
    .collect();
  let max = -1;
  for (const t of rows) {
    if (t.parentTaskId !== undefined) continue;
    const s = t.planSequence;
    if (typeof s === "number" && s > max) max = s;
  }
  return max + 1;
}
