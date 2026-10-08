/** Real route/session/scope/cleanup integration with an explicitly mocked SDK transport. */
import { GET, POST, DELETE } from "../../app/api/conversations/route";
import { createScopedCortex, withCortex } from "../../lib/cortex";
const mockAccount = {
  accountId: "owner",
  username: "testuser",
  role: "user",
  tenantId: "tenant",
  allowedMemorySpaceIds: ["owned", "space-a", "space-b"],
};
const mockRows = new Map<string, any>();
let mockSession = true;
const mockClose = jest.fn(),
  mockShutdown = jest.fn(),
  mockAdmin = jest.fn();
const mockConnect = jest.fn(), mockDisconnect = jest.fn(), mockResolveGraph = jest.fn();
const mockGet = jest.fn(async (id: string) => mockRows.get(id) ?? null);
const mockList = jest.fn(async (args: any) => ({
  conversations: [...mockRows.values()].filter(
    (r) =>
      r.memorySpaceId === args.memorySpaceId &&
      r.participants.userId === args.userId
  ),
}));
const mockCreate = jest.fn(async (args: any) => {
  const row = {
    ...args,
    tenantId: "tenant",
    createdAt: 1,
    updatedAt: 2,
    messageCount: 0,
  };
  mockRows.set(args.conversationId, row);
  return row;
});
const mockDelete = jest.fn(async (id: string) => {
  mockRows.delete(id);
  return { deleted: true };
});
const mockFactory = jest.fn(async (_: any, runtime: any) => {
  runtime.initializeTransport({ setAdminAuth: mockAdmin });
  return {
    conversations: {
      get: mockGet,
      list: mockList,
      create: mockCreate,
      delete: mockDelete,
    },
    close: mockClose,
    shutdown: mockShutdown,
  };
});
jest.mock("@cortexmemory/sdk", () => ({
  Cortex: { create: (...args: any[]) => mockFactory(...args) },
  resolveGraphConnection: (...args: any[]) => mockResolveGraph(...args),
  CypherGraphAdapter: class {
    connect = mockConnect;
    disconnect = mockDisconnect;
  },
}));
jest.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAdminAuth = mockAdmin;
    async function(name: string) {
      if (name !== "app/sessions:resolve")
        throw new Error("unexpected private operation");
      return mockSession ? mockAccount : null;
    }
  },
}));
const request = (
  method: string,
  params: Record<string, string> = {},
  body?: unknown,
  signed = true
) =>
  new Request(
    "https://unit.invalid/api/conversations?" + new URLSearchParams(params),
    {
      method,
      headers: {
        origin: "https://unit.invalid",
        ...(signed ? { cookie: "cortex-app-session=" + "a".repeat(64) } : {}),
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }
  );
function seed(id: string, updates: any = {}) {
  const r = {
    conversationId: id,
    participants: { userId: "owner" },
    memorySpaceId: "owned",
    tenantId: "tenant",
    metadata: { title: "Test Chat" },
    createdAt: 1,
    updatedAt: 2,
    messageCount: 0,
    ...updates,
  };
  mockRows.set(id, r);
  return r;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockRows.clear();
  mockSession = true;
  mockShutdown.mockResolvedValue(undefined);
  mockConnect.mockResolvedValue(undefined);
  mockDisconnect.mockResolvedValue(undefined);
  mockResolveGraph.mockReturnValue({ uri: "bolt://unit.invalid", username: "unit", password: "unit-only" });
  mockGet.mockImplementation(async (id) => mockRows.get(id) ?? null);
  mockCreate.mockImplementation(async (args) => {
    const r = seed(args.conversationId, args);
    return r;
  });
  mockDelete.mockImplementation(async (id) => {
    mockRows.delete(id);
    return { deleted: true };
  });
  mockList.mockImplementation(async (args) => ({
    conversations: [...mockRows.values()].filter(
      (r) =>
        r.memorySpaceId === args.memorySpaceId &&
        r.participants.userId === args.userId
    ),
  }));
  Object.assign(process.env, {
    CONVEX_URL: "http://127.0.0.1:3218",
    CORTEX_APP_DEPLOYMENT_ADMIN_KEY: "unit-private-key",
    CORTEX_APP_ORIGIN: "https://unit.invalid",
  });
});
describe("private Conversations API routes", () => {
  test("configured graph delete selects owned delivery and joins, while reads remain off", async () => {
    process.env.CORTEX_GRAPH_SYNC = "true";
    seed("graph-owned");
    expect((await DELETE(request("DELETE", { conversationId: "graph-owned" }))).status).toBe(200);
    expect(mockFactory.mock.calls[0][0].graphEnabled).toBe(true);
    expect(mockFactory.mock.calls[0][0].graph).toMatchObject({ autoSync: false });
    expect(mockFactory.mock.calls[0][0].graph.adapter.connect).toBe(mockConnect);
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockShutdown.mock.invocationCallOrder[0]).toBeLessThan(mockDisconnect.mock.invocationCallOrder[0]);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith("graph-owned");
    expect(mockShutdown).toHaveBeenCalledTimes(1);
    await GET(request("GET"));
    expect(mockFactory.mock.calls[1][0].graphEnabled).toBe(false);
    delete process.env.CORTEX_GRAPH_SYNC;
  });
  test("graph-off deletion remains supported and graph-on foreign owner cannot delete", async () => {
    process.env.CORTEX_GRAPH_SYNC = "false";
    seed("plain-owned");
    expect((await DELETE(request("DELETE", { conversationId: "plain-owned" }))).status).toBe(200);
    expect(mockFactory.mock.calls[0][0].graphEnabled).toBe(false);
    process.env.CORTEX_GRAPH_SYNC = "true";
    seed("foreign", { participants: { userId: "foreign" } });
    expect((await DELETE(request("DELETE", { conversationId: "foreign" }))).status).toBe(404);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    delete process.env.CORTEX_GRAPH_SYNC;
  });
  test("missing session refuses before SDK construction", async () => {
    expect((await GET(request("GET", {}, undefined, false))).status).toBe(401);
    expect(mockFactory).not.toHaveBeenCalled();
  });
  test("detail projects owner history and agent messages", async () => {
    seed("c", {
      messageCount: 2,
      messages: [
        { id: "u", role: "user", content: "Hello", timestamp: 1 },
        { id: "a", role: "agent", content: "Hi", timestamp: 2 },
      ],
    });
    const r = await GET(request("GET", { conversationId: "c" }));
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.conversation).toMatchObject({
      id: "c",
      title: "Test Chat",
      messageCount: 2,
    });
    expect(b.messages.map((m: any) => [m.id, m.role, m.content])).toEqual([
      ["u", "user", "Hello"],
      ["a", "assistant", "Hi"],
    ]);
    expect(mockGet).toHaveBeenCalledWith("c", {
      includeMessages: true,
      messageLimit: 100,
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockShutdown).toHaveBeenCalledTimes(1);
  });
  test("missing detail returns opaque404", async () => {
    const r = await GET(request("GET", { conversationId: "missing" }));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Conversation unavailable" });
  });
  test("empty owned list is an empty array", async () => {
    const r = await GET(request("GET"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ conversations: [] });
  });
  test("owned list returns all matching conversations", async () => {
    seed("a");
    seed("b");
    const r = await GET(request("GET"));
    expect((await r.json()).conversations.map((c: any) => c.id)).toEqual([
      "a",
      "b",
    ]);
  });
  test("authorized memory-space selector filters exact scope", async () => {
    seed("a", { memorySpaceId: "space-a" });
    seed("b", { memorySpaceId: "space-b" });
    const r = await GET(request("GET", { memorySpaceId: "space-a" }));
    expect(r.status).toBe(200);
    expect((await r.json()).conversations.map((c: any) => c.id)).toEqual(["a"]);
  });
  test("foreign caller user selector refuses before SDK", async () => {
    expect((await GET(request("GET", { userId: "foreign" }))).status).toBe(403);
    expect(mockFactory).not.toHaveBeenCalled();
  });
  test("projection includes durable metadata/count/timestamps", async () => {
    seed("c", { metadata: { title: "Explicit" }, messageCount: 7 });
    const r = await GET(request("GET"));
    expect((await r.json()).conversations[0]).toEqual({
      id: "c",
      title: "Explicit",
      createdAt: 1,
      updatedAt: 2,
      messageCount: 7,
    });
  });
  test("omitted space uses verified account default", async () => {
    await GET(request("GET"));
    expect(mockList).toHaveBeenCalledWith({
      memorySpaceId: "owned",
      userId: "owner",
      limit: 50,
    });
  });
  test("list limit remains fifty", async () => {
    await GET(request("GET", { memorySpaceId: "space-b" }));
    expect(mockList).toHaveBeenCalledWith({
      memorySpaceId: "space-b",
      userId: "owner",
      limit: 50,
    });
  });
  test("list is sorted by descending durable updatedAt", async () => {
    seed("old");
    seed("new", { updatedAt: 5 });
    const r = await GET(request("GET"));
    expect((await r.json()).conversations.map((c: any) => c.id)).toEqual([
      "new",
      "old",
    ]);
  });
  test("create uses default title and fixed owner/agent/space", async () => {
    const r = await POST(request("POST", {}, {}));
    expect(r.status).toBe(200);
    expect((await r.json()).conversation.title).toBe("New Chat");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        memorySpaceId: "owned",
        participants: { userId: "owner", agentId: "quickstart-assistant" },
        type: "user-agent",
        metadata: { title: "New Chat" },
      })
    );
  });
  test("create preserves explicit title", async () => {
    const r = await POST(request("POST", {}, { title: "Custom" }));
    expect((await r.json()).conversation.title).toBe("Custom");
  });
  test("create generates distinct UUIDs", async () => {
    await POST(request("POST", {}, {}));
    await POST(request("POST", {}, {}));
    const ids = mockCreate.mock.calls.map(([a]) => a.conversationId);
    expect(ids[0]).toMatch(/^[a-f0-9-]{36}$/);
    expect(ids[0]).not.toBe(ids[1]);
  });
  test("forged POST user refuses before creation", async () => {
    expect(
      (await POST(request("POST", {}, { userId: "foreign" }))).status
    ).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test("invalid title refuses before creation", async () => {
    expect((await POST(request("POST", {}, { title: 123 }))).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test("delete missing ID refuses", async () => {
    const r = await DELETE(request("DELETE"));
    expect(r.status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });
  test("delete checks owner then removes and awaits cleanup", async () => {
    seed("c");
    const r = await DELETE(request("DELETE", { conversationId: "c" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ success: true });
    expect(mockRows.has("c")).toBe(false);
    expect(mockGet.mock.invocationCallOrder[0]).toBeLessThan(
      mockDelete.mock.invocationCallOrder[0]
    );
    expect(mockShutdown).toHaveBeenCalledTimes(1);
  });
  test("delete passes only the verified exact ID", async () => {
    seed("c");
    await DELETE(request("DELETE", { conversationId: "c" }));
    expect(mockDelete).toHaveBeenCalledWith("c");
  });
  test("foreign owner delete refuses without mutation", async () => {
    seed("c", { participants: { userId: "foreign" } });
    expect(
      (await DELETE(request("DELETE", { conversationId: "c" }))).status
    ).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockRows.has("c")).toBe(true);
  });
  test("foreign tenant response refuses instead of leaking rows", async () => {
    seed("c", { tenantId: "foreign" });
    expect((await GET(request("GET"))).status).toBe(404);
  });
  test("GET backend error is opaque503 and closes client", async () => {
    mockList.mockRejectedValue(new Error("secret error"));
    const r = await GET(request("GET"));
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("secret error");
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockShutdown).toHaveBeenCalledTimes(1);
  });
  test("POST backend error is opaque503 and closes client", async () => {
    mockCreate.mockRejectedValue(new Error("secret error"));
    expect((await POST(request("POST", {}, {}))).status).toBe(503);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockShutdown).toHaveBeenCalledTimes(1);
  });
  test("DELETE backend error is opaque503 and closes client", async () => {
    seed("c");
    mockDelete.mockRejectedValue(new Error("secret error"));
    expect(
      (await DELETE(request("DELETE", { conversationId: "c" }))).status
    ).toBe(503);
    expect(mockRows.has("c")).toBe(true);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockShutdown).toHaveBeenCalledTimes(1);
  });
});

test("graph construction and connection failures close borrowed adapter before propagating", async () => {
  mockFactory.mockRejectedValueOnce(new Error("construction failed"));
  await expect(createScopedCortex(mockAccount, true)).rejects.toThrow("construction failed");
  expect(mockDisconnect).toHaveBeenCalledTimes(1);
  mockDisconnect.mockClear();
  mockFactory.mockClear();
  mockConnect.mockRejectedValueOnce(new Error("connection failed"));
  await expect(createScopedCortex(mockAccount, true)).rejects.toThrow("connection failed");
  expect(mockFactory).not.toHaveBeenCalled();
  expect(mockDisconnect).toHaveBeenCalledTimes(1);
});
test("graph-off reads retain no adapter authority", async () => {
  await withCortex(mockAccount, async () => "read");
  expect(mockResolveGraph).not.toHaveBeenCalled();
  expect(mockConnect).not.toHaveBeenCalled();
  expect(mockDisconnect).not.toHaveBeenCalled();
});
test("graph work rejection joins SDK and adapter teardown", async () => {
  await expect(withCortex(mockAccount, async () => { throw new Error("work failed"); }, true)).rejects.toThrow("work failed");
  expect(mockShutdown).toHaveBeenCalledTimes(1);
  expect(mockDisconnect).toHaveBeenCalledTimes(1);
});
