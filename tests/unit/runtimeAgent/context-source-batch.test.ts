/** Real original source/cutoff handlers with controlled native DB ports, no live latency claim. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ApiFromModules, FunctionArgs } from "convex/server";
import type { SourceContent } from "../../../src/domain/contracts";
import type { ContextSourceWitness } from "../../../src/domain/context-witness";
import { mergeContextWitness } from "../../../src/domain/context-witness";
import { contextSourceKey } from "../../../src/domain/memory-context";
import { assertNativeArgs } from "./native-arguments";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot } = await import("../runtimeIngestion/fixture");
const { clone } = await import("../runtimeTranscript/fixture");
const { ConvexMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const runtime = await import("../../../convex-dev/runtimeAgent");
type AgentApi = ApiFromModules<{ runtimeAgent: typeof runtime }>;
type Batch = FunctionArgs<AgentApi["runtimeAgent"]["contextSourceBatch"]>;
beforeEach(installIngestionMockRoot);
afterEach(() => { jest.restoreAllMocks(); });
async function fixture(count = 2) {
  const f = await ingestionFixture(), sources: SourceContent[] = [];
  for (let i = 0; i < count; i++) {
    const source = await f.source(`Bounded current source ${i}`, `source:${i}`);
    await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); sources.push(source);
  }
  const args: Batch = { reference: f.reference, items: sources.map(source => ({ sourceId: source.lineage.sourceId,
    expected: { sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash } })),
    excludedSourceKeys: [], cutoff: count, boundary: { conversationId: "another-conversation", runId: "run:current", queueSequence: 2, anchor: { order: 3, stepOrder: 1 } },
    permission: "canViewMemories", witnesses: [], priorWitnesses: [] };
  return { ...f, get grant() { return f.grant; }, sources, args };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const witness = (source: SourceContent): ContextSourceWitness => ({ sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId,
  sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash, permissions: ["canViewMemories"] });
function state(f: Fixture) { return clone({ rows: f.db.rows, writes: f.db.writes, native: f.native, scheduled: f.scheduled, effects: f.effects }); }
async function batch(f: Fixture, args = f.args) { assertNativeArgs(runtime.contextSourceBatch, args); return f.call<{ selectedIndexes: number[]; witnesses: ContextSourceWitness[]; provenance: [string, SourceContent["lineage"]][] }>(runtime.contextSourceBatch, args); }
/** Original Action loop, using the retained actual single-source registration and the original pure merger. */
async function serial(f: Fixture, args = f.args) {
  const witnesses = new Map(args.witnesses.map(value => [value.sourceId, value])), prior = new Map(args.priorWitnesses.map(value => [value.sourceId, value]));
  const provenance = new Map<string, SourceContent["lineage"]>(), selectedIndexes: number[] = [];
  for (const [index, item] of args.items.entries()) {
    const source = await f.call<SourceContent | null>(runtime.contextSource, { reference: args.reference, ...item,
      excludedSourceKeys: args.excludedSourceKeys, cutoff: args.cutoff, boundary: args.boundary });
    if (!source) continue;
    const next = mergeContextWitness(witnesses.get(item.sourceId) ?? prior.get(item.sourceId), { ...witness(source), permissions: [args.permission] });
    if (!next) throw Error("STALE_CONTEXT");
    witnesses.set(item.sourceId, next); provenance.set(contextSourceKey(memoryScope(args.reference), source.lineage), source.lineage); selectedIndexes.push(index);
  }
  return { selectedIndexes, witnesses: [...witnesses.values()], provenance: [...provenance.entries()] };
}
async function outcome(fn: () => Promise<unknown>) {
  try { return { result: await fn() }; } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
}
describe("ordered native context source batch", () => {
  it.each([0, 1, 3, 33, 100])("matches original %s-item handler outputs, both getters and zero writes without a premature 32-witness cap", async count => {
    const f = await fixture(count), before = state(f), getter = jest.spyOn(ConvexMemoryRepository.prototype, "getSource");
    const expected = await serial(f), originalReads = getter.mock.calls.map(args => args[0]); getter.mockClear();
    expect(await batch(f)).toEqual(expected); expect(getter.mock.calls.map(args => args[0])).toEqual(originalReads);
    expect(expected.selectedIndexes).toHaveLength(count); expect(expected.witnesses).toHaveLength(count); expect(state(f)).toEqual(before);
    expect(runtime.contextSourceBatch.isInternal).toBe(true); expect(runtime.contextSourceBatch.isQuery).toBe(true);
  });
  it("retains duplicate selection/order, null exclusions, existing state and prior vector permission union", async () => {
    const f = await fixture(3); f.args.items = [f.args.items[1]!, f.args.items[0]!, f.args.items[1]!, f.args.items[2]!];
    f.args.excludedSourceKeys = [contextSourceKey(memoryScope(f.reference), f.sources[0]!.lineage)];
    f.args.permission = "canViewFacts"; f.args.priorWitnesses = [witness(f.sources[1]!)]; f.args.witnesses = [witness(f.sources[2]!)];
    const before = state(f), expected = await serial(f); expect(await batch(f)).toEqual(expected); expect(state(f)).toEqual(before);
    expect(expected.selectedIndexes).toEqual([0, 2, 3]); expect(expected.witnesses.map(value => value.sourceId)).toEqual(["source:2", "source:1"]);
    expect(expected.witnesses.every(value => value.permissions?.join() === "canViewFacts,canViewMemories")).toBe(true);
    expect(expected.provenance.map(([, value]) => value.sourceId)).toEqual(["source:1", "source:2"]);
  });
  it.each(["event", "revision", "hash", "missing", "foreign_scope", "foreign_principal", "revoked", "expired", "tombstone", "source_tombstone", "duplicate"])("retains original first/late %s refusal and no partial result/effects", async kind => {
    const f = await fixture(), row = f.db.table("runtimeMemorySources")[1]!;
    if (kind === "event") f.args.items[1]!.expected.sourceEventId = "foreign-event";
    if (kind === "revision") f.args.items[1]!.expected.sourceRevision++;
    if (kind === "hash") f.args.items[1]!.expected.contentHash = "0".repeat(64);
    if (kind === "missing") f.args.items[1]!.sourceId = "absent";
    if (kind === "foreign_scope") f.args.reference = { ...f.reference, memorySpaceId: "foreign-space" };
    if (kind === "foreign_principal") f.args.reference = { ...f.reference, principalId: "foreign-principal" };
    if (kind === "revoked") f.grant.revokedAt = Date.now();
    if (kind === "expired") f.grant.expiresAt = Date.now();
    if (kind === "tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "source:1", deletedAt: Date.now() });
    if (kind === "source_tombstone") row.tombstonedAt = Date.now();
    if (kind === "duplicate") f.db.seed("runtimeMemorySources", { ...row, _id: "duplicate-source" });
    const before = state(f), original = await outcome(() => serial(f)); expect(original).toHaveProperty("error");
    expect(await outcome(() => batch(f))).toEqual(original); expect(state(f)).toEqual(before);
  });
  it.each(["excluded", "cutoff", "event_hash", "ineligible"])("matches original late %s filtering and still checks the remaining items", async kind => {
    const f = await fixture(), event = f.db.table("runtimeIngestionEvents")[1]!;
    if (kind === "excluded") f.args.excludedSourceKeys = [contextSourceKey(memoryScope(f.reference), f.sources[1]!.lineage)];
    if (kind === "cutoff") f.args.cutoff = 1;
    if (kind === "event_hash") event.contentHash = "0".repeat(64);
    if (kind === "ineligible") event.eligibility = "awaiting_approval";
    expect(await batch(f)).toEqual(await serial(f)); expect((await batch(f)).selectedIndexes).toEqual([0]);
  });
  it("a prior witness conflict wins before a later stale source and does not read that later item", async () => {
    const f = await fixture(); f.args.priorWitnesses = [{ ...witness(f.sources[0]!), contentHash: "0".repeat(64) }]; f.args.items[1]!.expected.sourceRevision++;
    const getter = jest.spyOn(ConvexMemoryRepository.prototype, "getSource"), before = state(f);
    await expect(batch(f)).rejects.toThrow("STALE_CONTEXT"); expect(getter.mock.calls.map(args => args[0])).toEqual(["source:0", "source:0"]); expect(state(f)).toEqual(before);
  });
  it("keeps the second original getter and each later item's authority checks fresh", async () => {
    const f = await fixture(), original = ConvexMemoryRepository.prototype.getSource; let reads = 0;
    jest.spyOn(ConvexMemoryRepository.prototype, "getSource").mockImplementation(async function (this: InstanceType<typeof ConvexMemoryRepository>, ...args) {
      if (++reads === 3) f.grant.revokedAt = Date.now(); return original.apply(this, args);
    });
    await expect(batch(f)).rejects.toThrow("FORBIDDEN"); expect(reads).toBe(3);
  });
  it("rejects oversized batches and native unknown item fields without invoking source reads", async () => {
    const f = await fixture(1), getter = jest.spyOn(ConvexMemoryRepository.prototype, "getSource"), before = state(f);
    await expect(batch(f, { ...f.args, items: Array.from({ length: 101 }, () => f.args.items[0]!) })).rejects.toThrow("INVALID_INPUT");
    expect(() => assertNativeArgs(runtime.contextSourceBatch, { ...f.args, items: [{ ...f.args.items[0], claimedAuthority: true }] })).toThrow("Unknown native field");
    expect(getter).not.toHaveBeenCalled(); expect(state(f)).toEqual(before);
  });
  it("a forged retained witness never grants a missing or foreign source and no prior decisions survive the next query", async () => {
    const f = await fixture(1); f.args.priorWitnesses = [witness(f.sources[0]!)]; expect((await batch(f)).selectedIndexes).toEqual([0]);
    f.grant.revokedAt = Date.now(); await expect(batch(f)).rejects.toThrow("FORBIDDEN");
  });
});
