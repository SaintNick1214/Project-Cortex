/**
 * Integration Tests: Conversations API Routes
 *
 * Tests the conversations API routes with mocked Cortex SDK.
 */

import {
  createMockCortex,
  resetMockStores,
  seedTestData,
  type MockCortex,
} from "../helpers/mock-cortex";

// Mock the Cortex SDK module
let mockCortex: MockCortex;

jest.mock("../../lib/cortex", () => ({
  getCortex: () => mockCortex,
}));

// Import route handlers after mocking
import {
  GET as conversationsGet,
  POST as conversationsPost,
  DELETE as conversationsDelete,
} from "../../app/api/conversations/route";

/**
 * Helper to create a mock Request object
 */
function createRequest(
  method: string,
  options: {
    body?: Record<string, unknown>;
    searchParams?: Record<string, string>;
  } = {},
): Request {
  const url = new URL("http://localhost:3000/api/conversations");

  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const init: RequestInit = { method };
  if (options.body) {
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }

  return new Request(url.toString(), init);
}

/**
 * Helper to parse JSON response
 */
async function parseResponse(response: Response): Promise<{
  status: number;
  data: Record<string, unknown>;
}> {
  const data = await response.json();
  return { status: response.status, data };
}

describe("Conversations API Routes", () => {
  beforeEach(() => {
    resetMockStores();
    mockCortex = createMockCortex();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/conversations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("GET /api/conversations", () => {
    it("should return 400 if userId is missing and no conversationId", async () => {
      const request = createRequest("GET");
      const response = await conversationsGet(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("userId is required");
    });

    it("should return single conversation with messages when conversationId is provided", async () => {
      // Seed conversation with messages
      seedTestData.conversation("conv-with-messages", {
        userId: "testuser",
        title: "Test Conversation",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
      });

      const request = createRequest("GET", {
        searchParams: { conversationId: "conv-with-messages" },
      });
      const response = await conversationsGet(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.conversation).toBeDefined();
      expect((data.conversation as { id: string }).id).toBe(
        "conv-with-messages",
      );
      expect((data.conversation as { title: string }).title).toBe(
        "Test Conversation",
      );
      expect(data.messages).toBeDefined();
      expect((data.messages as unknown[]).length).toBe(2);
    });

    it("should return 404 when conversationId is not found", async () => {
      const request = createRequest("GET", {
        searchParams: { conversationId: "nonexistent-conv" },
      });
      const response = await conversationsGet(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Conversation not found");
    });

    it("should return empty array for user with no conversations", async () => {
      const request = createRequest("GET", {
        searchParams: { userId: "newuser" },
      });
      const response = await conversationsGet(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.conversations).toEqual([]);
    });

    it("should return conversations for user", async () => {
      // Seed conversations
      seedTestData.conversation("conv-1", {
        userId: "testuser",
        title: "First Chat",
      });
      seedTestData.conversation("conv-2", {
        userId: "testuser",
        title: "Second Chat",
      });

      const request = createRequest("GET", {
        searchParams: { userId: "testuser" },
      });
      const response = await conversationsGet(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect((data.conversations as unknown[]).length).toBe(2);

      const conversations = data.conversations as {
        id: string;
        title: string;
      }[];
      expect(conversations.map((c) => c.id)).toContain("conv-1");
      expect(conversations.map((c) => c.id)).toContain("conv-2");
    });

    it("should filter conversations by memorySpaceId", async () => {
      // Seed conversations in different memory spaces
      seedTestData.conversation("conv-1", {
        userId: "testuser",
        memorySpaceId: "space-a",
        title: "Space A Chat",
      });
      seedTestData.conversation("conv-2", {
        userId: "testuser",
        memorySpaceId: "space-b",
        title: "Space B Chat",
      });

      const request = createRequest("GET", {
        searchParams: { userId: "testuser", memorySpaceId: "space-a" },
      });
      const response = await conversationsGet(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect((data.conversations as unknown[]).length).toBe(1);
      expect((data.conversations as { id: string }[])[0].id).toBe("conv-1");
    });

    it("should not return conversations from other users", async () => {
      // Seed conversations for different users
      seedTestData.conversation("conv-1", {
        userId: "user-a",
        title: "User A Chat",
      });
      seedTestData.conversation("conv-2", {
        userId: "user-b",
        title: "User B Chat",
      });

      const request = createRequest("GET", {
        searchParams: { userId: "user-a" },
      });
      const response = await conversationsGet(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect((data.conversations as unknown[]).length).toBe(1);
      expect((data.conversations as { id: string }[])[0].id).toBe("conv-1");
    });

    it("should include conversation metadata in response", async () => {
      seedTestData.conversation("conv-1", {
        userId: "testuser",
        title: "Test Chat Title",
      });

      const request = createRequest("GET", {
        searchParams: { userId: "testuser" },
      });
      const response = await conversationsGet(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      const conversation = (data.conversations as Record<string, unknown>[])[0];
      expect(conversation.id).toBe("conv-1");
      expect(conversation.title).toBe("Test Chat Title");
      expect(conversation.createdAt).toBeDefined();
      expect(conversation.updatedAt).toBeDefined();
      expect(conversation.messageCount).toBeDefined();
    });

    it("should use default memorySpaceId if not provided", async () => {
      const request = createRequest("GET", {
        searchParams: { userId: "testuser" },
      });
      await conversationsGet(request);

      expect(mockCortex.conversations.list).toHaveBeenCalledWith(
        expect.objectContaining({
          memorySpaceId: "quickstart-demo",
          userId: "testuser",
        }),
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/conversations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("POST /api/conversations", () => {
    it("should return 400 if userId is missing", async () => {
      const request = createRequest("POST", {
        body: { title: "New Chat" },
      });
      const response = await conversationsPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("userId is required");
    });

    it("should create conversation with generated ID", async () => {
      const request = createRequest("POST", {
        body: { userId: "testuser" },
      });
      const response = await conversationsPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.conversation).toBeDefined();

      const conversation = data.conversation as { id: string };
      expect(conversation.id).toMatch(/^conv-\d+-[a-z0-9]+$/);
    });

    it("should create conversation with provided title", async () => {
      const request = createRequest("POST", {
        body: { userId: "testuser", title: "My Custom Title" },
      });
      const response = await conversationsPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      const conversation = data.conversation as { title: string };
      expect(conversation.title).toBe("My Custom Title");
    });

    it("should use default title if not provided", async () => {
      const request = createRequest("POST", {
        body: { userId: "testuser" },
      });
      const response = await conversationsPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      const conversation = data.conversation as { title: string };
      expect(conversation.title).toBe("New Chat");
    });

    it("should use provided memorySpaceId", async () => {
      const request = createRequest("POST", {
        body: { userId: "testuser", memorySpaceId: "custom-space" },
      });
      await conversationsPost(request);

      expect(mockCortex.conversations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          memorySpaceId: "custom-space",
        }),
      );
    });

    it("should use default memorySpaceId if not provided", async () => {
      const request = createRequest("POST", {
        body: { userId: "testuser" },
      });
      await conversationsPost(request);

      expect(mockCortex.conversations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          memorySpaceId: "quickstart-demo",
        }),
      );
    });

    it("should set conversation type to user-agent", async () => {
      const request = createRequest("POST", {
        body: { userId: "testuser" },
      });
      await conversationsPost(request);

      expect(mockCortex.conversations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "user-agent",
        }),
      );
    });

    it("should set participants with userId and agentId", async () => {
      const request = createRequest("POST", {
        body: { userId: "testuser" },
      });
      await conversationsPost(request);

      expect(mockCortex.conversations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: {
            userId: "testuser",
            agentId: "quickstart-assistant",
          },
        }),
      );
    });

    it("should return conversation metadata", async () => {
      const request = createRequest("POST", {
        body: { userId: "testuser", title: "Test Chat" },
      });
      const response = await conversationsPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      const conversation = data.conversation as Record<string, unknown>;
      expect(conversation.id).toBeDefined();
      expect(conversation.title).toBe("Test Chat");
      expect(conversation.createdAt).toBeDefined();
      expect(conversation.updatedAt).toBeDefined();
      expect(conversation.messageCount).toBe(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE /api/conversations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("DELETE /api/conversations", () => {
    it("should return 400 if conversationId is missing", async () => {
      const request = createRequest("DELETE");
      const response = await conversationsDelete(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("conversationId is required");
    });

    it("should delete conversation and return success", async () => {
      // Seed a conversation
      seedTestData.conversation("conv-to-delete", {
        userId: "testuser",
        title: "Delete Me",
      });

      const request = createRequest("DELETE", {
        searchParams: { conversationId: "conv-to-delete" },
      });
      const response = await conversationsDelete(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should call cortex.conversations.delete with correct ID", async () => {
      const request = createRequest("DELETE", {
        searchParams: { conversationId: "conv-123" },
      });
      await conversationsDelete(request);

      expect(mockCortex.conversations.delete).toHaveBeenCalledWith("conv-123");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("edge cases", () => {
    it("should handle SDK errors gracefully for GET", async () => {
      mockCortex.conversations.list = jest
        .fn()
        .mockRejectedValue(new Error("SDK error"));

      const request = createRequest("GET", {
        searchParams: { userId: "testuser" },
      });
      const response = await conversationsGet(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to fetch conversations");
    });

    it("should handle SDK errors gracefully for POST", async () => {
      mockCortex.conversations.create = jest
        .fn()
        .mockRejectedValue(new Error("SDK error"));

      const request = createRequest("POST", {
        body: { userId: "testuser" },
      });
      const response = await conversationsPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to create conversation");
    });

    it("should handle SDK errors gracefully for DELETE", async () => {
      mockCortex.conversations.delete = jest
        .fn()
        .mockRejectedValue(new Error("SDK error"));

      const request = createRequest("DELETE", {
        searchParams: { conversationId: "conv-123" },
      });
      const response = await conversationsDelete(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to delete conversation");
    });
  });
});
