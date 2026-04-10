import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUser } from "./lib/auth";
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
    };
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
    const sourceTag = "google_calendar" as const;
    let upserted = 0;
    const now = Date.now();
    for (const e of args.events) {
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_user_external", (q) =>
          q.eq("userId", args.userId).eq("externalUid", e.uid)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          title: e.summary,
          dueDate: e.dueDate,
          color: e.color,
          updatedAt: now,
        });
        upserted++;
      } else {
        await ctx.db.insert("tasks", {
          userId: args.userId,
          title: e.summary,
          dueDate: e.dueDate,
          estimatedHours: 2,
          priority: "medium",
          progressPercent: 0,
          status: "todo",
          source: sourceTag,
          externalUid: e.uid,
          color: e.color,
          createdAt: now,
          updatedAt: now,
        });
        upserted++;
      }
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
