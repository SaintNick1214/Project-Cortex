import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import { convertArrayToReadableStream, MockLanguageModelV3 } from "ai/test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

const state = vi.hoisted(() => ({
  model: undefined as MockLanguageModelV3 | undefined,
  titleError: undefined as Error | undefined,
  titleSaveError: undefined as Error | undefined,
  readerError: undefined as Error | undefined,
  finishError: undefined as Error | undefined,
  providerDelay: Promise.resolve(),
  cortexDelay: Promise.resolve(),
  order: [] as string[],
  saves: 0,
  finish: undefined as undefined | ((value: { messages: [] }) => Promise<void>),
}));
vi.mock("@/app/(auth)/auth", () => ({
  auth: async () => ({ user: { id: "owner", type: "regular" } }),
}));
vi.mock("@/lib/cortex", () => ({
  requireScope: async () => ({
    userId: "owner",
    tenantId: "tenant",
    memorySpaceId: "owned",
  }),
  createScopedCortex: () => Promise.resolve({}),
  closeOwnedCortex: async () => {
    state.order.push("cortex-start");
    await state.cortexDelay;
    state.order.push("cortex-done");
  },
}));
vi.mock("@/lib/private-backend", () => ({ privateCall: async () => [] }));
vi.mock("@/lib/db/queries", () => ({
  getChatById: async () => null,
  getMessagesByChatId: async () => [],
  getMessageCountByUserId: async () => 0,
  saveChat: () => Promise.resolve({}),
  prepareChatMessages: async () => [],
  createStreamId: async () => undefined,
  deleteChatById: async () => undefined,
  updateChatTitleById: () => {
    if (state.titleSaveError) {
      throw state.titleSaveError;
    }
  },
  saveMessages: () => {
    state.saves++;
    if (state.saves > 1 && state.finishError) {
      throw state.finishError;
    }
  },
}));
vi.mock("@/app/(chat)/actions", () => ({
  generateTitleFromUserMessage: () => {
    if (state.titleError) {
      throw state.titleError;
    }
    return "Owned title";
  },
}));
vi.mock("@/lib/ai/providers", () => ({
  getLanguageModel: () => state.model,
  assertChatConfiguration: () => undefined,
}));
vi.mock("@/lib/cortex-memory-config", () => ({
  getCortexMemoryConfig: () => ({}),
}));
vi.mock("@vercel/functions", () => ({ geolocation: () => ({}) }));
vi.mock("resumable-stream", () => ({
  createResumableStreamContext: () => null,
}));
vi.mock("@cortexmemory/vercel-ai-provider", async () => {
  const { MockLanguageModelV3: Model } = await import("ai/test");
  return {
    CortexMemoryProvider: class extends Model {
      constructor(model: MockLanguageModelV3) {
        super({ doStream: (options) => model.doStream(options) });
      }
      async close() {
        state.order.push("provider-start");
        await state.providerDelay;
        state.order.push("provider-done");
      }
    },
  };
});
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    createUIMessageStream: (
      options: Parameters<typeof actual.createUIMessageStream>[0]
    ) => {
      state.finish = options.onFinish as typeof state.finish;
      return actual.createUIMessageStream(options);
    },
    streamText: (options: Parameters<typeof actual.streamText>[0]) => {
      if (state.readerError) {
        return {
          toUIMessageStream: () =>
            new ReadableStream({ start: (controller) => controller.close() }),
          consumeStream: () => Promise.reject(state.readerError),
        };
      }
      return actual.streamText(options);
    },
  };
});

import { POST } from "@/app/(chat)/api/chat/route";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
function model(chunks: LanguageModelV3StreamPart[]) {
  return new MockLanguageModelV3({
    doStream: () =>
      Promise.resolve({ stream: convertArrayToReadableStream(chunks) }),
  });
}
function request() {
  return new Request("http://127.0.0.1:3219/api/chat", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3219" },
    body: JSON.stringify({
      id: "11111111-1111-4111-8111-111111111111",
      selectedChatModel: "openai/gpt-4.1",
      selectedVisibilityType: "private",
      message: {
        id: "22222222-2222-4222-8222-222222222222",
        role: "user",
        parts: [{ type: "text", text: "Controlled offline request" }],
      },
    }),
  });
}
let log: MockInstance<(...data: unknown[]) => void>;
beforeEach(() => {
  state.titleError = undefined;
  state.titleSaveError = undefined;
  state.readerError = undefined;
  state.finishError = undefined;
  state.order = [];
  state.saves = 0;
  state.providerDelay = Promise.resolve();
  state.cortexDelay = Promise.resolve();
  state.model = model([
    { type: "text-start", id: "text" },
    { type: "text-delta", id: "text", delta: "Owned response" },
    { type: "text-end", id: "text" },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
  ]);
  log = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());
function stages() {
  return log.mock.calls
    .filter((call) => call[0] === "[Chat stream error]")
    .map((call) => (call[1] as { stage: string }).stage);
}
function closed() {
  expect(state.order).toEqual([
    "provider-start",
    "provider-done",
    "cortex-start",
    "cortex-done",
  ]);
}
describe("actual Chat route execute and original error boundaries", () => {
  it("actual AI6 provider error chunk records model stage without exposing its original message", async () => {
    const error = Object.assign(new Error("secret-error-canary"), {
      name: "AI_APICallError",
      statusCode: 429,
    });
    state.model = model([
      { type: "error", error },
      {
        type: "finish",
        finishReason: { unified: "error", raw: "error" },
        usage,
      },
    ]);
    const response = await POST(request());
    const body = await response.text();
    expect(stages()).toContain("model-stream");
    expect(log.mock.calls).toContainEqual([
      "[Chat stream error]",
      {
        stage: "model-stream",
        name: "AI_APICallError",
        status: 429,
        code: null,
      },
    ]);
    expect(body).toContain('"type":"error"');
    expect(body).not.toContain("canary");
    closed();
  });
  it("retains reader rejection and waits for both owned cleanup steps before stream completion", async () => {
    state.readerError = Object.assign(new Error("secret-reader-canary"), {
      name: "AI_TypeValidationError",
    });
    let release!: () => void;
    state.providerDelay = new Promise((resolve) => {
      release = resolve;
    });
    let releaseCortex!: () => void;
    state.cortexDelay = new Promise((resolve) => {
      releaseCortex = resolve;
    });
    const response = await POST(request());
    let settled = false;
    const bodyPromise = response.text().then((value) => {
      settled = true;
      return value;
    });
    await vi.waitFor(() => expect(state.order).toEqual(["provider-start"]));
    expect(settled).toBe(false);
    release();
    await vi.waitFor(() =>
      expect(state.order).toEqual([
        "provider-start",
        "provider-done",
        "cortex-start",
      ])
    );
    expect(settled).toBe(false);
    releaseCortex();
    const body = await bodyPromise;
    expect(stages()).toContain("stream-consume");
    expect(body).toContain("Oops, an error occurred!");
    expect(body).not.toContain("canary");
    closed();
  });
  for (const boundary of ["titleError", "titleSaveError"] as const) {
    it(`distinguishes ${boundary} from model/reader failures and closes resources`, async () => {
      state[boundary] = new Error("secret-title-canary");
      const response = await POST(request());
      const body = await response.text();
      expect(stages()).toContain(
        boundary === "titleError" ? "chat-title" : "chat-title-save"
      );
      expect(stages()).not.toContain("stream-consume");
      expect(body).toContain("Oops, an error occurred!");
      expect(body).not.toContain("canary");
      closed();
    });
  }
  it("preserves finish persistence rejection identity after execute cleanup", async () => {
    const response = await POST(request());
    await response.text();
    closed();
    state.finishError = new Error("secret-finish-canary");
    state.saves = 1;
    await expect(state.finish?.({ messages: [] })).rejects.toBe(
      state.finishError
    );
    expect(stages()).toContain("stream-finish");
    expect(JSON.stringify(log.mock.calls)).not.toContain("canary");
  });
  it("keeps successful output/persistence and closes the provider and Cortex once", async () => {
    const response = await POST(request());
    const body = await response.text();
    expect(body).toContain("Owned response");
    expect(stages()).toEqual([]);
    expect(state.saves).toBe(2);
    closed();
  });
});
