import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUser, getOrCreateAuthUser } from "./lib/auth";
import { mapUser } from "./lib/mappers";

export const ensureExists = mutation({
  args: v.object({}),
  handler: async (ctx) => {
    const user = await getOrCreateAuthUser(ctx);
    return mapUser(user);
  },
});

export const get = query({
  args: v.object({}),
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    return mapUser(user);
  },
});
