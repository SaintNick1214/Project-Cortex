import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
const digest = (value: string) => {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error("Invalid session digest");
};
export const create = internalMutation({
  args: { sessionDigest: v.string(), accountId: v.string() },
  handler: async (ctx, args) => {
    digest(args.sessionDigest);
    const account = await ctx.db
      .query("appAccounts")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .unique();
    if (!account || account.disabled) return { error: "ACCOUNT_UNAVAILABLE" };
    if (
      await ctx.db
        .query("appSessions")
        .withIndex("by_digest", (q) =>
          q.eq("sessionDigest", args.sessionDigest),
        )
        .unique()
    )
      return { error: "SESSION_EXISTS" };
    const now = Date.now();
    await ctx.db.insert("appSessions", {
      ...args,
      createdAt: now,
      expiresAt: now + 8 * 60 * 60 * 1000,
    });
    return null;
  },
});
export const resolve = internalQuery({
  args: { sessionDigest: v.string() },
  handler: async (ctx, args) => {
    digest(args.sessionDigest);
    const session = await ctx.db
      .query("appSessions")
      .withIndex("by_digest", (q) => q.eq("sessionDigest", args.sessionDigest))
      .unique();
    if (
      !session ||
      session.revokedAt !== undefined ||
      session.expiresAt <= Date.now()
    )
      return null;
    const account = await ctx.db
      .query("appAccounts")
      .withIndex("by_account", (q) => q.eq("accountId", session.accountId))
      .unique();
    return account && !account.disabled
      ? {
          accountId: account.accountId,
          username: account.username,
          ...(account.displayName ? { displayName: account.displayName } : {}),
          role: account.role,
          tenantId: account.tenantId,
          allowedMemorySpaceIds: account.allowedMemorySpaceIds,
        }
      : null;
  },
});
export const revoke = internalMutation({
  args: { sessionDigest: v.string() },
  handler: async (ctx, args) => {
    digest(args.sessionDigest);
    const session = await ctx.db
      .query("appSessions")
      .withIndex("by_digest", (q) => q.eq("sessionDigest", args.sessionDigest))
      .unique();
    if (session && session.revokedAt === undefined)
      await ctx.db.patch(session._id, { revokedAt: Date.now() });
    return null;
  },
});
