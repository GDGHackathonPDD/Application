import type {
  AvailabilityRow,
  FeasibilityPayload as ServerFeasibilityPayload,
  FeasibilityResult,
  MiniTask as ConvexMiniTask,
  OverloadResult,
  Plan,
  Recommendation,
  Task,
} from "@convex/lib/types";
import type {
  CanvasSyncState,
  FeasibilityPayload,
  FeasibilityStatus,
  MiniTask,
  OverallTask,
  UserPlan,
  WeeklyAvailability,
} from "@/lib/types/momentum";

export function taskToOverallTask(t: Task): OverallTask {
  const src = t.source;
  return {
    id: t.id,
    title: t.title,
    dueDate: t.due_date,
    estimatedHours: t.estimated_hours,
    priority: t.priority,
    progressPercent: t.progress_percent,
    color: t.color ?? "#6366f1",
    source:
      src === "canvas" || src === "canvas_ics"
        ? "canvas"
        : src === "ics_upload"
          ? "ics"
          : src === "manual"
            ? "manual"
            : undefined,
  };
}

export function convexMiniToUi(m: ConvexMiniTask): MiniTask {
  return {
    id: m.id,
    parentTaskId: m.parent_task_id,
    title: m.title,
    scheduledDate: m.scheduled_date,
    minutes: m.minutes,
    tier: m.tier,
    completed: m.completed,
  };
}

export function availabilityRowsToWeekly(rows: AvailabilityRow[]): WeeklyAvailability {
  const w: WeeklyAvailability = {
    sun: 0,
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
  };
  const order: (keyof WeeklyAvailability)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  for (const r of rows) {
    const k = order[r.day_of_week];
    if (k) w[k] = r.available_hours;
  }
  return w;
}

function clampDayHours(h: number): number {
  if (!Number.isFinite(h)) return 0;
  return Math.min(24, Math.max(0, h));
}

export function weeklyAvailabilityToDayEntries(w: WeeklyAvailability): {
  day_of_week: number;
  available_hours: number;
}[] {
  return [
    { day_of_week: 0, available_hours: clampDayHours(w.sun) },
    { day_of_week: 1, available_hours: clampDayHours(w.mon) },
    { day_of_week: 2, available_hours: clampDayHours(w.tue) },
    { day_of_week: 3, available_hours: clampDayHours(w.wed) },
    { day_of_week: 4, available_hours: clampDayHours(w.thu) },
    { day_of_week: 5, available_hours: clampDayHours(w.fri) },
    { day_of_week: 6, available_hours: clampDayHours(w.sat) },
  ];
}

export function convexPlanToUserPlan(
  plan: Plan | null,
  period: { period_start: string; period_end: string; horizon_days: number }
): UserPlan {
  if (!plan) {
    return {
      meta: {
        periodStart: period.period_start,
        periodEnd: period.period_end,
        recoveryMode: false,
      },
      updatedAt: new Date().toISOString(),
      days: [],
    };
  }

  const pj = plan.plan_json;
  const dates = Object.keys(pj.days).sort();
  const days = dates.map((date) => {
    const d = pj.days[date];
    const blocksRaw = d?.blocks ?? [];
    const blocks = blocksRaw.map((b) => ({
      miniTaskId: b.mini_task_id,
      parentTaskId: b.parent_task_id,
      title: b.title,
      minutes: b.minutes,
      tier: b.tier,
    }));
    const scheduledMinutes = blocks.reduce((s, b) => s + b.minutes, 0);
    const overallDueTaskIds = [...new Set(blocks.map((b) => b.parentTaskId))];
    return {
      date,
      availableHours: d?.available_hours ?? 0,
      scheduledMinutes,
      overallDueTaskIds,
      blocks,
    };
  });

  return {
    meta: {
      periodStart: pj.meta.period_start,
      periodEnd: pj.meta.period_end,
      recoveryMode: pj.meta.recovery_mode,
    },
    updatedAt: plan.created_at,
    updateReason: plan.update_reason,
    updateSummary: plan.update_summary ?? undefined,
    days,
  };
}

function mapFeasibilityStatus(
  feasibility: FeasibilityResult,
  overload: OverloadResult
): FeasibilityStatus {
  if (feasibility.status === "INFEASIBLE") return "infeasible";
  if (feasibility.status === "FEASIBLE_FRAGILE") return "fragile";
  if (overload.label === "overloaded" || overload.label === "drifting") return "drifting";
  return "stable";
}

export function convexFeasibilityToUi(
  bundle: Pick<ServerFeasibilityPayload, "overload" | "feasibility" | "recommendations">
): FeasibilityPayload {
  const { overload, feasibility, recommendations } = bundle;
  const status = mapFeasibilityStatus(feasibility, overload);
  const remaining = feasibility.remaining_work_hours;
  const available = feasibility.available_claimed_hours;
  const shortfall = feasibility.shortfall_claimed_hours;

  let headline: string;
  if (status === "infeasible") {
    headline = "Not enough time in this planning window";
  } else if (status === "fragile") {
    headline = "Your plan is fragile — small slips add up";
  } else if (status === "drifting") {
    headline = "Schedule pressure is building";
  } else {
    headline = "Plan looks workable for this window";
  }

  const subtext = [
    `${remaining.toFixed(1)} h work remaining vs ${available.toFixed(1)} h available (claimed)`,
    shortfall > 0.05 ? `Shortfall ≈ ${shortfall.toFixed(1)} h` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const suggestions: string[] = [];
  for (const r of recommendations) {
    suggestions.push(r.message);
    if (r.suggestions) {
      for (const s of r.suggestions) {
        suggestions.push(`${s.date}: +${s.add_hours} h — ${s.reason}`);
      }
    }
  }

  return {
    status,
    headline,
    subtext,
    remainingHours: remaining,
    availableHours: available,
    shortfallHours: shortfall > 0.05 ? shortfall : undefined,
    overloadScore: overload.score,
    suggestions,
  };
}

export type DashboardGetResult = {
  success: true;
  data: {
    tasks: Task[];
    availability: AvailabilityRow[];
    plan:
      | (Plan & {
          updatedAt: string;
          updateReason: Plan["update_reason"];
          updateSummary: Plan["update_summary"];
        })
      | Plan
      | null;
    miniTasks: ConvexMiniTask[];
    period: { period_start: string; period_end: string; horizon_days: number };
    overload: OverloadResult;
    feasibility: FeasibilityResult;
    recommendations: Recommendation[];
  };
};

export function mapDashboardToMomentum(result: DashboardGetResult): {
  tasks: OverallTask[];
  plan: UserPlan;
  feasibility: FeasibilityPayload;
  minisByParent: Map<string, MiniTask[]>;
  weeklyAvailability: WeeklyAvailability;
  anchorDate: Date;
} {
  const { data } = result;
  const overall = data.tasks.filter((t) => !t.parent_task_id).map(taskToOverallTask);
  const plan = convexPlanToUserPlan(data.plan, data.period);
  const feasibility = convexFeasibilityToUi({
    overload: data.overload,
    feasibility: data.feasibility,
    recommendations: data.recommendations,
  });
  const uiMinis = data.miniTasks.map(convexMiniToUi);
  const minisByParent = new Map<string, MiniTask[]>();
  for (const m of uiMinis) {
    const arr = minisByParent.get(m.parentTaskId) ?? [];
    arr.push(m);
    minisByParent.set(m.parentTaskId, arr);
  }
  for (const arr of minisByParent.values()) {
    arr.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }
  const weeklyAvailability = availabilityRowsToWeekly(data.availability);
  return {
    tasks: overall,
    plan,
    feasibility,
    minisByParent,
    weeklyAvailability,
    anchorDate: new Date(),
  };
}

export function canvasSettingsToUi(s: {
  feed_url: string | null;
  has_uploaded_ics: boolean;
  uploaded_file_name: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
} | null): CanvasSyncState {
  if (!s) {
    return {
      feedUrl: "",
      hasUploadedIcs: false,
      uploadedFileName: null,
      lastSyncedAt: null,
      status: "idle",
    };
  }
  let status: CanvasSyncState["status"] = "idle";
  const st = s.last_sync_status ?? "";
  if (st.startsWith("ok")) status = "ok";
  else if (st.startsWith("fetch_error")) status = "error";
  else if (st.length > 0) status = "syncing";

  return {
    feedUrl: s.feed_url ?? "",
    hasUploadedIcs: s.has_uploaded_ics,
    uploadedFileName: s.uploaded_file_name,
    lastSyncedAt: s.last_sync_at,
    status,
  };
}
