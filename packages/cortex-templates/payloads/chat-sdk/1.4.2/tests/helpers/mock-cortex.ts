/**
 * Cortex SDK Mock Helper
 *
 * Provides mock implementations of the Cortex SDK for unit testing.
 * Use this to test components that depend on Cortex without hitting the real API.
 */

import type { AuthContext } from "@cortexmemory/sdk";
import { type Mock, vi } from "vitest";

/**
 * Mock conversation operations
 */
export interface MockConversations {
  create: Mock;
  delete: Mock;
  get: Mock;
  list: Mock;
  setVisibility: Mock;
}

/**
 * Mock artifact operations
 */
export interface MockArtifacts {
  create: Mock;
  delete: Mock;
  get: Mock;
  list: Mock;
  update: Mock;
}

/**
 * Mock attachment operations
 */
export interface MockAttachments {
  attach: Mock;
  delete: Mock;
  generateUploadUrl: Mock;
  getUrl: Mock;
}

/**
 * Mock memory operations
 */
export interface MockMemory {
  forget: Mock;
  recall: Mock;
  remember: Mock;
}

/**
 * Complete mock Cortex SDK client
 */
export interface MockCortex {
  artifacts: MockArtifacts;
  attachments: MockAttachments;
  conversations: MockConversations;
  memory: MockMemory;
}

/**
 * Create a mock Cortex SDK client with all operations mocked.
 *
 * @returns Mock Cortex client with vi.fn() mocks for all operations
 *
 * @example
 * ```typescript
 * const mockCortex = createMockCortex();
 *
 * // Configure mock responses
 * mockCortex.conversations.create.mockResolvedValue({ conversationId: 'conv-123' });
 *
 * // Assert calls
 * expect(mockCortex.conversations.create).toHaveBeenCalledWith({
 *   memorySpaceId: 'test-space',
 * });
 * ```
 */
export function createMockCortex(): MockCortex {
  return {
    artifacts: {
      create: vi.fn().mockResolvedValue({ artifactId: "art-123" }),
      delete: vi.fn().mockResolvedValue({ deleted: true }),
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    attachments: {
      attach: vi.fn().mockResolvedValue({ attachmentId: "att-123" }),
      delete: vi.fn().mockResolvedValue({ deleted: true }),
      generateUploadUrl: vi
        .fn()
        .mockResolvedValue({ uploadUrl: "http://upload.example.com" }),
      getUrl: vi.fn().mockResolvedValue("http://download.example.com/file"),
    },
    conversations: {
      create: vi.fn().mockResolvedValue({ conversationId: "conv-123" }),
      delete: vi.fn().mockResolvedValue({ deleted: true }),
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      setVisibility: vi.fn().mockResolvedValue({}),
    },
    memory: {
      forget: vi.fn().mockResolvedValue({ deleted: true }),
      recall: vi.fn().mockResolvedValue({ memories: [] }),
      remember: vi.fn().mockResolvedValue({ memoryId: "mem-123" }),
    },
  };
}

/**
 * Reset all mocks on a MockCortex instance.
 *
 * @param mockCortex - The mock client to reset
 */
export function resetMockCortex(mockCortex: MockCortex): void {
  for (const api of [
    mockCortex.conversations,
    mockCortex.artifacts,
    mockCortex.attachments,
    mockCortex.memory,
  ]) {
    for (const mock of Object.values(api)) {
      mock.mockReset();
    }
  }
}

/**
 * Create a mock AuthContext for testing authenticated operations.
 *
 * @param overrides - Optional overrides for the auth context
 * @returns Mock auth context
 */
export function createMockAuthContext(
  overrides: Partial<AuthContext> = {}
): AuthContext {
  return {
    authenticatedAt: Date.now(),
    authMethod: "session",
    authProvider: "nextauth",
    metadata: {},
    userId: "test-user-123",
    ...overrides,
  };
}
