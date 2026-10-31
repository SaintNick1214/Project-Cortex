import type { QueryCtx } from "../_generated/server";
export async function requireOwnerScope(
  ctx: QueryCtx,
  args: { userId: string; tenantId: string; memorySpaceId: string },
): Promise<void> {
  const account = await ctx.db
    .query("appAccounts")
    .withIndex("by_account", (q) => q.eq("accountId", args.userId))
    .unique();
  if (
    !account ||
    account.disabled ||
    account.tenantId !== args.tenantId ||
    !account.allowedMemorySpaceIds.includes(args.memorySpaceId)
  )
    throw new Error("Resource unavailable");
}
