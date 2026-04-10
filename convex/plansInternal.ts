import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUser } from "./lib/auth";
import { mapAvailability, mapMiniTask, mapPlan, mapTask } from "./lib/mappers";
import type { MiniTask, Task } from "./lib/types";

const planUpdateReason = v.union(
  v.literal("initial"),
  v.literal("manual_regenerate"),
  v.literal("auto_drift"),
  v.literal("tasks_changed")
);

const tier = v.union(v.literal("must"), v.literal("should"), v.literal("optional"));

export const insertPlan = internalMutation({
  args: {
    userId: v.id("users"),
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
      })
    ),
  },
  handler: async (ctx, args) => {
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
      });
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
