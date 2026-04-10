import { v } from "convex/values";

import { query } from "./_generated/server";
import { addCalendarDaysYmd, dateForUserCalendarDay } from "./lib/calendar_dates";
import { DRIFT_CONFIG } from "./lib/config";
import { getAuthUser } from "./lib/auth";
import { computeDrift } from "./lib/drift";
import { computeFeasibilityPayload } from "./lib/feasibility";
import { resolvePlanningPeriod } from "./lib/plan/period";
import { mapAvailability, mapDailySummary, mapMiniTask, mapPlan, mapTask } from "./lib/mappers";
import type { Plan } from "./lib/types";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export const get = query({
  args: { debugAsOf: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);

    const debugAsOf =
      args.debugAsOf && YMD_RE.test(args.debugAsOf) ? args.debugAsOf : undefined;
    const asOfDate = debugAsOf
      ? dateForUserCalendarDay(user.timezone, debugAsOf)
      : new Date();

    const [taskDocs, availDocs, latestPlan] = await Promise.all([
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
    ]);

    const tasks = taskDocs.map(mapTask);
    const taskIds = new Set(taskDocs.map((d) => d._id));
    const availability = availDocs.map(mapAvailability);
    const plan = latestPlan ? mapPlan(latestPlan) : null;

    const period = resolvePlanningPeriod({
      userDefaults: {
        default_planning_horizon_days: user.defaultPlanningHorizonDays,
        default_period_mode: user.defaultPeriodMode,
        max_auto_horizon_days: user.maxAutoHorizonDays ?? null,
      },
      horizonFromDefaultsOnly: true,
      userTimeZone: user.timezone,
      today: asOfDate,
    });

    const feasibilityPayload = computeFeasibilityPayload(
      tasks,
      availability,
      period.period_start,
      period.period_end,
      user.timezone
    );

    let miniTasks: ReturnType<typeof mapMiniTask>[] = [];
    if (latestPlan) {
      const miniDocs = await ctx.db
        .query("miniTasks")
        .withIndex("by_user_scheduled", (q) => q.eq("userId", user._id))
        .take(5000);
      miniTasks = miniDocs
        .filter((d) => taskIds.has(d.parentTaskId))
        .map(mapMiniTask);
    }

    const slipStart = period.period_start;
    const slipEnd = addCalendarDaysYmd(slipStart, DRIFT_CONFIG.slippageWindowDays - 1);
    const incompleteBlocks = miniTasks.filter(
      (m) =>
        !m.completed &&
        m.scheduled_date >= slipStart &&
        m.scheduled_date <= slipEnd
    ).length;
    const overallTasks = tasks.filter((t) => !t.parent_task_id);
    const stalledTasks = overallTasks.filter(
      (t) => t.progress_percent === 0 && new Date(t.due_date) < asOfDate
    );
    const overdueNow = overallTasks.filter(
      (t) =>
        new Date(t.due_date) < asOfDate &&
        t.estimated_hours * (1 - t.progress_percent / 100) > 0
    ).length;

    const driftResult = computeDrift({
      overload: feasibilityPayload.overload,
      feasibility: feasibilityPayload.feasibility,
      incompleteBlockCount: incompleteBlocks,
      stalledTaskIds: stalledTasks.map((t) => t.id),
      overdueDelta: overdueNow,
      planCreatedAt: plan?.created_at ?? null,
      now: asOfDate,
      remainingHoursDelta: feasibilityPayload.feasibility.shortfall_claimed_hours,
      mustDoStreakMiss: 0,
    });

    const todayStr = debugAsOf ?? new Date().toISOString().slice(0, 10);
    const summaryDoc = await ctx.db
      .query("dailySummaries")
      .withIndex("by_user_for_date", (q) => q.eq("userId", user._id).eq("forDate", todayStr))
      .unique();

    const daily_summary = summaryDoc ? mapDailySummary(summaryDoc) : null;

    const planPayload =
      plan &&
      ({
        ...plan,
        updatedAt: plan.created_at,
        updateReason: plan.update_reason,
        updateSummary: plan.update_summary,
      } as Plan & {
        updatedAt: string;
        updateReason: Plan["update_reason"];
        updateSummary: Plan["update_summary"];
      });

    return {
      success: true as const,
      data: {
        tasks,
        availability,
        plan: planPayload ?? plan,
        miniTasks,
        daily_summary,
        overload: feasibilityPayload.overload,
        feasibility: feasibilityPayload.feasibility,
        recommendations: feasibilityPayload.recommendations,
        drift: driftResult,
        period,
      },
    };
  },
});
