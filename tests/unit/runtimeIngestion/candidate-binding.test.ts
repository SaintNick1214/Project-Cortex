/** Original worker/Gateway/native commit handlers; only provider and DB ports
 * are controlled. No service, paid inference or native qualification claim. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { LanguageModelV4, LanguageModelV4CallOptions } from "@ai-sdk/provider";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { AttributedFact, SourceContent } from "../../../src/domain/contracts";
import type { BeliefPlanV1 } from "../../../src/domain/belief-plan";
import type { StageLease } from "../../../convex-dev/runtimeIngestion";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { planBeliefs, sourceCandidateBindings } from "../../../src/domain/belief-plan";
import { normalizeSourceText, semanticHash } from "../../../src/domain/profile";
import { BELIEF_POLICY_VERSION } from "../../../src/domain/ingestion";
import { buildConflictResolutionPrompt } from "../../../src/domain/conflicts";
import { parseSourceFactsResponse } from "../../../src/domain/sources";
import { getFunctionName } from "convex/server";

const calls: LanguageModelV4CallOptions[] = [];
let outputs: string[] = [];
jest.unstable_mockModule("@convex-dev/ai-sdk-provider", () => ({ convexGateway: (modelId: string): LanguageModelV4 => ({
  specificationVersion: "v4", provider: "convexGateway.chat", modelId, supportedUrls: {},
  doGenerate: async input => {
    calls.push(input); const text = outputs.shift(); if (text === undefined) throw new Error("Unplanned provider call");
    return { content: [{ type: "text", text }], warnings: [], finishReason: { unified: "stop", raw: "stop" },
      usage: { inputTokens: { total: 2, noCache: 2, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
      response: { body: { id: "offline-candidate", model: modelId, choices: [{ finish_reason: "stop" }], usage: { prompt_tokens: 2, completion_tokens: 1 } } } };
  }, doStream: async () => { throw new Error("Unexpected stream"); },
}) }));
const { memoryFixture, registeredHandler } = await import("../runtimeMemory/fixture");
const policy = await import("../../../convex-dev/runtimeModelPolicy");
const ingestion = await import("../../../convex-dev/runtimeIngestion");
const memory = await import("../../../convex-dev/runtimeMemory");
const beliefs = await import("../../../convex-dev/runtimeBeliefs");
const context = await import("../../../convex-dev/runtimeMemoryContext");
const { createActionMemoryRepository } = await import("../../../convex-dev/runtimeMemoryRepository");
const { createGatewayMemoryModel } = await import("../../../convex-dev/runtimeMemoryGateway");
const { OBSERVED_GATEWAY_POLICY_MANIFEST_V17: manifest } = await import("../../../convex-dev/runtimeGatewayMediaQualifications");
const now = 1791546000000;
const first = { fact: "User likes oak", factType: "preference" as const, subject: "User", predicate: "likes", object: "oak", confidence: 1, tags: [], entities: [{ name: "oak", type: "concept" }], relations: [] };
const second = { fact: "User likes maple", factType: "preference" as const, subject: "User", predicate: "likes", object: "maple", confidence: 1, tags: [], entities: [], relations: [] };
const add = { action: "ADD" as const, targetFactId: null, mergedFact: null, reason: "Independent supported assertion" };
async function fixture() {
  const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run"];
  const query = f.db.query.bind(f.db);
  f.db.query = table => {
    const builder = query(table), methods = builder as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    for (const key of ["unique", "collect", "take", "paginate"]) {
      const read = methods[key]!;
      methods[key] = async (...args) => { const value = await read(...args); return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as unknown; };
    }
    return builder;
  };
  const modules = { runtimeModelPolicy: policy, runtimeIngestion: ingestion, runtimeMemory: memory, runtimeBeliefs: beliefs, runtimeMemoryContext: context };
  const invoke = async (registration: unknown, args: unknown) => registeredHandler<unknown, unknown>(registration)(f.ctx, args);
  const dispatch = async (reference: unknown, args: unknown) => {
    const [module, name] = getFunctionName(reference as Parameters<typeof getFunctionName>[0]).split(":");
    if (!Object.hasOwn(modules, module!)) throw new Error("Unexpected module");
    const registration = (modules[module as keyof typeof modules] as unknown as Record<string, unknown>)[name!];
    if (!registration) throw new Error("Unexpected registration"); return invoke(registration, args);
  };
  f.ctx.runQuery = dispatch as MutationCtx["runQuery"];
  f.ctx.runMutation = ((ref: unknown, args: unknown) => f.db.transaction(() => dispatch(ref, args))) as MutationCtx["runMutation"];
  const call = <T = unknown>(registration: unknown, args: unknown) => f.db.transaction(async () => await invoke(registration, args) as T);
  await call(policy.installDeploymentPolicy, { manifestId: manifest.manifestId, expectedRevision: 17 });
  async function source(id = "owned-source") {
    const content = normalizeSourceText("User likes oak and maple");
    const value: SourceContent = { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId!, ownerPrincipalId: f.reference.principalId,
      lineage: { sourceId: id, sourceEventId: id, sourceRevision: 1, role: "user", trust: "user_assertion" }, content, contentHash: await semanticHash(content), createdAt: now };
    f.db.seed("runtimeMemorySources", value as unknown as Record<string, unknown>); return value;
  }
  const worker = (eventId: string, stage: "extract" | "facts" = "extract") => ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId, stage });
  async function extracted() {
    const value = await source(), event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, value);
    outputs.push(JSON.stringify({ facts: [first, second] })); await worker(event.eventId);
    expect(f.db.table("runtimeIngestionStages").find(x => x.eventId === event.eventId && x.stage === "extract")).toMatchObject({ state: "complete" });
    const owned = await call<StageLease & { runBudgetId: string }>(ingestion.claim, { reference: f.reference, eventId: event.eventId, stage: "facts" });
    const input = await call<Awaited<ReturnType<typeof ingestion.requireStageLease>> & { extraction: string; existing: [] }>(ingestion.stageInput, owned);
    return { value, event, owned, input };
  }
  return { ...f, call, source, worker, extracted };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function attributed(source: SourceContent): AttributedFact[] {
  // Native output requires arrays; the original parser omits empty optional
  // entity/relation fields from the persisted attributed candidates.
  return JSON.parse(JSON.stringify(parseSourceFactsResponse({ facts: [first, second] }, source))) as AttributedFact[];
}
async function proposal(owned: Awaited<ReturnType<Fixture["extracted"]>>) {
  return await planBeliefs({ eventId: owned.event.eventId, sequence: owned.event.sequence, source: owned.value,
    candidates: JSON.parse(owned.input.extraction) as AttributedFact[], existing: [], candidateAttempt: owned.owned.attempt,
    resolve: async (_candidate, _existing, _ordinal, binding) => { if (!binding) throw new Error("Missing source binding"); return { candidateBinding: binding, decision: add }; } });
}
describe("source-owned candidate decision bindings", () => {
  beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(now); calls.length = 0; outputs = []; });
  afterEach(() => { jest.restoreAllMocks(); });
  it("retains old unbound unequal-slot refusal and never interprets one result as the next candidate", async () => {
    const f = await fixture(), source = await f.source(), resolve = jest.fn(async () => add);
    await expect(planBeliefs({ eventId: "event", sequence: 1, source, candidates: attributed(source), existing: [], resolve })).rejects.toThrow("AMBIGUOUS_EXTRACTION_SLOT");
    expect(resolve).not.toHaveBeenCalled(); expect(f.db.table("facts")).toHaveLength(0);
  });
  it("retains every unequal field, source ordinal and independently bound decision", async () => {
    const f = await fixture(), source = await f.source(), candidates = attributed(source);
    const selected = await sourceCandidateBindings({ eventId: "event", sequence: 1, source, candidates: [candidates[0]!, candidates[0]!, candidates[1]!], attempt: 1 });
    expect(selected.map(x => [x.binding.sourceOrdinal, x.binding.ordinal])).toEqual([[0, 0], [2, 1]]);
    expect(new Set(selected.map(x => x.binding.candidateId)).size).toBe(2);
    const plan = await planBeliefs({ eventId: "event", sequence: 1, source, candidates, existing: [], candidateAttempt: 1,
      resolve: async (_candidate, matching, ordinal, binding) => {
        expect(ordinal).toBe(1); expect(matching.map(f => f.fact)).toEqual([first.fact]);
        if (!binding) throw new Error("Missing source binding"); return { candidateBinding: binding, decision: add };
      } });
    expect(plan.entries.map(e => e.candidate)).toEqual(candidates); expect(plan.entries.map(e => e.next?.object)).toEqual(["oak", "maple"]);
    expect(plan.entries.map(e => e.candidateBinding?.ordinal)).toEqual([0, 1]); expect(plan.entries[0]!.candidateBinding?.candidateId).not.toBe(plan.entries[1]!.candidateBinding?.candidateId);
  });
  it.each(["unbound", "wrong-candidate", "rewrite-new-target", "supersede-new-target"])("refuses %s resolution before a plan can be committed", async kind => {
    const f = await fixture(), source = await f.source(), candidates = attributed(source);
    const bindings = await sourceCandidateBindings({ eventId: "event", sequence: 1, source, candidates, attempt: 1 });
    await expect(planBeliefs({ eventId: "event", sequence: 1, source, candidates, existing: [], candidateAttempt: 1,
      resolve: async (_candidate, matching, _ordinal, binding) => kind === "unbound" ? add : { candidateBinding: kind === "wrong-candidate" ? bindings[0]!.binding : binding!,
        decision: kind === "rewrite-new-target" || kind === "supersede-new-target" ? { action: kind === "rewrite-new-target" ? "UPDATE" : "SUPERSEDE", targetFactId: matching[0]!.factId, mergedFact: "Changed", reason: "Cannot atomically rewrite an uncommitted target" } : add } })).rejects.toThrow("INVALID_BELIEF_DECISION");
    expect(f.db.table("facts")).toHaveLength(0);
  });
  it("executes the real worker/Gateway twice for two candidate conflicts, then commits both without replay or extraction loss", async () => {
    const f = await fixture(), earlier = await f.source("prior"); const before = await ingestion.enqueueSourceEvent(f.ctx, f.reference, earlier);
    outputs.push(JSON.stringify({ facts: [{ ...first, fact: "User likes birch", object: "birch" }] })); await f.worker(before.eventId); await f.worker(before.eventId, "facts");
    expect(f.db.table("runtimeIngestionStages").filter(x => x.eventId === before.eventId).map(x => ({ stage: x.stage, state: x.state, failureCode: x.failureCode }))).toEqual(expect.arrayContaining([expect.objectContaining({ stage: "extract", state: "complete" }), expect.objectContaining({ stage: "facts", state: "complete" })]));
    const source = await f.source(), event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
    outputs.push(JSON.stringify({ facts: [first, second] })); await f.worker(event.eventId);
    const extract = f.db.table("runtimeIngestionStages").find(x => x.eventId === event.eventId && x.stage === "extract")!, raw = canonicalModelJson(extract);
    outputs.push(JSON.stringify(add), JSON.stringify(add)); await f.worker(event.eventId, "facts");
    expect(canonicalModelJson(extract)).toBe(raw); expect(f.db.table("facts").map(x => x.object)).toEqual(["birch", "oak", "maple"]);
    const stage = f.db.table("runtimeIngestionStages").find(x => x.eventId === event.eventId && x.stage === "facts")!;
    expect(stage).toMatchObject({ state: "complete", attempt: 1 });
    const plan = JSON.parse(stage.payloadCanonical as string) as BeliefPlanV1;
    expect(plan.entries.map(e => e.candidate.object)).toEqual(["oak", "maple"]); expect(plan.entries.map(e => e.candidateBinding?.ordinal)).toEqual([0, 1]);
    const resolves = f.db.table("runtimeModelOperations").filter(x => x.operationKey === "facts.resolve"); expect(resolves).toHaveLength(2);
    for (const ordinal of [0, 1]) expect(resolves.some(x => x.semanticId === plan.entries[ordinal]!.candidateBinding!.semanticId)).toBe(true);
    expect(f.db.table("runtimeModelAttempts").every(x => x.slotReleased === true && x.resultAttachmentState === "attached")).toBe(true);
    expect(f.db.table("runtimeBudgetAccounts").every(x => x.reservedUnits === 0 && x.activeConcurrency === 0)).toBe(true);
    const count = calls.length, rows = canonicalModelJson(f.db.table("facts")); await f.worker(event.eventId, "facts");
    expect(calls).toHaveLength(count); expect(canonicalModelJson(f.db.table("facts"))).toBe(rows); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(3);
  });
  it.each(["candidateId", "ordinal", "operationId", "semanticId", "sourceHash", "missing", "truncated"])("native commit rejects %s private binding tampering atomically", async kind => {
    const f = await fixture(), owned = await f.extracted(), plan = await proposal(owned);
    if (kind === "missing") delete plan.entries[1]!.candidateBinding;
    else if (kind === "truncated") plan.entries.pop();
    else { const binding = plan.entries[1]!.candidateBinding!; if (kind === "ordinal") binding.ordinal = 0; else binding[kind as "candidateId" | "operationId" | "semanticId" | "sourceHash"] = "changed"; }
    await expect(f.call(beliefs.commit, { ...owned.owned, planCanonical: canonicalModelJson(plan) })).rejects.toBeDefined();
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(0); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(0);
  });
  it.each(["grant", "source", "lease", "policy"])("fresh %s fence rejects a complete bound plan without partial writes", async kind => {
    const f = await fixture(), owned = await f.extracted(), plan = await proposal(owned);
    if (kind === "grant") await f.db.patch("runtimeAuthGrants", f.grant._id, { revokedAt: now });
    if (kind === "source") { const row = f.db.table("runtimeMemorySources")[0]!; await f.db.patch("runtimeMemorySources", row._id, { contentHash: "a".repeat(64) }); }
    if (kind === "lease") await f.db.patch("runtimeIngestionStages", f.db.table("runtimeIngestionStages").find(x => x.stage === "facts")!._id, { leaseExpiresAt: now });
    if (kind === "policy") await f.db.patch("runtimeIngestionStages", f.db.table("runtimeIngestionStages").find(x => x.stage === "facts")!._id, { policyCanonical: "{}" });
    await expect(f.call(beliefs.commit, { ...owned.owned, planCanonical: canonicalModelJson(plan) })).rejects.toBeDefined();
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(0);
  });
  it("Gateway refuses a candidate under its sibling's operation before reservation/provider dispatch", async () => {
    const f = await fixture(), owned = await f.extracted(), candidates = JSON.parse(owned.input.extraction) as AttributedFact[];
    const repository = createActionMemoryRepository(f.ctx as unknown as ActionCtx, f.reference, "write"), original = { eventId: owned.event.eventId, sequence: owned.event.sequence, source: owned.value, candidates, attempt: owned.owned.attempt };
    const model = createGatewayMemoryModel(f.ctx as unknown as ActionCtx, repository, { runBudgetId: owned.owned.runBudgetId, beliefCandidates: original });
    const prompt = buildConflictResolutionPrompt(candidates[1]!, [], { maxExistingFacts: 100 }, { now: () => now });
    const before = calls.length, attempts = f.db.table("runtimeModelAttempts").length;
    await expect(model.resolve({ purpose: "facts.resolve", operationId: `${owned.event.eventId}:facts:1:0`, policyVersion: BELIEF_POLICY_VERSION, attempt: 1,
      source: owned.value.lineage, system: prompt.system, prompt: prompt.user, candidate: candidates[1]! })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(calls).toHaveLength(before); expect(f.db.table("runtimeModelAttempts")).toHaveLength(attempts);
  });
  it.each(["grant", "source"])("Gateway repeats the original fresh %s guard before candidate dispatch", async kind => {
    const f = await fixture(), owned = await f.extracted(), candidates = JSON.parse(owned.input.extraction) as AttributedFact[];
    const repository = createActionMemoryRepository(f.ctx as unknown as ActionCtx, f.reference, "write");
    const model = createGatewayMemoryModel(f.ctx as unknown as ActionCtx, repository, { runBudgetId: owned.owned.runBudgetId,
      beliefCandidates: { eventId: owned.event.eventId, sequence: owned.event.sequence, source: owned.value, candidates, attempt: owned.owned.attempt } });
    if (kind === "grant") await f.db.patch("runtimeAuthGrants", f.grant._id, { revokedAt: now });
    else await f.db.patch("runtimeMemorySources", f.db.table("runtimeMemorySources")[0]!._id,
      { lineage: { ...owned.value.lineage, sourceRevision: 2 }, content: "Edited source", contentHash: await semanticHash("Edited source") });
    const prompt = buildConflictResolutionPrompt(candidates[0]!, [], { maxExistingFacts: 100 }, { now: () => now }), before = calls.length;
    await expect(model.resolve({ purpose: "facts.resolve", operationId: `${owned.event.eventId}:facts:1:0`, policyVersion: BELIEF_POLICY_VERSION,
      attempt: 1, source: owned.value.lineage, system: prompt.system, prompt: prompt.user, candidate: candidates[0]! })).rejects.toMatchObject({ data: { code: kind === "grant" ? "FORBIDDEN" : "STALE_SOURCE" } });
    expect(calls).toHaveLength(before); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
  it("a lost commit after confirmed resolution keeps the full bound draft and UNKNOWN without an automatic paid replay", async () => {
    const f = await fixture(), source = await f.source(), event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
    outputs.push(JSON.stringify({ facts: [first, second] })); await f.worker(event.eventId); outputs.push(JSON.stringify(add));
    const original = f.ctx.runMutation.bind(f.ctx);
    f.ctx.runMutation = (async (reference, args) => {
      if (getFunctionName(reference) === "runtimeBeliefs:commit") throw new Error("Controlled commit outage");
      return await original(reference, args);
    }) as MutationCtx["runMutation"];
    await f.worker(event.eventId, "facts");
    const stage = f.db.table("runtimeIngestionStages").find(x => x.eventId === event.eventId && x.stage === "facts")!;
    expect(stage).toMatchObject({ state: "unknown", failureCode: "INDEXING_OUTCOME_UNKNOWN" });
    expect((JSON.parse(stage.payloadCanonical as string) as BeliefPlanV1).entries.map(x => x.candidate.object)).toEqual(["oak", "maple"]);
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(0);
    expect(f.db.table("runtimeModelAttempts").every(x => x.resultAttachmentState === "attached" && x.slotReleased === true)).toBe(true);
    const count = calls.length; await f.worker(event.eventId, "facts"); expect(calls).toHaveLength(count);
  });
});
