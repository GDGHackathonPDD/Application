import { query } from "./_generated/server";
import { getAuthUser } from "./lib/auth";
import { computeDrift } from "./lib/drift";
import { computeFeasibilityPayload } from "./lib/feasibility";
import { resolvePlanningPeriod } from "./lib/plan/period";
import { mapAvailability, mapDailySummary, mapMiniTask, mapPlan, mapTask } from "./lib/mappers";
import type { Plan } from "./lib/types";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);

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
    });

    const feasibilityPayload = computeFeasibilityPayload(
      tasks,
      availability,
      period.period_start,
      period.period_end
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

    const incompleteBlocks = miniTasks.filter((m) => !m.completed).length;
    const overallTasks = tasks.filter((t) => !t.parent_task_id);
    const stalledTasks = overallTasks.filter(
      (t) => t.progress_percent === 0 && new Date(t.due_date) < new Date()
    );
    const overdueNow = overallTasks.filter(
      (t) => new Date(t.due_date) < new Date() && t.estimated_hours * (1 - t.progress_percent / 100) > 0
    ).length;

    const driftResult = computeDrift({
      overload: feasibilityPayload.overload,
      feasibility: feasibilityPayload.feasibility,
      incompleteBlockCount: incompleteBlocks,
      stalledTaskIds: stalledTasks.map((t) => t.id),
      overdueDelta: overdueNow,
      planCreatedAt: plan?.created_at ?? null,
      now: new Date(),
      remainingHoursDelta: feasibilityPayload.feasibility.shortfall_claimed_hours,
      mustDoStreakMiss: 0,
    });

    const todayStr = new Date().toISOString().slice(0, 10);
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
