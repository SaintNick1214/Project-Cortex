/** Registered modern memory endpoints. Only the two foreground actions are public. */
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import type { RuntimeAuthority, RuntimeAuthorityRequirement } from "../src/auth/verified";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { commitDerivedInput, sourceContent } from "./runtimeMemorySchema";
import { ConvexMemoryRepository, createActionMemoryRepository, memoryError, memoryScope } from "./runtimeMemoryRepository";
import { explicitSourceLineage, recallMemory, rememberMemory, unconfiguredMemoryModel } from "./runtimeMemoryServices";

const scopedArgs = { reference: runtimeAuthorityReference, capability: v.union(v.literal("read"), v.literal("write")) };
export const checkAuthority = internalQuery({ args: scopedArgs,
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability).authority() });
export const readSource = internalQuery({ args: { ...scopedArgs, sourceId: v.string() },
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability).getSource(args.sourceId) });
export const writeSource = internalMutation({ args: { ...scopedArgs, source: sourceContent },
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability, ctx.db).putSource(args.source) });
export const writeDerived = internalMutation({ args: { ...scopedArgs, input: commitDerivedInput },
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability, ctx.db).commitDerived(args.input) });
export const readFacts = internalQuery({ args: { ...scopedArgs, query: v.object({
  subject: v.optional(v.string()), factType: v.optional(v.union(v.literal("preference"), v.literal("identity"), v.literal("knowledge"),
    v.literal("relationship"), v.literal("event"), v.literal("observation"), v.literal("custom"))), limit: v.number(),
}) }, handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability).listFacts(args.query) });
export const readVectorMatches = internalQuery({ args: { ...scopedArgs, hits: v.array(v.object({ id: v.id("runtimeMemoryVectors"), score: v.number() })) },
  handler: async (ctx, args) => await new ConvexMemoryRepository(ctx, args.reference, args.capability).hydrateVectors(args.hits) });

const authorize = makeFunctionReference<"query", { requirement: RuntimeAuthorityRequirement }, RuntimeAuthority>("runtimeAuth:authorize") as unknown as
  FunctionReference<"query", "internal", { requirement: RuntimeAuthorityRequirement }, RuntimeAuthority>;
/** Foundation closure: only current trusted controls may be read before readiness. */
async function memoryCapabilityUnavailable(repository: ReturnType<typeof createActionMemoryRepository>): Promise<never> {
  await repository.recheckAuthority();
  return memoryError("CAPABILITY_UNAVAILABLE", "Memory capability unavailable.");
}
const requestArgs = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), text: v.string(), requestId: v.string() };
export const remember = action({ args: requestArgs, handler: async (ctx, args) => {
  const authority = await ctx.runQuery(authorize, { requirement: { capability: "write", tenantId: args.tenantId, memorySpaceId: args.memorySpaceId } });
  const repository = createActionMemoryRepository(ctx, authority, "write");
  await memoryCapabilityUnavailable(repository);
  return await rememberMemory({ repository, model: unconfiguredMemoryModel(), clock: { now: () => Date.now() } },
    { text: args.text, lineage: explicitSourceLineage(memoryScope(authority), args.requestId) });
} });
export const recall = action({ args: { ...requestArgs, limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const authority = await ctx.runQuery(authorize, { requirement: { capability: "read", tenantId: args.tenantId, memorySpaceId: args.memorySpaceId } });
  await memoryCapabilityUnavailable(createActionMemoryRepository(ctx, authority, "read"));
  return await recallMemory({ repository: createActionMemoryRepository(ctx, authority, "read"),
    model: unconfiguredMemoryModel(), clock: { now: () => Date.now() } }, { text: args.text, requestId: args.requestId, limit: args.limit ?? 10 });
} });
