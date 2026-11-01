import { it, expect, vi, afterEach } from "vitest";
import { createCli } from "../index.js";
import { config, runtimeMock } from "./helpers/test-utils.js";
afterEach(() => { vi.restoreAllMocks(); });
it("CLI sends a stable key, retains the server conversation, and closes every command", async () => {
  const f = runtimeMock(), log = vi.spyOn(console, "log").mockImplementation(() => {});
  const cli = createCli({ config, factory: () => f.client, fetchToken: async () => "host-jwt" });
  await cli("/send caller-key first message"); await cli("/send next-key second message");
  expect(f.client.submit.mock.calls.map(call => call[0].clientRequestId)).toEqual(["caller-key", "next-key"]);
  expect(f.client.submit.mock.calls[1][0].conversationId).toBe("conversation-one");
  expect(f.client.close).toHaveBeenCalledTimes(2); expect(log.mock.calls.flat().join(" ")).not.toContain("host-jwt");
  await cli("/new"); await cli("/send third-key third message"); expect(f.client.submit.mock.calls[2][0]).not.toHaveProperty("conversationId");
});
it("CLI observation/readiness/history/approval/cancel use registered methods without a model loop", async () => {
  const f = runtimeMock(); vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const cli = createCli({ config, factory: () => f.client, fetchToken: async () => "host-jwt" });
  await cli("/observe run-one"); await cli("/history"); await cli("/readiness"); await cli("/profile");
  await cli("/approve-tool op memory_recall exact-hash"); await cli("/cancel");
  expect(f.client.messages).toHaveBeenCalledWith("conversation-one"); expect(f.client.memoryReadiness).toHaveBeenCalledOnce();
  expect(f.client.approveTool).toHaveBeenCalledWith(f.handle, { operationId: "op", toolName: "memory_recall", requestHash: "exact-hash" });
  expect(f.client.cancel).toHaveBeenCalledWith(f.handle); expect(f.client.submit).not.toHaveBeenCalled(); expect(f.client.recall).not.toHaveBeenCalled();
  expect(f.client.close).toHaveBeenCalledTimes(6);
});
it("CLI unknown commands never submit and exit creates no connection", async () => {
  const f = runtimeMock(), factory = vi.fn(() => f.client), cli = createCli({ config, factory, fetchToken: async () => "token" });
  await expect(cli("/unknown")).rejects.toThrow("UNKNOWN_COMMAND"); expect(f.client.submit).not.toHaveBeenCalled(); expect(f.client.close).toHaveBeenCalledOnce();
  expect(await cli("/exit")).toBe(false); expect(factory).toHaveBeenCalledOnce();
});
