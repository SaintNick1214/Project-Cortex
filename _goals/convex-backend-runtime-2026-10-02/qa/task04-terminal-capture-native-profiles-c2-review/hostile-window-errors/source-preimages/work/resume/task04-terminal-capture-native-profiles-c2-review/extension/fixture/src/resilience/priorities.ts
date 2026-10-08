/**
 * Operation Priority Mapping
 *
 * Automatically assigns priority levels to SDK operations based on their
 * importance and latency requirements.
 *
 * Priority Levels:
 * - critical: GDPR/security operations that must not be delayed
 * - high: Real-time conversation operations for responsive UX
 * - normal: Standard reads/writes with reasonable latency tolerance
 * - low: Bulk operations that can tolerate delays
 * - background: Async operations that run when resources are available
 */

import type { Priority } from "./types";

/**
 * Operation name to priority mapping
 *
 * Uses pattern matching with wildcards:
 * - Exact match: "memory:remember" → specific operation
 * - Wildcard suffix: "graphSync:*" → all graphSync operations
 */
export const OPERATION_PRIORITIES: Record<string, Priority> = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CRITICAL - GDPR/Security (never delayed, never dropped)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "users:delete": "critical",
  "users:purge": "critical",
  "governance:purge": "critical",
  "governance:deleteUserData": "critical",
  "governance:executeRetentionPolicy": "critical",

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HIGH - Real-time conversation (low latency required)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "memory:remember": "high",
  "memory:rememberStream": "high",
  "conversations:create": "high",
  "conversations:addMessage": "high",
  "conversations:update": "high",
  "a2a:sendMessage": "high",
  "a2a:broadcast": "high",

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NORMAL - Standard operations (default)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "memory:search": "normal",
  "memory:get": "normal",
  "memory:store": "normal",
  "memory:update": "normal",
  "memory:delete": "normal",
  "memory:list": "normal",
  "memory:count": "normal",

  "conversations:get": "normal",
  "conversations:list": "normal",
  "conversations:delete": "normal",

  "facts:store": "normal",
  "facts:get": "normal",
  "facts:search": "normal",
  "facts:update": "normal",
  "facts:delete": "normal",
  "facts:list": "normal",

  "contexts:create": "normal",
  "contexts:get": "normal",
  "contexts:update": "normal",
  "contexts:delete": "normal",

  "vector:store": "normal",
  "vector:search": "normal",
  "vector:get": "normal",
  "vector:update": "normal",
  "vector:delete": "normal",

  "immutable:append": "normal",
  "immutable:get": "normal",
  "immutable:list": "normal",

  "mutable:set": "normal",
  "mutable:get": "normal",
  "mutable:delete": "normal",

  "users:create": "normal",
  "users:get": "normal",
  "users:update": "normal",
  "users:list": "normal",

  "agents:create": "normal",
  "agents:get": "normal",
  "agents:update": "normal",
  "agents:delete": "normal",
  "agents:list": "normal",

  "memorySpaces:create": "normal",
  "memorySpaces:get": "normal",
  "memorySpaces:update": "normal",
  "memorySpaces:delete": "normal",
  "memorySpaces:list": "normal",

  "a2a:get": "normal",
  "a2a:list": "normal",
  "a2a:subscribe": "normal",

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOW - Bulk operations (can tolerate delays)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "memory:export": "low",
  "memory:deleteMany": "low",
  "memory:updateMany": "low",
  "memory:archive": "low",
  "memory:restoreFromArchive": "low",

  "facts:deleteMany": "low",
  "facts:updateMany": "low",
  "facts:export": "low",

  "conversations:deleteMany": "low",
  "conversations:export": "low",

  "vector:deleteMany": "low",
  "vector:updateMany": "low",

  "governance:listPolicies": "low",
  "governance:createPolicy": "low",
  "governance:updatePolicy": "low",

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BACKGROUND - Async operations (run when idle)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "graphSync:*": "background",
  "graph:sync": "background",
  "graph:batchSync": "background",
};

/**
 * Default priority for unknown operations
 */
export const DEFAULT_PRIORITY: Priority = "normal";

/**
 * Get priority for an operation name
 *
 * Supports exact matches and wildcard patterns (e.g., "graphSync:*")
 *
 * @param operationName - The operation name (e.g., "memory:remember")
 * @returns The priority level for the operation
 */
export function getPriority(operationName: string): Priority {
  // Try exact match first
  if (operationName in OPERATION_PRIORITIES) {
    return OPERATION_PRIORITIES[operationName];
  }

  // Try wildcard match (e.g., "graphSync:*" matches "graphSync:anything")
  const [namespace] = operationName.split(":");
  const wildcardKey = `${namespace}:*`;

  if (wildcardKey in OPERATION_PRIORITIES) {
    return OPERATION_PRIORITIES[wildcardKey];
  }

  // Return default priority
  return DEFAULT_PRIORITY;
}

/**
 * Check if an operation is critical (should never be dropped)
 */
export function isCritical(operationName: string): boolean {
  return getPriority(operationName) === "critical";
}

/**
 * Get all operation names for a given priority level
 */
export function getOperationsByPriority(priority: Priority): string[] {
  return Object.entries(OPERATION_PRIORITIES)
    .filter(([_, p]) => p === priority)
    .map(([name]) => name);
}
