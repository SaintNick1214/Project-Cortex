/**
 * Test Isolation Helpers
 *
 * Provides unique run IDs and prefixed entity generators to enable
 * parallel test execution without conflicts.
 *
 * Each test file should create a TestRunContext at the top level,
 * then use its generators for all entity IDs.
 */

/**
 * Context for a single test run, containing a unique run ID and
 * generators for creating prefixed entity identifiers.
 */
export interface TestRunContext {
  /** Unique identifier for this test run */
  runId: string;

  /**
   * Generate a memory space ID prefixed with the run ID
   * @param suffix - Optional suffix to distinguish multiple spaces within a test
   */
  memorySpaceId: (suffix?: string) => string;

  /**
   * Generate a user ID prefixed with the run ID
   * @param suffix - Optional suffix to distinguish multiple users within a test
   */
  userId: (suffix?: string) => string;

  /**
   * Generate an agent ID prefixed with the run ID
   * @param suffix - Optional suffix to distinguish multiple agents within a test
   */
  agentId: (suffix?: string) => string;

  /**
   * Generate a conversation ID prefixed with the run ID
   * @param suffix - Optional suffix to distinguish multiple conversations within a test
   */
  conversationId: (suffix?: string) => string;

  /**
   * Generate a context ID prefixed with the run ID
   * @param suffix - Optional suffix to distinguish multiple contexts within a test
   */
  contextId: (suffix?: string) => string;

  /**
   * Generate an immutable type prefixed with the run ID
   * @param suffix - Optional suffix to distinguish multiple types within a test
   */
  immutableType: (suffix?: string) => string;

  /**
   * Generate an immutable record ID prefixed with the run ID
   * @param suffix - Optional suffix to distinguish multiple records within a test
   */
  immutableId: (suffix?: string) => string;

  /**
   * Generate a mutable namespace prefixed with the run ID
   * @param suffix - Optional suffix to distinguish multiple namespaces within a test
   */
  mutableNamespace: (suffix?: string) => string;

  /**
   * Generate a mutable key prefixed with the run ID
   * @param suffix - Optional suffix to distinguish multiple keys within a test
   */
  mutableKey: (suffix?: string) => string;

  /**
   * Generate a fact ID prefixed with the run ID (for reference purposes)
   * Note: Facts generate their own IDs, but this helps with tracking
   * @param suffix - Optional suffix to distinguish multiple facts within a test
   */
  factPrefix: (suffix?: string) => string;

  /**
   * Check if an entity ID belongs to this test run
   * @param id - The entity ID to check
   */
  belongsToRun: (id: string) => boolean;
}

/**
 * Create a new test run context with a unique run ID.
 *
 * The run ID format: `run-{timestamp}-{random}`
 * - timestamp: milliseconds since epoch for ordering/debugging
 * - random: 6-char alphanumeric for uniqueness within same millisecond
 *
 * @returns A TestRunContext with generators for all entity types
 *
 * @example
 * ```typescript
 * describe("My Test Suite", () => {
 *   const ctx = createTestRunContext();
 *
 *   it("creates a user", async () => {
 *     const userId = ctx.userId("alice");
 *     await cortex.users.update(userId, { name: "Alice" });
 *   });
 * });
 * ```
 */
export function createTestRunContext(): TestRunContext {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const runId = `run-${timestamp}-${random}`;

  const makeGenerator =
    (prefix: string) =>
    (suffix?: string): string => {
      const base = `${runId}-${prefix}`;
      return suffix ? `${base}-${suffix}` : `${base}-${Date.now()}`;
    };

  return {
    runId,
    memorySpaceId: makeGenerator("space"),
    userId: makeGenerator("user"),
    agentId: makeGenerator("agent"),
    conversationId: makeGenerator("conv"),
    contextId: makeGenerator("ctx"),
    immutableType: makeGenerator("immtype"),
    immutableId: makeGenerator("immid"),
    mutableNamespace: makeGenerator("mutns"),
    mutableKey: makeGenerator("mutkey"),
    factPrefix: makeGenerator("fact"),
    belongsToRun: (id: string) => id.startsWith(runId),
  };
}

/**
 * Create a test run context with a custom prefix for better test output readability.
 *
 * @param testName - A short name identifying the test file or suite
 * @returns A TestRunContext with the custom prefix
 *
 * @example
 * ```typescript
 * const ctx = createNamedTestRunContext("users");
 * // runId will be like: "users-run-1234567890-abc123"
 * ```
 */
export function createNamedTestRunContext(testName: string): TestRunContext {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const runId = `${testName}-run-${timestamp}-${random}`;

  const makeGenerator =
    (prefix: string) =>
    (suffix?: string): string => {
      const base = `${runId}-${prefix}`;
      return suffix ? `${base}-${suffix}` : `${base}-${Date.now()}`;
    };

  return {
    runId,
    memorySpaceId: makeGenerator("space"),
    userId: makeGenerator("user"),
    agentId: makeGenerator("agent"),
    conversationId: makeGenerator("conv"),
    contextId: makeGenerator("ctx"),
    immutableType: makeGenerator("immtype"),
    immutableId: makeGenerator("immid"),
    mutableNamespace: makeGenerator("mutns"),
    mutableKey: makeGenerator("mutkey"),
    factPrefix: makeGenerator("fact"),
    belongsToRun: (id: string) => id.startsWith(runId),
  };
}

/**
 * Global registry for tracking all test run contexts.
 * Useful for debugging and final cleanup verification.
 */
const activeContexts: Map<string, TestRunContext> = new Map();

/**
 * Create and register a test run context.
 * The context will be tracked for potential cross-test debugging.
 *
 * @param testName - Optional name for the test suite
 * @returns A registered TestRunContext
 */
export function createRegisteredTestRunContext(
  testName?: string,
): TestRunContext {
  const ctx = testName
    ? createNamedTestRunContext(testName)
    : createTestRunContext();
  activeContexts.set(ctx.runId, ctx);
  return ctx;
}

/**
 * Unregister a test run context after cleanup.
 *
 * @param ctx - The context to unregister
 */
export function unregisterTestRunContext(ctx: TestRunContext): void {
  activeContexts.delete(ctx.runId);
}

/**
 * Get all currently active test run contexts.
 * Useful for debugging parallel test issues.
 *
 * @returns Array of active run IDs
 */
export function getActiveTestRuns(): string[] {
  return Array.from(activeContexts.keys());
}

/**
 * Extract the run ID prefix from any entity ID created by a TestRunContext.
 *
 * @param entityId - The entity ID to parse
 * @returns The run ID if the entity was created by a TestRunContext, null otherwise
 *
 * @example
 * ```typescript
 * const runId = extractRunId("run-1234567890-abc123-space-test");
 * // returns: "run-1234567890-abc123"
 * ```
 */
export function extractRunId(entityId: string): string | null {
  // Match pattern: run-{timestamp}-{random} or {name}-run-{timestamp}-{random}
  const match = entityId.match(/^((?:\w+-)?run-\d+-[a-z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Check if two entity IDs belong to the same test run.
 *
 * @param id1 - First entity ID
 * @param id2 - Second entity ID
 * @returns true if both IDs belong to the same test run
 */
export function sameTestRun(id1: string, id2: string): boolean {
  const run1 = extractRunId(id1);
  const run2 = extractRunId(id2);
  return run1 !== null && run1 === run2;
}
