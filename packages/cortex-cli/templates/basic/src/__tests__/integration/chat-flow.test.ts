import { it, expect, vi } from "vitest";
import { createApp } from "../../server.js";
import type { RuntimeFactory } from "../../cortex.js";
import { config, runtimeMock } from "../helpers/test-utils.js";
it("parallel callers own distinct clients/tokens with no ambient cross-principal singleton", async () => {
  const a = runtimeMock("principal-a"), b = runtimeMock("principal-b"), tokens: string[] = [];
  let allocations = 0;
  const factory = vi.fn<RuntimeFactory>(settings => {
    const own = allocations++ === 0 ? a : b;
    own.client.session.mockImplementation(async () => { tokens.push(await settings.fetchToken({ forceRefreshToken: true }) ?? "missing"); return own.verified; });
    return own.client;
  });
  const app = createApp({ config, factory });
  const responses = await Promise.all(["a", "b"].map(actor => app.request("/chat", { method: "POST", headers: { Authorization: `Bearer jwt-${actor}`, "Content-Type": "application/json" }, body: JSON.stringify({ requestId: `key-${actor}`, message: `text-${actor}` }) })));
  expect(await responses[0].json()).toMatchObject({ handle: { principalId: "principal-a" } }); expect(await responses[1].json()).toMatchObject({ handle: { principalId: "principal-b" } });
  expect(a.client.close).toHaveBeenCalledOnce(); expect(b.client.close).toHaveBeenCalledOnce(); expect(tokens.filter(t => t === "jwt-a")).toHaveLength(2); expect(tokens.filter(t => t === "jwt-b")).toHaveLength(2);
  expect(a.client.submit.mock.calls[0][0].clientRequestId).toBe("key-a"); expect(b.client.submit.mock.calls[0][0].clientRequestId).toBe("key-b");
});
it("published memory remains pending after text submission and no app-side pipeline fills the hole", async () => {
  const f = runtimeMock(), app = createApp({ config, factory: () => f.client });
  const response = await app.request("/chat", { method: "POST", headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" }, body: JSON.stringify({ requestId: "stable", message: "new text", conversationId: "conversation-one" }) });
  expect(await response.json()).toMatchObject({ run: { memoryStatus: "pending" } }); expect(f.client.submit).toHaveBeenCalledOnce(); expect(f.client.recall).not.toHaveBeenCalled(); expect(f.client.messages).not.toHaveBeenCalled();
});
