import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getAuthUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

export async function getOrCreateAuthUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (existing) {
    return existing;
  }

  const email =
    typeof identity.email === "string" && identity.email.length > 0
      ? identity.email
      : "unknown@unknown.local";

  const id: Id<"users"> = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email,
    timezone: "UTC",
    defaultPlanningHorizonDays: 7,
    defaultPeriodMode: "rolling",
    createdAt: Date.now(),
  });

  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Failed to create user");
  }
  return created;
}
