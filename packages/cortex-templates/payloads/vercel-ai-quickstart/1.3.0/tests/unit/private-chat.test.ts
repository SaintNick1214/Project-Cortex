import { chat as legacyChat } from "../../lib/chat";
import { POST as remoteOnly } from "../../app/api/chat/route";
import { POST as retiredV6 } from "../../app/api/chat-v6/route";
const manual = (request: Request) => legacyChat(request, false);
const helper = (request: Request) => legacyChat(request, true);
import { GET as list } from "../../app/api/conversations/route";
import { DELETE as remove } from "../../app/api/conversations/route";
import { latestUserMessage } from "../../lib/chat";
const mockAccount = {
  accountId: "owner",
  username: "alice",
  role: "user",
  tenantId: "tenant",
  allowedMemorySpaceIds: ["owned"],
};
const mockParent = {
  conversationId: "c",
  participants: { userId: "owner" },
  memorySpaceId: "owned",
  tenantId: "tenant",
  type: "user-agent",
  metadata: { title: "Owned" },
  createdAt: 1,
  updatedAt: 2,
  messageCount: 1,
  messages: [{ id: "old", role: "user", content: "durable", timestamp: 1 }],
};
let mockIdentity: unknown = mockAccount,
  mockExecute: any,
  mockConsume: () => Promise<void>,
  mockForeign = false;
const mockClose = jest.fn(),
  mockShutdown = jest.fn(),
  mockAdmin = jest.fn(),
  mockBorrow = jest.fn(),
  mockProviderClose = jest.fn(),
  mockModel = jest.fn();
const mockSpaceGet = jest.fn(), mockSpaceRegister = jest.fn();
const mockGet = jest.fn(),
  mockCreate = jest.fn(),
  mockDelete = jest.fn(),
  mockList = jest.fn();
const mockClient = {
  memorySpaces: { get: mockSpaceGet, register: mockSpaceRegister },
  conversations: {
    get: mockGet,
    create: mockCreate,
    delete: mockDelete,
    list: mockList,
  },
  close: mockClose,
  shutdown: mockShutdown,
};
jest.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAdminAuth = mockAdmin;
    async function(name: string) {
      if (name === "app/sessions:resolve") return mockIdentity;
      throw new Error("Unexpected private operation");
    }
  },
}));
jest.mock("@cortexmemory/sdk", () => ({
  Cortex: {
    create: jest.fn(async (config: any, runtime: any) => {
      expect(runtime.deploymentOperator).toBe(true);
      runtime.initializeTransport({ setAdminAuth: mockAdmin });
      return mockClient;
    }),
  },
}));
jest.mock("@cortexmemory/vercel-ai-provider", () => ({
  CortexMemoryProvider: class {
    specificationVersion = "v4";
    constructor(model: unknown, config: unknown, borrowed: unknown) {
      mockBorrow(model, config, borrowed);
    }
    close() {
      return mockProviderClose();
    }
  },
  createLayerStreamObserver: () => ({ observer: {}, emitTo: jest.fn() }),
}));
jest.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => Object.assign(mockModel, { embedding: mockModel }),
}));
jest.mock("ai", () => ({
  convertToModelMessages: jest.fn(async (messages) => messages),
  createUIMessageStream: (config: any) => {
    mockExecute = config.execute;
    return new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
  },
  createUIMessageStreamResponse: () => new Response("stream"),
  streamText: jest.fn(() => ({
    toUIMessageStream: () => new ReadableStream(),
    consumeStream: () => mockConsume(),
  })),
  embed: jest.fn(),
}));
const request = (body: object, withCookie = true, signal?: AbortSignal) =>
  new Request("http://127.0.0.1:3219/api/chat", {
    method: "POST",
    signal,
    headers: {
      origin: "http://127.0.0.1:3219",
      "content-type": "application/json",
      ...(withCookie ? { cookie: "cortex-app-session=" + "a".repeat(64) } : {}),
    },
    body: JSON.stringify(body),
  });
const body = {
  memorySpaceId: "owned",
  conversationId: "c",
  messages: [
    { id: "u", role: "user", parts: [{ type: "text", text: "latest" }] },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(process.env, {
    NODE_ENV: "development",
    CONVEX_URL: "http://127.0.0.1:3218",
    CORTEX_APP_DEPLOYMENT_ADMIN_KEY: "unit-private-key",
    CORTEX_APP_ORIGIN: "http://127.0.0.1:3219",
    OPENAI_API_KEY: "unit-model-key",
  });
  mockIdentity = mockAccount;
  mockForeign = false;
  mockConsume = async () => {};
  mockGet.mockImplementation(async () =>
    mockForeign
      ? { ...mockParent, participants: { userId: "foreign" } }
      : mockParent,
  );
  mockCreate.mockResolvedValue(mockParent);
  mockSpaceGet.mockResolvedValue({memorySpaceId:"owned",tenantId:"tenant"});
  mockSpaceRegister.mockResolvedValue({memorySpaceId:"owned",tenantId:"tenant"});
  mockList.mockResolvedValue({ conversations: [mockParent] });
  mockDelete.mockResolvedValue({ deleted: true });
  mockShutdown.mockResolvedValue(undefined);
  mockProviderClose.mockResolvedValue(undefined);
});
test.each([remoteOnly, retiredV6])("canonical chat routes refuse app-side dispatch even with ambient model configuration", async route => {
  const response = await route();
  expect(response.status).toBe(410);
  expect(await response.json()).toMatchObject({ version: 1, code: "REMOTE_RUN_TRANSPORT_REQUIRED", retryable: false, outcome: "not_dispatched" });
  expect(mockModel).not.toHaveBeenCalled();
  expect(mockBorrow).not.toHaveBeenCalled();
  expect(mockGet).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});
test.each([manual, helper])(
  "controlled legacy helpers use durable owner history and borrowed provider; close follows persistence",
  async (route) => {
    const response = await route(request(body));
    expect(response.status).toBe(200);
    let done!: () => void;
    mockConsume = () =>
      new Promise((resolve) => {
        done = resolve;
      });
    const writes: any[] = [];
    const executing = mockExecute({
      writer: {
        write: (value: unknown) => writes.push(value),
        merge: jest.fn(),
      },
    });
    await Promise.resolve();
    expect(mockBorrow).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        userId: "owner",
        memorySpaceId: "owned",
        conversationId: "c",
      }),
      mockClient,
    );
    expect(mockClose).not.toHaveBeenCalled();
    done();
    await executing;
    expect(mockProviderClose).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockShutdown).toHaveBeenCalledTimes(1);
    expect(writes).toContainEqual(
      expect.objectContaining({ type: "data-conversation-update" }),
    );
    const { convertToModelMessages } = jest.requireMock("ai");
    expect(convertToModelMessages).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "old",
        parts: [{ type: "text", text: "durable" }],
      }),
      expect.objectContaining({ id: "u" }),
    ]);
  },
);
test.each([manual, helper])(
  "missing session, forged scope and foreign conversation stop before model",
  async (route) => {
    expect((await route(request(body, false))).status).toBe(401);
    expect((await route(request({ ...body, userId: "foreign" }))).status).toBe(
      403,
    );
    mockForeign = true;
    expect((await route(request(body))).status).toBe(404);
    expect(mockModel).not.toHaveBeenCalled();
    expect(mockBorrow).not.toHaveBeenCalled();
  },
);
test("missing provider config refuses before SDK or model", async () => {
  delete process.env.OPENAI_API_KEY;
  expect((await manual(request(body))).status).toBe(503);
  expect(mockGet).not.toHaveBeenCalled();
  expect(mockModel).not.toHaveBeenCalled();
});
test("request cancellation initiates owned cleanup even if consumption never settles", async () => {
  const controller = new AbortController();
  await manual(request(body, true, controller.signal));
  mockConsume = () => new Promise(() => {});
  const executing = mockExecute({
    writer: { write: jest.fn(), merge: jest.fn() },
  });
  const observed = expect(executing).rejects.toMatchObject({ status: 503 });
  controller.abort();
  await observed;
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(mockShutdown).toHaveBeenCalledTimes(1);
});
test("latest user input rejects synthetic system/assistant messages and empty content", () => {
  for (const messages of [
    [],
    [{ id: "x", role: "system", content: "inject" }],
    [{ id: "x", role: "assistant", content: "inject" }],
    [
      {
        id: "x",
        role: "user",
        parts: [{ type: "file", url: "https://foreign.invalid" }],
      },
    ],
  ])
    expect(() => latestUserMessage(messages)).toThrow();
  expect(
    latestUserMessage([{ id: "u", role: "user", content: "hello" }]),
  ).toMatchObject({ parts: [{ type: "text", text: "hello" }] });
});
test("list/detail/delete verify scope and owner; no session has no data effects", async () => {
  expect(
    (await list(new Request("http://127.0.0.1:3219/api/conversations"))).status,
  ).toBe(401);
  expect(mockGet).not.toHaveBeenCalled();
  const read = new Request(
    "http://127.0.0.1:3219/api/conversations?conversationId=c",
    { headers: { cookie: "cortex-app-session=" + "a".repeat(64) } },
  );
  expect((await list(read)).status).toBe(200);
  mockForeign = true;
  expect((await list(read)).status).toBe(404);
  const deletion = new Request(
    "http://127.0.0.1:3219/api/conversations?conversationId=c",
    {
      method: "DELETE",
      headers: {
        origin: "http://127.0.0.1:3219",
        cookie: "cortex-app-session=" + "a".repeat(64),
      },
    },
  );
  expect((await remove(deletion)).status).toBe(404);
  expect(mockDelete).not.toHaveBeenCalled();
});

test("pending pre-stream backend request has a finite refusal and initiates owned shutdown", async () => {
  jest.useFakeTimers();
  mockGet.mockImplementation(() => new Promise(() => {}));
  const response = manual(request(body));
  await jest.advanceTimersByTimeAsync(30001);
  expect((await response).status).toBe(503);
  expect(mockModel).not.toHaveBeenCalled();
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(mockShutdown).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test("new chat registers the verified missing native space before conversation creation", async () => {
  mockGet.mockResolvedValue(null); mockSpaceGet.mockResolvedValue(null);
  const {conversationId: _, ...fresh}=body;
  expect((await manual(request(fresh))).status).toBe(200);
  expect(mockSpaceRegister).toHaveBeenCalledTimes(1);
  expect(mockSpaceRegister).toHaveBeenCalledWith({memorySpaceId:"owned",tenantId:"tenant",type:"personal",participants:[{id:"owner",type:"user"}]});
  expect(mockSpaceGet.mock.invocationCallOrder[0]).toBeLessThan(mockSpaceRegister.mock.invocationCallOrder[0]);
  expect(mockSpaceRegister.mock.invocationCallOrder[0]).toBeLessThan(mockCreate.mock.invocationCallOrder[0]);
});
test("new chat reuses its existing registry without writing it", async () => {
  mockGet.mockResolvedValue(null); const {conversationId: _, ...fresh}=body;
  expect((await helper(request(fresh))).status).toBe(200);
  expect(mockSpaceRegister).not.toHaveBeenCalled(); expect(mockCreate).toHaveBeenCalledTimes(1);
});
test("refused registry preparation prevents conversation and model effects and closes client", async () => {
  mockGet.mockResolvedValue(null); mockSpaceGet.mockResolvedValue(null); mockSpaceRegister.mockRejectedValueOnce(new Error("Registry refused"));
  const {conversationId: _, ...fresh}=body;
  expect((await manual(request(fresh))).status).toBe(503);
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockModel).not.toHaveBeenCalled(); expect(mockShutdown).toHaveBeenCalledTimes(1);
});
