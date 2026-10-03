import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ConvexClient } from "convex/browser";
import { api } from "../../../convex-dev/_generated/api";
import { FactHistoryCapabilityError, FactHistoryService } from "../../../src/facts/history";
import { ResilienceLayer } from "../../../src/resilience";

function fixture(mode: "absent" | "disabled" | "enabled") {
  const client = new ConvexClient("https://example.convex.cloud", { disabled: true, logger: false });
  const query = jest.spyOn(client, "query");
  const mutation = jest.spyOn(client, "mutation");
  const action = jest.spyOn(client, "action");
  const resilience = new ResilienceLayer({ enabled: mode === "enabled" });
  const execute = jest.spyOn(resilience, "execute");
  return { client, query, mutation, action, resilience, execute,
    history: new FactHistoryService(client, mode === "absent" ? undefined : resilience) };
}

const writes = [
  { name: "log", call: (h: FactHistoryService) => h.log({ factId: "private-fact", memorySpaceId: "private-space", action: "UPDATE", oldValue: "private-old", newValue: "private-new", reason: "private-reason", userId: "administrator", participantId: "operator", conversationId: "private-conversation", pipeline: { llmResolution: true } }) },
  { name: "deleteByFactId", call: (h: FactHistoryService) => h.deleteByFactId("private-fact") },
  { name: "deleteByUserId", call: (h: FactHistoryService) => h.deleteByUserId("administrator") },
  { name: "deleteByMemorySpace", call: (h: FactHistoryService) => h.deleteByMemorySpace("private-space") },
  { name: "purgeOldEvents", call: (h: FactHistoryService) => h.purgeOldEvents(new Date(123), "private-space", 999) },
];

const expectedError = {
  name: "FactHistoryCapabilityError", version: 1, code: "CAPABILITY_UNAVAILABLE",
  retryable: false, outcome: "not_dispatched",
};

describe.each(["absent", "disabled", "enabled"] as const)("history operator bridge resilience=%s", (mode) => {
  let current: ReturnType<typeof fixture>;
  afterEach(async () => { await current.client.close(); await current.resilience.shutdown(); jest.restoreAllMocks(); });

  function assertNotDispatched() {
    expect(current.query).not.toHaveBeenCalled();
    expect(current.mutation).not.toHaveBeenCalled();
    expect(current.action).not.toHaveBeenCalled();
    expect(current.execute).not.toHaveBeenCalled();
  }

  it.each(writes)("$name rejects with a static typed capability error and zero dispatch", async ({ call }) => {
    current = fixture(mode);
    const result: unknown = await call(current.history).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(FactHistoryCapabilityError);
    expect(result).toMatchObject(expectedError);
    expect(JSON.parse(JSON.stringify(result))).toEqual(expectedError);
    if (!(result instanceof FactHistoryCapabilityError)) throw new Error("Expected capability rejection");
    expect(result.message).toBe("Fact history writes and maintenance require trusted backend execution. No operation was dispatched by this client.");
    expect(result).not.toHaveProperty("eventId");
    expect(result).not.toHaveProperty("deleted");
    expect(result).not.toHaveProperty("remaining");
    expect(result).not.toHaveProperty("cause");
    expect(JSON.stringify(result)).not.toMatch(/private-|administrator|operator|credentials/);
    assertNotDispatched();
  });

  it("log does not hydrate caller properties or treat caller admin labels as authority", async () => {
    current = fixture(mode);
    const hydrate = jest.fn(() => { throw new Error("private input getter"); });
    await expect(current.history.log({ get factId() { return hydrate(); }, memorySpaceId: "private-space", action: "CREATE", userId: "administrator", participantId: "operator" })).rejects.toMatchObject(expectedError);
    expect(hydrate).not.toHaveBeenCalled();
    assertNotDispatched();
  });

  it("retention capability rejection does not call a caller-controlled date", async () => {
    current = fixture(mode);
    const date = new Date(123); const getTime = jest.spyOn(date, "getTime").mockImplementation(() => { throw new Error("private date getter"); });
    await expect(current.history.purgeOldEvents(date)).rejects.toMatchObject(expectedError);
    expect(getTime).not.toHaveBeenCalled();
    await expect(current.history.purgeOldEvents(new Date(NaN))).rejects.toMatchObject(expectedError);
    await expect(current.history.deleteByFactId("")).rejects.toMatchObject(expectedError);
    await expect(current.history.deleteByUserId("")).rejects.toMatchObject(expectedError);
    await expect(current.history.deleteByMemorySpace("")).rejects.toMatchObject(expectedError);
    assertNotDispatched();
  });

  const reads = [
    { name: "getHistory", ref: api.factHistory.getHistory, args: { factId: "fact-a", limit: 3 }, call: (h: FactHistoryService) => h.getHistory("fact-a", 3), value: [] },
    { name: "getEvent", ref: api.factHistory.getEvent, args: { eventId: "event-a" }, call: (h: FactHistoryService) => h.getEvent("event-a"), value: null },
    { name: "getChanges", ref: api.factHistory.getChangesByTimeRange, args: { memorySpaceId: "space-a", after: 100, before: 200, action: "UPDATE", limit: 3, offset: 2 }, call: (h: FactHistoryService) => h.getChanges({ memorySpaceId: "space-a", after: new Date(100), before: new Date(200), action: "UPDATE", limit: 3, offset: 2 }), value: [] },
    { name: "countByAction", ref: api.factHistory.countByAction, args: { memorySpaceId: "space-a", after: 100, before: 200 }, call: (h: FactHistoryService) => h.countByAction("space-a", new Date(100), new Date(200)), value: { CREATE: 1, UPDATE: 2, SUPERSEDE: 0, DELETE: 0, total: 3 } },
    { name: "getSupersessionChain", ref: api.factHistory.getSupersessionChain, args: { factId: "fact-a" }, call: (h: FactHistoryService) => h.getSupersessionChain("fact-a"), value: [] },
    { name: "getActivitySummary", ref: api.factHistory.getActivitySummary, args: { memorySpaceId: "space-a", hours: 2 }, call: (h: FactHistoryService) => h.getActivitySummary("space-a", 2), value: { timeRange: { hours: 2, since: "a", until: "b" }, totalEvents: 3, actionCounts: { CREATE: 1, UPDATE: 2, SUPERSEDE: 0, DELETE: 0 }, uniqueFactsModified: 2, activeParticipants: 1 } },
  ];

  it.each(reads)("$name retains the public read reference, selectors and result", async ({ ref, args, call, value }) => {
    current = fixture(mode); current.query.mockResolvedValue(value);
    await expect(call(current.history)).resolves.toBe(value);
    expect(current.query).toHaveBeenCalledTimes(1);
    expect(current.query).toHaveBeenCalledWith(ref, args);
    expect(current.mutation).not.toHaveBeenCalled(); expect(current.action).not.toHaveBeenCalled();
  });

  it.each(reads)("$name preserves backend read denial without converting it to a capability or success", async ({ call }) => {
    current = fixture(mode); const denied = new Error("NOT_AUTHORIZED"); current.query.mockRejectedValue(denied);
    await expect(call(current.history)).rejects.toBe(denied);
    expect(current.query).toHaveBeenCalledTimes(1);
    expect(current.mutation).not.toHaveBeenCalled(); expect(current.action).not.toHaveBeenCalled();
  });
});
