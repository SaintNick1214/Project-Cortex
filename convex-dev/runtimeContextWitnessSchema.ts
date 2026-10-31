import { v } from "convex/values";

export const contextSourcePermission = v.union(v.literal("canViewFacts"), v.literal("canViewMemories"));
export const contextSourceWitness = v.object({ sourceId: v.string(), sourceEventId: v.string(),
  sourceRevision: v.number(), contentHash: v.string(), permissions: v.optional(v.array(contextSourcePermission)) });
