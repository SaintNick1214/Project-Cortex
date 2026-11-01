/** Real registered recall/Agent handlers, controlled DB/components/provider only.
 * These saved-fixture shapes do not reconstruct historical selector identities. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { EmbeddingModelV4 } from "@ai-sdk/provider";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { DerivedFact, SourceContent } from "../../../src/domain/contracts";
import { proveDirectFactLookup, directFactLookupSourceIds, directFactProofCompatible } from "../../../src/domain/memory-direct-recall";
let embeddings = 0;
jest.unstable_mockModule("@convex-dev/ai-sdk-provider", () => ({ convexGateway: Object.assign(() => { throw Error("No chat dispatch"); }, {
  embeddingModel: (id: string): EmbeddingModelV4 => ({ specificationVersion: "v4", modelId: id, provider: "convexGateway.embedding", maxEmbeddingsPerCall: 1, supportsParallelCalls: false,
    doEmbed: async () => { embeddings++; return { embeddings: [Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)], warnings: [],
      response: { body: { id: "literal-question-embedding", model: "text-embedding-3-small", data: [{ index: 0, object: "embedding" }], usage: { prompt_tokens: 1 } } } }; } })
}) }));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:literal-question"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { ledger, runs, definitions, clock, clone } = await import("../runtimeTranscript/fixture");
const { prepareSourceContent } = await import("../../../src/domain/sources");
const { canonicalModelJson } = await import("../../../src/domain/model-policy");
const { DEFAULT_EMBEDDING_PROFILE: profile, semanticHash } = await import("../../../src/domain/profile");
const { ConvexMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const { explicitSourceLineage } = await import("../../../convex-dev/runtimeMemoryServices");
const memory = await import("../../../convex-dev/runtimeMemory");
const auth = await import("../../../convex-dev/runtimeAuth");
const publicQuery = await import("../../../convex-dev/runtimeMemoryQuery");
const agent = await import("../../../convex-dev/runtimeAgent");
const agentRecall = await import("../../../convex-dev/runtimeAgentRecall");
const { replaceFactEntityLinks } = await import("../../../convex-dev/runtimeMemoryTraversal");
type CompleteRecall = Awaited<ReturnType<typeof import("../../../convex-dev/runtimeMemoryServices").completeRecallDelivery>>;
beforeEach(() => { installIngestionMockRoot(); embeddings = 0; jest.spyOn(performance, "now").mockReturnValue(0); });
afterEach(() => { jest.restoreAllMocks(); });
const queryText = "What is my favorite color?";
type Shape = "question" | "projection" | "existence";
async function fixture(shape: Shape = "question", maxEntries = 8) {
  const f = await ingestionFixture(), scope = memoryScope(f.reference), writer = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db);
  const value = shape === "projection" ? "coral" : "apricot";
  async function source(id: string, text: string, rows: { id: string; fact: string; predicate: string; object: string }[]) {
    const prepared = await prepareSourceContent(scope, explicitSourceLineage(scope, id), text, { now: () => clock });
    await writer.putSource(prepared.source); await ingestion.enqueueSourceEvent(f.ctx, f.reference, prepared.source);
    const lineage = prepared.source.lineage, identity = { ...lineage, stage: "facts" as const, semanticPolicyVersion: "literal-v2-fixture" };
    const facts: DerivedFact[] = rows.map(row => ({ _id: "", factId: row.id, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, ownerPrincipalId: scope.principalId,
      lineage, extractionPolicyVersion: "literal-v2-fixture", fact: row.fact, subject: "User", predicate: row.predicate, object: row.object, factType: "preference", confidence: 1,
      tags: [], sourceType: "manual", version: 1, createdAt: clock, updatedAt: clock }));
    await writer.commitDerived({ source: lineage, identity, chunks: prepared.chunks, facts, expectedFactVersions: Object.fromEntries(facts.map(fact => [fact.factId, 0])) });
    return prepared.source;
  }
  const seedSource = await source("literal-seed", `My favorite color is ${value}.`, [
    { id: "literal-value", fact: `User's favorite color is ${value}.`, predicate: shape === "question" ? "is_favorite_color" : shape === "existence" ? "prefers" : "is", object: value },
    ...(shape === "projection" ? [{ id: "literal-projection", fact: "User prefers the color coral.", predicate: "prefers", object: value }] : []),
    ...(shape === "existence" ? [{ id: "literal-existence", fact: `User's favorite color is ${value}.`, predicate: "has", object: "favorite color" }] : []),
  ]);
  const question = shape === "question" ? await source("literal-question", queryText, [{ id: "literal-question-fact", fact: "User has a favorite color.", predicate: "has", object: "a favorite color" }]) : undefined;
  for (const event of f.db.table("runtimeIngestionEvents")) Object.assign(event, { factsState: "complete", vectorsState: "complete", vectorProfilesComplete: [profile.profileId] });
  const oldQuery = f.ctx.runQuery.bind(f.ctx), oldMutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = [];
  const modules = { runtimeMemory: memory, runtimeMemoryQuery: publicQuery, runtimeModelPolicy: ledger, runtimeAuth: auth, runtimeAgent: agent, runtimeAgentRecall: agentRecall, runs };
  const lookup = (ref: Parameters<typeof getFunctionName>[0]) => {
    let name: string; try { name = getFunctionName(ref); } catch { return; }
    const [module, method] = name.split(":"); if (!(module in modules)) return;
    const registration = (modules[module as keyof typeof modules] as Record<string, unknown>)[method!]; return registration ? { name, registration } : undefined;
  };
  f.ctx.runQuery = (async (ref, args) => { const found = lookup(ref); if (!found) return oldQuery(ref, args); calls.push(found.name); return invoke(found.registration, f.ctx, args); }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => { const found = lookup(ref); if (!found) return oldMutation(ref, args); calls.push(found.name); return f.call(found.registration, args); }) as MutationCtx["runMutation"];
  const action = { ...f.ctx, vectorSearch: async () => [] } as unknown as ActionCtx;
  const input = { text: queryText, requestId: "literal-public", limit: 10, memory: { effort: "normal" as const, maxEntries } };
  const performPublic = () => invoke<CompleteRecall>(memory.recall, action as never, { ...input, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId });
  async function agentRun(version?: 1 | 2 | 3 | "omitted", maxWork?: number) {
    const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "literal-agent", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, handlerId: "cortex.transcript.relevant", handlerVersion: 2,
        registryHash: await definitions.executableRegistryHashV4(), inputSelection: { version: 2 } } } });
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: { ...f.request(), agentId: published.agentId, agentVersion: published.version,
      parts: [{ type: "text", text: queryText }], memory: input.memory } });
    await f.call(agent.start, { runId: run.runId });
    const execution = f.db.table("runtimeAgentExecutions").find(row => row.runId === run.runId)!;
    const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: execution.leaseVersion as number };
    await f.call(agent.startContext, attempt);
    const row = f.db.table("runtimeRuns").find(row => row.runId === run.runId)!;
    if (version !== undefined || maxWork !== undefined) {
      const effort = JSON.parse(row.memoryEffortCanonical as string), snapshot = JSON.parse(row.snapshotCanonical as string);
      for (const policy of [effort, snapshot.inputSelection.effort]) {
        if (version === "omitted") delete policy.literalSourceProofVersion; else if (version !== undefined) policy.literalSourceProofVersion = version;
        if (maxWork !== undefined) policy.maxWork = maxWork;
      }
      row.memoryEffortCanonical = canonicalModelJson(effort); row.snapshotCanonical = canonicalModelJson(snapshot);
    }
    return { attempt, parent: () => f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8, attempt),
      prepare: () => agent.prepareContextV8Handler(action, attempt, async () => { throw Error("Valid literal evidence must not invoke embedding"); }, true) };
  }
  const facts = () => f.db.table("facts") as unknown as DerivedFact[];
  const sources = () => f.db.table("runtimeMemorySources") as unknown as SourceContent[];
  const state = () => clone({ rows: new Map([...f.db.rows].filter(([, rows]) => rows.length)), writes: f.db.writes, effects: f.effects, native: f.native, scheduled: f.scheduled });
  return { ...f, get grant() { return f.grant; }, seedSource, question, facts, sources, calls, performPublic, agentRun, state, value };
}
it.each<Shape>(["question", "projection"])("registered public recall retains both actual %s facts and source provenance without embedding", async shape => {
  const f = await fixture(shape), result = await f.performPublic();
  expect(result.memoryEffort).toMatchObject({ retrievalRoute: "direct-facts-v1", entriesByKind: { fact: 2, memory: shape === "question" ? 2 : 1 } });
  expect(result.items.filter(item => item.type === "fact").map(item => item.id).sort()).toEqual(f.facts().map(fact => fact.factId).sort());
  expect(result.items.find(item => item.id === "literal-value")!.content).toBe(`User's favorite color is ${f.value}.`);
  expect(result.items.filter(item => item.type === "memory").map(item => item.content).sort()).toEqual(f.sources().map(source => source.content).sort());
  expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); expect(f.calls).not.toContain("runtimeMemoryQuery:admit");
});
it.each<Shape>(["question", "projection"])("registered Agent %s path delivers every fact and bound source without embedding proposal/dispatch", async shape => {
  const f = await fixture(shape), run = await f.agentRun(), before = f.state(), parent = await run.parent();
  expect(parent.proposal).toBeUndefined(); expect(parent.direct).toBeDefined(); expect(f.state()).toEqual(before);
  expect(parent.direct!.read.bindings.facts.map(fact => fact.factId).sort()).toEqual(f.facts().map(fact => fact.factId).sort());
  expect([...new Set(parent.direct!.read.bindings.sources.map(source => source.sourceId))].sort()).toEqual([f.seedSource, ...(f.question ? [f.question] : [])].map(source => source.lineage.sourceId).sort());
  const candidate = await run.prepare(); if (candidate?.state !== "started") throw Error("Prepared main candidate required");
  expect(candidate.current.execution.sourceWitnesses.map(source => source.sourceId).sort()).toEqual([f.seedSource, ...(f.question ? [f.question] : [])].map(source => source.lineage.sourceId).sort());
  expect(candidate.current.execution.contextCanonical).toContain(`User's favorite color is ${f.value}.`);
  expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each([1, "omitted"] as const)("immutable Agent pin %s retains old fallback for question and same-source prefers projections", async version => {
  for (const shape of ["question", "projection"] as const) {
    const f = await fixture(shape), run = await f.agentRun(version), before = f.state(), parent = await run.parent();
    expect(parent.direct).toBeUndefined(); expect(parent.proposal?.binding.operationKey).toBe("embedding.query"); expect(f.state()).toEqual(before);
    expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  }
});
it.each(["unknown", "conflict", "correction", "future", "time-bound", "source-edited", "source-question-extra", "metadata", "owner"] as const)("%s candidate cannot be silently removed to produce a new literal proof", async fault => {
  const f = await fixture(), question = f.facts().find(fact => fact.factId === "literal-question-fact")!;
  if (fault === "unknown") question.fact = "User enjoys colors.";
  if (fault === "conflict") Object.assign(question, { fact: "User's favorite color is blue.", predicate: "is", object: "blue" });
  if (fault === "correction") question.supersedes = "previous";
  if (fault === "future") question.validFrom = clock + 1;
  if (fault === "time-bound") question.validUntil = clock + 100;
  if (fault === "source-edited") question.updatedAt++;
  if (fault === "source-question-extra") { const source = f.sources().find(source => source.lineage.sourceId === question.lineage.sourceId)!; source.content = "What is my favorite color? My favorite color is blue."; source.contentHash = await semanticHash(source.content); }
  if (fault === "metadata") question.object = "blue";
  if (fault === "owner") question.ownerPrincipalId = "foreign";
  // This complete pure candidate set includes future/foreign rows too, proving
  // they cannot qualify; the repository independently excludes inaccessible rows.
  expect(proveDirectFactLookup(queryText, { facts: f.facts(), candidateWorkBound: false }, clock, 2, f.sources())).toBeUndefined();
  if (["future", "owner"].includes(fault)) return;
  await replaceFactEntityLinks(f.ctx.db, question);
  const result = await f.performPublic(); expect(result.memoryEffort?.retrievalRoute).toBe("semantic-v1");
  expect(embeddings).toBe(1); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});
it.each(["entries", "work"] as const)("Agent %s truncation retains original governed embedding proposal", async fault => {
  const f = await fixture("question", fault === "entries" ? 1 : 8), run = await f.agentRun(undefined, fault === "work" ? 5 : undefined);
  const parent = await run.parent(); expect(parent.direct).toBeUndefined(); expect(parent.proposal?.binding.operationKey).toBe("embedding.query");
  expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["question-delete", "question-edit", "question-expire"] as const)("cold final delivery rejects late %s in public and Agent paths", async fault => {
  for (const path of ["public", "agent"] as const) {
    const f = await fixture(), run = path === "agent" ? await f.agentRun() : undefined;
    const original = ConvexMemoryRepository.prototype.checkDelivery;
    const guard = jest.spyOn(ConvexMemoryRepository.prototype, "checkDelivery").mockImplementation(async function (this: InstanceType<typeof ConvexMemoryRepository>, bindings, authority) {
      expect(bindings.facts.map(fact => fact.factId)).toContain("literal-question-fact");
      expect(bindings.sources.map(source => source.sourceId)).toContain(f.question!.lineage.sourceId);
      const questionSource = f.sources().find(source => source.lineage.sourceId === f.question!.lineage.sourceId)!;
      if (fault === "question-delete") questionSource.tombstonedAt = clock;
      if (fault === "question-edit") questionSource.contentHash = "f".repeat(64);
      if (fault === "question-expire") f.facts().find(fact => fact.factId === "literal-question-fact")!.validUntil = clock;
      return original.call(this, bindings, authority);
    });
    await expect(path === "agent" ? run!.parent() : f.performPublic()).rejects.toThrow(); expect(guard).toHaveBeenCalledTimes(1); guard.mockRestore();
    expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  }
});
it.each(["grant", "expiry", "identity"] as const)("both registered paths preserve initial %s authorization refusal", async fault => {
  for (const path of ["public", "agent"] as const) {
    const f = await fixture(), run = path === "agent" ? await f.agentRun() : undefined;
    if (fault === "grant") f.grant.revokedAt = clock;
    if (fault === "expiry") f.grant.expiresAt = clock;
    if (fault === "identity") { if (path === "public") f.identity(null); else f.db.table("runtimeAuthPrincipals")[0]!.version = 2; }
    await expect(path === "agent" ? run!.parent() : f.performPublic()).rejects.toThrow(); expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  }
});
it("v2 prospective plan binds every question source, refuses work caps, and keeps v1/omitted semantics", async () => {
  const f = await fixture(), facts = f.facts(), sources = f.sources(), candidates = { facts, candidateWorkBound: false };
  expect(directFactLookupSourceIds(queryText, candidates, clock, 2)).toEqual([f.seedSource.lineage.sourceId, f.question!.lineage.sourceId]);
  expect(directFactLookupSourceIds(queryText, candidates, clock, 1)).toEqual([]); expect(directFactLookupSourceIds(queryText, candidates, clock)).toEqual([]);
  expect(directFactLookupSourceIds(queryText, { ...candidates, candidateWorkBound: true }, clock, 2)).toEqual([]);
  expect(proveDirectFactLookup(queryText, candidates, clock, 2, [sources[0]!])).toBeUndefined();
  const proof = proveDirectFactLookup(queryText, candidates, clock, 2, sources)!; expect(proof).toMatchObject({ version: 2 });
  expect(directFactProofCompatible(proof, facts, clock)).toBe(true);
  const later = { ...facts[1]!, lineage: { ...facts[1]!.lineage, sourceId: "unread-question" } };
  expect(directFactProofCompatible(proof, [later], clock)).toBe(false);
});
it.each(["What is my favorite color? Also blue.", "What is your favorite color?", "What is my favorite flower?", "What is my favorite color and fruit?", "My favorite color is blue.", "What is my favorite color", "What is my favorite color?!"])("canonical question grammar refuses %s", async content => {
  const f = await fixture(), sources = f.sources().map(source => source.lineage.sourceId === f.question!.lineage.sourceId ? { ...source, content } : source);
  expect(proveDirectFactLookup(queryText, { facts: f.facts(), candidateWorkBound: false }, clock, 2, sources)).toBeUndefined();
});
it.each(["User prefers coral.", "User prefers the flower coral.", "User might prefer the color coral.", "User prefers the color blue.", "User prefers the color coral and blue."])("v2 same-source projection grammar refuses %s", async text => {
  const f = await fixture("projection"), facts = f.facts().map(fact => fact.factId === "literal-projection" ? { ...fact, fact: text } : fact);
  expect(proveDirectFactLookup(queryText, { facts, candidateWorkBound: false }, clock, 2, f.sources())).toBeUndefined();
});
it("revocation between native direct query and context preparation retains the fresh authority fence", async () => {
  const f = await fixture(), run = await f.agentRun(), parent = await run.parent();
  expect(parent.direct).toBeDefined(); f.grant.revokedAt = clock;
  await expect(run.prepare()).rejects.toThrow(); expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("revocation after direct context save and before main admission retains the independent native denial", async () => {
  const f = await fixture(), run = await f.agentRun(), candidate = await run.prepare();
  if (candidate?.state !== "started") throw Error("Prepared direct main request required");
  expect(candidate.current.execution.sourceWitnesses.map(source => source.sourceId)).toContain(f.question!.lineage.sourceId);
  f.grant.revokedAt = clock;
  await expect(f.call(agent.admitPreparedModelOperationV8, { ...run.attempt, ordinal: 0, operationId: candidate.op.operationId,
    requestCanonical: candidate.op.nativeRequestCanonical!, snapshotCanonical: canonicalModelJson(candidate.governedResolution.snapshot),
    bindingCanonical: canonicalModelJson({ reference: f.reference, operationKey: "agent.respond", runBudgetId: candidate.current.run.runBudgetId, semanticId: candidate.op.semanticId, ordinal: 0 }) })).rejects.toThrow();
  expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["tenant", "space", "owner", "event", "revision", "tombstone", "hash", "missing"] as const)("v2 question source %s cannot independently establish the existence projection", async fault => {
  const f = await fixture(), sources = f.sources().map(source => ({ ...source, lineage: { ...source.lineage } }));
  const question = sources.find(source => source.lineage.sourceId === f.question!.lineage.sourceId)!;
  if (fault === "tenant") question.tenantId = "foreign";
  if (fault === "space") question.memorySpaceId = "foreign";
  if (fault === "owner") question.ownerPrincipalId = "foreign";
  if (fault === "event") question.lineage.sourceEventId = "foreign";
  if (fault === "revision") question.lineage.sourceRevision = 2;
  if (fault === "tombstone") question.tombstonedAt = clock;
  if (fault === "hash") question.contentHash = "invalid";
  if (fault === "missing") sources.splice(sources.indexOf(question), 1);
  expect(proveDirectFactLookup(queryText, { facts: f.facts(), candidateWorkBound: false }, clock, 2, sources)).toBeUndefined();
});
it("v2 source-read locations remain bounded by the native candidate ceiling", async () => {
  const f = await fixture(), facts = [f.facts()[0]!, ...Array.from({ length: 100 }, (_, index) => ({ ...f.facts()[1]!, factId: `question-${index}`, lineage: { ...f.facts()[1]!.lineage, sourceId: `question-${index}` } }))];
  expect(directFactLookupSourceIds(queryText, { facts, candidateWorkBound: false }, clock, 2)).toEqual([]);
  expect(proveDirectFactLookup(queryText, { facts, candidateWorkBound: false }, clock, 2, f.sources())).toBeUndefined();
});

it.each(["favorite color", "a favorite color"])("v3 registered public recall retains the exact asserted %s metadata projection without embedding", async object => {
  const f = await fixture("existence"), projection = f.facts().find(fact => fact.factId === "literal-existence")!;
  projection.object = object; await replaceFactEntityLinks(f.ctx.db, projection);
  const result = await f.performPublic();
  expect(result.memoryEffort).toMatchObject({ retrievalRoute: "direct-facts-v1", entriesByKind: { fact: 2, memory: 1 } });
  expect(result.items.filter(item => item.type === "fact").map(item => item.id).sort()).toEqual(["literal-existence", "literal-value"]);
  expect(result.items.filter(item => item.type === "fact").map(item => item.content)).toEqual(["User's favorite color is apricot.", "User's favorite color is apricot."]);
  expect(result.items.find(item => item.type === "memory")!.content).toBe("My favorite color is apricot.");
  expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); expect(f.calls).not.toContain("runtimeMemoryQuery:admit");
});
it.each(["favorite color", "a favorite color"])("new Agent snapshot3 binds both assertion facts with %s metadata and the guarded source", async object => {
  const f = await fixture("existence"), projection = f.facts().find(fact => fact.factId === "literal-existence")!;
  projection.object = object; await replaceFactEntityLinks(f.ctx.db, projection);
  const run = await f.agentRun(), row = f.db.table("runtimeRuns").find(row => row.runId === run.attempt.runId)!;
  expect(JSON.parse(row.snapshotCanonical as string).inputSelection.effort.literalSourceProofVersion).toBe(3);
  const before = f.state(), parent = await run.parent(); expect(f.state()).toEqual(before);
  expect(parent.proposal).toBeUndefined(); expect(parent.direct!.read.bindings.facts.map(fact => fact.factId).sort()).toEqual(["literal-existence", "literal-value"]);
  expect([...new Set(parent.direct!.read.bindings.sources.map(source => source.sourceId))]).toEqual([f.seedSource.lineage.sourceId]);
  const candidate = await run.prepare(); if (candidate?.state !== "started") throw Error("Prepared v3 main candidate required");
  expect(candidate.current.execution.sourceWitnesses.map(source => source.sourceId)).toEqual([f.seedSource.lineage.sourceId]);
  expect(candidate.current.execution.contextCanonical).toContain("User's favorite color is apricot.");
  expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["omitted", 1, 2] as const)("historical pin %s does not reinterpret the identical-assertion existence metadata", async version => {
  const f = await fixture("existence"), candidates = { facts: f.facts(), candidateWorkBound: false }, pin = version === "omitted" ? undefined : version;
  expect(directFactLookupSourceIds(queryText, candidates, clock, pin)).toEqual([]);
  expect(proveDirectFactLookup(queryText, candidates, clock, pin, f.sources())).toBeUndefined();
  const run = await f.agentRun(version), before = f.state(), parent = await run.parent();
  expect(parent.direct).toBeUndefined(); expect(parent.proposal?.binding.operationKey).toBe("embedding.query"); expect(f.state()).toEqual(before);
  expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["statement", "question", "subject", "predicate", "property", "value", "owner", "source", "event", "revision", "assistant", "correction", "edited", "future", "time-bound", "conflict"] as const)("v3 refuses %s metadata instead of removing the incompatible candidate", async fault => {
  const f = await fixture("existence"), facts = clone(f.facts()), projection = facts.find(fact => fact.factId === "literal-existence")!;
  if (fault === "statement") projection.fact = "My favorite color is apricot.";
  if (fault === "question") projection.fact = "What is my favorite color?";
  if (fault === "subject") projection.subject = "another user";
  if (fault === "predicate") projection.predicate = "likes";
  if (fault === "property") projection.object = "favorite flower";
  if (fault === "value") projection.object = "blue";
  if (fault === "owner") projection.ownerPrincipalId = "foreign";
  if (fault === "source") projection.lineage.sourceId = "foreign";
  if (fault === "event") projection.lineage.sourceEventId = "foreign";
  if (fault === "revision") projection.lineage.sourceRevision = 2;
  if (fault === "assistant") projection.lineage = { ...projection.lineage, role: "assistant", trust: "assistant_claim" };
  if (fault === "correction") projection.supersedes = "old";
  if (fault === "edited") projection.updatedAt++;
  if (fault === "future") projection.validFrom = clock + 1;
  if (fault === "time-bound") projection.validUntil = clock + 1;
  if (fault === "conflict") Object.assign(projection, { fact: "User's favorite color is blue.", predicate: "prefers", object: "blue" });
  const candidates = { facts, candidateWorkBound: false };
  expect(directFactLookupSourceIds(queryText, candidates, clock, 3)).toEqual([]);
  expect(proveDirectFactLookup(queryText, candidates, clock, 3, f.sources())).toBeUndefined();
  const valid = proveDirectFactLookup(queryText, { facts: f.facts(), candidateWorkBound: false }, clock, 3, f.sources())!;
  expect(valid).toMatchObject({ version: 3 }); expect(directFactProofCompatible(valid, [projection], clock)).toBe(false);
});
it.each(["question", "request", "compound", "alias", "wrong-value", "untrusted", "foreign", "revision", "tombstone", "hash", "missing"] as const)("v3 cannot use %s canonical source as value evidence", async fault => {
  const f = await fixture("existence"), sources = clone(f.sources()), source = sources[0]!;
  if (fault === "question") source.content = "What is my favorite color?";
  if (fault === "request") source.content = "Please tell me my favorite color.";
  if (fault === "compound") source.content += " My favorite color is blue.";
  if (fault === "alias") source.content = "My preferred color is apricot.";
  if (fault === "wrong-value") source.content = "My favorite color is blue.";
  if (fault === "untrusted") source.lineage = { ...source.lineage, role: "assistant", trust: "assistant_claim" };
  if (fault === "foreign") source.ownerPrincipalId = "foreign";
  if (fault === "revision") source.lineage.sourceRevision = 2;
  if (fault === "tombstone") source.tombstonedAt = clock;
  if (fault === "hash") source.contentHash = "invalid";
  if (fault === "missing") sources.pop();
  expect(proveDirectFactLookup(queryText, { facts: f.facts(), candidateWorkBound: false }, clock, 3, sources)).toBeUndefined();
});
it("v3 retains prospective source deduplication, candidate ceiling and work-bound fallback", async () => {
  const f = await fixture("existence"), candidates = { facts: f.facts(), candidateWorkBound: false };
  expect(directFactLookupSourceIds(queryText, candidates, clock, 3)).toEqual([f.seedSource.lineage.sourceId]);
  for (const bounded of [{ ...candidates, candidateWorkBound: true }, { ...candidates, facts: [...candidates.facts, ...Array.from({ length: 99 }, () => candidates.facts[1]!)] }]) {
    expect(directFactLookupSourceIds(queryText, bounded, clock, 3)).toEqual([]);
    expect(proveDirectFactLookup(queryText, bounded, clock, 3, f.sources())).toBeUndefined();
  }
});
it.each(["statement", "question", "conflict"] as const)("both registered v3 paths preserve semantic fallback for an incompatible %s projection", async fault => {
  for (const path of ["public", "agent"] as const) {
    const f = await fixture("existence"), projection = f.facts().find(fact => fact.factId === "literal-existence")!;
    if (fault === "statement") projection.fact = "My favorite color is apricot.";
    if (fault === "question") projection.fact = "What is my favorite color?";
    if (fault === "conflict") Object.assign(projection, { fact: "User's favorite color is blue.", predicate: "prefers", object: "blue" });
    await replaceFactEntityLinks(f.ctx.db, projection);
    if (path === "public") {
      const result = await f.performPublic(); expect(result.memoryEffort?.retrievalRoute).toBe("semantic-v1");
      expect(embeddings).toBe(1); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
    } else {
      const run = await f.agentRun(), parent = await run.parent();
      expect(parent.direct).toBeUndefined(); expect(parent.proposal?.binding.operationKey).toBe("embedding.query");
    }
    embeddings = 0;
  }
});
it.each(["source-delete", "source-edit", "fact-expire"] as const)("v3 cold final delivery rejects late %s with both projection facts retained", async fault => {
  for (const path of ["public", "agent"] as const) {
    const f = await fixture("existence"), run = path === "agent" ? await f.agentRun() : undefined;
    const original = ConvexMemoryRepository.prototype.checkDelivery;
    const guard = jest.spyOn(ConvexMemoryRepository.prototype, "checkDelivery").mockImplementation(async function (this: InstanceType<typeof ConvexMemoryRepository>, bindings, authority) {
      expect(bindings.facts.map(fact => fact.factId).sort()).toEqual(["literal-existence", "literal-value"]);
      const source = f.sources().find(source => source.lineage.sourceId === f.seedSource.lineage.sourceId)!;
      if (fault === "source-delete") source.tombstonedAt = clock;
      if (fault === "source-edit") source.contentHash = "f".repeat(64);
      if (fault === "fact-expire") f.facts().find(fact => fact.factId === "literal-existence")!.validUntil = clock;
      return original.call(this, bindings, authority);
    });
    await expect(path === "public" ? f.performPublic() : run!.parent()).rejects.toThrow(); expect(guard).toHaveBeenCalledTimes(1); guard.mockRestore();
    expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  }
});
it("v3 revocation between direct selection and preparation remains a fresh refusal", async () => {
  const f = await fixture("existence"), run = await f.agentRun(), parent = await run.parent();
  expect(parent.direct).toBeDefined(); f.grant.revokedAt = clock;
  await expect(run.prepare()).rejects.toThrow(); expect(embeddings).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
