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
 * Clean up test data with a specific prefix
 */
export async function cleanupTestData(prefix: string): Promise<void> {
  const client = getCleanupClient();

  // Delete users first (cascade will delete their memories)
  try {
    const users = await client.users.list({ limit: 1000 });
    const testUsers = users.filter((u) => u.id.startsWith(prefix));

    for (const user of testUsers) {
      try {
        await client.users.delete(user.id, { cascade: true });
      } catch {
        // Ignore errors
      }
    }
  } catch {
    // Ignore errors
  }

  // Then delete memory spaces (without cascade since memories already deleted)
  try {
    const spaces = await client.memorySpaces.list({ limit: 1000 });
    const testSpaces = spaces.filter((s) => s.memorySpaceId.startsWith(prefix));

    for (const space of testSpaces) {
      try {
        await client.memorySpaces.delete(space.memorySpaceId, {
          cascade: false,
        });
      } catch {
        // Ignore errors
      }
    }
  } catch {
    // Ignore errors
  }
}

// Close client after all tests
afterAll(async () => {
  if (cleanupClient) {
    cleanupClient.close();
  }
  // Give Convex clients time to close gracefully
  return await new Promise((resolve) => setTimeout(resolve, 100));
});
