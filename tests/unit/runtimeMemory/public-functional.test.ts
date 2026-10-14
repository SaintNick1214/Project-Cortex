/** Offline public wiring through actual auth, domain services and internal persistence.
 * Only policy admission and the Gateway model port are controlled; no paid service is contacted. */
import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { BackendGatewayBudget, BackendGatewayBudgetArgs } from "../../../convex-dev/runtimeGatewayBackend";
import type { MemoryModel } from "../../../src/domain/contracts";
import type { rememberMemory, recallMemory } from "../../../convex-dev/runtimeMemoryServices";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { prepareSourceContent } from "../../../src/domain/sources";

const factory = jest.fn<typeof import("../../../convex-dev/runtimeMemoryGateway").createGatewayMemoryModel>();
jest.unstable_mockModule("../../../convex-dev/runtimeMemoryGateway", () => ({ createGatewayMemoryModel: factory }));
const {installIngestionMockRoot,currentMockRootSelection,ledger}=await import('../runtimeTranscript/fixture');
const {explicitSourceLineage}=await import('../../../convex-dev/runtimeMemoryServices');
const {memoryScope}=await import('../../../convex-dev/runtimeMemoryRepository');
const memory = await import("../../../convex-dev/runtimeMemory");
const { memoryFixture, registeredHandler } = await import("./fixture");

type Input = { tenantId?: string; memorySpaceId?: string; text: string; requestId: string; limit?: number };
const input: Input = { tenantId: "tenant-a", memorySpaceId: "space-a", text: "  I prefer dark mode\r\n", requestId: "public-remember" };
const facts = { facts: [{ fact: "User prefers dark mode", factType: "preference", subject: "user-a", predicate: "prefers",
  object: "dark mode", confidence: 0.91, tags: ["ui"], entities: [], relations: [] }] };
const unavailable = { version: 1, code: "CAPABILITY_UNAVAILABLE", message: "Memory capability unavailable.", retryable: false, outcome: "not_dispatched" };
const failed = { version: 1, code: "MEMORY_OPERATION_FAILED", message: "Memory operation failed.", retryable: false, outcome: "uncertain" };
const vector = () => Array.from({ length: DEFAULT_EMBEDDING_PROFILE.dimensions }, (_, i) => i === 0 ? 1 : 0);

function setup(profile = DEFAULT_EMBEDDING_PROFILE) {
  installIngestionMockRoot({large:profile.profileId===LARGE_EMBEDDING_PROFILE.profileId});
  const accounts = new Map<string, { canonical: string; budget: BackendGatewayBudget }>();
  let budgetHook: ((args: BackendGatewayBudgetArgs) => void) | undefined;
  let afterBudgetHook: ((args: BackendGatewayBudgetArgs) => void) | undefined;
  const f = memoryFixture({ profile: () => profile, budget: async (args) => {
    await ready;
    budgetHook?.(args);
    // Controlled exact-request account identity only; native monetary/admission tests live elsewhere.
    const key = canonicalModelJson([args.reference, args.operationKey, args.requestId]);
    const previous = accounts.get(key);
    if (previous) {
      if (previous.canonical !== args.requestCanonical) throw new ConvexError({ version: 1, code: "IDEMPOTENCY_CONFLICT",
        message: "PRIVATE_POLICY_DETAIL", retryable: false, outcome: "not_dispatched" });
      return previous.budget;
    }
    const budget=await registeredHandler<typeof args,BackendGatewayBudget>(ledger.ensureBudget)(f.ctx,args);
    afterBudgetHook?.(args);
    accounts.set(key, { canonical: args.requestCanonical, budget });
    return budget;
  } });
  const ready=(async()=>{
    // Actual policy installation/budget/preparation handlers replace the obsolete
    // offline-run IDs. Only the Gateway model remains controlled in this suite.
    await registeredHandler<unknown,unknown>(ledger.installDeploymentPolicy)(f.ctx,currentMockRootSelection());
    f.db.writes=0;
  })();
  const operations: { purpose: string; operationId: string }[] = [];
  const model: MemoryModel = {
    extract: async (request) => { operations.push(request); return structuredClone(facts); },
    resolve: async () => { throw new Error("Unexpected public conflict recursion"); },
    embed: async (request) => { operations.push(request); return { profile: DEFAULT_EMBEDDING_PROFILE, vectors: request.texts.map(vector) }; },
  };
  factory.mockImplementation(() => model);
  return { ...f, ready, model, operations, accounts, setBudgetHook: (hook: typeof budgetHook) => { budgetHook = hook; },setAfterBudgetHook:(hook:typeof afterBudgetHook)=>{afterBudgetHook=hook;} };
}
async function remember(f: ReturnType<typeof memoryFixture>&{ready?:Promise<void>}, args: Input = input) {
  await f.ready;
  return await registeredHandler<Input, Awaited<ReturnType<typeof rememberMemory>>>(memory.remember)(f.actionCtx as never, args);
}
async function recall(f: ReturnType<typeof memoryFixture>&{ready?:Promise<void>}, args: Input = { ...input, text: " preferences ", requestId: "public-recall" }) {
  await f.ready;
  return await registeredHandler<Input, Awaited<ReturnType<typeof recallMemory>>>(memory.recall)(f.actionCtx as never, args);
}
async function rejection(call: () => Promise<unknown>): Promise<unknown> {
  try { await call(); throw new Error("Expected public rejection"); }
  catch (error) { if (error instanceof ConvexError) return error.data; throw error; }
}
function noDerived(f: ReturnType<typeof memoryFixture>) {
  for (const table of ["facts", "runtimeMemoryChunks", "runtimeMemoryVectors", "runtimeMemoryReceipts"]) expect(f.db.table(table)).toEqual([]);
}
function protectedRows(f:ReturnType<typeof memoryFixture>) {
  return structuredClone(Object.fromEntries(['runtimeMemorySources','facts','runtimeMemoryChunks','runtimeMemoryVectors','runtimeMemoryReceipts'].map(t=>[t,f.db.table(t)])));
}
beforeEach(() => { factory.mockReset(); });afterEach(()=>{jest.restoreAllMocks();});

describe("functional public memory wiring with an offline model", () => {
  it("preflights exact trusted request before writing, then remembers and recalls real scoped data", async () => {
    const f = setup(); const writesAtBudget: number[] = [];
    f.setBudgetHook(() => writesAtBudget.push(f.db.writes));
    const stored = await remember(f);
    expect(stored).toMatchObject({ created: true, sourceRevision: 1, facts: [{ fact: facts.facts[0]!.fact, confidence: 91,
      ownerPrincipalId: f.principal._id, lineage: { sourceId: stored.sourceId, sourceRevision: 1, role: "user", trust: "user_assertion" } }] });
    expect(stored.facts[0]).not.toHaveProperty("_id");
    const source = f.db.table("runtimeMemorySources")[0]!;
    expect(source.content).toBe("I prefer dark mode");
    expect(f.db.table("facts")).toHaveLength(1); expect(f.db.table("runtimeMemoryChunks")).toHaveLength(1);
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(1); expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(1);
    expect(writesAtBudget).toEqual([0]);
    const budget = f.policyRequests[0]!;
    expect(budget.reference).toEqual(f.reference); expect(Object.isFrozen(budget.reference)).toBe(true);
    expect(Object.keys(budget.reference).sort()).toEqual(Object.keys(f.reference).sort());
    expect(JSON.parse(budget.requestCanonical)).toEqual({ purpose: "remember", text: source.content, lineage: source.lineage });
    expect(factory.mock.calls[0]![1].scope).toMatchObject(f.reference);
    expect(factory.mock.calls[0]![2]).toEqual(f.accounts.values().next().value!.budget);
    // A same-tenant foreign owner's fact cannot enter the actual scoped query.
    f.db.seed("facts", { ...f.db.table("facts")[0], _id: "facts:foreign", factId: "foreign", ownerPrincipalId: "foreign",
      fact: "PRIVATE_FOREIGN_SENTINEL" });
    const found = await recall(f);
    expect(found.items).toHaveLength(2); expect(found.context).toContain("confidence: 91%");
    expect(found.context).toContain("[user]: I prefer dark mode"); expect(found.context).not.toContain("PRIVATE_FOREIGN_SENTINEL");
    expect(found.profileId).toBe(DEFAULT_EMBEDDING_PROFILE.profileId);
    expect(f.operations.map((op) => op.purpose)).toEqual(["memory.extract", "embedding.memory", "embedding.query"]);
    expect(f.searches[0]).toMatchObject({ filter: { key: "scopeProfileOwnerKey", value: JSON.stringify([
      "tenant-a", "space-a", DEFAULT_EMBEDDING_PROFILE.profileId, f.principal._id]) } });
    expect(f.policyRequests[1]).toMatchObject({ operationKey: "embedding.query", requestId: "public-recall",
      requestCanonical: canonicalModelJson({ purpose: "recall", text: "preferences", limit: 10 }) });
  });
  it("reuses normalized request account and derived receipt without duplicate persistent data", async () => {
    const f = setup(); const first = await remember(f); const writes = f.db.writes;
    const again = await remember(f, { ...input, text: "I prefer dark mode" });
    expect(again).toEqual({ ...first, created: false }); expect(f.accounts.size).toBe(1);
    expect(f.db.writes).toBe(writes);
    expect(f.policyRequests[0]!.requestCanonical).toBe(f.policyRequests[1]!.requestCanonical);
    expect(factory.mock.calls[0]![2]).toEqual(factory.mock.calls[1]![2]);
    expect(f.operations[0]!.operationId).toBe(f.operations[2]!.operationId);
  });
  it.each(["remember", "recall"] as const)("rejects changed %s input before persistence or a second model invocation", async (operation) => {
    const f = setup(); const call = operation === "remember" ? remember : recall;
    await call(f, input); const before = structuredClone(f.db.rows); const writes = f.db.writes; const count = f.operations.length;
    const outcome = await rejection(async () => await call(f, { ...input, text: "different private request" }));
    expect(outcome).toEqual({ version: 1, code: "INTERNAL_FAILURE", message: "Memory control failed.", retryable: false, outcome: "not_dispatched" });
    expect(JSON.stringify(outcome)).not.toContain("PRIVATE_POLICY_DETAIL");
    expect(f.operations).toHaveLength(count); expect(factory).toHaveBeenCalledTimes(1);
    expect(f.db.rows).toEqual(before); expect(f.db.writes).toBe(writes); expect(f.accounts.size).toBe(1);
  });
  it("binds recall limit in the exact request before model dispatch", async () => {
    const f = setup(); await recall(f, { ...input, limit: 1 }); const count = f.operations.length;
    expect(await rejection(async () => await recall(f, { ...input, limit: 2 }))).toMatchObject({ outcome: "not_dispatched" });
    expect(f.operations).toHaveLength(count); expect(factory).toHaveBeenCalledTimes(1); expect(f.searches).toHaveLength(1);
  });
  it.each(["remember", "recall"] as const)("unconfigured %s policy performs no source/fact/vector writes or model construction", async (operation) => {
    const f = memoryFixture();
    expect(await rejection(async () => await (operation === "remember" ? remember : recall)(f))).toEqual(unavailable);
    expect(f.policyRequests).toHaveLength(1); expect(f.db.writes).toBe(0); expect(f.searches).toEqual([]);
    expect(f.db.table("runtimeMemorySources")).toEqual([]); noDerived(f); expect(factory).not.toHaveBeenCalled();
  });
  it.each(["missing identity", "revoked", "foreign scope", "missing capability"])("ready policy cannot bypass %s", async (condition) => {
    const f = setup(); let args = input;
    if (condition === "missing identity") f.ctx.auth.getUserIdentity = async () => null;
    if (condition === "revoked") f.grant.revokedAt = 1;
    if (condition === "foreign scope") args = { ...input, tenantId: "foreign" };
    if (condition === "missing capability") f.grant.capabilities = ["read"];
    expect(await rejection(async () => await remember(f, args))).toMatchObject({ outcome: "not_dispatched" });
    expect(f.policyRequests).toEqual([]); expect(factory).not.toHaveBeenCalled(); expect(f.db.writes).toBe(0); noDerived(f);
  });
  it.each(["request ID", "text"])("invalid %s stops before budget and persistence after authority", async (field) => {
    const f = setup(); const args = field === "request ID" ? { ...input, requestId: "" } : { ...input, text: " \r\n " };
    await expect(remember(f, args)).rejects.toThrow(/INVALID_INPUT|nonempty request ID/);
    expect(f.policyRequests).toEqual([]); expect(factory).not.toHaveBeenCalled(); expect(f.db.writes).toBe(0);
  });
  it.each([0, 101, 1.5, Number.NaN])("invalid recall limit %p stops before budget or query model", async (limit) => {
    const f = setup(); expect(await rejection(async () => await recall(f, { ...input, limit }))).toMatchObject({ code: "INVALID_INPUT", outcome: "not_dispatched" });
    expect(f.policyRequests).toEqual([]); expect(factory).not.toHaveBeenCalled(); expect(f.searches).toEqual([]);
  });
  it("late revocation after preflight denies source persistence with the functional uncertain envelope", async () => {
    const f = setup(); f.setAfterBudgetHook(() => { f.grant.revokedAt = 1; });
    expect(await rejection(async () => await remember(f))).toEqual(failed);
    expect(f.policyRequests).toHaveLength(1); expect(f.operations).toEqual([]);
    // The original native budget admission commits two account rows before this late fence.
    expect(f.db.writes).toBe(2);expect(f.db.table("runtimeBudgetAccounts").filter(r=>r.kind==="run")).toHaveLength(1);
    expect(f.db.table("runtimeModelAttempts")).toEqual([]);expect(f.db.table("runtimeMemorySources")).toEqual([]);noDerived(f);
  });
  it("revocation after extraction prevents embedding and derived commit without a false no-dispatch claim", async () => {
    const f = setup(); const extract = f.model.extract;
    f.model.extract = async (request) => { const result = await extract(request); f.grant.revokedAt = 1; return result; };
    expect(await rejection(async () => await remember(f))).toEqual(failed);
    expect(f.operations.map((op) => op.purpose)).toEqual(["memory.extract"]);
    expect(f.db.table("runtimeMemorySources")).toHaveLength(1); noDerived(f);
  });
  it.each(["provider error", "diagnostic getters", "malformed extraction", "invalid vector"])("post-model %s stays opaque and uncertain with no derived commit", async (fault) => {
    const f = setup(); let reads = 0;
    if (fault === "provider error") f.model.extract = async (request) => { f.operations.push(request); throw new Error("PRIVATE_PROVIDER_SENTINEL"); };
    if (fault === "diagnostic getters") f.model.extract = async (request) => {
      f.operations.push(request); const error = {};
      for (const field of ["data", "message", "stack"]) Object.defineProperty(error, field, { get: () => { reads++; throw new Error("PRIVATE_GETTER_SENTINEL"); } });
      throw error;
    };
    if (fault === "malformed extraction") f.model.extract = async (request) => { f.operations.push(request); return { facts: "PRIVATE_MALFORMED_SENTINEL" }; };
    if (fault === "invalid vector") f.model.embed = async (request) => { f.operations.push(request); return { profile: DEFAULT_EMBEDDING_PROFILE, vectors: [[1]] }; };
    expect(await rejection(async () => await remember(f))).toEqual(failed); expect(reads).toBe(0);
    expect(f.operations.length).toBeGreaterThan(0); expect(f.db.table("runtimeMemorySources")).toHaveLength(1); noDerived(f);
  });
  it("source revision race at actual commit remains opaque/uncertain and commits no derived rows", async () => {
    const f = setup(); const runMutation = f.actionCtx.runMutation.bind(f.actionCtx); let commitReached = false;
    f.actionCtx.runMutation = async (ref, args) => {
      if (getFunctionName(ref) === "runtimeMemory:writeDerived") {
        commitReached = true;
        (f.db.table("runtimeMemorySources")[0]!.lineage as { sourceRevision: number }).sourceRevision = 2;
      }
      return await runMutation(ref, args);
    };
    expect(await rejection(async () => await remember(f))).toEqual(failed); expect(commitReached).toBe(true);
    expect(f.operations.map((op) => op.purpose)).toEqual(["memory.extract", "embedding.memory"]); noDerived(f);
  });
  it("post-query-model failure does not return a partial recall or leak provider diagnostics", async () => {
    const f = setup(); await remember(f); const snapshot = protectedRows(f);
    f.model.embed = async (request) => { f.operations.push(request); throw new Error("PRIVATE_QUERY_SENTINEL"); };
    expect(await rejection(async () => await recall(f))).toEqual(failed);
    expect(f.operations.at(-1)!.purpose).toBe("embedding.query"); expect(f.searches).toEqual([]);
    expect(protectedRows(f)).toEqual(snapshot);expect(f.db.table('runtimeModelAttempts')).toEqual([]);
    expect(f.db.table('runtimeBudgetAccounts').filter(r=>r.kind==='run')).toHaveLength(2);
  });
  it("reports trusted cold-profile readiness before model construction, search, or persistent effects", async () => {
    const f = setup(LARGE_EMBEDDING_PROFILE);
    await f.ready;
    const { source } = await prepareSourceContent(memoryScope(f.reference), explicitSourceLineage(memoryScope(f.reference), "prior-small"),
      "current small-profile source", { now: () => 1000 });
    f.db.seed("runtimeMemorySources", source as unknown as Record<string, unknown>);
    f.db.seed("runtimeMemoryVectorGenerations", { tenantId: source.tenantId, memorySpaceId: source.memorySpaceId,
      ownerPrincipalId: source.ownerPrincipalId, sourceId: source.lineage.sourceId,
      sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision,
      contentHash: source.contentHash, profile: DEFAULT_EMBEDDING_PROFILE, receiptId: "existing-small-receipt" });
    f.db.table("runtimeAuthTombstones"); // The controlled DB materializes empty tables on read.
    const before = protectedRows(f);
    expect(await rejection(async () => await recall(f))).toEqual({ version: 1, code: "PROFILE_NOT_READY",
      message: "Current sources have no compatible vector generation for the selected profile", retryable: false, outcome: "not_dispatched" });
    expect(f.operations).toEqual([]); expect(factory).not.toHaveBeenCalled(); expect(f.searches).toEqual([]);
    expect(protectedRows(f)).toEqual(before);expect(f.db.table('runtimeModelAttempts')).toEqual([]);
    expect(f.db.table('runtimeBudgetAccounts').filter(r=>r.kind==='run')).toHaveLength(1);
  });
  it("a readiness-shaped failure after model invocation remains opaque and uncertain", async () => {
    const f = setup();
    f.model.embed = async request => { f.operations.push(request); throw new ConvexError({ version: 1, code: "PROFILE_NOT_READY",
      message: "Current sources have no compatible vector generation for the selected profile", retryable: false, outcome: "not_dispatched" }); };
    expect(await rejection(async () => await recall(f))).toEqual(failed);
    expect(f.operations).toHaveLength(1); expect(f.searches).toEqual([]);
  });
});
