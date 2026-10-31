import {defineTable} from "convex/server";
import {v} from "convex/values";
import {runtimeAuthorityReference} from "./runtimeAuthSchema";
import {ingestionStage} from "./runtimeIngestionSchema";
export const task13HeldIngestionTable=defineTable({tenantId:v.string(),memorySpaceId:v.string(),reference:runtimeAuthorityReference,eventId:v.string(),stage:ingestionStage,
 state:v.union(v.literal("held"),v.literal("released")),heldAt:v.number(),deadlineAt:v.number(),scheduledId:v.id("_scheduled_functions"),releaseIssuedAt:v.optional(v.number())})
 .index("by_event",["tenantId","memorySpaceId","eventId"]);
