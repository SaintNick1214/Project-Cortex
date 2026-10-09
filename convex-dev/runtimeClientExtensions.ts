/** Fresh, nonbillable metadata and explicit stage barriers for browser clients. */
import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { dataAuthorityReference, requireDataAuthority, recheckDataAuthority } from "./runtimeDataAuth";
import { readCurrentEmbeddingProfile } from "./runtimeModelPolicy";
import { readScopeCutoff } from "./runtimeIngestion";
import { readStageProgress } from "./runtimeMemoryContext";

const selectors = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) };
const stage = v.union(v.literal("facts"), v.literal("vectors"), v.literal("graph"));
function denied(code: "INVALID_INPUT" | "PROFILE_MISMATCH" | "CONTEXT_INCOMPLETE" | "CAPABILITY_UNAVAILABLE"): never {
  throw new ConvexError({ version: 1, code, message: "Runtime metadata control failed.", retryable: false, outcome: "not_dispatched" });
}
function cutoff(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) denied("INVALID_INPUT");
  return value;
}

/** Models and profiles are selected by current administrator policy. The optional ID is a guard. */
export const embeddingProfile = mutation({
  args: { ...selectors, operationKey: v.optional(v.union(v.literal("embedding.memory"), v.literal("embedding.query"))), expectedProfileId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireDataAuthority(ctx, args, "read"), reference = dataAuthorityReference(actor);
    const profile = await readCurrentEmbeddingProfile(ctx, reference, args.operationKey ?? "embedding.query");
    if (args.expectedProfileId !== undefined && args.expectedProfileId !== profile.profileId) denied("PROFILE_MISMATCH");
    await recheckDataAuthority(ctx, reference, "read");
    return { version: 1 as const, profile };
  },
});

/** A point-in-time barrier, with separate source and graph counters. It starts no model or worker. */
export const memoryReadiness = mutation({
  args: { ...selectors, cutoff: v.optional(v.number()), graphCutoff: v.optional(v.number()),
    expectedProfileId: v.optional(v.string()), strictStages: v.optional(v.array(stage)) },
  handler: async (ctx, args) => {
    const actor = await requireDataAuthority(ctx, args, "read"), reference = dataAuthorityReference(actor);
    // Whole-scope counters can reveal another owner's activity; own grants use run-specific readiness.
    if (actor.resourceAccess === "own") throw new ConvexError({ version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" });
    const selected = args.strictStages ?? [];
    if (selected.length > 3 || new Set(selected).size !== selected.length) denied("INVALID_INPUT");
    const profile = await readCurrentEmbeddingProfile(ctx, reference, "embedding.query");
    if (args.expectedProfileId !== undefined && args.expectedProfileId !== profile.profileId) denied("PROFILE_MISMATCH");
    const sourceScope = await readScopeCutoff(ctx, reference);
    const graphScope = await ctx.db.query("runtimeGraphScopes").withIndex("by_scope", q => q.eq("tenantId", reference.tenantId)
      .eq("memorySpaceId", reference.memorySpaceId!)).unique();
    const sourceCutoff = cutoff(args.cutoff ?? sourceScope.sequence), graphCutoff = cutoff(args.graphCutoff ?? graphScope?.sequence ?? 0);
    if (sourceCutoff > sourceScope.sequence || graphCutoff > (graphScope?.sequence ?? 0)) denied("INVALID_INPUT");
    const stages = await readStageProgress(ctx, reference, sourceCutoff, undefined, graphCutoff);
    await recheckDataAuthority(ctx, reference, "read");
    for (const name of selected) {
      if (!stages[name]) denied("CAPABILITY_UNAVAILABLE");
      if (!stages[name]!.complete) denied("CONTEXT_INCOMPLETE");
    }
    return { version: 1 as const, cutoff: sourceCutoff, graphCutoff, profile, stages, strictStages: selected };
  },
});
