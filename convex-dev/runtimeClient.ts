/** Verified browser bootstrap. Selectors narrow existing grants; they confer no authority. */
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireDataAuthority } from "./runtimeDataAuth";

export const session = query({
  args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireDataAuthority(ctx, args, "read");
    return { version: 1 as const, tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId,
      principalId: actor.principalId, userId: actor.userId };
  },
});
