import { describe, it, expect, vi } from "vitest";
import { chat, message, observe, watch } from "../chat.js";
import { config, runtimeMock } from "./helpers/test-utils.js";
import { CortexRuntimeError } from "../cortex.js";
import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";
import type { RuntimeClientPort } from "@cortexmemory/sdk/runtime";
import { getFunctionName } from "convex/server";
describe("backend-owned text runs", () => {
  it("actual SDK Basic admission uses one combined operation between fresh sessions", async () => {
    const f = runtimeMock(), calls: string[] = [];
    const port = { setAuth: (_fetch: unknown, ready: (accepted: boolean) => void) => ready(true),
      mutation: async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => {
        const name = getFunctionName(ref); calls.push(name);
        if (name === "runtimeClient:session") return f.verified;
        if (name === "runtimeClient:submitAndStart") {
          expect(args).toEqual({ tenantId: "tenant", memorySpaceId: "space", streaming: true,
            request: { version: 1, agentId: "agent", agentVersion: 2, clientRequestId: "basic-key", parts: [{ type: "text", text: "hello" }] } });
          return { version: 1, run: { ...f.run, attemptNumber: 1, responseStatus: "running" }, start: { runId: f.handle.runId, attemptNumber: 1, state: "ready" } };
        }
        throw new Error("UNEXPECTED_RPC");
      }, query: async () => { throw new Error("PRIVATE_QUERY_PROHIBITED"); }, action: async () => { throw new Error("PAID_CALL_PROHIBITED"); },
      onUpdate: () => { throw new Error("UNEXPECTED_WATCH"); }, close: async () => {},
    } as unknown as RuntimeClientPort;
    const client = new CortexRuntimeClient({ deploymentUrl: config.deploymentUrl, fetchToken: async () => "opaque", client: port });
    try {
      const result = await chat(client, config, { requestId: "basic-key", message: "hello" });
      expect(result.handle).toEqual({ version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", runId: f.handle.runId,
        conversationId: f.handle.conversationId, agentId: "agent", agentVersion: 2, definitionHash: f.handle.definitionHash });
      expect(result.run).toMatchObject({ responseStatus: "running", attemptNumber: 1 });
      expect(calls).toEqual(["runtimeClient:session", "runtimeClient:submitAndStart", "runtimeClient:session"]);
    } finally { await client.close(); }
  });
  it("submits only new text with the caller key and published Agent, without recall/model/remember", async () => {
    const f = runtimeMock(); const result = await chat(f.client, config, { requestId: "stable-key", message: "new text", conversationId: "prior-conversation" });
    expect(f.client.submitAndStart).toHaveBeenCalledExactlyOnceWith({ version: 1, agentId: "agent", agentVersion: 2, clientRequestId: "stable-key", conversationId: "prior-conversation", parts: [{ type: "text", text: "new text" }] }, { streaming: true });
    expect(f.client.start).not.toHaveBeenCalled(); expect(f.client.get).not.toHaveBeenCalled(); expect(result.handle).toBe(f.handle); expect(result.run.responseStatus).toBe("running"); expect(f.client.recall).not.toHaveBeenCalled();
  });
  it.each(["", " ", "x".repeat(257)])("requires a usable replay key before submit", async requestId => { const f = runtimeMock(); await expect(chat(f.client, config, { requestId, message: "text" })).rejects.toThrow(); expect(f.client.submitAndStart).not.toHaveBeenCalled(); });
  it.each(["", " ", "é".repeat(8001)])("rejects empty or UTF-8-overlimit new text", value => { expect(() => message(value)).toThrow("INVALID_MESSAGE"); });
  it("accepts the exact UTF-8 text boundary", () => { expect(message("é".repeat(8000))).toHaveLength(8000); });
  it("does not blindly retry ambiguous submit or fabricate a local reply", async () => { const f = runtimeMock(); f.client.submitAndStart.mockRejectedValue(new Error("ambiguous")); await expect(chat(f.client, config, { requestId: "same-key", message: "text" })).rejects.toThrow("ambiguous"); expect(f.client.submitAndStart).toHaveBeenCalledOnce(); expect(f.client.start).not.toHaveBeenCalled(); });
  it("fresh observation carries both attempt and sequence without restarting", async () => { const f = runtimeMock(); expect(await observe(f.client, "run-one", { cursor: 7, attemptNumber: 3, finalOnly: true })).toBe(f.observation); expect(f.client.observe).toHaveBeenCalledWith(f.handle, { cursor: { sequence: 7, attemptNumber: 3 }, finalOnly: true }); expect(f.client.start).not.toHaveBeenCalled(); });
  it.each([{ cursor: 1 }, { cursor: -1, attemptNumber: 1 }, { cursor: 0, attemptNumber: -1 }])("rejects unpaired/invalid cursor %j", async cursor => { const f = runtimeMock(); await expect(observe(f.client, "run-one", cursor)).rejects.toThrow("INVALID_CURSOR"); expect(f.client.observe).not.toHaveBeenCalled(); });
  it("watch releases a synchronous terminal subscription and emits the durable result", async () => { const f = runtimeMock(), update = vi.fn(); await watch(f.client, f.handle, update); expect(update).toHaveBeenCalledWith(expect.objectContaining({ state: "complete" })); expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.cancel).not.toHaveBeenCalled(); });
  it("watch error releases observation without cancelling server work", async () => { const f = runtimeMock(); f.client.watchObservation.mockImplementation((_handle, _update, error) => { queueMicrotask(() => error?.(new CortexRuntimeError("FORBIDDEN"))); return f.unsubscribe; }); await expect(watch(f.client, f.handle, () => {})).rejects.toThrow("FORBIDDEN"); expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.cancel).not.toHaveBeenCalled(); });
});
