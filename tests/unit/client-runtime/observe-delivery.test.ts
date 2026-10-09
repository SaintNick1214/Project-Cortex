import { afterEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { CortexRuntimeClient } from "../../../src/client-runtime/client";
import type { RuntimeClientPort } from "../../../src/client-runtime/client";
import type { RuntimeRun, RuntimeRunHandle } from "../../../src/client-runtime/types";

afterEach(() => { jest.restoreAllMocks(); });
const actor = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "viewer", userId: "viewer" };
const handle: RuntimeRunHandle = { ...actor, version: 1, runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1, definitionHash: "hash" };
const run: RuntimeRun = { version: 1, runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1, definitionHash: "hash", scope: { tenantId: "tenant", memorySpaceId: "space" }, queueSequence: 1, responseStatus: "complete", memoryStatus: "complete", graphStatus: "not_requested", attemptNumber: 1, cancellationRequested: false, inputMessageIds: ["input"], outputMessageIds: ["output"], failureCode: null, contextCompleteness: "complete", contextFailureCode: null, createdAt: 1, updatedAt: 2 };
function fixture(cross: boolean) {
  const base = 1791520000000;
  const clock = jest.spyOn(Date, "now").mockReturnValue(base);
  let sessions = 0, observes = 0;
  const port = {
    setAuth: (_fetch: unknown, accepted: (value: boolean) => void) => accepted(true),
    query: async () => { throw new Error("PRIVATE_QUERY_PROHIBITED"); },
    mutation: async (ref: Parameters<RuntimeClientPort["mutation"]>[0]) => {
      if (getFunctionName(ref) === "runtimeClient:session") {
        sessions++;
        if (sessions === 2 && cross) clock.mockReturnValue(base + 101);
        return actor;
      }
      if (getFunctionName(ref) !== "runtimeAgent:observe") throw new Error("UNEXPECTED_RPC");
      observes++;
      return { run, state: "complete", parts: [{ sequence: 1, part: { type: "text", text: "private shared source" } }], cursor: 1, approvals: [], deliveryExpiresAt: base + 100 };
    },
    action: async () => { throw new Error("PAID_CALL_PROHIBITED"); },
    onUpdate: () => { throw new Error("UNEXPECTED_SUBSCRIPTION"); },
    close: async () => {},
  } as unknown as RuntimeClientPort;
  return { client: new CortexRuntimeClient({ deploymentUrl: "https://unit.invalid", fetchToken: async () => "opaque", client: port }), counts: () => ({ sessions, observes }) };
}
it("one-shot observe delivers current protected parts before their consumed share cutoff", async () => {
  const f = fixture(false);
  try {
    const result = await f.client.observe(handle);
    expect(result.parts).toEqual([{ sequence: 1, part: { type: "text", text: "private shared source" } }]);
    expect(f.counts()).toEqual({ sessions: 2, observes: 1 });
  } finally { await f.client.close(); }
});
it("one-shot observe withholds protected parts when consumed share expires during final actor-session RPC", async () => {
  const f = fixture(true);
  try {
    await expect(f.client.observe(handle)).rejects.toMatchObject({ code: "AUTHORITY_EXPIRED" });
    expect(f.counts()).toEqual({ sessions: 2, observes: 1 });
  } finally { await f.client.close(); }
});
