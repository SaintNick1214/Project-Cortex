import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCodeRuntime } from "@/lib/code-runtime";

describe("actual code runtime readiness", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("loadPyodide", undefined); });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("loads the pinned runtime when already available", async () => {
    const runtime = { runPythonAsync: vi.fn() };
    const load = vi.fn().mockResolvedValue(runtime);
    vi.stubGlobal("loadPyodide", load);
    expect(await loadCodeRuntime()).toBe(runtime);
    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not execute code before the actual loader export becomes ready", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn().mockResolvedValue({ runPythonAsync: execute });
    const result = loadCodeRuntime().then(runtime => runtime.runPythonAsync("print('ready')"));
    expect(execute).not.toHaveBeenCalled();
    vi.stubGlobal("loadPyodide", load);
    await vi.advanceTimersByTimeAsync(50);
    await result;
    expect(execute).toHaveBeenCalledExactlyOnceWith("print('ready')");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("reports bounded unavailable runtime without executing user code", async () => {
    const result = expect(loadCodeRuntime()).rejects.toThrow("Python runtime did not load");
    await vi.advanceTimersByTimeAsync(30000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
