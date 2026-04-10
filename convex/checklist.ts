import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUser } from "./lib/auth";
import { mapChecklistItem, mapMiniTask } from "./lib/mappers";

export const update = mutation({
  args: {
    id: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const now = Date.now();
    const updatePayload = {
      completed: args.completed,
      completedAt: args.completed ? now : undefined,
    };

    const miniId = ctx.db.normalizeId("miniTasks", args.id);
    if (miniId) {
      const row = await ctx.db.get("miniTasks", miniId);
      if (row && row.userId === user._id) {
        await ctx.db.patch(miniId, updatePayload);
        const doc = await ctx.db.get("miniTasks", miniId);
        if (!doc) throw new ConvexError({ message: "Update failed", code: "UPDATE_FAILED" });
        return { success: true as const, data: mapMiniTask(doc) };
      }
    }

    const checklistId = ctx.db.normalizeId("checklistItems", args.id);
    if (checklistId) {
      const row = await ctx.db.get("checklistItems", checklistId);
      if (row && row.userId === user._id) {
        await ctx.db.patch(checklistId, updatePayload);
        const doc = await ctx.db.get("checklistItems", checklistId);
        if (!doc) throw new ConvexError({ message: "Update failed", code: "UPDATE_FAILED" });
        return { success: true as const, data: mapChecklistItem(doc) };
      }
    }

    throw new ConvexError({ message: "Checklist item not found", code: "NOT_FOUND" });
  },
});
