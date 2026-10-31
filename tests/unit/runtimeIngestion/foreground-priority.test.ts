import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ingestionFixture, ingestion, installIngestionMockRoot } from "./fixture";
import { definitions, runs } from "../runtimeTranscript/fixture";
const priority = await import("../../../convex-dev/runtimeIngestionPriority");
type Fixture = Awaited<ReturnType<typeof ingestionFixture>>;

async function setup(options: { strict?: boolean; legacy?: boolean; key?: string; beforeSubmit?: (f: Fixture) => void } = {}) {
  const f = await ingestionFixture();
  const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
    memorySpaceId: "space-a", clientMutationId: "priority-definition", expectedPreviousVersion: 0,
    definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context,
      ...(options.legacy ? {} : { handlerId: "cortex.transcript.relevant", registryHash: await definitions.executableRegistryHashV3() }),
      ...(options.strict ? { memoryMode: "strict", requiredStages: ["facts"] } : {}) } } });
  options.beforeSubmit?.(f);
  const result = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: { ...f.request(options.key ?? "priority-run"), agentId: published.agentId, agentVersion: published.version } });
  const run = (await f.ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", f.reference.tenantId)
    .eq("memorySpaceId", f.reference.memorySpaceId!).eq("runId", result.runId)).unique())!;
  const definition = await definitions.readCurrentExecutableDefinition(f.ctx, f.reference, published, { capability: "run" });
  // Original submit/registerMessages already materializes this canonical input.
  // Do not invent a second source event for its native message identity.
  const event = f.db.table("runtimeIngestionEvents").find(row => row.runId === run.runId && row.nativeMessageId === run.inputMessageIds[0]);
  if (!event || typeof event.eventId !== "string") throw new Error("Original canonical input event missing");
  const eventId = event.eventId;
  const hold = () => f.transaction(() => priority.holdForegroundIngestion(f.ctx, run, definition));
  return { ...f, run, definition, eventId, hold,
    marker: () => f.db.table("runtimeIngestionForegroundPriority")[0],
    event: async () => (await ingestion.eventById(f.ctx, f.reference, eventId))!,
    stage: async () => (await ingestion.readEventStages(f.ctx, (await ingestion.eventById(f.ctx, f.reference, eventId))!)).find(s => s.stage === "extract")! };
}
beforeEach(() => { installIngestionMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });

describe("original native ingestion claim with foreground scheduling metadata", () => {
  test("original submit atomically installs the hold and original cancel retirement releases it", async () => {
    const f = await setup(); expect(f.marker()).toMatchObject({ state: "held", runDocId: f.run._id, captureAt: f.run.createdAt,
      deadline: f.run.createdAt + 5000, nativeMessageIds: f.run.inputMessageIds });
    expect(await f.claim(f.eventId)).toBeNull(); const before = await f.stage();
    const cancelled = await f.call<ReturnType<typeof runs.publicRun>>(runs.cancel, { runId: f.run.runId });
    expect(cancelled.responseStatus).toBe("cancelled"); expect(f.marker().state).toBe("released");
    expect(await f.stage()).toEqual(before); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  });
  test("defers only unstarted work before job/budget/lease; replay does not extend deadline", async () => {
    const f = await setup(), beforeAccounts = structuredClone(f.db.table("runtimeBudgetAccounts"));
    const held = await f.hold(); expect(held).toEqual({ held: true, deadline: f.run.createdAt + 5000 });
    expect(await f.claim(f.eventId)).toBeNull(); expect(await f.stage()).toMatchObject({ state: "pending", attempt: 0, leaseVersion: 0 });
    expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
    expect(f.db.table("runtimeBudgetAccounts")).toEqual(beforeAccounts);
    jest.spyOn(Date, "now").mockReturnValue(f.run.createdAt + 1000);
    expect(await f.hold()).toEqual(held);
    const expires = f.scheduled.filter(row => row.name === "runtimeIngestionPriority:expireForeground");
    expect(expires).toHaveLength(1);
  });
  test("fallback progresses after foreground crash using ORIGINAL claim and one unchanged intent", async () => {
    const f = await setup(); await f.hold(); expect(await f.claim(f.eventId)).toBeNull();
    jest.spyOn(Date, "now").mockReturnValue(f.run.createdAt + 5000);
    await f.call(priority.expireForeground, { tenantId: f.run.tenantId, memorySpaceId: f.run.memorySpaceId, runId: f.run.runId, deadline: f.run.createdAt + 5000 });
    expect(f.marker()).toMatchObject({ state: "released", deadline: f.run.createdAt + 5000 });
    expect(await f.claim(f.eventId)).toMatchObject({ attempt: 1, leaseVersion: 1 });
    expect(f.db.table("runtimeIngestionJobs")).toHaveLength(1);
    const active = (await f.stage()); expect(active.state).toBe("running");
    await f.call(priority.expireForeground, { tenantId: f.run.tenantId, memorySpaceId: f.run.memorySpaceId, runId: f.run.runId, deadline: f.run.createdAt + 5000 });
    expect(await f.stage()).toEqual(active); expect(await f.claim(f.eventId)).toBeNull();
  });
  test("early/wrong-deadline callbacks cannot release and released markers never renew", async () => {
    const f = await setup(); await f.hold();
    await f.call(priority.expireForeground, { tenantId: f.run.tenantId, memorySpaceId: f.run.memorySpaceId, runId: f.run.runId, deadline: f.run.createdAt + 5000 });
    expect(f.marker().state).toBe("held");
    jest.spyOn(Date, "now").mockReturnValue(f.run.createdAt + 5000);
    await f.call(priority.expireForeground, { tenantId: f.run.tenantId, memorySpaceId: f.run.memorySpaceId, runId: f.run.runId, deadline: f.run.createdAt + 6000 });
    expect(f.marker().state).toBe("held");
    await priority.releaseForegroundIngestion(f.ctx, f.run, f.run.runId);
    expect((await f.hold()).held).toBe(false);
  });
  test.each([{ strict: true }, { legacy: true }])("strict/custom legacy path is never held: %j", async options => {
    const f = await setup(options); expect(await f.hold()).toEqual({ held: false });
    expect(await f.claim(f.eventId)).toMatchObject({ attempt: 1 }); expect(f.marker()).toBeUndefined();
  });
  test("explicit capture/non-Agent source has no run binding and retains original claim", async () => {
    const f = await setup(); await f.hold(); const source = await f.source("Another assertion", "explicit-source");
    const explicit = await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
    expect(await f.claim(explicit.eventId)).toMatchObject({ attempt: 1 });
    expect(await f.claim(f.eventId)).toBeNull();
  });
  test.each(["running", "unknown", "complete", "failed", "dead_letter"] as const)("%s stage and its financial state are untouched", async state => {
    const f = await setup(); await f.hold(); const stage = await f.stage();
    await f.ctx.db.patch("runtimeIngestionStages", stage._id, { state, attempt: 1, leaseVersion: 1, leaseExpiresAt: f.run.createdAt + 10000 });
    const before = await f.stage(); expect(await f.claim(f.eventId)).toBeNull(); expect(await f.stage()).toEqual(before);
    expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0);
  });
  test("existing job/unreserved wait is not deferred or re-leased", async () => {
    const f = await setup(); await priority.releaseForegroundIngestion(f.ctx, f.run, f.run.runId);
    const owned = await f.claim(f.eventId); expect((await f.hold()).held).toBe(false);
    expect(owned).toMatchObject({ attempt: 1 }); const stage = await f.stage();
    await f.ctx.db.patch("runtimeIngestionStages", stage._id, { state: "pending", capacityWait: { deadline: f.run.createdAt + 10000, notBefore: f.run.createdAt + 1000, wakes: 1 } });
    expect(await priority.deferForegroundStage(f.ctx, await f.event(), await f.stage())).toBe(false);
  });
  test.each(["cancel", "delete", "foreign-owner", "foreign-native", "wrong-epoch", "foreign-grant"])("changed parent binding bypasses hint; original fences retained: %s", async change => {
    const f = await setup(); await f.hold();
    if (change === "cancel") await f.ctx.db.patch("runtimeRuns", f.run._id, { cancellationRequestedAt: f.run.createdAt });
    if (change === "delete") await f.ctx.db.patch("runtimeRuns", f.run._id, { tombstonedAt: f.run.createdAt });
    const event = await f.event();
    if (change === "foreign-owner") await f.ctx.db.patch("runtimeIngestionEvents", event._id, { ownerPrincipalId: "other" });
    if (change === "foreign-native") await f.ctx.db.patch("runtimeIngestionEvents", event._id, { nativeMessageId: "other" });
    if (change === "wrong-epoch") await f.ctx.db.patch("runtimeIngestionEvents", event._id, { conversationEpoch: event.conversationEpoch! + 1 });
    if (change === "foreign-grant") await f.ctx.db.patch("runtimeIngestionEvents", event._id,
      { authorityReference: { ...event.authorityReference, grantId: "other" } });
    expect(await priority.deferForegroundStage(f.ctx, await f.event(), await f.stage())).toBe(false);
  });
  test("source edit/revocation still deny BEFORE deferral and no stage/job changes commit", async () => {
    const f = await setup(); await f.hold(); const stage = await f.stage();
    await f.source("Edited text", (await f.event()).lineage.sourceId, 2);
    await expect(f.claim(f.eventId)).rejects.toMatchObject({ data: expect.objectContaining({ code: "STALE_SOURCE" }) });
    expect(await f.stage()).toEqual(stage); expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0);
    const g = await setup(); await g.hold(); g.grant.revokedAt = g.run.createdAt;
    await expect(g.claim(g.eventId)).rejects.toThrow(); expect(g.db.table("runtimeIngestionJobs")).toHaveLength(0);
  });
  test("strict promotion across conversations releases only through cutoff and publishes no readiness", async () => {
    const f = await setup(); await f.hold(); const event = await f.event(); const before = await f.stage();
    const result = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: { ...f.request("second-run"), agentId: f.run.agentId, agentVersion: f.run.agentVersion } });
    const other = (await f.ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", f.run.tenantId)
      .eq("memorySpaceId", f.run.memorySpaceId).eq("runId", result.runId)).unique())!;
    expect(other.conversationId).not.toBe(f.run.conversationId);
    await priority.holdForegroundIngestion(f.ctx, other, f.definition);
    const admitted = f.db.table("runtimeIngestionEvents").find(row => row.runId === other.runId && row.nativeMessageId === other.inputMessageIds[0]);
    if (!admitted || typeof admitted.sequence !== "number") throw new Error("Second canonical input event missing");
    expect(await priority.promoteForegroundIngestion(f.ctx, f.run, event.sequence - 1)).toEqual({ released: 0 });
    expect(f.marker().state).toBe("held");
    expect(await priority.promoteForegroundIngestion(f.ctx, f.run, event.sequence)).toEqual({ released: 1 });
    expect(f.db.table("runtimeIngestionForegroundPriority").find(row => row.runId === other.runId)?.state).toBe("held");
    expect(await priority.promoteForegroundIngestion(f.ctx, f.run, admitted.sequence)).toEqual({ released: 1 });
    expect(await f.stage()).toEqual(before); expect((await f.event()).factsState).toBe("pending");
    expect(await f.claim(f.eventId)).toMatchObject({ attempt: 1 });
  });
  test("admission fallback scheduler failure rolls back marker; release fault rolls back publication", async () => {
    const f = await setup(), original = f.ctx.scheduler.runAfter.bind(f.ctx.scheduler);
    jest.spyOn(f.ctx.scheduler, "runAfter").mockImplementation(original).mockRejectedValueOnce(new Error("wake unavailable"));
    await expect(f.transaction(() => priority.releaseForegroundIngestion(f.ctx, f.run, f.run.runId))).rejects.toThrow("wake unavailable");
    expect(f.marker().state).toBe("held");
  });
  test("fallback scheduler fault inside actual submit rolls back run/transcript/source/marker", async () => {
    let fixture: Fixture | undefined;
    await expect(setup({ beforeSubmit: f => {
      fixture = f; const original = f.ctx.scheduler.runAfter.bind(f.ctx.scheduler);
      jest.spyOn(f.ctx.scheduler, "runAfter").mockImplementation((async (delay, reference, args) => {
        if ((await import("convex/server")).getFunctionName(reference) === "runtimeIngestionPriority:expireForeground") throw new Error("fallback unavailable");
        return await original(delay, reference, args);
      }) as typeof f.ctx.scheduler.runAfter);
    } })).rejects.toThrow("fallback unavailable");
    if (!fixture) throw new Error("Actual submit fixture did not initialize");
    for (const table of ["runtimeRuns", "runtimeTranscriptMessages", "runtimeMemorySources", "runtimeIngestionEvents", "runtimeIngestionForegroundPriority"]) expect(fixture.db.table(table)).toHaveLength(0);
    expect(fixture.native.messages.size).toBe(0);
    expect(fixture.scheduled).toHaveLength(0);
  });
  test("missing/mismatched authoritative definition and expired capture use original path", async () => {
    const f = await setup(); expect(await priority.holdForegroundIngestion(f.ctx, f.run)).toEqual({ held: false });
    expect(await priority.holdForegroundIngestion(f.ctx, f.run, { ...f.definition, definitionHash: "wrong" })).toEqual({ held: false });
    jest.spyOn(Date, "now").mockReturnValue(f.run.createdAt + 5001);
    // The original automatic marker remains durably recorded until its scheduled
    // callback; replay cannot renew it, and expiration already bypasses deferral.
    expect(await f.hold()).toEqual({ held: true, deadline: f.run.createdAt + 5000 });
    expect(await f.claim(f.eventId)).toMatchObject({ attempt: 1 });
  });
  test("scope capacity is finite; overflow takes original path", async () => {
    const f = await setup({ beforeSubmit: f => { for (let index = 0; index < 256; index++) f.db.seed("runtimeIngestionForegroundPriority", { tenantId: f.reference.tenantId,
      memorySpaceId: f.reference.memorySpaceId, runId: `other-${index}`, state: "held" }); } });
    expect(await f.hold()).toEqual({ held: false }); expect(await f.claim(f.eventId)).toMatchObject({ attempt: 1 });
  });
});
