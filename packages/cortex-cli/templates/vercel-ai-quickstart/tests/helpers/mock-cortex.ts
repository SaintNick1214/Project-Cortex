/**
 * Mock Cortex SDK
 *
 * Provides a mock implementation of the Cortex SDK for testing.
 * Simulates the SDK behavior without requiring a real Convex backend.
 */

// In-memory stores for test state
let mutableStore: Map<string, Map<string, unknown>> = new Map();
let usersStore: Map<string, { userId: string; data: Record<string, unknown> }> =
  new Map();
let conversationsStore: Map<
  string,
  {
    conversationId: string;
    memorySpaceId: string;
    type: string;
    participants: { userId?: string; agentId?: string };
    metadata: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
  }
> = new Map();

/**
 * Reset all mock stores (call in beforeEach)
 */
export function resetMockStores(): void {
  mutableStore = new Map();
  usersStore = new Map();
  conversationsStore = new Map();
}

/**
 * Create a mock Cortex SDK instance
 */
export function createMockCortex() {
  return {
    mutable: {
      get: jest.fn(
        async (namespace: string, key: string): Promise<unknown | null> => {
          const ns = mutableStore.get(namespace);
          if (!ns) return null;
          return ns.get(key) ?? null;
        }
      ),
      set: jest.fn(
        async (
          namespace: string,
          key: string,
          value: unknown
        ): Promise<void> => {
          if (!mutableStore.has(namespace)) {
            mutableStore.set(namespace, new Map());
          }
          mutableStore.get(namespace)!.set(key, value);
        }
      ),
      delete: jest.fn(
        async (namespace: string, key: string): Promise<void> => {
          const ns = mutableStore.get(namespace);
          if (ns) ns.delete(key);
        }
      ),
    },
    users: {
      get: jest.fn(
        async (
          userId: string
        ): Promise<{
          userId: string;
          data: Record<string, unknown>;
        } | null> => {
          return usersStore.get(userId) ?? null;
        }
      ),
      update: jest.fn(
        async (
          userId: string,
          data: Record<string, unknown>
        ): Promise<{ userId: string; data: Record<string, unknown> }> => {
          const existing = usersStore.get(userId);
          const user = {
            userId,
            data: { ...(existing?.data || {}), ...data },
          };
          usersStore.set(userId, user);
          return user;
        }
      ),
      delete: jest.fn(async (userId: string): Promise<void> => {
        usersStore.delete(userId);
      }),
      list: jest.fn(async () => {
        return {
          users: Array.from(usersStore.values()),
          hasMore: false,
        };
      }),
    },
    conversations: {
      list: jest.fn(
        async (params: { memorySpaceId?: string; userId?: string }) => {
          const conversations = Array.from(conversationsStore.values()).filter(
            (conv) => {
              if (
                params.memorySpaceId &&
                conv.memorySpaceId !== params.memorySpaceId
              ) {
                return false;
              }
              if (
                params.userId &&
                conv.participants.userId !== params.userId
              ) {
                return false;
              }
              return true;
            }
          );
          return { conversations, hasMore: false };
        }
      ),
      create: jest.fn(
        async (params: {
          memorySpaceId: string;
          conversationId: string;
          type: string;
          participants: { userId?: string; agentId?: string };
          metadata?: Record<string, unknown>;
        }) => {
          const now = Date.now();
          const conversation = {
            conversationId: params.conversationId,
            memorySpaceId: params.memorySpaceId,
            type: params.type,
            participants: params.participants,
            metadata: params.metadata || {},
            createdAt: now,
            updatedAt: now,
            messageCount: 0,
          };
          conversationsStore.set(params.conversationId, conversation);
          return conversation;
        }
      ),
      get: jest.fn(async (conversationId: string) => {
        return conversationsStore.get(conversationId) ?? null;
      }),
      delete: jest.fn(async (conversationId: string): Promise<void> => {
        conversationsStore.delete(conversationId);
      }),
      update: jest.fn(
        async (
          conversationId: string,
          updates: { metadata?: Record<string, unknown> }
        ) => {
          const conv = conversationsStore.get(conversationId);
          if (!conv) throw new Error("Conversation not found");
          const updated = {
            ...conv,
            metadata: { ...conv.metadata, ...updates.metadata },
            updatedAt: Date.now(),
          };
          conversationsStore.set(conversationId, updated);
          return updated;
        }
      ),
    },
    memory: {
      search: jest.fn().mockResolvedValue([]),
      remember: jest.fn().mockResolvedValue({
        conversation: { conversationId: "conv-1", messageIds: [] },
        memories: [],
        facts: [],
      }),
      recall: jest.fn().mockResolvedValue({
        context: "",
        totalResults: 0,
        queryTimeMs: 10,
        sources: { vector: { count: 0, items: [] } },
      }),
    },
    close: jest.fn(),
  };
}

/**
 * Type for the mock Cortex instance
 */
export type MockCortex = ReturnType<typeof createMockCortex>;

/**
 * Helper to seed test data into stores
 */
export const seedTestData = {
  user: (
    userId: string,
    data: Record<string, unknown> = {}
  ): { userId: string; data: Record<string, unknown> } => {
    const user = { userId, data };
    usersStore.set(userId, user);
    return user;
  },
  mutable: (namespace: string, key: string, value: unknown): void => {
    if (!mutableStore.has(namespace)) {
      mutableStore.set(namespace, new Map());
    }
    mutableStore.get(namespace)!.set(key, value);
  },
  conversation: (
    conversationId: string,
    params: {
      memorySpaceId?: string;
      userId?: string;
      title?: string;
    } = {}
  ) => {
    const now = Date.now();
    const conversation = {
      conversationId,
      memorySpaceId: params.memorySpaceId || "quickstart-demo",
      type: "user-agent",
      participants: {
        userId: params.userId || "test-user",
        agentId: "quickstart-assistant",
      },
      metadata: { title: params.title || "Test Chat" },
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    conversationsStore.set(conversationId, conversation);
    return conversation;
  },
};
