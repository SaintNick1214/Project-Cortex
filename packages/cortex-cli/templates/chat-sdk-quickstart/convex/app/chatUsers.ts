import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
const registration = {
  userId: v.string(),
  tenantId: v.string(),
  memorySpaceId: v.string(),
  email: v.string(),
};
export const credentialByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("chatUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    return user
      ? {
          id: user.userId,
          email: user.email,
          password: user.passwordHash || null,
        }
      : null;
  },
});
export const register = internalMutation({
  args: { ...registration, passwordHash: v.string() },
  handler: async (ctx, args) => {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email) ||
      !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(args.passwordHash)
    )
      throw new Error("Invalid credentials");
    if (
      (await ctx.db
        .query("chatUsers")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .unique()) ||
      (await ctx.db
        .query("chatUsers")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .unique())
    )
      return { error: "USER_EXISTS" };
    await ctx.db.insert("chatUsers", { ...args, createdAt: Date.now() });
    return { id: args.userId, email: args.email };
  },
});
export const createGuest = internalMutation({
  args: registration,
  handler: async (ctx, args) => {
    if (
      !args.email.startsWith("guest-") ||
      (await ctx.db
        .query("chatUsers")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .unique()) ||
      (await ctx.db
        .query("chatUsers")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .unique())
    )
      throw new Error("Guest unavailable");
    await ctx.db.insert("chatUsers", { ...args, createdAt: Date.now() });
    return { id: args.userId, email: args.email };
  },
});
