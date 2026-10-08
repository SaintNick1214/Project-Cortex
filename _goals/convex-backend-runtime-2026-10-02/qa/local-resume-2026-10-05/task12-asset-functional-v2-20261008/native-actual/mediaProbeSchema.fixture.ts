/** Disposable QA-only pending async receipt, excluded from shipped distribution. */
import {defineTable} from 'convex/server';
import {v} from 'convex/values';
import {runtimeAuthorityReference} from './runtimeAuthSchema';
export const task12MediaProbeTable=defineTable({key:v.string(),reference:runtimeAuthorityReference,assetId:v.string(),version:v.number(),frameVersionId:v.string(),frameHash:v.string(),bodyHash:v.string(),bodyBytes:v.number(),runBudgetId:v.string(),attemptId:v.id('runtimeModelAttempts'),
 state:v.union(v.literal('pending'),v.literal('issued'),v.literal('started'),v.literal('completed'),v.literal('failed'),v.literal('unknown')),issuedCount:v.number(),operation:v.optional(v.string()),inferenceId:v.optional(v.string()),dispatchIdentity:v.optional(v.string()),failureCode:v.optional(v.string()),terminalSummary:v.optional(v.any()),createdAt:v.number(),updatedAt:v.number()}).index('by_key',['key']);
