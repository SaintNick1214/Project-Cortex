import { describe, expect, it, jest } from "@jest/globals";
import type { ConvexClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import { MemoryAPI } from "../../src/memory";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";
import type { MemoryAPIDependencies } from "../../src/memory";
import type { OrchestrationObserver, RememberParams, StoreMemoryInput } from "../../src/types";

function fixture(configuredEmbedding = false) {
  const embedding = jest.fn(async (_text: string) => [1, 0]);
  const saved = {memoryId: "memory-owned", content: "manual content", version: 1};
  const query = jest.fn(async (_ref: unknown, _args: unknown): Promise<unknown> => []);
  const mutation = jest.fn(async (_ref: unknown, _args: unknown): Promise<unknown> => saved);
  const action = jest.fn(async (_ref: unknown, _args: unknown): Promise<unknown> => []);
  const client = {query, mutation, action, onUpdate: jest.fn()} as unknown as ConvexClient;
  const memorySpaceGet = jest.fn(async () => ({memorySpaceId: "space-owned"}));
  const dependencies = {
    memorySpaces: {get: memorySpaceGet},
    embedding: configuredEmbedding ? {provider: "custom", generate: embedding} : undefined,
  } as unknown as MemoryAPIDependencies;
  const memory = new MemoryAPI(client, undefined, undefined, dependencies);
  return {memory, client, query, mutation, action, embedding, saved, memorySpaceGet};
}
function observers() {
  const callback = jest.fn((): void => {});
  const observer: OrchestrationObserver = {onRememberStart: callback, onRememberComplete: callback,
    onRecallStart: callback, onRecallComplete: callback, onLayerUpdate: callback};
  return {observer, callback};
}
function assertNoTransport(f: ReturnType<typeof fixture>) {
  expect(f.query).not.toHaveBeenCalled();
  expect(f.mutation).not.toHaveBeenCalled();
  expect(f.action).not.toHaveBeenCalled();
  expect(f.memorySpaceGet).not.toHaveBeenCalled();
}
const denial = {code: "CAPABILITY_UNAVAILABLE", outcome: "not_dispatched"};
const manualInput: StoreMemoryInput = {content: "manual content", contentType: "raw",
  source: {type: "system"}, metadata: {importance: 50, tags: []}};

describe("ordinary MemoryAPI cannot issue app-side model orchestration", () => {
  it.each([false, true])("remember refuses before effects with skipped conversation %s", async (skipConversation) => {
    const f = fixture(); const o = observers();
    const extractContent = jest.fn(async () => "extracted content");
    const generateEmbedding = jest.fn(async () => [1, 0]);
    const extractFacts = jest.fn(async () => []);
    const params: RememberParams = {memorySpaceId: "space-owned", conversationId: "conversation-existing",
      agentId: "agent-owned", userMessage: "owned question", agentResponse: "owned response",
      extractContent, generateEmbedding, extractFacts, observer: o.observer,
      skipLayers: skipConversation ? ["users", "agents", "conversations", "facts", "graph"] : []};
    await expect(f.memory.remember(params)).rejects.toMatchObject(denial);
    for (const fn of [extractContent, generateEmbedding, extractFacts, o.callback]) expect(fn).not.toHaveBeenCalled();
    assertNoTransport(f);
  });

  it("rememberStream refuses before consuming an existing stream or notifying hooks", async () => {
    const f = fixture(); const o = observers();
    const next = jest.fn(async () => ({done: true as const, value: undefined}));
    const iterator = jest.fn(() => ({next}));
    const hook = jest.fn((): void => {}); const extraction = jest.fn(async () => []);
    await expect(f.memory.rememberStream({memorySpaceId: "space-owned", conversationId: "conversation-existing",
      agentId: "agent-owned", userMessage: "owned question", responseStream: {[Symbol.asyncIterator]: iterator},
      extractFacts: extraction, observer: o.observer, skipLayers: ["users", "agents", "conversations"]},
    {progressiveFactExtraction: true, hooks: {onChunk: hook}})).rejects.toMatchObject(denial);
    for (const fn of [iterator, next, extraction, hook, o.callback]) expect(fn).not.toHaveBeenCalled();
    assertNoTransport(f);
  });

  it("recall refuses before configured embedding and observer callbacks", async () => {
    const f = fixture(true); const o = observers();
    await expect(f.memory.recall({memorySpaceId: "space-owned", query: "owned search", observer: o.observer})).rejects.toMatchObject(denial);
    expect(f.embedding).not.toHaveBeenCalled(); expect(o.callback).not.toHaveBeenCalled(); assertNoTransport(f);
  });

  it("search refuses implicit embedding before a callback or RPC", async () => {
    const f = fixture(true);
    await expect(f.memory.search("space-owned", "owned search")).rejects.toMatchObject(denial);
    expect(f.embedding).not.toHaveBeenCalled(); assertNoTransport(f);
  });

  it("store extraction refuses before the manual write and callback", async () => {
    const f = fixture(); const extractFacts = jest.fn(async () => []);
    await expect(f.memory.store("space-owned", {...manualInput, extractFacts})).rejects.toMatchObject(denial);
    expect(extractFacts).not.toHaveBeenCalled(); assertNoTransport(f);
  });

  it("update re-extraction refuses before update or deleting prior facts", async () => {
    const f = fixture(); const extractFacts = jest.fn(async () => []);
    await expect(f.memory.update("space-owned", "memory-owned", {content: "new content"},
      {reextractFacts: true, extractFacts})).rejects.toMatchObject(denial);
    expect(extractFacts).not.toHaveBeenCalled(); assertNoTransport(f);
  });

  it("manual public store preserves one canonical write without extraction", async () => {
    const f = fixture();
    await expect(f.memory.store("space-owned", manualInput)).resolves.toEqual({memory: f.saved, facts: []});
    expect(f.mutation).toHaveBeenCalledTimes(1); expect(f.query).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
    expect(getFunctionName(f.mutation.mock.calls[0]![0] as Parameters<typeof getFunctionName>[0])).toBe("memories:store");
  });

  it("manual public update preserves one canonical write without re-extraction", async () => {
    const f = fixture();
    await expect(f.memory.update("space-owned", "memory-owned", {content: "new content"})).resolves.toEqual({memory: f.saved});
    expect(f.mutation).toHaveBeenCalledTimes(1); expect(f.query).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
    expect(getFunctionName(f.mutation.mock.calls[0]![0] as Parameters<typeof getFunctionName>[0])).toBe("memories:update");
  });

  it("explicit deployment operator retains extraction and separately routed legacy writes", async () => {
    const f = fixture(); enableDeploymentOperator(f.client); const extractFacts = jest.fn(async () => []);
    await expect(f.memory.store("space-owned", {...manualInput, extractFacts})).resolves.toEqual({memory: f.saved, facts: []});
    expect(extractFacts).toHaveBeenCalledTimes(1); expect(f.mutation).toHaveBeenCalledTimes(1);
    expect(getFunctionName(f.mutation.mock.calls[0]![0] as Parameters<typeof getFunctionName>[0])).toBe("cliOperator/memories:store");
  });
});
