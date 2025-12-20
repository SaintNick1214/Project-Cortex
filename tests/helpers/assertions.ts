/**
 * Filtered Assertion Helpers
 *
 * Provides assertion helpers that filter results by test run prefix,
 * enabling accurate count/list assertions in parallel test environments.
 *
 * These replace conflict-prone global assertions like:
 *   expect(await cortex.users.count()).toBeGreaterThanOrEqual(3)
 *
 * With isolated assertions like:
 *   expect(await countUsers(cortex, ctx)).toBe(3)
 */

import type { Cortex } from "../../src";
import type { TestRunContext } from "./isolation";

/**
 * Filter items by prefix, checking multiple possible ID fields
 */
function filterByPrefix<T>(
  items: T[],
  prefix: string,
  idFields: string[],
): T[] {
  return items.filter((item) =>
    idFields.some((field) => {
      const value = (item as Record<string, unknown>)[field];
      return typeof value === "string" && value.startsWith(prefix);
    }),
  );
}

// ============================================================================
// User Assertions
// ============================================================================

/**
 * Count users belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @returns Number of users matching the run prefix
 */
export async function countUsers(
  cortex: Cortex,
  ctx: TestRunContext,
): Promise<number> {
  const result = await cortex.users.list({ limit: 1000 });
  return filterByPrefix(result.users, ctx.runId, ["id"]).length;
}

/**
 * List users belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @returns Users matching the run prefix
 */
export async function listUsers<T extends { id: string }>(
  cortex: Cortex,
  ctx: TestRunContext,
): Promise<T[]> {
  const result = await cortex.users.list({ limit: 1000 });
  return filterByPrefix(result.users, ctx.runId, ["id"]) as unknown as T[];
}

/**
 * Assert that exactly N users exist for this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param expectedCount - Expected number of users
 */
export async function expectUserCount(
  cortex: Cortex,
  ctx: TestRunContext,
  expectedCount: number,
): Promise<void> {
  const count = await countUsers(cortex, ctx);
  if (count !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} users for run ${ctx.runId}, but found ${count}`,
    );
  }
}

// ============================================================================
// Agent Assertions
// ============================================================================

/**
 * Count agents belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @returns Number of agents matching the run prefix
 */
export async function countAgents(
  cortex: Cortex,
  ctx: TestRunContext,
): Promise<number> {
  const agents = await cortex.agents.list();
  return filterByPrefix(agents, ctx.runId, ["agentId"]).length;
}

/**
 * List agents belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @returns Agents matching the run prefix
 */
export async function listAgents<T extends { agentId: string }>(
  cortex: Cortex,
  ctx: TestRunContext,
): Promise<T[]> {
  const agents = await cortex.agents.list();
  return filterByPrefix(agents, ctx.runId, ["agentId"]) as unknown as T[];
}

// ============================================================================
// Memory Space Assertions
// ============================================================================

/**
 * Count memory spaces belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @returns Number of memory spaces matching the run prefix
 */
export async function countMemorySpaces(
  cortex: Cortex,
  ctx: TestRunContext,
): Promise<number> {
  const result = await cortex.memorySpaces.list();
  return filterByPrefix(result.spaces, ctx.runId, ["memorySpaceId"]).length;
}

/**
 * List memory spaces belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @returns Memory spaces matching the run prefix
 */
export async function listMemorySpaces<T extends { memorySpaceId: string }>(
  cortex: Cortex,
  ctx: TestRunContext,
): Promise<T[]> {
  const result = await cortex.memorySpaces.list();
  return filterByPrefix(result.spaces, ctx.runId, [
    "memorySpaceId",
  ]) as unknown as T[];
}

// ============================================================================
// Conversation Assertions
// ============================================================================

/**
 * Count conversations belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param memorySpaceId - Optional specific memory space ID
 * @returns Number of conversations matching the run prefix
 */
export async function countConversations(
  cortex: Cortex,
  ctx: TestRunContext,
  memorySpaceId?: string,
): Promise<number> {
  const options = memorySpaceId ? { memorySpaceId } : {};
  const result = await cortex.conversations.list(options);
  return filterByPrefix(result.conversations, ctx.runId, [
    "memorySpaceId",
    "conversationId",
  ]).length;
}

/**
 * List conversations belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param memorySpaceId - Optional specific memory space ID
 * @returns Conversations matching the run prefix
 */
export async function listConversations<
  T extends { memorySpaceId: string; conversationId: string },
>(cortex: Cortex, ctx: TestRunContext, memorySpaceId?: string): Promise<T[]> {
  const options = memorySpaceId ? { memorySpaceId } : {};
  const result = await cortex.conversations.list(options);
  return filterByPrefix(result.conversations, ctx.runId, [
    "memorySpaceId",
    "conversationId",
  ]) as unknown as T[];
}

// ============================================================================
// Context Assertions
// ============================================================================

/**
 * Count contexts belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @returns Number of contexts matching the run prefix
 */
export async function countContexts(
  cortex: Cortex,
  ctx: TestRunContext,
): Promise<number> {
  const contexts = await cortex.contexts.list();
  return filterByPrefix(contexts, ctx.runId, ["memorySpaceId", "contextId"])
    .length;
}

/**
 * List contexts belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @returns Contexts matching the run prefix
 */
export async function listContexts<
  T extends { memorySpaceId: string; contextId: string },
>(cortex: Cortex, ctx: TestRunContext): Promise<T[]> {
  const contexts = await cortex.contexts.list();
  return filterByPrefix(contexts, ctx.runId, [
    "memorySpaceId",
    "contextId",
  ]) as unknown as T[];
}

// ============================================================================
// Immutable Record Assertions
// ============================================================================

/**
 * Count immutable records belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param type - Optional filter by type
 * @returns Number of immutable records matching the run prefix
 */
export async function countImmutable(
  cortex: Cortex,
  ctx: TestRunContext,
  type?: string,
): Promise<number> {
  const options = type ? { type } : {};
  const records = await cortex.immutable.list(options);
  return filterByPrefix(records, ctx.runId, ["type", "id"]).length;
}

/**
 * List immutable records belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param type - Optional filter by type
 * @returns Immutable records matching the run prefix
 */
export async function listImmutable<T extends { type: string; id: string }>(
  cortex: Cortex,
  ctx: TestRunContext,
  type?: string,
): Promise<T[]> {
  const options = type ? { type } : {};
  const records = await cortex.immutable.list(options);
  return filterByPrefix(records, ctx.runId, ["type", "id"]) as unknown as T[];
}

// ============================================================================
// Mutable Record Assertions
// ============================================================================

/**
 * Count mutable records belonging to this test run.
 * Note: mutable.list requires a namespace, so this counts records
 * in the provided namespace that belong to this test run.
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param namespace - Required namespace to list from
 * @returns Number of mutable records matching the run prefix
 */
export async function countMutable(
  cortex: Cortex,
  ctx: TestRunContext,
  namespace: string,
): Promise<number> {
  const records = await cortex.mutable.list({ namespace });
  return filterByPrefix(records, ctx.runId, ["namespace", "key"]).length;
}

/**
 * List mutable records belonging to this test run.
 * Note: mutable.list requires a namespace, so this lists records
 * in the provided namespace that belong to this test run.
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param namespace - Required namespace to list from
 * @returns Mutable records matching the run prefix
 */
export async function listMutable<T extends { namespace: string; key: string }>(
  cortex: Cortex,
  ctx: TestRunContext,
  namespace: string,
): Promise<T[]> {
  const records = await cortex.mutable.list({ namespace });
  return filterByPrefix(records, ctx.runId, [
    "namespace",
    "key",
  ]) as unknown as T[];
}

// ============================================================================
// Fact Assertions
// ============================================================================

/**
 * Count facts in a memory space belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param memorySpaceId - Memory space ID (should be prefixed with run ID)
 * @returns Number of facts in the memory space
 */
export async function countFacts(
  cortex: Cortex,
  ctx: TestRunContext,
  memorySpaceId: string,
): Promise<number> {
  if (!memorySpaceId.startsWith(ctx.runId)) {
    console.warn(
      `Warning: memorySpaceId ${memorySpaceId} does not belong to run ${ctx.runId}`,
    );
  }
  const facts = await cortex.facts.list({ memorySpaceId });
  return facts.length;
}

/**
 * List facts in a memory space belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param memorySpaceId - Memory space ID (should be prefixed with run ID)
 * @returns Facts in the memory space
 */
export async function listFacts<T>(
  cortex: Cortex,
  ctx: TestRunContext,
  memorySpaceId: string,
): Promise<T[]> {
  if (!memorySpaceId.startsWith(ctx.runId)) {
    console.warn(
      `Warning: memorySpaceId ${memorySpaceId} does not belong to run ${ctx.runId}`,
    );
  }
  const facts = await cortex.facts.list({ memorySpaceId });
  return facts as unknown as T[];
}

// ============================================================================
// Memory/Vector Assertions
// ============================================================================

/**
 * Count memories in a memory space belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param memorySpaceId - Memory space ID (should be prefixed with run ID)
 * @returns Number of memories in the memory space
 */
export async function countMemories(
  cortex: Cortex,
  ctx: TestRunContext,
  memorySpaceId: string,
): Promise<number> {
  if (!memorySpaceId.startsWith(ctx.runId)) {
    console.warn(
      `Warning: memorySpaceId ${memorySpaceId} does not belong to run ${ctx.runId}`,
    );
  }
  const memories = await cortex.vector.list({ memorySpaceId });
  return memories.length;
}

/**
 * List memories in a memory space belonging to this test run
 *
 * @param cortex - Cortex SDK instance
 * @param ctx - Test run context
 * @param memorySpaceId - Memory space ID (should be prefixed with run ID)
 * @returns Memories in the memory space
 */
export async function listMemories<T>(
  cortex: Cortex,
  ctx: TestRunContext,
  memorySpaceId: string,
): Promise<T[]> {
  if (!memorySpaceId.startsWith(ctx.runId)) {
    console.warn(
      `Warning: memorySpaceId ${memorySpaceId} does not belong to run ${ctx.runId}`,
    );
  }
  const memories = await cortex.vector.list({ memorySpaceId });
  return memories as unknown as T[];
}

// ============================================================================
// Generic Assertion Helpers
// ============================================================================

/**
 * Assert that a condition is true for this test run
 *
 * @param condition - Condition to check
 * @param message - Error message if condition is false
 * @param ctx - Test run context for error context
 */
export function assertCondition(
  condition: boolean,
  message: string,
  ctx: TestRunContext,
): void {
  if (!condition) {
    throw new Error(`Assertion failed for run ${ctx.runId}: ${message}`);
  }
}

/**
 * Wait for a condition to be true, with timeout
 *
 * @param check - Function that returns true when condition is met
 * @param ctx - Test run context
 * @param timeout - Maximum time to wait in milliseconds (default: 5000)
 * @param interval - Polling interval in milliseconds (default: 100)
 * @returns true if condition was met, false if timeout
 */
export async function waitForCondition(
  check: () => Promise<boolean>,
  ctx: TestRunContext,
  timeout = 5000,
  interval = 100,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await check()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  console.warn(`Timeout waiting for condition in run ${ctx.runId}`);
  return false;
}

/**
 * Wait for an entity count to reach expected value
 *
 * @param countFn - Function that returns current count
 * @param expected - Expected count
 * @param ctx - Test run context
 * @param timeout - Maximum time to wait
 * @returns true if count reached expected value
 */
export async function waitForCount(
  countFn: () => Promise<number>,
  expected: number,
  ctx: TestRunContext,
  timeout = 5000,
): Promise<boolean> {
  return waitForCondition(
    async () => (await countFn()) === expected,
    ctx,
    timeout,
  );
}
