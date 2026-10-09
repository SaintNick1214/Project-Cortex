import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { clock, installMockRoot, transcriptFixture } from "../runtimeTranscript/fixture";
const client = await import("../../../convex-dev/runtimeClient");
beforeEach(() => { installMockRoot(); jest.spyOn(Date, "now").mockReturnValue(clock); });
afterEach(() => { jest.restoreAllMocks(); });

it("private session is a fresh mutation and returns only its actual server grant deadline", async () => {
  const f = await transcriptFixture(); expect(client.session.isMutation).toBe(true); expect(client.session).not.toHaveProperty("isQuery");
  expect(await f.call(client.session, {})).not.toHaveProperty("deliveryExpiresAt");
  f.grant.expiresAt = clock + 50;
  expect(await f.call(client.session, {})).toMatchObject({ version: 1, deliveryExpiresAt: clock + 50 });
  const before = JSON.stringify([...f.db.rows]), writes = f.db.writes;
  jest.spyOn(Date, "now").mockReturnValue(clock + 51);
  await expect(f.call(client.session, {})).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(JSON.stringify([...f.db.rows])).toBe(before); expect(f.db.writes).toBe(writes);
});

it("the only subscription DTO is opaque metadata and changes for output beyond the first page", async () => {
  const f = await transcriptFixture(), run = await f.run();
  const owned = f.db.seed("runtimeAgentExecutions", { tenantId: run.scope.tenantId, memorySpaceId: run.scope.memorySpaceId,
    runId: run.runId, attemptNumber: run.attemptNumber, reference: f.reference, state: "running", streaming: true,
    sourceWitnesses: [], artifactContextWitnesses: [], mediaJobReferences: [], nextOutputSequence: 1, updatedAt: clock });
  const first = await f.call<{ version: 1; marker: string }>(client.signal, { runId: run.runId });
  expect(Object.keys(first).sort()).toEqual(["marker", "version"]); expect(first.marker).toMatch(/^[a-f0-9]{64}$/);
  const writes = f.db.writes;
  owned.nextOutputSequence = 250;
  const next = await f.call<{ version: 1; marker: string }>(client.signal, { runId: run.runId });
  expect(next.marker).not.toBe(first.marker); expect(f.db.writes).toBe(writes);
  expect(JSON.stringify(next)).not.toContain("inputMessageIds"); expect(JSON.stringify(next)).not.toContain("parts");
});

it("a signal shares fresh observer permissions and reports retention without private text", async () => {
  const f = await transcriptFixture(), run = await f.run();
  const conversation = f.db.table("runtimeConversations")[0]; conversation.retentionUntil = clock + 20;
  expect(await f.call(client.signal, { runId: run.runId })).toMatchObject({ version: 1, deliveryExpiresAt: clock + 20 });
  jest.spyOn(Date, "now").mockReturnValue(clock + 21);
  await expect(f.call(client.signal, { runId: run.runId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});
