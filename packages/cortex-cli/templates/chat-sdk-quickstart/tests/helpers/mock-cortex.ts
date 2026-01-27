/**
 * Cortex SDK Mock Helper
 *
 * Provides mock implementations of the Cortex SDK for unit testing.
 * Use this to test components that depend on Cortex without hitting the real API.
 */

import { vi, type Mock } from "vitest";

/**
 * Mock conversation operations
 */
export interface MockConversations {
  create: Mock;
  get: Mock;
  list: Mock;
  delete: Mock;
  setVisibility: Mock;
}

/**
 * Mock artifact operations
 */
export interface MockArtifacts {
  create: Mock;
  get: Mock;
  update: Mock;
  delete: Mock;
  list: Mock;
}

/**
 * Mock attachment operations
 */
export interface MockAttachments {
  generateUploadUrl: Mock;
  attach: Mock;
  getUrl: Mock;
  delete: Mock;
}

/**
 * Mock memory operations
 */
export interface MockMemory {
  remember: Mock;
  recall: Mock;
  forget: Mock;
}

/**
 * Complete mock Cortex SDK client
 */
export interface MockCortex {
  conversations: MockConversations;
  artifacts: MockArtifacts;
  attachments: MockAttachments;
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
    conversations: {
      create: vi.fn().mockResolvedValue({ conversationId: "conv-123" }),
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({ deleted: true }),
      setVisibility: vi.fn().mockResolvedValue({}),
    },
    artifacts: {
      create: vi.fn().mockResolvedValue({ artifactId: "art-123" }),
      get: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ deleted: true }),
      list: vi.fn().mockResolvedValue([]),
    },
    attachments: {
      generateUploadUrl: vi
        .fn()
        .mockResolvedValue({ uploadUrl: "http://upload.example.com" }),
      attach: vi.fn().mockResolvedValue({ attachmentId: "att-123" }),
      getUrl: vi.fn().mockResolvedValue("http://download.example.com/file"),
      delete: vi.fn().mockResolvedValue({ deleted: true }),
    },
    memory: {
      remember: vi.fn().mockResolvedValue({ memoryId: "mem-123" }),
      recall: vi.fn().mockResolvedValue({ memories: [] }),
      forget: vi.fn().mockResolvedValue({ deleted: true }),
    },
  };
}

/**
 * Reset all mocks on a MockCortex instance.
 *
 * @param mockCortex - The mock client to reset
 */
export function resetMockCortex(mockCortex: MockCortex): void {
  Object.values(mockCortex.conversations).forEach((mock) => mock.mockReset());
  Object.values(mockCortex.artifacts).forEach((mock) => mock.mockReset());
  Object.values(mockCortex.attachments).forEach((mock) => mock.mockReset());
  Object.values(mockCortex.memory).forEach((mock) => mock.mockReset());
}

/**
 * Create a mock AuthContext for testing authenticated operations.
 *
 * @param overrides - Optional overrides for the auth context
 * @returns Mock auth context
 */
export function createMockAuthContext(
  overrides: Partial<{
    userId: string;
    authProvider: string;
    authMethod: string;
    authenticatedAt: number;
    metadata: Record<string, unknown>;
  }> = {},
) {
  return {
    userId: "test-user-123",
    authProvider: "nextauth",
    authMethod: "session",
    authenticatedAt: Date.now(),
    metadata: {},
    ...overrides,
  };
}
