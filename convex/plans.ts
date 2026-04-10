import { action, internalAction, query, type ActionCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ApiError } from "./lib/errors";
import { computeDrift } from "./lib/drift";
import { computeFeasibilityPayload } from "./lib/feasibility";
import { generatePlan, incrementalMergeNewTask } from "./lib/plan/generate";
import { resolvePlanningPeriod } from "./lib/plan/period";
import type {
  AvailabilityRow,
  MiniTask,
  Plan,
  PlanBlock,
  PeriodMode,
  PlanUpdateReason,
  Task,
} from "./lib/types";

type GenerationContext = {
  userId: Id<"users">;
  userDefaults: {
    default_planning_horizon_days: number;
    default_period_mode: PeriodMode;
    max_auto_horizon_days: number | null;
  };
  tasks: Task[];
  availability: AvailabilityRow[];
  miniTasks: MiniTask[];
  priorPlanCount: number;
  latestPlanCreatedAt: string | null;
};

function miniTasksInsertPayloadFromPlanDays(
  days: Record<string, { blocks: PlanBlock[] }>
): Array<{
  parentTaskId: Id<"tasks">;
  title: string;
  scheduledDate: string;
  minutes: number;
  tier: PlanBlock["tier"];
}> {
  const out: Array<{
    parentTaskId: Id<"tasks">;
    title: string;
    scheduledDate: string;
    minutes: number;
    tier: PlanBlock["tier"];
  }> = [];
  for (const [date, day] of Object.entries(days)) {
    for (const block of day.blocks) {
      out.push({
        parentTaskId: block.parent_task_id as Id<"tasks">,
        title: block.title,
        scheduledDate: date,
        minutes: block.minutes,
        tier: block.tier,
      });
    }
  }
  return out;
}
const periodMode = v.union(
  v.literal("rolling"),
  v.literal("calendar_month"),
  v.literal("date_range")
);

/** Full replan for a user: new plan JSON + mini tasks from scheduler (replaces all minis). */
async function regenerateFullPlanForUser(
  ctx: ActionCtx,
  args: { userId: Id<"users">; updateReason: PlanUpdateReason }
): Promise<void> {
  const base = await ctx.runQuery(internal.plansInternal.getGenerationContextForUser, {
    userId: args.userId,
  });
  if (!base) {
    return;
  }

  const period = resolvePlanningPeriod({
    userDefaults: base.userDefaults,
    horizonFromDefaultsOnly: true,
  });

  const feasibilityPayload = computeFeasibilityPayload(
    base.tasks,
    base.availability,
    period.period_start,
    period.period_end
  );

  const overallTasks = base.tasks.filter((t) => !t.parent_task_id);
  const tasksWithRemaining = overallTasks.filter(
    (t) => t.estimated_hours * (1 - t.progress_percent / 100) > 0
  );

  if (tasksWithRemaining.length === 0) {
    return;
  }

  const incompleteBlocks = base.miniTasks.filter((m) => !m.completed).length;
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
    planCreatedAt: base.latestPlanCreatedAt,
    now: new Date(),
    remainingHoursDelta: feasibilityPayload.feasibility.shortfall_claimed_hours,
    mustDoStreakMiss: 0,
  });

  const isRecovery = driftResult.falling_behind;

  let result: Awaited<ReturnType<typeof generatePlan>>;
  try {
    result = await generatePlan(
      base.tasks,
      base.availability,
      feasibilityPayload.feasibility,
      period.period_start,
      period.period_end,
      isRecovery,
      driftResult,
      args.updateReason
    );
  } catch (err) {
    if (err instanceof ApiError && err.code === "NO_REMAINING_WORK") {
      return;
    }
    console.error(`regenerateFullPlanForUser (${args.updateReason}) failed:`, err);
    return;
  }

  const { updateSummary: _omit, ...planForStorage } = result;
  void _omit;
  const planJsonString = JSON.stringify(planForStorage);

  await ctx.runMutation(internal.plansInternal.insertPlan, {
    userId: args.userId,
    replaceAllMiniTasks: true,
    planJson: planJsonString,
    overloadScore: feasibilityPayload.overload.score,
    periodStart: period.period_start,
    periodEnd: period.period_end,
    horizonDays: period.horizon_days,
    updateReason: args.updateReason,
    updateSummary: result.updateSummary ?? undefined,
    recoveryMode: planForStorage.meta.recovery_mode,
    schedulerVersion: "deterministic-v1",
    miniTasks: miniTasksInsertPayloadFromPlanDays(result.days),
  });
}

/**
 * Whether Convex can call the Agent API for LLM decomposition (Mode B).
 * Uses deployment env (Convex dashboard / `npx convex env`), not Next.js `.env.local`.
 */
export const agentPlanningConfig = query({
  args: {},
  handler: async () => {
    const url = (process.env.AGENT_API_URL ?? "").trim();
    return { agent_api_configured: url.length > 0 };
  },
});

export const generate = action({
  args: {
    planning_horizon_days: v.optional(v.number()),
    period_mode: v.optional(periodMode),
    period_start: v.optional(v.string()),
    period_end: v.optional(v.string()),
    recovery_mode: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: true;
    data: {
      plan_json: Plan["plan_json"];
      overload_score: number;
      feasibility: unknown;
      overload: unknown;
      recommendations: unknown[];
      messages: string[];
      updatedAt: string;
      updateReason: Plan["update_reason"];
      updateSummary: Plan["update_summary"];
      period_start: string;
      period_end: string;
      horizon_days: number;
      plan: Plan;
      drift: unknown;
      period: unknown;
    };
  }> => {
    const base: GenerationContext = await ctx.runQuery(internal.plansInternal.getGenerationContext, {});

    const period = resolvePlanningPeriod({
      planning_horizon_days: args.planning_horizon_days,
      period_mode: args.period_mode,
      period_start: args.period_start,
      period_end: args.period_end,
      userDefaults: base.userDefaults,
      horizonFromDefaultsOnly: args.planning_horizon_days === undefined,
    });

    const feasibilityPayload = computeFeasibilityPayload(
      base.tasks,
      base.availability,
      period.period_start,
      period.period_end
    );

    const overallTasks = base.tasks.filter((t) => !t.parent_task_id);
    const tasksWithRemaining = overallTasks.filter(
      (t) => t.estimated_hours * (1 - t.progress_percent / 100) > 0
    );

    if (tasksWithRemaining.length === 0) {
      throw new ConvexError({
        message: "No tasks with remaining work to plan",
        code: "NO_REMAINING_WORK",
      });
    }

    const incompleteBlocks = base.miniTasks.filter((m) => !m.completed).length;
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
      planCreatedAt: base.latestPlanCreatedAt,
      now: new Date(),
      remainingHoursDelta: feasibilityPayload.feasibility.shortfall_claimed_hours,
      mustDoStreakMiss: 0,
    });

    const isRecovery = args.recovery_mode ?? driftResult.falling_behind;
    const updateReason: PlanUpdateReason = driftResult.falling_behind
      ? "auto_drift"
      : base.priorPlanCount === 0
        ? "initial"
        : "manual_regenerate";

    let result: Awaited<ReturnType<typeof generatePlan>>;
    try {
      result = await generatePlan(
        base.tasks,
        base.availability,
        feasibilityPayload.feasibility,
        period.period_start,
        period.period_end,
        isRecovery,
        driftResult,
        updateReason
      );
    } catch (err) {
      if (err instanceof ApiError) {
        throw new ConvexError({ message: err.message, code: err.code });
      }
      throw err;
    }

    const { updateSummary: _omit, ...planForStorage } = result;
    void _omit;
    const planJsonString = JSON.stringify(planForStorage);

    const miniTasksPayload: {
      parentTaskId: Id<"tasks">;
      title: string;
      scheduledDate: string;
      minutes: number;
      tier: PlanBlock["tier"];
    }[] = [];

    for (const [date, day] of Object.entries(result.days) as [string, { blocks: PlanBlock[] }][]) {
      for (const block of day.blocks) {
        miniTasksPayload.push({
          parentTaskId: block.parent_task_id as Id<"tasks">,
          title: block.title,
          scheduledDate: date,
          minutes: block.minutes,
          tier: block.tier,
        });
      }
    }

    const planId: Id<"plans"> = await ctx.runMutation(internal.plansInternal.insertPlan, {
      userId: base.userId,
      replaceAllMiniTasks: true,
      planJson: planJsonString,
      overloadScore: feasibilityPayload.overload.score,
      periodStart: period.period_start,
      periodEnd: period.period_end,
      horizonDays: period.horizon_days,
      updateReason,
      updateSummary: result.updateSummary ?? undefined,
      recoveryMode: planForStorage.meta.recovery_mode,
      schedulerVersion: "deterministic-v1",
      miniTasks: miniTasksPayload,
    });

    const planRow: Plan | null = await ctx.runQuery(internal.plansInternal.getPlanRow, { planId });
    if (!planRow) {
      throw new ConvexError({ message: "Plan not found after insert", code: "PLAN_MISSING" });
    }

    const messages = feasibilityPayload.recommendations.map((r) => r.message);

    return {
      success: true as const,
      data: {
        plan_json: planRow.plan_json,
        overload_score: planRow.overload_score,
        feasibility: feasibilityPayload.feasibility,
        overload: feasibilityPayload.overload,
        recommendations: feasibilityPayload.recommendations,
        messages,
        updatedAt: planRow.created_at,
        updateReason: planRow.update_reason,
        updateSummary: planRow.update_summary,
        period_start: period.period_start,
        period_end: period.period_end,
        horizon_days: period.horizon_days,
        plan: planRow,
        drift: driftResult,
        period,
      },
    };
  },
});

export const mergeNewTaskPlan = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const taskRef = await ctx.runQuery(internal.plansInternal.getTaskForMerge, {
      taskId: args.taskId,
    });
    if (!taskRef) {
      return;
    }

    await ctx.runMutation(internal.plansInternal.deleteIncompleteMinisForParent, {
      userId: taskRef.userId,
      parentTaskId: args.taskId,
    });

    const mergeCtx = await ctx.runQuery(internal.plansInternal.getMergeContext, {
      userId: taskRef.userId,
      newTaskId: args.taskId,
    });
    if (!mergeCtx) {
      return;
    }

    const period = resolvePlanningPeriod({
      userDefaults: mergeCtx.userDefaults,
      horizonFromDefaultsOnly: true,
    });

    const feasibilityPayload = computeFeasibilityPayload(
      mergeCtx.tasks,
      mergeCtx.availability,
      period.period_start,
      period.period_end
    );

    const preserved = mergeCtx.miniTasks.filter(
      (m) => !m.completed && m.parent_task_id !== args.taskId
    );

    let result: Awaited<ReturnType<typeof incrementalMergeNewTask>>;
    try {
      result = await incrementalMergeNewTask(
        mergeCtx.tasks,
        mergeCtx.availability,
        feasibilityPayload.feasibility,
        period.period_start,
        period.period_end,
        args.taskId,
        preserved
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "NO_REMAINING_WORK") {
        return;
      }
      console.error("mergeNewTaskPlan failed:", err);
      return;
    }

    const { newMiniTasksPayload, updateSummary: _omitUpdateSummary, ...planForStorage } = result;
    void _omitUpdateSummary;

    const overallWithRemaining = mergeCtx.tasks.filter(
      (t) =>
        !t.parent_task_id &&
        t.estimated_hours * (1 - t.progress_percent / 100) > 0
    );

    if (newMiniTasksPayload.length === 0 && overallWithRemaining.length > 0) {
      console.warn(
        "mergeNewTaskPlan: incremental schedule produced no new blocks; running full replan"
      );
      try {
        const full = await generatePlan(
          mergeCtx.tasks,
          mergeCtx.availability,
          feasibilityPayload.feasibility,
          period.period_start,
          period.period_end,
          false,
          null,
          "tasks_changed"
        );
        const { updateSummary: _omitFull, ...fullStorage } = full;
        void _omitFull;
        const planJsonString = JSON.stringify(fullStorage);
        await ctx.runMutation(internal.plansInternal.insertPlan, {
          userId: mergeCtx.userId,
          replaceAllMiniTasks: true,
          planJson: planJsonString,
          overloadScore: feasibilityPayload.overload.score,
          periodStart: period.period_start,
          periodEnd: period.period_end,
          horizonDays: period.horizon_days,
          updateReason: "tasks_changed",
          updateSummary: full.updateSummary ?? undefined,
          recoveryMode: fullStorage.meta.recovery_mode,
          schedulerVersion: "deterministic-v1",
          miniTasks: miniTasksInsertPayloadFromPlanDays(full.days),
        });
        return;
      } catch (fallbackErr) {
        console.error("mergeNewTaskPlan: full replan fallback failed:", fallbackErr);
      }
    }

    const planJsonString = JSON.stringify(planForStorage);

    await ctx.runMutation(internal.plansInternal.insertPlan, {
      userId: mergeCtx.userId,
      planJson: planJsonString,
      overloadScore: feasibilityPayload.overload.score,
      periodStart: period.period_start,
      periodEnd: period.period_end,
      horizonDays: period.horizon_days,
      updateReason: "tasks_changed",
      updateSummary: result.updateSummary ?? undefined,
      recoveryMode: planForStorage.meta.recovery_mode,
      schedulerVersion: "deterministic-v1",
      miniTasks: newMiniTasksPayload.map((mt) => ({
        parentTaskId: mt.parentTaskId as Id<"tasks">,
        title: mt.title,
        scheduledDate: mt.scheduledDate,
        minutes: mt.minutes,
        tier: mt.tier,
      })),
    });
  },
});

/**
 * Re-runs the deterministic scheduler with current tasks + updated weekly availability
 * so daily blocks stay within effective per-day capacity (same path as manual Generate plan).
 */
export const regenerateAfterAvailabilityChange = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await regenerateFullPlanForUser(ctx, {
      userId: args.userId,
      updateReason: "availability_changed",
    });
  },
});

/**
 * After an overall task is removed, re-run the scheduler so remaining work is redistributed
 * (not only stripping that parent's blocks from the stored plan).
 */
export const regenerateAfterTaskDelete = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await regenerateFullPlanForUser(ctx, {
      userId: args.userId,
      updateReason: "tasks_changed",
    });
  },
});
