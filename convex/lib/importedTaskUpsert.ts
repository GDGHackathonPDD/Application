import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { computeMergedKey } from "./taskDedupe";

export type CalendarImportSource =
  | "canvas_ics"
  | "ics_upload"
  | "google_calendar";

/**
 * Insert or merge an overall task from ICS/Google sync using mergedKey + external uid.
 */
export async function upsertImportedOverallTask(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    source: CalendarImportSource;
    uid: string;
    summary: string;
    dueDate: string;
    color: string;
  }
): Promise<void> {
  const mergedKey = computeMergedKey(args.dueDate, args.summary);
  const now = Date.now();

  const byMerged = await ctx.db
    .query("tasks")
    .withIndex("by_user_merged_key", (q) =>
      q.eq("userId", args.userId).eq("mergedKey", mergedKey)
    )
    .unique();

  let existing =
    byMerged && byMerged.parentTaskId === undefined ? byMerged : null;

  if (!existing) {
    const byExt = await ctx.db
      .query("tasks")
      .withIndex("by_user_external", (q) =>
        q.eq("userId", args.userId).eq("externalUid", args.uid)
      )
      .unique();
    if (byExt && byExt.parentTaskId === undefined) {
      existing = byExt;
    }
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      title: args.summary,
      dueDate: args.dueDate,
      color: args.color,
      mergedKey,
      lastSourceOfTruth: args.source,
      source: args.source,
      externalUid: args.uid,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("tasks", {
    userId: args.userId,
    title: args.summary,
    dueDate: args.dueDate,
    estimatedHours: 2,
    priority: "medium",
    progressPercent: 0,
    status: "todo",
    source: args.source,
    externalUid: args.uid,
    mergedKey,
    lastSourceOfTruth: args.source,
    color: args.color,
    createdAt: now,
    updatedAt: now,
  });
}
