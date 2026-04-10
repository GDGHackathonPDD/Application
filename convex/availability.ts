import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUser } from "./lib/auth";
import { mapAvailability } from "./lib/mappers";

const dayEntry = v.object({
  day_of_week: v.number(),
  available_hours: v.number(),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    const rows = await ctx.db
      .query("availability")
      .withIndex("by_user_day", (q) => q.eq("userId", user._id))
      .order("asc")
      .take(32);
    return rows.map(mapAvailability);
  },
});

export const upsert = mutation({
  args: {
    days: v.array(dayEntry),
  },
  handler: async (ctx, args) => {
    if (args.days.length !== 7) {
      throw new ConvexError({ message: "days must have length 7", code: "INVALID_DAYS" });
    }
    const user = await getAuthUser(ctx);
    const out: ReturnType<typeof mapAvailability>[] = [];
    for (const d of args.days) {
      if (d.day_of_week < 0 || d.day_of_week > 6) {
        throw new ConvexError({ message: "day_of_week must be 0–6", code: "INVALID_DAY" });
      }
      const hoursRaw = Number(d.available_hours);
      const hours = Number.isFinite(hoursRaw)
        ? Math.min(24, Math.max(0, hoursRaw))
        : 0;
      const existing = await ctx.db
        .query("availability")
        .withIndex("by_user_day", (q) => q.eq("userId", user._id).eq("dayOfWeek", d.day_of_week))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { availableHours: hours });
        const updated = await ctx.db.get(existing._id);
        if (updated) out.push(mapAvailability(updated));
      } else {
        const id = await ctx.db.insert("availability", {
          userId: user._id,
          dayOfWeek: d.day_of_week,
          availableHours: hours,
        });
        const inserted = await ctx.db.get(id);
        if (inserted) out.push(mapAvailability(inserted));
      }
    }
    out.sort((a, b) => a.day_of_week - b.day_of_week);
    return out;
  },
});
