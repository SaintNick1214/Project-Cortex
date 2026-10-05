import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
// A single account row is the OCC boundary for every permit/charge/control. No second production ledger.
export default defineSchema({ experimentControls: defineTable({ key: v.string(), stateCanonical: v.string() }).index("by_key", ["key"]) });
