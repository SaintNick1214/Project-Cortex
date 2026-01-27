/**
 * Integration Tests for Chat API Route
 *
 * Tests the chat API endpoint behavior including authentication,
 * request validation, and error handling.
 *
 * Note: These are lightweight integration tests suitable for a quickstart template.
 * Full integration tests would require a test database and more setup.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/app/(auth)/auth";

// Mock auth module
const mockAuth = auth as ReturnType<typeof vi.fn>;

// Mock db queries to avoid database dependencies
vi.mock("@/lib/db/queries", () => ({
  getChatById: vi.fn(),
  getMessagesByChatId: vi.fn(),
  getMessageCountByUserId: vi.fn(),
  saveChat: vi.fn(),
  saveMessages: vi.fn(),
  updateChatTitleById: vi.fn(),
  updateMessage: vi.fn(),
  deleteChatById: vi.fn(),
  createStreamId: vi.fn(),
}));

// Mock Cortex memory provider
vi.mock("@cortexmemory/vercel-ai-provider", () => ({
  createCortexMemoryAsync: vi.fn().mockResolvedValue((model: unknown) => model),
}));

// Mock AI SDK functions
vi.mock("ai", () => ({
  convertToModelMessages: vi.fn().mockResolvedValue([]),
  createUIMessageStream: vi.fn().mockReturnValue({
    toDataStreamResponse: vi.fn(),
  }),
  createUIMessageStreamResponse: vi.fn().mockReturnValue(
    new Response("mock stream", { status: 200 }),
  ),
  generateId: vi.fn().mockReturnValue("test-id"),
  stepCountIs: vi.fn(),
  streamText: vi.fn().mockReturnValue({
    toUIMessageStream: vi.fn().mockReturnValue(new ReadableStream()),
  }),
}));

// Mock Vercel functions
vi.mock("@vercel/functions", () => ({
  geolocation: vi.fn().mockReturnValue({
    longitude: -122.4194,
    latitude: 37.7749,
    city: "San Francisco",
    country: "US",
  }),
}));

// Mock resumable stream
vi.mock("resumable-stream", () => ({
  createResumableStreamContext: vi.fn().mockReturnValue(null),
}));

// Mock providers
vi.mock("@/lib/ai/providers", () => ({
  getLanguageModel: vi.fn().mockReturnValue({}),
}));

// Mock Cortex config
vi.mock("@/lib/cortex-memory-config", () => ({
  getCortexMemoryConfig: vi.fn().mockReturnValue({}),
  getMemorySpaceId: vi.fn().mockReturnValue("test-memory-space"),
}));

// Import mocked query functions
import {
  getChatById,
  getMessageCountByUserId,
} from "@/lib/db/queries";

const mockGetChatById = getChatById as ReturnType<typeof vi.fn>;
const mockGetMessageCountByUserId = getMessageCountByUserId as ReturnType<
  typeof vi.fn
>;

describe("Chat API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: user is authenticated
    mockAuth.mockResolvedValue({
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        type: "regular",
      },
    });

    // Default: no existing chat
    mockGetChatById.mockResolvedValue(null);

    // Default: low message count (not rate limited)
    mockGetMessageCountByUserId.mockResolvedValue(5);
  });

  describe("POST /api/chat", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { POST } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          id: "chat-123",
          message: {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
          selectedChatModel: "gpt-4",
          selectedVisibilityType: "private",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("returns 400 for invalid request body", async () => {
      const { POST } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: "invalid json{",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 when required fields are missing", async () => {
      const { POST } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          // Missing required fields: id, selectedChatModel
          message: { role: "user", parts: [] },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("returns 403 when accessing another user's chat", async () => {
      // Chat exists but belongs to different user
      mockGetChatById.mockResolvedValue({
        id: "chat-123",
        userId: "different-user",
        title: "Another user's chat",
      });

      const { POST } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          id: "chat-123",
          message: {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
          selectedChatModel: "gpt-4",
          selectedVisibilityType: "private",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it("returns 429 when user exceeds rate limit", async () => {
      // User has exceeded daily message limit
      mockGetMessageCountByUserId.mockResolvedValue(10000);

      const { POST } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          id: "chat-123",
          message: {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
          selectedChatModel: "gpt-4",
          selectedVisibilityType: "private",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(429);
    });
  });

  describe("DELETE /api/chat", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { DELETE } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat?id=chat-123", {
        method: "DELETE",
      });

      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });

    it("returns 400 when id parameter is missing", async () => {
      const { DELETE } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        method: "DELETE",
      });

      const response = await DELETE(request);

      expect(response.status).toBe(400);
    });

    it("returns 403 when deleting another user's chat", async () => {
      mockGetChatById.mockResolvedValue({
        id: "chat-123",
        userId: "different-user",
        title: "Another user's chat",
      });

      const { DELETE } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat?id=chat-123", {
        method: "DELETE",
      });

      const response = await DELETE(request);

      expect(response.status).toBe(403);
    });
  });
});
