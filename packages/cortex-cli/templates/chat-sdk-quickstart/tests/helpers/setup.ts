/**
 * Vitest Test Setup
 *
 * Global test setup for the chat-sdk-quickstart template.
 * This file runs before all tests.
 */

import { vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = { ...process.env };

beforeEach(() => {
  // Reset environment variables to a clean state
  process.env = { ...originalEnv };

  // Set default test environment variables
  process.env.CONVEX_URL = "https://test-convex.cloud";
  process.env.MEMORY_SPACE_ID = "test-memory-space";
  process.env.AGENT_ID = "test-agent";

  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore original environment
  process.env = { ...originalEnv };
});

// Mock Next.js server components
vi.mock("next/server", () => ({
  after: vi.fn(),
}));

// Mock the auth module to avoid actual auth calls in tests
vi.mock("@/app/(auth)/auth", () => ({
  auth: vi.fn(),
}));
