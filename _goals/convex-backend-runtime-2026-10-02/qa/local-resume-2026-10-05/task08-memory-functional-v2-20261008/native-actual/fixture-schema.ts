/** Add only to the owned disposable host schema when installing the coherent Task08 candidate. */
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { ingestionStage } from "./runtimeIngestionSchema";
export const task08FixtureTables = {
  task08HeldStages: defineTable({ tenantId: v.string(), memorySpaceId: v.string(), reference: runtimeAuthorityReference,
    eventId: v.string(), stage: ingestionStage, heldAt: v.number() }).index("by_event_stage", ["eventId", "stage"]),
};
