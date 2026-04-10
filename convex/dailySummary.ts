import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { computeFeasibility } from "./lib/feasibility/availability";
import { mapAvailability, mapDailySummary, mapMiniTask, mapTask } from "./lib/mappers";
import { generateDailySummary } from "./lib/summary";
import type { AvailabilityRow, DailySummary, MiniTask, Task } from "./lib/types";

type SummaryLoadContext = {
  todayStr: string;
  items: MiniTask[];
  availability: AvailabilityRow[];
  tasks: Task[];
};

export const loadSummaryContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [miniDocs, availDocs, taskDocs] = await Promise.all([
      ctx.db
        .query("miniTasks")
        .withIndex("by_user_scheduled", (q) =>
          q.eq("userId", args.userId).eq("scheduledDate", todayStr)
        )
        .take(2000),
      ctx.db
        .query("availability")
        .withIndex("by_user_day", (q) => q.eq("userId", args.userId))
        .take(32),
      ctx.db
        .query("tasks")
        .withIndex("by_user_due", (q) => q.eq("userId", args.userId))
        .take(5000),
    ]);

    return {
      todayStr,
      items: miniDocs.map(mapMiniTask),
      availability: availDocs.map(mapAvailability),
      tasks: taskDocs.map(mapTask),
    };
  },
});

export const upsertDailySummary = internalMutation({
  args: {
    userId: v.id("users"),
    forDate: v.string(),
    summaryText: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailySummaries")
      .withIndex("by_user_for_date", (q) => q.eq("userId", args.userId).eq("forDate", args.forDate))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { summaryText: args.summaryText });
      const doc = await ctx.db.get(existing._id);
      return doc ? mapDailySummary(doc) : null;
    }
    const id = await ctx.db.insert("dailySummaries", {
      userId: args.userId,
      forDate: args.forDate,
      summaryText: args.summaryText,
      createdAt: now,
    });
    const doc = await ctx.db.get(id);
    return doc ? mapDailySummary(doc) : null;
  },
});

export const runForUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ success: true; data: DailySummary | null }> => {
    const input: SummaryLoadContext = await ctx.runQuery(internal.dailySummary.loadSummaryContext, {
      userId: args.userId,
    });

    const periodEnd = new Date(input.todayStr);
    periodEnd.setDate(periodEnd.getDate() + 6);
    const periodEndStr = periodEnd.toISOString().slice(0, 10);

    const feasibility = computeFeasibility(
      input.tasks,
      input.availability,
      input.todayStr,
      periodEndStr,
      input.todayStr
    );

    const summaryText = await generateDailySummary(input.items, feasibility, null);

    const summary: DailySummary | null = await ctx.runMutation(internal.dailySummary.upsertDailySummary, {
      userId: args.userId,
      forDate: input.todayStr,
      summaryText,
    });

    return { success: true as const, data: summary };
  },
});

export const generate = action({
  args: {},
  handler: async (ctx): Promise<{ success: true; data: DailySummary | null }> => {
    const profile = await ctx.runQuery(api.users.get, {});
    const userId = profile.id as Id<"users">;
    return await ctx.runAction(internal.dailySummary.runForUser, { userId });
  },
});

export const listAllUserIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(10000);
    return users.map((u) => u._id);
  },
});

export const generateForAll = internalAction({
  args: {},
  handler: async (ctx): Promise<null> => {
    const ids = await ctx.runQuery(internal.dailySummary.listAllUserIds, {});
    for (const userId of ids) {
      try {
        await ctx.runAction(internal.dailySummary.runForUser, { userId });
      } catch (err) {
        console.error("dailySummary.runForUser failed for", userId, err);
      }
    }
    return null;
  },
});
