import { it, expect, vi, afterEach } from "vitest";
import { createCli, main } from "../index.js";
import { PassThrough } from "node:stream";
import { config, runtimeMock } from "./helpers/test-utils.js";
import type { RuntimeObservation } from "@cortexmemory/sdk/runtime";
import { CortexRuntimeError } from "../cortex.js";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function streamingCli(signal?: AbortSignal) {
  const f = runtimeMock(), log = vi.spyOn(console, "log").mockImplementation(() => {}), write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  let update = (_value: RuntimeObservation) => {}, failure: ((error: CortexRuntimeError) => void) | undefined;
  f.client.watchObservation.mockImplementation((_handle, callback, onError) => { update = callback; failure = onError; return f.unsubscribe; });
  const cli = createCli({ config, factory: () => f.client, fetchToken: async () => "opaque-host-token", signal });
  const emit = (parts: RuntimeObservation["parts"], status: RuntimeObservation["run"]["responseStatus"] = "running", extra: Partial<RuntimeObservation> = {}) => {
    update({ ...f.observation, run: { ...f.run, responseStatus: status }, state: status, parts, cursor: parts.at(-1)?.sequence ?? 0, ...extra });
  };
  return { ...f, cli, emit, fail: (error: CortexRuntimeError) => failure?.(error), log, write,
    output: () => write.mock.calls.map(call => String(call[0])).join("") };
}
it("ordinary CLI text submits once and displays deltas within the same owned client without repeating canonical final text", async () => {
  const f = streamingCli(), pending = f.cli("hello from the CLI"); await tick();
  expect(f.client.submitAndStart).toHaveBeenCalledOnce();
  expect(f.client.submitAndStart.mock.calls[0][0]).toMatchObject({ parts: [{ type: "text", text: "hello from the CLI" }] });
  expect(f.client.watchObservation).toHaveBeenCalledOnce(); expect(f.client.close).not.toHaveBeenCalled();
  f.emit([{ sequence: 1, part: { type: "text-delta", text: "hel" } }]);
  expect(f.output()).toBe("hel"); expect(f.client.close).not.toHaveBeenCalled();
  f.emit([{ sequence: 1, part: { type: "text-delta", text: "hel" } }, { sequence: 2, part: { type: "text-delta", text: "lo" } }]);
  f.emit([{ sequence: 3, part: { type: "text", text: "hello" } }], "complete");
  await pending;
  expect(f.output()).toBe("hello"); expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.close).toHaveBeenCalledOnce();
  expect(f.client.start).not.toHaveBeenCalled(); expect(f.client.get).not.toHaveBeenCalled(); expect(f.client.recall).not.toHaveBeenCalled();
});
it("ordinary CLI response drains a full terminal cursor page before closing and prints only the missing final suffix", async () => {
  const f = streamingCli(), pending = f.cli("drain the backend answer"); await tick();
  f.emit(Array.from({ length: 100 }, (_, i) => ({ sequence: i + 1, part: { type: "text-delta", text: "a" } })), "complete");
  await tick(); expect(f.client.close).not.toHaveBeenCalled(); expect(f.unsubscribe).not.toHaveBeenCalled();
  f.emit([{ sequence: 101, part: { type: "text", text: "a".repeat(100) + "z" } }], "complete"); await pending;
  expect(f.output()).toBe("a".repeat(100) + "z"); expect(f.client.close).toHaveBeenCalledOnce(); expect(f.unsubscribe).toHaveBeenCalledOnce();
  expect(f.client.submitAndStart).toHaveBeenCalledOnce();
});
it.each([{ approvals: [] }, { approvals: [{ operationId: "op", toolName: "memory_recall", requestHash: "hash" }] }])("ordinary CLI approval wait releases observation without approval or redispatch %j", async ({ approvals }) => {
  const f = streamingCli(), pending = f.cli("approval-sensitive input"); await tick();
  f.emit([], "waiting_approval", { approvals }); await pending;
  expect(f.output()).toBe(""); expect(f.client.approveInput).not.toHaveBeenCalled(); expect(f.client.approveTool).not.toHaveBeenCalled();
  expect(f.client.start).not.toHaveBeenCalled(); expect(f.client.cancel).not.toHaveBeenCalled(); expect(f.client.submitAndStart).toHaveBeenCalledOnce();
  expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.close).toHaveBeenCalledOnce();
  expect(f.log.mock.calls.flat().join(" ")).toContain("waiting_approval");
});
it("ordinary CLI denied observation closes ownership and never retries accepted input", async () => {
  const f = streamingCli(), pending = f.cli("one governed input"); await tick();
  const assertion = expect(pending).rejects.toMatchObject({ code: "FORBIDDEN" }); f.fail(new CortexRuntimeError("FORBIDDEN")); await assertion;
  expect(f.client.submitAndStart).toHaveBeenCalledOnce(); expect(f.output()).toBe(""); expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.close).toHaveBeenCalledOnce();
  expect(f.client.cancel).not.toHaveBeenCalled();
});
it("ordinary CLI displays a changed canonical answer once with an explicit correction label", async () => {
  const f = streamingCli(), pending = f.cli("canonical correction"); await tick();
  f.emit([{ sequence: 1, part: { type: "text-delta", text: "draft" } }]);
  f.emit([{ sequence: 2, part: { type: "text", text: "corrected " } }]);
  f.emit([{ sequence: 3, part: { type: "text", text: "answer" } }], "complete"); await pending;
  expect(f.output()).toBe("draft\nFinal answer:\ncorrected answer"); expect(f.unsubscribe).toHaveBeenCalledOnce();
});
it("ordinary CLI composes fragmented final pages then labels a strict-prefix truncation exactly once", async () => {
  const f = streamingCli(), pending = f.cli("canonical truncation"); await tick();
  f.emit([{ sequence: 1, part: { type: "text-delta", text: "Hello! Extra draft" } }]);
  f.emit([{ sequence: 2, part: { type: "text", text: "Hel" } }]);
  expect(f.output()).toBe("Hello! Extra draft");
  const fullFinalPage: RuntimeObservation["parts"] = [{ sequence: 3, part: { type: "text", text: "lo" } },
    ...Array.from({ length: 99 }, (_, i) => ({ sequence: i + 4, part: { type: "status" as const, state: "complete" } }))];
  f.emit(fullFinalPage, "complete"); await tick();
  expect(f.output()).toBe("Hello! Extra draft"); expect(f.client.close).not.toHaveBeenCalled();
  f.emit([{ sequence: 103, part: { type: "text", text: "!" } }], "complete"); await pending;
  expect(f.output()).toBe("Hello! Extra draft\nFinal answer:\nHello!");
  f.emit([{ sequence: 104, part: { type: "text", text: "late forbidden text" } }], "complete");
  expect(f.output()).toBe("Hello! Extra draft\nFinal answer:\nHello!"); expect(f.unsubscribe).toHaveBeenCalledOnce();
});
it("matching incomplete final chunks never manufacture a correction before their final suffix", async () => {
  const f = streamingCli(), pending = f.cli("fragmented suffix"); await tick();
  f.emit([{ sequence: 1, part: { type: "text-delta", text: "Hello" } }]);
  f.emit([{ sequence: 2, part: { type: "text", text: "Hel" } }]);
  expect(f.output()).toBe("Hello");
  f.emit([{ sequence: 3, part: { type: "text", text: "lo" } }, { sequence: 4, part: { type: "text", text: "!" } }], "complete"); await pending;
  expect(f.output()).toBe("Hello!"); expect(f.output()).not.toContain("Final answer");
});
it("aborting an in-flight ordinary command immediately unsubscribes/closes and suppresses later output without backend cancellation", async () => {
  const controller = new AbortController(), f = streamingCli(controller.signal), pending = f.cli("one command"); await tick();
  const assertion = expect(pending).rejects.toMatchObject({ code: "REQUEST_ABORTED" }); controller.abort(); await assertion;
  expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.close).toHaveBeenCalledOnce();
  f.emit([{ sequence: 1, part: { type: "text-delta", text: "late private reply" } }]);
  expect(f.output()).toBe(""); expect(f.client.cancel).not.toHaveBeenCalled(); expect(f.client.submitAndStart).toHaveBeenCalledOnce();
});
it.each(["SIGINT", "SIGTERM"] as const)("main's first owned %s signal promptly exits an active watch and cleans listeners", async name => {
  const f = streamingCli(), input = new PassThrough(), output = new PassThrough();
  const initialInt = process.listeners("SIGINT"), initialTerm = process.listeners("SIGTERM");
  const pending = main({ config, factory: () => f.client, fetchToken: async () => "opaque-host-token", input, output });
  input.write("one main command\n"); await tick();
  expect(f.client.watchObservation).toHaveBeenCalledOnce();
  const initial = name === "SIGINT" ? initialInt : initialTerm;
  const owned = process.listeners(name).find(listener => !initial.includes(listener));
  expect(owned).toBeTypeOf("function"); (owned as () => void)(); await pending;
  expect(f.unsubscribe).toHaveBeenCalledOnce(); expect(f.client.close).toHaveBeenCalledOnce();
  expect(process.listeners("SIGINT")).toEqual(initialInt); expect(process.listeners("SIGTERM")).toEqual(initialTerm);
  f.emit([{ sequence: 1, part: { type: "text-delta", text: "late private main reply" } }]); expect(f.output()).toBe("");
  expect(f.client.cancel).not.toHaveBeenCalled(); expect(f.client.submitAndStart).toHaveBeenCalledOnce();
  input.destroy(); output.destroy();
});
it("opt-in CLI timing records submission before auth and first flushed answer bytes, excluding request/status and prompt/token data", async () => {
  vi.stubEnv("CORTEX_RUNTIME_LATENCY_TRACE", "1");
  const diagnostics = vi.spyOn(console, "error").mockImplementation(() => {});
  const f = streamingCli(), pending = f.cli("PRIVATE_INPUT_TRACE_SENTINEL"); await tick();
  const traces = () => diagnostics.mock.calls.flat().filter((item): item is string => typeof item === "string" && item.startsWith('{"type":"cortex-cli-latency"')).map(item => JSON.parse(item));
  expect(traces().map(event => event.phase)).toEqual(["submit.begin"]);
  let flushed = () => {};
  f.write.mockImplementation(((text: string, callback?: () => void) => { if (typeof callback === "function") flushed = callback; return true; }) as typeof process.stdout.write);
  f.emit([{ sequence: 1, part: { type: "text-delta", text: "PRIVATE_OUTPUT_TRACE_SENTINEL" } }]);
  expect(traces().map(event => event.phase)).toEqual(["submit.begin"]); flushed();
  f.emit([], "complete"); await pending;
  expect(traces().map(event => event.phase)).toEqual(["submit.begin", "answer.first_printed"]);
  expect(traces()[1]).toMatchObject({ version: 1, method: "cli.chat", commandId: 1, durationMs: expect.any(Number) });
  expect(traces()[1].durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(traces())).not.toMatch(/PRIVATE_INPUT|PRIVATE_OUTPUT|opaque-host-token|Request ID/);
  expect(f.output()).toBe("PRIVATE_OUTPUT_TRACE_SENTINEL");
});
it("leading whitespace prints normally but first-visible timing waits for flushed non-whitespace answer", async () => {
  vi.stubEnv("CORTEX_RUNTIME_LATENCY_TRACE", "1");
  const diagnostics = vi.spyOn(console, "error").mockImplementation(() => {}), f = streamingCli(), pending = f.cli("visible answer"); await tick();
  let flushed = () => {};
  f.write.mockImplementation(((text: string, callback?: () => void) => { if (typeof callback === "function") flushed = callback; return true; }) as typeof process.stdout.write);
  f.emit([{ sequence: 1, part: { type: "text-delta", text: " \n" } }]);
  expect(diagnostics.mock.calls.flat().join(" ")).not.toContain("answer.first_printed");
  f.emit([{ sequence: 2, part: { type: "text-delta", text: "answer" } }]);
  expect(diagnostics.mock.calls.flat().join(" ")).not.toContain("answer.first_printed"); flushed();
  expect(diagnostics.mock.calls.flat().filter(item => String(item).includes("answer.first_printed"))).toHaveLength(1);
  f.emit([{ sequence: 3, part: { type: "text", text: " \nanswer" } }], "complete"); await pending;
  expect(f.output()).toBe(" \nanswer");
});
it("CLI timing uses a finite monotonic fallback for both submission and first printed text", async () => {
  vi.stubEnv("CORTEX_RUNTIME_LATENCY_TRACE", "1");
  const diagnostics = vi.spyOn(console, "error").mockImplementation(() => {});
  const clock = vi.spyOn(performance, "now").mockReturnValue(Number.NaN), wall = vi.spyOn(Date, "now").mockReturnValue(100);
  try {
    const f = streamingCli(), pending = f.cli("fallback clock"); await tick();
    let flushed = () => {};
    f.write.mockImplementation(((text: string, callback?: () => void) => { if (typeof callback === "function") flushed = callback; return true; }) as typeof process.stdout.write);
    wall.mockReturnValue(90); f.emit([{ sequence: 1, part: { type: "text-delta", text: "answer" } }]); flushed();
    f.emit([], "complete"); await pending;
    const events = diagnostics.mock.calls.flat().map(item => JSON.parse(String(item)));
    expect(events).toMatchObject([{ phase: "submit.begin", atMs: 100 }, { phase: "answer.first_printed", atMs: 100, durationMs: 0 }]);
    expect(f.output()).toBe("answer"); expect(f.client.close).toHaveBeenCalledOnce();
  } finally { clock.mockRestore(); wall.mockRestore(); }
});
it("CLI diagnostics stay off by default while the ordinary response is displayed", async () => {
  vi.stubEnv("CORTEX_RUNTIME_LATENCY_TRACE", ""); const f = streamingCli(), pending = f.cli("plain text"); await tick();
  f.emit([{ sequence: 1, part: { type: "text", text: "answer" } }], "complete"); await pending;
  expect(f.output()).toBe("answer"); expect(f.log.mock.calls.flat().join(" ")).not.toContain("latency");
});
it("CLI sends a stable key, retains the server conversation, and closes every command", async () => {
  const f = runtimeMock(), log = vi.spyOn(console, "log").mockImplementation(() => {});
  const cli = createCli({ config, factory: () => f.client, fetchToken: async () => "host-jwt" });
  await cli("/send caller-key first message"); await cli("/send next-key second message");
  expect(f.client.submitAndStart.mock.calls.map(call => call[0].clientRequestId)).toEqual(["caller-key", "next-key"]);
  expect(f.client.submitAndStart.mock.calls[1][0].conversationId).toBe("conversation-one");
  expect(f.client.close).toHaveBeenCalledTimes(2); expect(log.mock.calls.flat().join(" ")).not.toContain("host-jwt");
  expect(f.client.watchObservation).not.toHaveBeenCalled();
  await cli("/new"); await cli("/send third-key third message"); expect(f.client.submitAndStart.mock.calls[2][0]).not.toHaveProperty("conversationId");
});
it("CLI observation/readiness/history/approval/cancel use registered methods without a model loop", async () => {
  const f = runtimeMock(); vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const cli = createCli({ config, factory: () => f.client, fetchToken: async () => "host-jwt" });
  await cli("/observe run-one"); await cli("/history"); await cli("/readiness"); await cli("/profile");
  await cli("/approve-tool op memory_recall exact-hash"); await cli("/cancel");
  expect(f.client.messages).toHaveBeenCalledWith("conversation-one"); expect(f.client.memoryReadiness).toHaveBeenCalledOnce();
  expect(f.client.approveTool).toHaveBeenCalledWith(f.handle, { operationId: "op", toolName: "memory_recall", requestHash: "exact-hash" });
  expect(f.client.cancel).toHaveBeenCalledWith(f.handle); expect(f.client.submitAndStart).not.toHaveBeenCalled(); expect(f.client.recall).not.toHaveBeenCalled();
  expect(f.client.close).toHaveBeenCalledTimes(6);
});
it("CLI unknown commands never submit and exit creates no connection", async () => {
  const f = runtimeMock(), factory = vi.fn(() => f.client), cli = createCli({ config, factory, fetchToken: async () => "token" });
  await expect(cli("/unknown")).rejects.toThrow("UNKNOWN_COMMAND"); expect(f.client.submitAndStart).not.toHaveBeenCalled(); expect(f.client.close).toHaveBeenCalledOnce();
  expect(await cli("/exit")).toBe(false); expect(factory).toHaveBeenCalledOnce();
});
