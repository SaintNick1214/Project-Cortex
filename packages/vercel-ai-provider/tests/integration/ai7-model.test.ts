import type { Cortex } from "@cortexmemory/sdk";
import { generateText, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { CortexMemoryProvider } from "../../src/provider";
import { createTestConfig } from "../helpers/test-utils";

jest.mock("@cortexmemory/sdk", () => ({ Cortex: jest.fn() }));

const usage = {
  inputTokens: { total: 2, noCache: 2, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 2, text: 2, reasoning: 0 },
};
const finishReason = { unified: "stop" as const, raw: "stop" };

function fixture() {
  const memory = {
    recall: jest.fn().mockResolvedValue({
      context: "Verified owner prefers tea.", totalResults: 1, queryTimeMs: 1,
      sources: { vector: { count: 1 }, facts: { count: 0 }, graph: { count: 0 } },
    }),
    remember: jest.fn().mockResolvedValue(undefined),
    rememberStream: jest.fn(async (params) => {
      let text = "";
      for await (const chunk of params.responseStream) text += chunk;
      return { fullResponse: text };
    }),
  };
  const client = { memory, shutdown: jest.fn().mockResolvedValue(undefined) };
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: [
        { type: "reasoning", text: "Private model reasoning" },
        { type: "text", text: "Tea " },
        { type: "text", text: "remembered." },
      ],
      finishReason, usage, warnings: [],
    },
    doStream: {
      stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        controller.enqueue({ type: "text-start", id: "text-1" });
        controller.enqueue({ type: "text-delta", id: "text-1", delta: "Tea " });
        controller.enqueue({ type: "text-delta", id: "text-1", delta: "remembered." });
        controller.enqueue({ type: "text-end", id: "text-1" });
        controller.enqueue({ type: "finish", finishReason, usage });
        controller.close();
      } }),
    },
  });
  const provider = new CortexMemoryProvider(model, createTestConfig({
    userId: "verified-owner", memorySpaceId: "owned-space", conversationId: "owned-chat",
  }), client as unknown as Cortex);
  expect(provider.specificationVersion).toBe("v4");
  return { memory, client, model,
    provider: provider as CortexMemoryProvider & { readonly specificationVersion: "v4" } };
}

it("AI 7 generation injects owned recall and stores ordered text content without reasoning", async () => {
  const { provider, memory, model, client } = fixture();
  const result = await generateText({ model: provider, prompt: "Recall my drink" });
  expect(result.text).toBe("Tea remembered.");
  expect(model.doGenerateCalls[0].prompt[0]).toMatchObject({
    role: "system", content: "Verified owner prefers tea.",
  });
  expect(memory.recall).toHaveBeenCalledWith(expect.objectContaining({
    userId: "verified-owner", memorySpaceId: "owned-space",
  }));
  expect(memory.remember).toHaveBeenCalledWith(expect.objectContaining({
    userId: "verified-owner", memorySpaceId: "owned-space", conversationId: "owned-chat",
    agentResponse: "Tea remembered.",
  }), expect.any(Object));
  await provider.close();
  expect(client.shutdown).not.toHaveBeenCalled();
});

it("generation joins persistence before caller can release its owner", async () => {
  const { provider, memory } = fixture();
  let complete!: () => void;
  memory.remember.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
  let settled = false;
  const result = generateText({ model: provider, prompt: "Remember tea" })
    .then(value => { settled = true; return value; });
  for (let attempt = 0; attempt < 50 && !complete; attempt++) await Promise.resolve();
  expect(memory.remember).toHaveBeenCalledTimes(1);
  expect(settled).toBe(false);
  complete();
  expect((await result).text).toBe("Tea remembered.");
});

it("AI 7 streaming preserves text/finish protocol and awaits scoped persistence", async () => {
  const { provider, memory, model } = fixture();
  const result = streamText({ model: provider, prompt: "Recall my drink" });
  await result.consumeStream();
  expect(await result.text).toBe("Tea remembered.");
  expect(model.doStreamCalls[0].prompt[0]).toMatchObject({
    role: "system", content: "Verified owner prefers tea.",
  });
  expect(memory.rememberStream).toHaveBeenCalledTimes(1);
  expect(memory.rememberStream.mock.calls[0][0]).toMatchObject({
    userId: "verified-owner", memorySpaceId: "owned-space", conversationId: "owned-chat",
  });
});
