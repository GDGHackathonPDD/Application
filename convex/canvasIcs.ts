import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUser } from "./lib/auth";
import { mapCanvasIcsSettings } from "./lib/mappers";
import {
  assertCanvasIcsFeedUrlAllowed,
  colorForUid,
  fetchAndParseICS,
  parseICS,
} from "./lib/canvas/ics";

const MAX_UPLOADED_ICS_BYTES = 512 * 1024;

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    const settings = await ctx.db
      .query("canvasIcsSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return settings ? mapCanvasIcsSettings(settings) : null;
  },
});

export const getSettingsForUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    const settings = await ctx.db
      .query("canvasIcsSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return { userId: user._id, settings };
  },
});

export const applyCanvasSync = internalMutation({
  args: {
    userId: v.id("users"),
    settingsId: v.id("canvasIcsSettings"),
    taskSource: v.union(v.literal("canvas_ics"), v.literal("ics_upload")),
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
    const sourceTag = args.taskSource;
    let upserted = 0;
    const now = Date.now();
    for (const e of args.events) {
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_user_external", (q) => q.eq("userId", args.userId).eq("externalUid", e.uid))
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

export const saveSettings = mutation({
  args: {
    feed_url: v.string(),
  },
  handler: async (ctx, args) => {
    const feedUrl = args.feed_url.trim();
    try {
      assertCanvasIcsFeedUrlAllowed(feedUrl);
    } catch (e) {
      throw new ConvexError({
        message: e instanceof Error ? e.message : "Invalid ICS URL",
        code: "ICS_URL_NOT_ALLOWED",
      });
    }
    if (!feedUrl.startsWith("https://")) {
      throw new ConvexError({ message: "ICS feed must use HTTPS", code: "ICS_URL_NOT_ALLOWED" });
    }

    const user = await getAuthUser(ctx);
    const existing = await ctx.db
      .query("canvasIcsSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        feedUrl,
        uploadedIcsText: undefined,
        uploadedFileName: undefined,
        lastSyncStatus: undefined,
      });
      const updated = await ctx.db.get(existing._id);
      return {
        success: true as const,
        data: {
          id: existing._id,
          user_id: user._id,
          last_sync_at: updated?.lastSyncAt != null ? new Date(updated.lastSyncAt).toISOString() : null,
          last_sync_status: updated?.lastSyncStatus ?? null,
        },
      };
    }

    const id = await ctx.db.insert("canvasIcsSettings", {
      userId: user._id,
      feedUrl,
      lastSyncStatus: undefined,
    });

    return {
      success: true as const,
      data: {
        id,
        user_id: user._id,
        last_sync_at: null,
        last_sync_status: null,
      },
    };
  },
});

export const saveUploadedIcs = mutation({
  args: {
    ics_text: v.string(),
    file_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const text = args.ics_text;
    if (text.length > MAX_UPLOADED_ICS_BYTES) {
      throw new ConvexError({
        message: `ICS file is too large (max ${MAX_UPLOADED_ICS_BYTES / 1024} KB).`,
        code: "ICS_TOO_LARGE",
      });
    }
    if (text.trim().length === 0) {
      throw new ConvexError({ message: "ICS file is empty.", code: "ICS_EMPTY" });
    }
    const user = await getAuthUser(ctx);
    const existing = await ctx.db
      .query("canvasIcsSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const fileName = args.file_name?.trim() || null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        uploadedIcsText: text,
        uploadedFileName: fileName ?? undefined,
        lastSyncStatus: undefined,
      });
    } else {
      await ctx.db.insert("canvasIcsSettings", {
        userId: user._id,
        uploadedIcsText: text,
        uploadedFileName: fileName ?? undefined,
        lastSyncStatus: undefined,
      });
    }

    return { success: true as const };
  },
});

export const clearUploadedIcs = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    const existing = await ctx.db
      .query("canvasIcsSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!existing) return { success: true as const };
    await ctx.db.patch(existing._id, {
      uploadedIcsText: undefined,
      uploadedFileName: undefined,
      lastSyncStatus: undefined,
    });
    return { success: true as const };
  },
});

export const sync = action({
  args: {},
  handler: async (ctx): Promise<{
    success: true;
    data: { synced: number; total_events: number };
  }> => {
    const { userId, settings }: {
      userId: Id<"users">;
      settings: Doc<"canvasIcsSettings"> | null;
    } = await ctx.runQuery(internal.canvasIcs.getSettingsForUser, {});
    if (!settings) {
      throw new ConvexError({
        message:
          "No calendar ICS configured. Paste a Canvas HTTPS feed URL, or upload an .ics file.",
        code: "NO_ICS_FEED",
      });
    }

    const uploaded = settings.uploadedIcsText;
    const hasUpload = typeof uploaded === "string" && uploaded.length > 0;
    const feedUrl = settings.feedUrl;

    let events: Awaited<ReturnType<typeof fetchAndParseICS>>;
    let taskSource: "canvas_ics" | "ics_upload";

    if (hasUpload) {
      events = parseICS(uploaded);
      taskSource = "ics_upload";
    } else if (feedUrl) {
      try {
        events = await fetchAndParseICS(feedUrl);
      } catch (err) {
        await ctx.runMutation(internal.canvasIcs.patchSyncError, {
          settingsId: settings._id,
          message: err instanceof Error ? err.message : "unknown",
        });
        throw new ConvexError({
          message: "Failed to fetch ICS feed",
          code: "ICS_FETCH_ERROR",
        });
      }
      taskSource = "canvas_ics";
    } else {
      throw new ConvexError({
        message:
          "No calendar ICS configured. Paste a Canvas HTTPS feed URL, or upload an .ics file.",
        code: "NO_ICS_FEED",
      });
    }

    const payload: {
      uid: string;
      summary: string;
      dueDate: string;
      color: string;
    }[] = [];

    for (const event of events) {
      const dueDate = event.due ?? event.dtstart ?? event.dtend;
      if (!dueDate) continue;
      payload.push({
        uid: event.uid,
        summary: event.summary,
        dueDate,
        color: colorForUid(event.uid),
      });
    }

    const { upserted }: { upserted: number } = await ctx.runMutation(internal.canvasIcs.applyCanvasSync, {
      userId,
      settingsId: settings._id,
      taskSource,
      events: payload,
    });

    return {
      success: true as const,
      data: { synced: upserted, total_events: events.length },
    };
  },
});

export const patchSyncError = internalMutation({
  args: {
    settingsId: v.id("canvasIcsSettings"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.settingsId, {
      lastSyncStatus: `fetch_error: ${args.message}`,
    });
  },
});
