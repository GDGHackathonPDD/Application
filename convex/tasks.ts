import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUser } from "./lib/auth";
import { mapMiniTask, mapTask } from "./lib/mappers";
import { PLAN_BLOCK_MINUTES_MAX } from "./lib/config";
import { nextPlanSequence } from "./lib/plan_sequence";
import { syncParentProgressFromMiniTasks } from "./lib/parent_task_progress";

const priority = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));
const taskStatus = v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done"));
const tier = v.union(v.literal("must"), v.literal("should"), v.literal("optional"));

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(label: string, value: string | undefined): void {
  if (value === undefined || !dateRe.test(value)) {
    throw new ConvexError({ message: `${label} must be YYYY-MM-DD`, code: "INVALID_DATE" });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_user_due", (q) => q.eq("userId", user._id))
      .order("asc")
      .take(5000);
    return rows.map(mapTask);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    due_date: v.optional(v.string()),
    estimated_hours: v.optional(v.number()),
    priority: v.optional(priority),
    progress_percent: v.optional(v.number()),
    status: v.optional(taskStatus),
    color: v.optional(v.string()),
    parent_task_id: v.optional(v.id("tasks")),
    source: v.optional(v.string()),
    external_uid: v.optional(v.string()),
    scheduled_date: v.optional(v.string()),
    minutes: v.optional(v.number()),
    tier: v.optional(tier),
    completed: v.optional(v.boolean()),
    plan_id: v.optional(v.union(v.id("plans"), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const title = args.title.trim();
    if (title.length < 1 || title.length > 300) {
      throw new ConvexError({ message: "Invalid title length", code: "INVALID_TITLE" });
    }

    if (args.parent_task_id) {
      assertDate("scheduled_date", args.scheduled_date);
      if (args.minutes == null || args.minutes < 5 || args.minutes > PLAN_BLOCK_MINUTES_MAX) {
        throw new ConvexError({
          message: `minutes is required (5–${PLAN_BLOCK_MINUTES_MAX}) for mini tasks`,
          code: "INVALID_MINUTES",
        });
      }
      if (!args.tier) {
        throw new ConvexError({ message: "tier is required for mini tasks", code: "INVALID_TIER" });
      }
      const parent = await ctx.db.get(args.parent_task_id);
      if (!parent || parent.userId !== user._id || parent.parentTaskId !== undefined) {
        throw new ConvexError({ message: "Parent overall task not found", code: "PARENT_NOT_FOUND" });
      }
      const now = Date.now();
      const completed = args.completed ?? false;
      const id = await ctx.db.insert("miniTasks", {
        userId: user._id,
        parentTaskId: args.parent_task_id,
        planId: args.plan_id ?? undefined,
        title,
        scheduledDate: args.scheduled_date!,
        minutes: args.minutes,
        tier: args.tier,
        completed,
        completedAt: completed ? now : undefined,
      });
      const doc = await ctx.db.get(id);
      if (!doc) throw new ConvexError({ message: "Insert failed", code: "INSERT_FAILED" });
      await syncParentProgressFromMiniTasks(ctx, args.parent_task_id);
      return { success: true as const, data: mapMiniTask(doc), kind: "mini" as const };
    }

    assertDate("due_date", args.due_date);
    if (args.estimated_hours == null || args.estimated_hours <= 0 || args.estimated_hours > 24) {
      throw new ConvexError({
        message: "estimated_hours is required (positive, max 24) for overall tasks",
        code: "INVALID_ESTIMATE",
      });
    }

    const now = Date.now();
    const planSequence = await nextPlanSequence(ctx, user._id);
    const id = await ctx.db.insert("tasks", {
      userId: user._id,
      title,
      dueDate: args.due_date!,
      estimatedHours: args.estimated_hours,
      priority: args.priority ?? "medium",
      progressPercent: args.progress_percent ?? 0,
      status: args.status ?? "todo",
      color: args.color,
      source: args.source,
      externalUid: args.external_uid,
      planSequence,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    if (!doc) throw new ConvexError({ message: "Insert failed", code: "INSERT_FAILED" });
    await ctx.scheduler.runAfter(0, internal.plans.mergeNewTaskPlan, { taskId: id });
    return { success: true as const, data: mapTask(doc), kind: "overall" as const };
  },
});

const updateFields = v.object({
  title: v.optional(v.string()),
  due_date: v.optional(v.string()),
  estimated_hours: v.optional(v.number()),
  priority: v.optional(priority),
  progress_percent: v.optional(v.number()),
  status: v.optional(taskStatus),
  color: v.optional(v.union(v.string(), v.null())),
  /** Overall task only: lower = scheduled first in planner. */
  plan_sequence: v.optional(v.number()),
  scheduled_date: v.optional(v.string()),
  minutes: v.optional(v.number()),
  tier: v.optional(tier),
  completed: v.optional(v.boolean()),
});

export const update = mutation({
  args: {
    taskId: v.optional(v.id("tasks")),
    miniTaskId: v.optional(v.id("miniTasks")),
    patch: updateFields,
  },
  handler: async (ctx, args) => {
    const hasTask = args.taskId !== undefined;
    const hasMini = args.miniTaskId !== undefined;
    if (hasTask === hasMini) {
      throw new ConvexError({ message: "Provide exactly one of taskId or miniTaskId", code: "INVALID_TARGET" });
    }
    const user = await getAuthUser(ctx);
    const p = args.patch;

    if (args.taskId) {
      const existing = await ctx.db.get(args.taskId);
      if (!existing || existing.userId !== user._id) {
        throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
      }
      const overallPatch: {
        title?: string;
        dueDate?: string;
        estimatedHours?: number;
        priority?: "low" | "medium" | "high";
        progressPercent?: number;
        status?: "todo" | "in_progress" | "done";
        color?: string;
        planSequence?: number;
        updatedAt: number;
      } = { updatedAt: Date.now() };
      if (p.title !== undefined) overallPatch.title = p.title.trim();
      if (p.due_date !== undefined) {
        assertDate("due_date", p.due_date);
        overallPatch.dueDate = p.due_date;
      }
      if (p.estimated_hours !== undefined) overallPatch.estimatedHours = p.estimated_hours;
      if (p.priority !== undefined) overallPatch.priority = p.priority;
      if (p.progress_percent !== undefined) overallPatch.progressPercent = p.progress_percent;
      if (p.status !== undefined) overallPatch.status = p.status;
      if (p.color !== undefined) overallPatch.color = p.color === null ? undefined : p.color;
      if (p.plan_sequence !== undefined) overallPatch.planSequence = p.plan_sequence;

      const hasOverallKeys =
        p.title !== undefined ||
        p.due_date !== undefined ||
        p.estimated_hours !== undefined ||
        p.priority !== undefined ||
        p.progress_percent !== undefined ||
        p.status !== undefined ||
        p.color !== undefined ||
        p.plan_sequence !== undefined;

      if (hasOverallKeys) {
        await ctx.db.patch(args.taskId, overallPatch);
        const doc = await ctx.db.get(args.taskId);
        if (doc) return { success: true as const, data: mapTask(doc), kind: "overall" as const };
      }
    }

    if (args.miniTaskId) {
      const existing = await ctx.db.get(args.miniTaskId);
      if (!existing || existing.userId !== user._id) {
        throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
      }
      const miniPatch: {
        title?: string;
        scheduledDate?: string;
        minutes?: number;
        tier?: "must" | "should" | "optional";
        completed?: boolean;
        completedAt?: number;
      } = {};
      if (p.title !== undefined) miniPatch.title = p.title.trim();
      if (p.scheduled_date !== undefined) {
        assertDate("scheduled_date", p.scheduled_date);
        miniPatch.scheduledDate = p.scheduled_date;
      }
      if (p.minutes !== undefined) miniPatch.minutes = p.minutes;
      if (p.tier !== undefined) miniPatch.tier = p.tier;
      if (p.completed !== undefined) {
        miniPatch.completed = p.completed;
        miniPatch.completedAt = p.completed ? Date.now() : undefined;
      }
      if (Object.keys(miniPatch).length > 0) {
        await ctx.db.patch(args.miniTaskId, miniPatch);
        const doc = await ctx.db.get(args.miniTaskId);
        if (doc) {
          await syncParentProgressFromMiniTasks(ctx, doc.parentTaskId);
          return { success: true as const, data: mapMiniTask(doc), kind: "mini" as const };
        }
      }
    }

    throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
  },
});

export const remove = mutation({
  args: {
    taskId: v.optional(v.id("tasks")),
    miniTaskId: v.optional(v.id("miniTasks")),
  },
  handler: async (ctx, args) => {
    const hasTask = args.taskId !== undefined;
    const hasMini = args.miniTaskId !== undefined;
    if (hasTask === hasMini) {
      throw new ConvexError({ message: "Provide exactly one of taskId or miniTaskId", code: "INVALID_TARGET" });
    }
    const user = await getAuthUser(ctx);
    if (args.taskId) {
      const doc = await ctx.db.get(args.taskId);
      if (!doc) {
        return { success: true as const };
      }
      if (doc.userId !== user._id) {
        throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
      }
      if (doc.parentTaskId === undefined) {
        await ctx.runMutation(internal.plansInternal.deleteAllMiniTasksForParent, {
          userId: user._id,
          parentTaskId: args.taskId,
        });
        await ctx.runMutation(internal.plansInternal.stripPlanBlocksForParent, {
          userId: user._id,
          parentTaskId: args.taskId,
        });
      }
      await ctx.db.delete(args.taskId);
      if (doc.parentTaskId === undefined) {
        await ctx.scheduler.runAfter(0, internal.plans.regenerateAfterTaskDelete, {
          userId: user._id,
        });
      }
      return { success: true as const };
    }
    const miniTaskId = args.miniTaskId!;
    const miniDoc = await ctx.db.get(miniTaskId);
    if (!miniDoc) {
      return { success: true as const };
    }
    if (miniDoc.userId !== user._id) {
      throw new ConvexError({ message: "Task not found", code: "NOT_FOUND" });
    }
    const parentId = miniDoc.parentTaskId;
    await ctx.db.delete(miniTaskId);
    await syncParentProgressFromMiniTasks(ctx, parentId);
    return { success: true as const };
  },
});
