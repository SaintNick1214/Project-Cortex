/**
 * Integration Tests for Chat API Route
 *
 * Tests the chat API endpoint behavior including authentication,
 * request validation, and error handling.
 *
 * Note: These are lightweight integration tests suitable for a quickstart template.
 * Full integration tests would require a test database and more setup.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/app/(auth)/auth";

// Mock auth module
const mockAuth = auth as ReturnType<typeof vi.fn>;

// Mock db queries to avoid database dependencies
vi.mock("@/lib/db/queries", () => ({
  createStreamId: vi.fn(),
  deleteChatById: vi.fn(),
  getChatById: vi.fn(),
  getMessageCountByUserId: vi.fn(),
  getMessagesByChatId: vi.fn(),
  saveChat: vi.fn(),
  saveMessages: vi.fn(),
  updateChatTitleById: vi.fn(),
  updateMessage: vi.fn(),
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
  createUIMessageStreamResponse: vi
    .fn()
    .mockReturnValue(new Response("mock stream", { status: 200 })),
  generateId: vi.fn().mockReturnValue("test-id"),
  stepCountIs: vi.fn(),
  streamText: vi.fn().mockReturnValue({
    toUIMessageStream: vi.fn().mockReturnValue(new ReadableStream()),
  }),
  tool: vi.fn((definition) => definition),
}));

// Mock Vercel functions
vi.mock("@vercel/functions", () => ({
  geolocation: vi.fn().mockReturnValue({
    city: "San Francisco",
    country: "US",
    latitude: 37.7749,
    longitude: -122.4194,
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
import { getChatById, getMessageCountByUserId } from "@/lib/db/queries";

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
        email: "test@example.com",
        id: "user-123",
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
        body: JSON.stringify({
          id: "00000000-0000-4000-8000-000000000001",
          message: {
            id: "00000000-0000-4000-8000-000000000002",
            parts: [{ text: "Hello", type: "text" }],
            role: "user",
          },
          selectedChatModel: "gpt-4",
          selectedVisibilityType: "private",
        }),
        method: "POST",
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("returns 400 for invalid request body", async () => {
      const { POST } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        body: "invalid json{",
        method: "POST",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 when required fields are missing", async () => {
      const { POST } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        body: JSON.stringify({
          // Missing required fields: id, selectedChatModel
          message: { parts: [], role: "user" },
        }),
        method: "POST",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("returns 403 when accessing another user's chat", async () => {
      // Chat exists but belongs to different user
      mockGetChatById.mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000001",
        title: "Another user's chat",
        userId: "different-user",
      });

      const { POST } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        body: JSON.stringify({
          id: "00000000-0000-4000-8000-000000000001",
          message: {
            id: "00000000-0000-4000-8000-000000000002",
            parts: [{ text: "Hello", type: "text" }],
            role: "user",
          },
          selectedChatModel: "gpt-4",
          selectedVisibilityType: "private",
        }),
        method: "POST",
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it("returns 429 when user exceeds rate limit", async () => {
      // User has exceeded daily message limit
      mockGetMessageCountByUserId.mockResolvedValue(10_000);

      const { POST } = await import("@/app/(chat)/api/chat/route");

      const request = new Request("http://localhost/api/chat", {
        body: JSON.stringify({
          id: "00000000-0000-4000-8000-000000000001",
          message: {
            id: "00000000-0000-4000-8000-000000000002",
            parts: [{ text: "Hello", type: "text" }],
            role: "user",
          },
          selectedChatModel: "gpt-4",
          selectedVisibilityType: "private",
        }),
        method: "POST",
      });

      const response = await POST(request);

      expect(response.status).toBe(429);
    });
  });

  describe("DELETE /api/chat", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { DELETE } = await import("@/app/(chat)/api/chat/route");

      const request = new Request(
        "http://localhost/api/chat?id=00000000-0000-4000-8000-000000000001",
        {
          method: "DELETE",
        }
      );

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
        id: "00000000-0000-4000-8000-000000000001",
        title: "Another user's chat",
        userId: "different-user",
      });

      const { DELETE } = await import("@/app/(chat)/api/chat/route");

      const request = new Request(
        "http://localhost/api/chat?id=00000000-0000-4000-8000-000000000001",
        {
          method: "DELETE",
        }
      );

      const response = await DELETE(request);

      expect(response.status).toBe(403);
    });
  });
});
