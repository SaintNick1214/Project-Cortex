import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

const credentials = {
  accountId: v.string(),
  username: v.string(),
  displayName: v.optional(v.string()),
  passwordHash: v.string(),
};
function validateCredentials(args: {
  accountId: string;
  username: string;
  displayName?: string;
  passwordHash: string;
}) {
  if (
    !/^[a-f0-9-]{36}$/.test(args.accountId) ||
    (args.displayName !== undefined &&
      (!args.displayName.trim() || args.displayName.length > 100)) ||
    !/^[a-z0-9_-]{2,64}$/.test(args.username) ||
    !/^[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]{43}=$/.test(args.passwordHash)
  )
    throw new Error("Invalid private account data");
}
export const setup = internalMutation({
  args: { ...credentials, tenantId: v.string() },
  handler: async (ctx, args) => {
    validateCredentials(args);
    const state = await ctx.db
      .query("appAuthState")
      .withIndex("by_key", (q) => q.eq("key", "setup"))
      .unique();
    if (state) return { error: "SETUP_COMPLETE" };
    if (
      await ctx.db
        .query("appAccounts")
        .withIndex("by_username", (q) => q.eq("username", args.username))
        .unique()
    )
      return { error: "USERNAME_TAKEN" };
    if (
      await ctx.db
        .query("appAccounts")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
        .unique()
    )
      return { error: "ACCOUNT_EXISTS" };
    const now = Date.now();
    await ctx.db.insert("appAccounts", {
      ...args,
      role: "admin",
      allowedMemorySpaceIds: [`space-${args.accountId}`],
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("appAuthState", {
      key: "setup",
      initialAdminAccountId: args.accountId,
      tenantId: args.tenantId,
      bootstrapComplete: true,
    });
    return { accountId: args.accountId };
  },
});
export const register = internalMutation({
  args: credentials,
  handler: async (ctx, args) => {
    validateCredentials(args);
    const state = await ctx.db
      .query("appAuthState")
      .withIndex("by_key", (q) => q.eq("key", "setup"))
      .unique();
    if (!state?.bootstrapComplete) return { error: "SETUP_REQUIRED" };
    if (
      await ctx.db
        .query("appAccounts")
        .withIndex("by_username", (q) => q.eq("username", args.username))
        .unique()
    )
      return { error: "USERNAME_TAKEN" };
    if (
      await ctx.db
        .query("appAccounts")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
        .unique()
    )
      return { error: "ACCOUNT_EXISTS" };
    const now = Date.now();
    await ctx.db.insert("appAccounts", {
      ...args,
      role: "user",
      tenantId: state.tenantId,
      allowedMemorySpaceIds: [`space-${args.accountId}`],
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
    return { accountId: args.accountId };
  },
});
export const credentialByUsername = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("appAccounts")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    return account
      ? {
          accountId: account.accountId,
          passwordHash: account.passwordHash,
          disabled: account.disabled,
        }
      : null;
  },
});
export const identityById = internalQuery({
  args: { accountId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("appAccounts")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
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
