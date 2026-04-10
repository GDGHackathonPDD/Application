import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthUser } from "./lib/auth";
import { mapAvailability, mapMiniTask, mapPlan, mapTask } from "./lib/mappers";
import type { MiniTask, PlanJson, Task } from "./lib/types";
import { syncParentProgressFromMiniTasks } from "./lib/parent_task_progress";

const planUpdateReason = v.union(
  v.literal("initial"),
  v.literal("manual_regenerate"),
  v.literal("auto_drift"),
  v.literal("tasks_changed"),
  v.literal("availability_changed")
);

const tier = v.union(v.literal("must"), v.literal("should"), v.literal("optional"));

/** Remove all mini-task rows for a user (used before a full plan replace). */
async function deleteAllMiniTasksForUser(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  for (;;) {
    const batch = await ctx.db
      .query("miniTasks")
      .withIndex("by_user_scheduled", (q) => q.eq("userId", userId))
      .take(100);
    if (batch.length === 0) break;
    for (const row of batch) {
      await ctx.db.delete(row._id);
    }
  }
}

export const insertPlan = internalMutation({
  args: {
    userId: v.id("users"),
    /** When true (full regenerate), delete existing mini tasks so old plan rows do not accumulate. */
    replaceAllMiniTasks: v.optional(v.boolean()),
    planJson: v.string(),
    overloadScore: v.number(),
    periodStart: v.optional(v.string()),
    periodEnd: v.optional(v.string()),
    horizonDays: v.optional(v.number()),
    updateReason: planUpdateReason,
    updateSummary: v.optional(v.string()),
    recoveryMode: v.boolean(),
    schedulerVersion: v.string(),
    miniTasks: v.array(
      v.object({
        parentTaskId: v.id("tasks"),
        title: v.string(),
        scheduledDate: v.string(),
        minutes: v.number(),
        tier,
        planOrder: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.replaceAllMiniTasks === true) {
      await deleteAllMiniTasksForUser(ctx, args.userId);
    }

    const planId = await ctx.db.insert("plans", {
      userId: args.userId,
      planJson: args.planJson,
      overloadScore: args.overloadScore,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      horizonDays: args.horizonDays,
      updateReason: args.updateReason,
      updateSummary: args.updateSummary,
      recoveryMode: args.recoveryMode,
      schedulerVersion: args.schedulerVersion,
      createdAt: Date.now(),
    });

    for (const mt of args.miniTasks) {
      await ctx.db.insert("miniTasks", {
        userId: args.userId,
        parentTaskId: mt.parentTaskId,
        planId,
        title: mt.title,
        scheduledDate: mt.scheduledDate,
        minutes: mt.minutes,
        tier: mt.tier,
        completed: false,
        planOrder: mt.planOrder,
      });
    }

    const parentIds = [...new Set(args.miniTasks.map((mt) => mt.parentTaskId))];
    for (const pid of parentIds) {
      await syncParentProgressFromMiniTasks(ctx, pid);
    }

    return planId;
  },
});

export const getGenerationContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);

    const [taskDocs, availDocs, anyPlan, miniDocs] = await Promise.all([
      ctx.db
        .query("tasks")
        .withIndex("by_user_due", (q) => q.eq("userId", user._id))
        .order("asc")
        .take(5000),
      ctx.db
        .query("availability")
        .withIndex("by_user_day", (q) => q.eq("userId", user._id))
        .order("asc")
        .take(32),
      ctx.db
        .query("plans")
        .withIndex("by_user_created", (q) => q.eq("userId", user._id))
        .order("desc")
        .first(),
      ctx.db
        .query("miniTasks")
        .withIndex("by_user_scheduled", (q) => q.eq("userId", user._id))
        .take(5000),
    ]);

    const tasks: Task[] = taskDocs.map(mapTask);
    const availability = availDocs.map(mapAvailability);
    const miniTasks: MiniTask[] = miniDocs.map(mapMiniTask);

    const priorPlanCount = anyPlan ? 1 : 0;

    return {
      userId: user._id,
      userTimezone: user.timezone,
      userDefaults: {
        default_planning_horizon_days: user.defaultPlanningHorizonDays,
        default_period_mode: user.defaultPeriodMode,
        max_auto_horizon_days: user.maxAutoHorizonDays ?? null,
      },
      tasks,
      availability,
      miniTasks,
      priorPlanCount,
      latestPlanCreatedAt: anyPlan ? new Date(anyPlan.createdAt).toISOString() : null,
    };
  },
});

/** Same as `getGenerationContext` but for a given user (e.g. scheduled actions without auth). */
export const getGenerationContextForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    const [taskDocs, availDocs, anyPlan, miniDocs] = await Promise.all([
      ctx.db
        .query("tasks")
        .withIndex("by_user_due", (q) => q.eq("userId", args.userId))
        .order("asc")
        .take(5000),
      ctx.db
        .query("availability")
        .withIndex("by_user_day", (q) => q.eq("userId", args.userId))
        .order("asc")
        .take(32),
      ctx.db
        .query("plans")
        .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
        .order("desc")
        .first(),
      ctx.db
        .query("miniTasks")
        .withIndex("by_user_scheduled", (q) => q.eq("userId", args.userId))
        .take(5000),
    ]);

    const tasks: Task[] = taskDocs.map(mapTask);
    const availability = availDocs.map(mapAvailability);
    const miniTasks: MiniTask[] = miniDocs.map(mapMiniTask);

    const priorPlanCount = anyPlan ? 1 : 0;

    return {
      userId: args.userId,
      userTimezone: user.timezone,
      userDefaults: {
        default_planning_horizon_days: user.defaultPlanningHorizonDays,
        default_period_mode: user.defaultPeriodMode,
        max_auto_horizon_days: user.maxAutoHorizonDays ?? null,
      },
      tasks,
      availability,
      miniTasks,
      priorPlanCount,
      latestPlanCreatedAt: anyPlan ? new Date(anyPlan.createdAt).toISOString() : null,
    };
  },
});

export const getPlanRow = internalQuery({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== user._id) {
      return null;
    }
    return mapPlan(plan);
  },
});

export const getTaskForMerge = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.taskId);
    if (!row || row.parentTaskId !== undefined) {
      return null;
    }
    return { userId: row.userId };
  },
});

export const getMergeContext = internalQuery({
  args: { userId: v.id("users"), newTaskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const newTask = await ctx.db.get(args.newTaskId);
    if (!newTask || newTask.userId !== args.userId || newTask.parentTaskId !== undefined) {
      return null;
    }
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    const [taskDocs, availDocs, latestPlan, miniDocs] = await Promise.all([
      ctx.db
        .query("tasks")
        .withIndex("by_user_due", (q) => q.eq("userId", args.userId))
        .order("asc")
        .take(5000),
      ctx.db
        .query("availability")
        .withIndex("by_user_day", (q) => q.eq("userId", args.userId))
        .order("asc")
        .take(32),
      ctx.db
        .query("plans")
        .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
        .order("desc")
        .first(),
      ctx.db
        .query("miniTasks")
        .withIndex("by_user_scheduled", (q) => q.eq("userId", args.userId))
        .take(5000),
    ]);

    return {
      userId: args.userId,
      userTimezone: user.timezone,
      userDefaults: {
        default_planning_horizon_days: user.defaultPlanningHorizonDays,
        default_period_mode: user.defaultPeriodMode,
        max_auto_horizon_days: user.maxAutoHorizonDays ?? null,
      },
      tasks: taskDocs.map(mapTask),
      availability: availDocs.map(mapAvailability),
      miniTasks: miniDocs.map(mapMiniTask),
      latestPlanCreatedAt: latestPlan ? new Date(latestPlan.createdAt).toISOString() : null,
    };
  },
});

export const deleteIncompleteMinisForParent = internalMutation({
  args: { userId: v.id("users"), parentTaskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("miniTasks")
      .withIndex("by_parent_task", (q) => q.eq("parentTaskId", args.parentTaskId))
      .collect();
    for (const r of rows) {
      if (r.userId === args.userId && !r.completed) {
        await ctx.db.delete(r._id);
      }
    }
    await syncParentProgressFromMiniTasks(ctx, args.parentTaskId);
  },
});

/** Remove all mini rows for a parent (e.g. when the overall task is deleted). */
export const deleteAllMiniTasksForParent = internalMutation({
  args: { userId: v.id("users"), parentTaskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("miniTasks")
      .withIndex("by_parent_task", (q) => q.eq("parentTaskId", args.parentTaskId))
      .collect();
    for (const r of rows) {
      if (r.userId === args.userId) {
        await ctx.db.delete(r._id);
      }
    }
  },
});

const parentIdStr = (id: Id<"tasks">): string => id as string;

/** Drop calendar blocks for a deleted parent so `plan_json` does not keep ghost minis. */
export const stripPlanBlocksForParent = internalMutation({
  args: { userId: v.id("users"), parentTaskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("plans")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    if (!latest || latest.userId !== args.userId) {
      return;
    }
    let pj: PlanJson;
    try {
      pj = JSON.parse(latest.planJson) as PlanJson;
    } catch {
      return;
    }
    const pid = parentIdStr(args.parentTaskId);
    const nextDays: PlanJson["days"] = { ...pj.days };
    let changed = false;
    for (const date of Object.keys(nextDays)) {
      const day = nextDays[date];
      if (!day?.blocks?.length) continue;
      const blocks = day.blocks.filter((b) => b.parent_task_id !== pid);
      if (blocks.length !== day.blocks.length) {
        changed = true;
        if (blocks.length === 0) {
          delete nextDays[date];
        } else {
          nextDays[date] = { ...day, blocks };
        }
      }
    }
    if (!changed) {
      return;
    }
    const updated: PlanJson = { ...pj, days: nextDays };
    await ctx.db.patch(latest._id, {
      planJson: JSON.stringify(updated),
    });
  },
});
