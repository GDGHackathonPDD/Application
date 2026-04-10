import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUser } from "./lib/auth";
import { computeFeasibilityPayload } from "./lib/feasibility";
import { resolvePlanningPeriod } from "./lib/plan/period";
import { mapAvailability, mapTask } from "./lib/mappers";

const periodMode = v.union(
  v.literal("rolling"),
  v.literal("calendar_month"),
  v.literal("date_range")
);

export const check = query({
  args: {
    planning_horizon_days: v.optional(v.number()),
    period_mode: v.optional(periodMode),
    period_start: v.optional(v.string()),
    period_end: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);

    const [taskDocs, availDocs] = await Promise.all([
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
    ]);

    const tasks = taskDocs.map(mapTask);
    const availability = availDocs.map(mapAvailability);

    const period = resolvePlanningPeriod({
      planning_horizon_days: args.planning_horizon_days,
      period_mode: args.period_mode,
      period_start: args.period_start,
      period_end: args.period_end,
      userDefaults: {
        default_planning_horizon_days: user.defaultPlanningHorizonDays,
        default_period_mode: user.defaultPeriodMode,
        max_auto_horizon_days: user.maxAutoHorizonDays ?? null,
      },
      horizonFromDefaultsOnly: args.planning_horizon_days === undefined,
      userTimeZone: user.timezone,
    });

    const payload = computeFeasibilityPayload(
      tasks,
      availability,
      period.period_start,
      period.period_end,
      user.timezone
    );

    return { success: true as const, data: { ...payload, period } };
  },
});
