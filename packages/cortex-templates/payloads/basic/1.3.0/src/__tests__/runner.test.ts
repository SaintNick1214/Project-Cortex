import { it, expect, vi } from "vitest";
import { ChildProcess } from "node:child_process";
import { runDev } from "../../dev-runner.mjs";
it("dev owns one application watcher and never starts/deploys Convex or graph containers", () => {
  const child = new ChildProcess(), kill = vi.spyOn(child, "kill").mockReturnValue(true), start = vi.fn(() => child);
  const beforeInt = process.listenerCount("SIGINT"), beforeTerm = process.listenerCount("SIGTERM");
  expect(runDev(start)).toBe(child); expect(start).toHaveBeenCalledExactlyOnceWith(process.execPath,
    ["--env-file-if-exists=.env.local", "--import", "tsx", "--watch", "src/server.ts"], { stdio: "inherit", env: process.env });
  child.emit("close", 0);
  expect(process.listenerCount("SIGINT")).toBe(beforeInt); expect(process.listenerCount("SIGTERM")).toBe(beforeTerm); expect(kill).not.toHaveBeenCalled(); kill.mockRestore();
});
