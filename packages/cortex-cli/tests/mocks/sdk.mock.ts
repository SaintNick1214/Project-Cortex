/**
 * Cortex SDK Mock
 *
 * Provides a complete mock of the Cortex SDK for testing CLI commands
 * without requiring a real Convex backend.
 */

import { jest } from "@jest/globals";

/**
 * Mock memory module
 */
export const mockMemory = {
  list: jest.fn().mockResolvedValue([]),
  search: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  delete: jest.fn().mockResolvedValue({ deleted: true }),
  deleteMany: jest.fn().mockResolvedValue({ deleted: 0 }),
  count: jest.fn().mockResolvedValue(0),
  export: jest.fn().mockResolvedValue({ format: "json", data: "[]", count: 0 }),
  archive: jest.fn().mockResolvedValue({ archived: true }),
  restoreFromArchive: jest.fn().mockResolvedValue({ restored: true }),
  remember: jest.fn().mockResolvedValue({ memoryId: "test-memory-id" }),
};

/**
 * Mock users module
 */
export const mockUsers = {
  list: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  exists: jest.fn().mockResolvedValue(false),
  update: jest
    .fn()
    .mockResolvedValue({ id: "test-user", version: 1, data: {} }),
  merge: jest.fn().mockResolvedValue({ id: "test-user", version: 2, data: {} }),
  delete: jest.fn().mockResolvedValue({ deleted: true, totalDeleted: 1 }),
  deleteMany: jest.fn().mockResolvedValue({ deleted: 0 }),
  count: jest.fn().mockResolvedValue(0),
  getHistory: jest.fn().mockResolvedValue([]),
};

/**
 * Mock memory spaces module
 */
export const mockMemorySpaces = {
  list: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  register: jest.fn().mockResolvedValue({
    memorySpaceId: "test-space",
    name: "Test Space",
    type: "project",
    status: "active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }),
  update: jest.fn().mockResolvedValue({
    memorySpaceId: "test-space",
    name: "Updated Space",
    type: "project",
    status: "active",
  }),
  delete: jest.fn().mockResolvedValue({ deleted: true }),
  archive: jest.fn().mockResolvedValue({ status: "archived" }),
  reactivate: jest.fn().mockResolvedValue({ status: "active" }),
  getStats: jest.fn().mockResolvedValue({
    memorySpaceId: "test-space",
    totalMemories: 0,
    totalConversations: 0,
    totalFacts: 0,
    totalMessages: 0,
    participants: [],
    topTags: [],
  }),
  count: jest.fn().mockResolvedValue(0),
  search: jest.fn().mockResolvedValue([]),
  addParticipant: jest.fn().mockResolvedValue({ participants: [] }),
  removeParticipant: jest.fn().mockResolvedValue({ participants: [] }),
};

/**
 * Mock facts module
 */
export const mockFacts = {
  list: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  search: jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue({ deleted: true }),
  create: jest.fn().mockResolvedValue({ factId: "test-fact" }),
};

/**
 * Mock conversations module
 */
export const mockConversations = {
  list: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ conversationId: "test-conv" }),
  delete: jest.fn().mockResolvedValue({ deleted: true }),
  count: jest.fn().mockResolvedValue(0),
};

/**
 * Mock vector module
 */
export const mockVector = {
  store: jest.fn().mockResolvedValue({ memoryId: "test-memory" }),
  get: jest.fn().mockResolvedValue(null),
  search: jest.fn().mockResolvedValue([]),
};

/**
 * Mock agents module
 */
export const mockAgents = {
  list: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  register: jest.fn().mockResolvedValue({ id: "test-agent" }),
  unregister: jest.fn().mockResolvedValue({ deleted: true }),
};

/**
 * Mock contexts module
 */
export const mockContexts = {
  list: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ contextId: "test-context" }),
  delete: jest.fn().mockResolvedValue({ deleted: true }),
};

/**
 * Mock immutable module
 */
export const mockImmutable = {
  list: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  store: jest.fn().mockResolvedValue({ id: "test-immutable" }),
  purge: jest.fn().mockResolvedValue({ deleted: true }),
};

/**
 * Mock raw Convex client
 */
export const mockConvexClient = {
  query: jest.fn().mockResolvedValue({}),
  mutation: jest.fn().mockResolvedValue({}),
};

/**
 * Complete mock Cortex client
 */
export const mockCortex = {
  memory: mockMemory,
  users: mockUsers,
  memorySpaces: mockMemorySpaces,
  facts: mockFacts,
  conversations: mockConversations,
  vector: mockVector,
  agents: mockAgents,
  contexts: mockContexts,
  immutable: mockImmutable,
  close: jest.fn(),
  getClient: jest.fn().mockReturnValue(mockConvexClient),
};

/**
 * Reset all mocks to their initial state
 */
export function resetAllMocks(): void {
  Object.values(mockMemory).forEach((fn) => (fn as jest.Mock).mockClear());
  Object.values(mockUsers).forEach((fn) => (fn as jest.Mock).mockClear());
  Object.values(mockMemorySpaces).forEach((fn) =>
    (fn as jest.Mock).mockClear(),
  );
  Object.values(mockFacts).forEach((fn) => (fn as jest.Mock).mockClear());
  Object.values(mockConversations).forEach((fn) =>
    (fn as jest.Mock).mockClear(),
  );
  Object.values(mockVector).forEach((fn) => (fn as jest.Mock).mockClear());
  Object.values(mockAgents).forEach((fn) => (fn as jest.Mock).mockClear());
  Object.values(mockContexts).forEach((fn) => (fn as jest.Mock).mockClear());
  Object.values(mockImmutable).forEach((fn) => (fn as jest.Mock).mockClear());
  (mockCortex.close as jest.Mock).mockClear();
  (mockCortex.getClient as jest.Mock).mockClear();
  (mockConvexClient.query as jest.Mock).mockClear();
  (mockConvexClient.mutation as jest.Mock).mockClear();
}

/**
 * Create a mock client factory for use with jest.mock
 */
export function createMockCortexFactory() {
  return jest.fn().mockImplementation(() => mockCortex);
}
