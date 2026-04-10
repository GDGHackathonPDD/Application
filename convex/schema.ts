import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const priority = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));
const taskStatus = v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done"));
const tier = v.union(v.literal("must"), v.literal("should"), v.literal("optional"));
const periodMode = v.union(
  v.literal("rolling"),
  v.literal("calendar_month"),
  v.literal("date_range")
);
const planUpdateReason = v.union(
  v.literal("initial"),
  v.literal("manual_regenerate"),
  v.literal("auto_drift"),
  v.literal("tasks_changed"),
  v.literal("availability_changed")
);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    timezone: v.string(),
    defaultPlanningHorizonDays: v.number(),
    defaultPeriodMode: periodMode,
    maxAutoHorizonDays: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  tasks: defineTable({
    userId: v.id("users"),
    parentTaskId: v.optional(v.id("tasks")),
    title: v.string(),
    dueDate: v.string(),
    estimatedHours: v.number(),
    priority,
    progressPercent: v.number(),
    status: taskStatus,
    color: v.optional(v.string()),
    source: v.optional(v.string()),
    /** Last calendar/import source that wrote this row (ICS, Google, manual). */
    lastSourceOfTruth: v.optional(v.string()),
    externalUid: v.optional(v.string()),
    /** From ICS `CATEGORIES` / `URL` at sync; tasks with same key schedule as one block. */
    calendarGroupKey: v.optional(v.string()),
    /** Dedupe key: dueDate + normalized title (overall tasks). */
    mergedKey: v.optional(v.string()),
    scheduledDate: v.optional(v.string()),
    /** Overall tasks only: lower = scheduled first in planner (sequential execution order). */
    planSequence: v.optional(v.number()),
    /** ICS `SEQUENCE` or file-order index at sync; lower = do first within the same calendar group. */
    icsSequence: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_due", ["userId", "dueDate"])
    .index("by_parent", ["parentTaskId"])
    .index("by_user_external", ["userId", "externalUid"])
    .index("by_user_merged_key", ["userId", "mergedKey"]),

  miniTasks: defineTable({
    userId: v.id("users"),
    parentTaskId: v.id("tasks"),
    planId: v.optional(v.id("plans")),
    title: v.string(),
    scheduledDate: v.string(),
    minutes: v.number(),
    tier,
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    /** Per parent: 0 = first step to do; aligns with plan_json block order. */
    planOrder: v.optional(v.number()),
  })
    .index("by_user_scheduled", ["userId", "scheduledDate"])
    .index("by_parent_task", ["parentTaskId"])
    .index("by_plan", ["planId"]),

  availability: defineTable({
    userId: v.id("users"),
    dayOfWeek: v.number(),
    availableHours: v.number(),
  }).index("by_user_day", ["userId", "dayOfWeek"]),

  plans: defineTable({
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
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]),

  checklistItems: defineTable({
    userId: v.id("users"),
    planId: v.id("plans"),
    payloadId: v.string(),
    plannedDate: v.string(),
    title: v.string(),
    plannedMinutes: v.number(),
    tier,
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
  }).index("by_user_planned_date", ["userId", "plannedDate"]),

  dailySummaries: defineTable({
    userId: v.id("users"),
    forDate: v.string(),
    summaryText: v.string(),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user_for_date", ["userId", "forDate"]),

  dailyOverdueAcknowledgments: defineTable({
    userId: v.id("users"),
    forDate: v.string(),
    acknowledgedAt: v.number(),
    yesterdayOverdueCount: v.number(),
    totalOverdueCount: v.number(),
    totalOverdueMinutes: v.number(),
  }).index("by_user_for_date", ["userId", "forDate"]),

  canvasIcsSettings: defineTable({
    userId: v.id("users"),
    /** HTTPS Canvas / institution calendar feed (optional if using upload). */
    feedUrl: v.optional(v.string()),
    /** Raw .ics text from user upload; sync prefers this over feedUrl when present. */
    uploadedIcsText: v.optional(v.string()),
    uploadedFileName: v.optional(v.string()),
    lastSyncAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  /** Google Calendar API OAuth (refresh token encrypted with GOOGLE_OAUTH_ENCRYPTION_KEY). */
  googleCalendarSettings: defineTable({
    userId: v.id("users"),
    encryptedRefreshToken: v.string(),
    connectedEmail: v.optional(v.string()),
    connectedAt: v.number(),
    lastSyncAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.string()),
    /** Secondary calendar used for Schedule → Google push ("AiGenda Calendar"). */
    aigendaCalendarId: v.optional(v.string()),
    lastPushAt: v.optional(v.number()),
    lastPushStatus: v.optional(v.string()),
  }).index("by_user", ["userId"]),
});
