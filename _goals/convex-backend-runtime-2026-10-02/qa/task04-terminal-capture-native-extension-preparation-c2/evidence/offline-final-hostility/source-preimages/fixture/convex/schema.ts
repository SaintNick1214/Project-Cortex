/** Fixture-owned composition. All product validators/indexes/options preserved verbatim. */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import product from "./productionSchema";
export default defineSchema({ ...product.tables,
  qaAdmissionPeerEffects: defineTable({ run: v.string(), dispatchDigest: v.string(), requestCount: v.number(),
    effectCount: v.number(), createdAt: v.number(), marker: v.optional(v.string()) })
    .index("by_run_dispatch", ["run", "dispatchDigest"]),
}, { schemaValidation: product.schemaValidation, strictTableNameTypes: true });
