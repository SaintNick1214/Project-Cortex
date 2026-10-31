import { describe, it, expect, vi } from "vitest";
import { chat, message, observe, watch } from "../chat.js";
import { config, runtimeMock } from "./helpers/test-utils.js";
import { CortexRuntimeError } from "../cortex.js";
describe("backend-owned text runs", () => {
  it("submits only new text with the caller key and published Agent, without recall/model/remember", async () => {
    const f = runtimeMock(); const result = await chat(f.client, config, { requestId: "stable-key", message: "new text", conversationId: "prior-conversation" });
    expect(f.client.submit).toHaveBeenCalledExactlyOnceWith({ version: 1, agentId: "agent", agentVersion: 2, clientRequestId: "stable-key", conversationId: "prior-conversation", parts: [{ type: "text", text: "new text" }] });
    expect(f.client.start).toHaveBeenCalledExactlyOnceWith(f.handle, { streaming: true }); expect(result.handle).toBe(f.handle); expect(result.run.responseStatus).toBe("running"); expect(f.client.recall).not.toHaveBeenCalled();
  });
  it.each(["", " ", "x".repeat(257)])("requires a usable replay key before submit", async requestId => { const f = runtimeMock(); await expect(chat(f.client, config, { requestId, message: "text" })).rejects.toThrow(); expect(f.client.submit).not.toHaveBeenCalled(); });
  it.each(["", " ", "é".repeat(8001)])("rejects empty or UTF-8-overlimit new text", value => { expect(() => message(value)).toThrow("INVALID_MESSAGE"); });
  it("accepts the exact UTF-8 text boundary", () => { expect(message("é".repeat(8000))).toHaveLength(8000); });
  it("does not blindly retry ambiguous submit or fabricate a local reply", async () => { const f = runtimeMock(); f.client.submit.mockRejectedValue(new Error("ambiguous")); await expect(chat(f.client, config, { requestId: "same-key", message: "text" })).rejects.toThrow("ambiguous"); expect(f.client.submit).toHaveBeenCalledOnce(); expect(f.client.start).not.toHaveBeenCalled(); });
  it("fresh observation carries both attempt and sequence without restarting", async () => { const f = runtimeMock(); expect(await observe(f.client, "run-one", { cursor: 7, attemptNumber: 3, finalOnly: true })).toBe(f.observation); expect(f.client.observe).toHaveBeenCalledWith(f.handle, { cursor: { sequence: 7, attemptNumber: 3 }, finalOnly: true }); expect(f.client.start).not.toHaveBeenCalled(); });
  it.each([{ cursor: 1 }, { cursor: -1, attemptNumber: 1 }, { cursor: 0, attemptNumber: -1 }])("rejects unpaired/invalid cursor %j", async cursor => { const f = runtimeMock(); await expect(observe(f.client, "run-one", cursor)).rejects.toThrow("INVALID_CURSOR"); expect(f.client.observe).not.toHaveBeenCalled(); });
  it("watch releases a synchronous terminal subscription and emits the durable result", async () => { const f = runtimeMock(), update = vi.fn(); await watch(f.client, f.handle, update); expect(update).toHaveBeenCalledWith(expect.objectContaining({ state: "complete" })); expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.cancel).not.toHaveBeenCalled(); });
  it("watch error releases observation without cancelling server work", async () => { const f = runtimeMock(); f.client.watchObservation.mockImplementation((_handle, _update, error) => { queueMicrotask(() => error?.(new CortexRuntimeError("FORBIDDEN"))); return f.unsubscribe; }); await expect(watch(f.client, f.handle, () => {})).rejects.toThrow("FORBIDDEN"); expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.cancel).not.toHaveBeenCalled(); });
});
