import { v } from "convex/values";
export const artifactContextWitness = v.object({ version: v.literal(1), artifactId: v.string(), artifactVersion: v.number(), metadataHash: v.string() });
