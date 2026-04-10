import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { addCalendarDaysYmd, formatYmdInTimeZone } from "./lib/calendar_dates";
import { getAuthUser, getOrCreateAuthUser } from "./lib/auth";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

type GateStatus = {
  asOfDate: string;
  yesterdayDate: string;
  acknowledged: boolean;
  shouldBlock: boolean;
  yesterdayOverdueCount: number;
  totalOverdueCount: number;
  totalOverdueMinutes: number;
};

type DbReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

function assertYmd(label: string, value: string): void {
  if (!YMD_RE.test(value)) {
    throw new ConvexError({ message: `${label} must be YYYY-MM-DD`, code: "INVALID_DATE" });
  }
}

async function loadGateStatus(
  ctx: DbReaderCtx,
  args: { userId: Id<"users">; asOfDate: string }
): Promise<GateStatus> {
  const yesterdayDate = addCalendarDaysYmd(args.asOfDate, -1);
  const [miniDocs, acknowledgment] = await Promise.all([
    ctx.db
      .query("miniTasks")
      .withIndex("by_user_scheduled", (q) => q.eq("userId", args.userId))
      .take(5000),
    ctx.db
      .query("dailyOverdueAcknowledgments")
      .withIndex("by_user_for_date", (q) =>
        q.eq("userId", args.userId).eq("forDate", args.asOfDate)
      )
      .unique(),
  ]);

  const overdueMinis = miniDocs.filter(
    (mini) => !mini.completed && mini.scheduledDate < args.asOfDate
  );
  const yesterdayOverdueCount = overdueMinis.filter(
    (mini) => mini.scheduledDate === yesterdayDate
  ).length;
  const totalOverdueMinutes = overdueMinis.reduce((sum, mini) => sum + mini.minutes, 0);
  const totalOverdueCount = overdueMinis.length;

  return {
    asOfDate: args.asOfDate,
    yesterdayDate,
    acknowledged: acknowledgment !== null,
    shouldBlock: totalOverdueCount > 0 && acknowledgment === null,
    yesterdayOverdueCount,
    totalOverdueCount,
    totalOverdueMinutes,
  };
}

export const getStatus = query({
  args: { asOfDate: v.optional(v.string()) },
  returns: v.object({
    asOfDate: v.string(),
    yesterdayDate: v.string(),
    acknowledged: v.boolean(),
    shouldBlock: v.boolean(),
    yesterdayOverdueCount: v.number(),
    totalOverdueCount: v.number(),
    totalOverdueMinutes: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const asOfDate = args.asOfDate ?? formatYmdInTimeZone(user.timezone);
    assertYmd("asOfDate", asOfDate);
    return await loadGateStatus(ctx, { userId: user._id, asOfDate });
  },
});

export const acknowledgeForDate = mutation({
  args: { forDate: v.string() },
  returns: v.object({
    success: v.boolean(),
    acknowledgedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    assertYmd("forDate", args.forDate);
    const user = await getOrCreateAuthUser(ctx);
    const existing = await ctx.db
      .query("dailyOverdueAcknowledgments")
      .withIndex("by_user_for_date", (q) =>
        q.eq("userId", user._id).eq("forDate", args.forDate)
      )
      .unique();

    const acknowledgedAt = existing?.acknowledgedAt ?? Date.now();
    if (!existing) {
      const status = await loadGateStatus(ctx, { userId: user._id, asOfDate: args.forDate });
      await ctx.db.insert("dailyOverdueAcknowledgments", {
        userId: user._id,
        forDate: args.forDate,
        acknowledgedAt,
        yesterdayOverdueCount: status.yesterdayOverdueCount,
        totalOverdueCount: status.totalOverdueCount,
        totalOverdueMinutes: status.totalOverdueMinutes,
      });
    }

    return { success: true, acknowledgedAt };
  },
});
