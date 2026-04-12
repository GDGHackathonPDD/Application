import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUser, getOrCreateAuthUser } from "./lib/auth";
import { mapUser } from "./lib/mappers";

function isValidIanaTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Kept as `v.object({})` so older Convex deployments do not reject the client. */
export const ensureExists = mutation({
  args: v.object({}),
  handler: async (ctx) => {
    const user = await getOrCreateAuthUser(ctx);
    return mapUser(user);
  },
});

/** Call after `ensureExists` — stores IANA zone from the browser for planning “today”. */
export const syncBrowserTimezone = mutation({
  args: { browser_timezone: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const bt = args.browser_timezone.trim();
    if (!bt || !isValidIanaTimeZone(bt) || bt === user.timezone) {
      return mapUser(user);
    }
    await ctx.db.patch(user._id, { timezone: bt });
    const fresh = await ctx.db.get(user._id);
    return mapUser(fresh!);
  },
});

export const get = query({
  args: v.object({}),
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    return mapUser(user);
  },
});
