import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

export async function principal(ctx: Pick<QueryCtx | MutationCtx | ActionCtx, "auth">): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ version: 1, code: "UNAUTHENTICATED", retryable: false });
  if (!["task01-owner", "task01-other-owner"].includes(identity.subject)) throw new ConvexError({ version: 1, code: "FORBIDDEN", retryable: false });
  return identity.subject;
}
