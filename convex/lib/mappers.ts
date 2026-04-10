import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type {
  AvailabilityRow,
  CanvasICSSettings,
  ChecklistItem,
  DailySummary,
  MiniTask,
  Plan,
  PlanJson,
  Task,
  User,
} from "./types";

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function idString<T extends TableNames>(id: Id<T>): string {
  return id as string;
}

export function mapUser(doc: Doc<"users">): User {
  return {
    id: idString(doc._id),
    email: doc.email,
    timezone: doc.timezone,
    default_planning_horizon_days: doc.defaultPlanningHorizonDays,
    default_period_mode: doc.defaultPeriodMode,
    max_auto_horizon_days: doc.maxAutoHorizonDays ?? null,
    created_at: iso(doc.createdAt),
  };
}

export function mapTask(doc: Doc<"tasks">): Task {
  return {
    id: idString(doc._id),
    user_id: idString(doc.userId),
    parent_task_id: doc.parentTaskId ? idString(doc.parentTaskId) : null,
    title: doc.title,
    due_date: doc.dueDate,
    estimated_hours: doc.estimatedHours,
    priority: doc.priority,
    progress_percent: doc.progressPercent,
    status: doc.status,
    color: doc.color ?? null,
    source: doc.source ?? null,
    last_source_of_truth: doc.lastSourceOfTruth ?? null,
    external_uid: doc.externalUid ?? null,
    merged_key: doc.mergedKey ?? null,
    scheduled_date: doc.scheduledDate ?? null,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
  };
}

export function mapMiniTask(doc: Doc<"miniTasks">): MiniTask {
  return {
    id: idString(doc._id),
    user_id: idString(doc.userId),
    parent_task_id: idString(doc.parentTaskId),
    plan_id: doc.planId ? idString(doc.planId) : null,
    title: doc.title,
    scheduled_date: doc.scheduledDate,
    minutes: doc.minutes,
    tier: doc.tier,
    completed: doc.completed,
    completed_at: doc.completedAt != null ? iso(doc.completedAt) : null,
  };
}

export function mapAvailability(doc: Doc<"availability">): AvailabilityRow {
  return {
    id: idString(doc._id),
    user_id: idString(doc.userId),
    day_of_week: doc.dayOfWeek,
    available_hours: doc.availableHours,
  };
}

export function mapPlan(doc: Doc<"plans">): Plan {
  let plan_json: PlanJson;
  try {
    plan_json = JSON.parse(doc.planJson) as PlanJson;
  } catch {
    plan_json = {
      version: 1,
      meta: {
        period_start: doc.periodStart ?? "",
        period_end: doc.periodEnd ?? "",
        scheduler_version: doc.schedulerVersion,
        recovery_mode: doc.recoveryMode,
      },
      explanation: "",
      days: {},
    };
  }

  return {
    id: idString(doc._id),
    user_id: idString(doc.userId),
    plan_json,
    overload_score: doc.overloadScore,
    period_start: doc.periodStart ?? null,
    period_end: doc.periodEnd ?? null,
    horizon_days: doc.horizonDays ?? null,
    update_reason: doc.updateReason,
    update_summary: doc.updateSummary ?? null,
    recovery_mode: doc.recoveryMode,
    scheduler_version: doc.schedulerVersion,
    created_at: iso(doc.createdAt),
  };
}

export function mapDailySummary(doc: Doc<"dailySummaries">): DailySummary {
  return {
    id: idString(doc._id),
    user_id: idString(doc.userId),
    for_date: doc.forDate,
    summary_text: doc.summaryText,
    sent_at: doc.sentAt != null ? iso(doc.sentAt) : null,
    created_at: iso(doc.createdAt),
  };
}

export function mapChecklistItem(doc: Doc<"checklistItems">): ChecklistItem {
  return {
    id: idString(doc._id),
    user_id: idString(doc.userId),
    plan_id: idString(doc.planId),
    payload_id: doc.payloadId,
    planned_date: doc.plannedDate,
    title: doc.title,
    planned_minutes: doc.plannedMinutes,
    tier: doc.tier,
    completed: doc.completed,
    completed_at: doc.completedAt != null ? iso(doc.completedAt) : null,
  };
}

export function mapCanvasIcsSettings(doc: Doc<"canvasIcsSettings">): CanvasICSSettings {
  const text = doc.uploadedIcsText;
  return {
    id: idString(doc._id),
    user_id: idString(doc.userId),
    feed_url: doc.feedUrl ?? null,
    has_uploaded_ics: typeof text === "string" && text.length > 0,
    uploaded_file_name: doc.uploadedFileName ?? null,
    last_sync_at: doc.lastSyncAt != null ? iso(doc.lastSyncAt) : null,
    last_sync_status: doc.lastSyncStatus ?? null,
  };
}
