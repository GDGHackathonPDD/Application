import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUser } from "./lib/auth";
import { upsertImportedOverallTask } from "./lib/importedTaskUpsert";
import { encryptToken } from "./lib/tokenCrypto";

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    const row = await ctx.db
      .query("googleCalendarSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!row) {
      return { connected: false as const };
    }
    return {
      connected: true as const,
      connectedEmail: row.connectedEmail,
      lastSyncAt: row.lastSyncAt,
      lastSyncStatus: row.lastSyncStatus,
      lastPushAt: row.lastPushAt,
      lastPushStatus: row.lastPushStatus,
      hasAiGendaCalendar: Boolean(row.aigendaCalendarId),
    };
  },
});

export const saveRefreshToken = mutation({
  args: {
    refreshToken: v.string(),
    connectedEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const encrypted = await encryptToken(args.refreshToken);
    const now = Date.now();
    const existing = await ctx.db
      .query("googleCalendarSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedRefreshToken: encrypted,
        connectedEmail: args.connectedEmail ?? existing.connectedEmail,
        connectedAt: now,
        lastSyncStatus: undefined,
      });
    } else {
      await ctx.db.insert("googleCalendarSettings", {
        userId: user._id,
        encryptedRefreshToken: encrypted,
        connectedEmail: args.connectedEmail,
        connectedAt: now,
      });
    }
    return { success: true as const };
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    const existing = await ctx.db
      .query("googleCalendarSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { success: true as const };
  },
});

export const getSyncContextForAction = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) {
      throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    }
    const settings = await ctx.db
      .query("googleCalendarSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!settings) {
      return null;
    }
    return {
      userId: user._id,
      settingsId: settings._id,
      encryptedRefreshToken: settings.encryptedRefreshToken,
      aigendaCalendarId: settings.aigendaCalendarId,
    };
  },
});

export const setAigendaCalendarId = internalMutation({
  args: {
    settingsId: v.id("googleCalendarSettings"),
    calendarId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.settingsId, { aigendaCalendarId: args.calendarId });
  },
});

export const patchPushResult = internalMutation({
  args: {
    settingsId: v.id("googleCalendarSettings"),
    ok: v.boolean(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.settingsId, {
      ...(args.ok ? { lastPushAt: now } : {}),
      lastPushStatus: args.status,
    });
  },
});

export const applyGoogleCalendarSync = internalMutation({
  args: {
    userId: v.id("users"),
    settingsId: v.id("googleCalendarSettings"),
    events: v.array(
      v.object({
        uid: v.string(),
        summary: v.string(),
        dueDate: v.string(),
        color: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let upserted = 0;
    const now = Date.now();
    for (const e of args.events) {
      await upsertImportedOverallTask(ctx, {
        userId: args.userId,
        source: "google_calendar",
        uid: e.uid,
        summary: e.summary,
        dueDate: e.dueDate,
        color: e.color,
      });
      upserted++;
    }
    await ctx.db.patch(args.settingsId, {
      lastSyncAt: now,
      lastSyncStatus: `ok: ${upserted} tasks synced`,
    });
    return { upserted };
  },
});

export const patchGoogleSyncError = internalMutation({
  args: {
    settingsId: v.id("googleCalendarSettings"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.settingsId, {
      lastSyncStatus: `fetch_error: ${args.message}`,
    });
  },
});
