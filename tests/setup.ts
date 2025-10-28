/**
 * Jest Setup (After Environment)
 * Global test hooks that run after test environment is initialized
 * Note: Environment variables are loaded in env.ts via setupFiles
 */

// Global timeout for closing connections
// This ensures Jest exits even if some cleanup is slow
afterAll(async () => {
  // Give Convex clients time to close gracefully
  return await new Promise((resolve) => setTimeout(resolve, 100));
});
