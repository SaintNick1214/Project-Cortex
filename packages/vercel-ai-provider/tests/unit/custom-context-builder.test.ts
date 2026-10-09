import type { MemoryEntry, RecallResult } from "@cortexmemory/sdk";
import { CortexMemoryProvider } from "../../src/provider";
import { createMockLLM, createTestConfig } from "../helpers/test-utils";

const mockRecall = jest.fn();
const mockRemember = jest.fn();
jest.mock("@cortexmemory/sdk", () => ({
  Cortex: jest.fn().mockImplementation(() => ({
    memory: { recall: mockRecall, remember: mockRemember },
  })),
}));

function memory(id: string): MemoryEntry {
  return {
    _id: id, memoryId: id, memorySpaceId: "space-1", userId: "user-1",
    content: `Memory ${id}`, contentType: "raw", sourceType: "conversation",
    sourceTimestamp: 1, importance: 50, tags: [], version: 1,
    previousVersions: [], createdAt: 1, updatedAt: 1, accessCount: 0,
  };
}

function recalled(memories: MemoryEntry[] = []): RecallResult {
  return {
    items: memories.map((entry, index) => ({
      type: "memory", id: entry.memoryId, content: entry.content, score: 1,
      source: index === 0 ? "vector" : "graph-expanded", memory: entry,
    })),
    context: "Unfiltered historical context", totalResults: memories.length,
    queryTimeMs: 1, graphExpansionApplied: memories.length > 1,
    sources: {
      vector: { count: memories.length, items: memories },
      facts: { count: 0, items: [] },
      graph: { count: memories.length > 1 ? 1 : 0, expandedEntities: [] },
    },
  };
}

describe.each(["doGenerate", "doStream"] as const)("customContextBuilder in %s", method => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecall.mockResolvedValue(recalled());
  });

  const prompt = [{ role: "user", content: [{ type: "text", text: "Recall my current preference" }] }];

  it("replaces default context with the builder result and supplies ranked memory entries", async () => {
    const entries = [memory("vector-memory"), memory("graph-memory")];
    mockRecall.mockResolvedValueOnce(recalled(entries));
    const builder = jest.fn().mockReturnValue("Authoritative active branch");
    const model = createMockLLM();
    const provider = new CortexMemoryProvider(model, createTestConfig({
      enableMemoryStorage: false, customContextBuilder: builder,
    }));

    await provider[method]({ prompt });

    expect(builder).toHaveBeenCalledTimes(1);
    expect(builder).toHaveBeenCalledWith(entries);
    const sentPrompt = model[method].mock.calls[0][0].prompt;
    expect(sentPrompt[0].content).toContain("Authoritative active branch");
    expect(JSON.stringify(sentPrompt)).not.toContain("Unfiltered historical context");
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("uses an empty override to suppress even fact-only and graph-only default context", async () => {
    const result = recalled();
    result.items = [{ type: "fact", id: "fact-1", content: "Stale fact", score: 1, source: "facts" }];
    result.totalResults = 1;
    result.context = "Stale fact and graph context";
    mockRecall.mockResolvedValueOnce(result);
    const builder = jest.fn().mockReturnValue("");
    const model = createMockLLM();
    const provider = new CortexMemoryProvider(model, createTestConfig({
      enableMemoryStorage: false, customContextBuilder: builder,
    }));

    await provider[method]({ prompt });

    expect(builder).toHaveBeenCalledWith([]);
    expect(model[method].mock.calls[0][0].prompt).toBe(prompt);
  });

  it("preserves the default multi-layer context when no builder is supplied", async () => {
    const model = createMockLLM();
    const provider = new CortexMemoryProvider(model, createTestConfig({ enableMemoryStorage: false }));
    await provider[method]({ prompt });
    expect(model[method].mock.calls[0][0].prompt[0].content).toContain("Unfiltered historical context");
  });

  it("does not invoke a builder when memory search is disabled", async () => {
    const builder = jest.fn().mockReturnValue("Should not be injected");
    const model = createMockLLM();
    const provider = new CortexMemoryProvider(model, createTestConfig({
      enableMemorySearch: false, enableMemoryStorage: false, customContextBuilder: builder,
    }));
    await provider[method]({ prompt });
    expect(mockRecall).not.toHaveBeenCalled();
    expect(builder).not.toHaveBeenCalled();
    expect(model[method].mock.calls[0][0].prompt).toBe(prompt);
  });

  it("propagates formatter failure before invoking the model or storing a response", async () => {
    const error = new Error("Active branch unavailable");
    const model = createMockLLM();
    const provider = new CortexMemoryProvider(model, createTestConfig({
      customContextBuilder: () => { throw error; },
    }));
    await expect(provider[method]({ prompt })).rejects.toBe(error);
    expect(model[method]).not.toHaveBeenCalled();
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("retains existing recall-failure behavior without invoking the formatter", async () => {
    mockRecall.mockRejectedValueOnce(new Error("Recall unavailable"));
    const builder = jest.fn();
    const model = createMockLLM();
    const provider = new CortexMemoryProvider(model, createTestConfig({
      enableMemoryStorage: false, customContextBuilder: builder,
    }));
    await provider[method]({ prompt });
    expect(builder).not.toHaveBeenCalled();
    expect(model[method].mock.calls[0][0].prompt).toBe(prompt);
  });
});
