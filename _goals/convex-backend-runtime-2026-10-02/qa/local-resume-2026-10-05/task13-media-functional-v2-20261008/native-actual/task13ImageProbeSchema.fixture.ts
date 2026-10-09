import {defineTable} from 'convex/server';
import {v} from 'convex/values';
export const task13ImageProbeTable=defineTable({jobId:v.string(),tenantId:v.string(),memorySpaceId:v.string(),requestId:v.string(),issuedCount:v.number(),createdAt:v.number(),
 attemptId:v.optional(v.id('runtimeModelAttempts')),dispatchIdentity:v.optional(v.string()),issuedAt:v.optional(v.number()),observation:v.optional(v.any()),observedAt:v.optional(v.number())}).index('by_job',['jobId']);
