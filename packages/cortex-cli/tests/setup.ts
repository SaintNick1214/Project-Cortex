/**
 * Jest Setup for CLI Tests
 * Global test hooks that run after test environment is initialized
 */

import { Cortex } from "@cortexmemory/sdk";

// Global Cortex client for cleanup
let cleanupClient: Cortex | null = null;

/**
 * Get a cleanup client
 */
export function getCleanupClient(): Cortex {
  if (!cleanupClient) {
    cleanupClient = new Cortex({
      convexUrl: process.env.CONVEX_URL!,
    });
  }
  return cleanupClient;
}

/**
 * Wrap an async operation with a timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => {
      console.warn(
        `  ⚠️  Operation timed out after ${timeoutMs}ms, continuing...`,
      );
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

/**
 * Clean up test data with a specific prefix
 * Uses timeouts to prevent hanging and ensure graceful degradation
 */
export async function cleanupTestData(prefix: string): Promise<void> {
  const client = getCleanupClient();
  const OPERATION_TIMEOUT = 10000; // 10 seconds per operation
  const MAX_BATCH_SIZE = 50; // Process in smaller batches

  console.log(`🧹 Cleaning up test data with prefix: ${prefix}`);

  // Delete users first (cascade will delete their memories)
  try {
    const users = await withTimeout(
      client.users.list({ limit: 1000 }),
      OPERATION_TIMEOUT,
      [],
    );

    const testUsers = users.filter((u) => u.id.startsWith(prefix));
    console.log(`  Found ${testUsers.length} test users to clean up`);

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < testUsers.length; i += MAX_BATCH_SIZE) {
      const batch = testUsers.slice(i, i + MAX_BATCH_SIZE);

      await Promise.all(
        batch.map((user) =>
          withTimeout(
            client.users.delete(user.id, { cascade: true }).catch(() => {}),
            OPERATION_TIMEOUT,
            undefined,
          ),
        ),
      );
    }

    console.log(`  ✅ Cleaned up ${testUsers.length} test users`);
  } catch (error) {
    console.warn(`  ⚠️  Error cleaning up users:`, error);
  }

  // Then delete memory spaces (without cascade since memories already deleted)
  try {
    const spaces = await withTimeout(
      client.memorySpaces.list({ limit: 1000 }),
      OPERATION_TIMEOUT,
      [],
    );

    const testSpaces = spaces.filter((s) => s.memorySpaceId.startsWith(prefix));
    console.log(`  Found ${testSpaces.length} test spaces to clean up`);

    // Process in batches
    for (let i = 0; i < testSpaces.length; i += MAX_BATCH_SIZE) {
      const batch = testSpaces.slice(i, i + MAX_BATCH_SIZE);

      await Promise.all(
        batch.map((space) =>
          withTimeout(
            client.memorySpaces
              .delete(space.memorySpaceId, { cascade: false })
              .catch(() => {}),
            OPERATION_TIMEOUT,
            undefined,
          ),
        ),
      );
    }

    console.log(`  ✅ Cleaned up ${testSpaces.length} test spaces`);
  } catch (error) {
    console.warn(`  ⚠️  Error cleaning up spaces:`, error);
  }
}

/**
 * Force close a client with timeout protection
 */
async function forceCloseClient(
  client: Cortex,
  timeoutMs: number = 5000,
): Promise<void> {
  try {
    await withTimeout(Promise.resolve(client.close()), timeoutMs, undefined);
  } catch (error) {
    console.warn("  ⚠️  Error closing client:", error);
  }
}

// Close client after all tests
afterAll(async () => {
  if (cleanupClient) {
    await forceCloseClient(cleanupClient);
    cleanupClient = null;
  }
  // Give Convex clients time to close gracefully
  await new Promise((resolve) => setTimeout(resolve, 100));
}, 60000); // Increase timeout for global afterAll
