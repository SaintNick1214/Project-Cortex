/** Actual registered worker/ledger/Gateway composition with a controlled official
 * provider peer. Offline behavior evidence only; no paid call or service claim. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { LanguageModelV4, EmbeddingModelV4, LanguageModelV4CallOptions } from "@ai-sdk/provider";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { SourceContent } from "../../../src/domain/contracts";
import { getFunctionName } from "convex/server";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE, normalizeSourceText, semanticHash } from "../../../src/domain/profile";

let nativeText = '{"facts":[]}';
let nativeThrows = false;
const nativeCalls: LanguageModelV4CallOptions[] = [];
const language = jest.fn<(modelId: string) => LanguageModelV4>(modelId => ({
  specificationVersion: "v4", provider: "convexGateway.chat", modelId, supportedUrls: {},
  doGenerate: async input => {
    nativeCalls.push(input);
    if (nativeThrows) throw new Error("Controlled native transport failure");
    return { content: [{ type: "text", text: nativeText }], finishReason: { unified: "stop", raw: "stop" }, warnings: [],
      usage: { inputTokens: { total: 2, noCache: 2, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
      response: { body: { id: "offline-framing", model: modelId, choices: [{ finish_reason: "stop" }], usage: { prompt_tokens: 2, completion_tokens: 1 } } } };
  },
  doStream: async () => { throw new Error("Unexpected streaming"); },
}));
const embeddings = jest.fn<(modelId: string) => EmbeddingModelV4>(modelId => ({
  specificationVersion: "v4", provider: "convexGateway.embedding", modelId, maxEmbeddingsPerCall: 1, supportsParallelCalls: false,
  doEmbed: async input => {
    const values = input.values.map(() => Array.from({ length: DEFAULT_EMBEDDING_PROFILE.dimensions }, () => 0.25));
    return { embeddings: values, warnings: [], response: { body: { id: "offline-vector", model: "text-embedding-3-small",
      data: values.map(embedding => ({ embedding })), usage: { prompt_tokens: 2 } } } };
  },
}));
jest.unstable_mockModule("@convex-dev/ai-sdk-provider", () => ({ convexGateway: Object.assign(language, { embeddingModel: embeddings }) }));

const { memoryFixture, registeredHandler } = await import("../runtimeMemory/fixture");
const policy = await import("../../../convex-dev/runtimeModelPolicy");
const ingestion = await import("../../../convex-dev/runtimeIngestion");
const memory = await import("../../../convex-dev/runtimeMemory");
const beliefs = await import("../../../convex-dev/runtimeBeliefs");
const context = await import("../../../convex-dev/runtimeMemoryContext");
const { OBSERVED_GATEWAY_POLICY_MANIFEST_V17: manifest } = await import("../../../convex-dev/runtimeGatewayMediaQualifications");
const { buildSourceExtractionFramingV4 } = await import("../../../convex-dev/runtimeMemoryGateway");
const now = 1791546000000;
const valid = { facts: [{ fact: "User likes jasmine tea", factType: "preference", subject: "User", predicate: "likes", object: "jasmine tea",
  confidence: 1, tags: ["tea"], entities: [{ name: "jasmine tea", type: "product" }], relations: [{ subject: "User", predicate: "likes", object: "jasmine tea" }] }] };

async function fixture(revision = 17) {
  const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run"];
  // Convex query reads are detached JSON values. This older memory fixture's
  // direct row reads are sufficient for repository tests but would mutate a
  // claimed lease's captured pre-write counters while the worker is running.
  const query = f.db.query.bind(f.db);
  f.db.query = table => {
    const builder = query(table), methods = builder as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    for (const key of ["unique", "collect", "take", "paginate"]) {
      const read = methods[key]!;
      methods[key] = async (...args) => {
        const value = await read(...args);
        return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as unknown;
      };
    }
    return builder;
  };
  const modules = { runtimeModelPolicy: policy, runtimeIngestion: ingestion, runtimeMemory: memory, runtimeBeliefs: beliefs, runtimeMemoryContext: context };
  const invoke = async (registration: unknown, args: unknown) => registeredHandler<unknown, unknown>(registration)(f.ctx, args);
  const dispatch = async (reference: unknown, args: unknown) => {
    const [module, name] = getFunctionName(reference as Parameters<typeof getFunctionName>[0]).split(":");
    if (!Object.hasOwn(modules, module!)) throw new Error("Unexpected fixture module");
    const registration = (modules[module as keyof typeof modules] as unknown as Record<string, unknown>)[name!];
    if (!registration) throw new Error("Unexpected fixture RPC");
    return invoke(registration, args);
  };
  f.ctx.runQuery = dispatch as MutationCtx["runQuery"];
  f.ctx.runMutation = ((ref: unknown, args: unknown) => f.db.transaction(() => dispatch(ref, args))) as MutationCtx["runMutation"];
  const call = (registration: unknown, args: unknown) => f.db.transaction(() => invoke(registration, args));
  const install = (next: number) => call(policy.installDeploymentPolicy, { manifestId: manifest.manifestId, expectedRevision: next });
  await install(revision);
  const source = async (text = "User likes jasmine tea") => {
    const content = normalizeSourceText(text);
    if (!f.reference.memorySpaceId) throw new Error("Fixture memory space required");
    const value: SourceContent = { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      ownerPrincipalId: f.reference.principalId, lineage: { sourceId: "owned-source", sourceEventId: "owned-event", sourceRevision: 1,
        role: "user", trust: "user_assertion" }, content, contentHash: await semanticHash(content), createdAt: now };
    f.db.seed("runtimeMemorySources", value as unknown as Record<string, unknown>);
    return value;
  };
  const enqueue = async (value: SourceContent) => ingestion.enqueueSourceEvent(f.ctx, f.reference, value);
  const worker = async (eventId: string, stage: "extract" | "facts" | "vectors" = "extract") =>
    ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId, stage });
  return { ...f, call, install, source, enqueue, worker };
}

describe("v4 framing through registered ingestion and charge-only terminal capture", () => {
  beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(now); nativeCalls.length = 0; language.mockClear(); embeddings.mockClear(); nativeText = '{"facts":[]}'; nativeThrows = false; });
  afterEach(() => { jest.restoreAllMocks(); });

  it.each(["empty", "attributed"])("commits a valid %s instance with the measured v4 roles and original source witness", async kind => {
    const f = await fixture(); const source = await f.source(kind === "empty" ? "hello there" : "User likes jasmine tea");
    const event = await f.enqueue(source); nativeText = JSON.stringify(kind === "empty" ? { facts: [] } : valid);
    await f.worker(event.eventId);
    expect(f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")).toMatchObject({ state: "complete", attempt: 1 });
    const framing = buildSourceExtractionFramingV4(source);
    expect(nativeCalls[0]!.prompt).toEqual([{ role: "system", content: framing.system }, { role: "user", content: [{ type: "text", text: framing.prompt }] }]);
    const operation = f.db.table("runtimeModelOperations")[0]!;
    const attempt = f.db.table("runtimeModelAttempts")[0]!;
    const admitted = JSON.parse(attempt.inputProofCanonical as string).requestCanonical as string;
    const request = JSON.parse(admitted) as { texts: string[]; inputTokens: number };
    expect(request.texts).toEqual([framing.system, framing.prompt]);
    expect(request.inputTokens).toBeGreaterThanOrEqual(Buffer.byteLength(framing.system + framing.prompt, "utf8"));
    expect(JSON.parse(operation.snapshotCanonical as string).pins.promptVersion).toBe("memory-extraction-framed-prompt-v4");
    expect(operation.source).toEqual({ sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId,
      sourceRevision: 1, contentHash: source.contentHash });
    await f.worker(event.eventId, "facts"); await f.worker(event.eventId, "vectors");
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ factsState: "complete", vectorsState: "complete" });
    const facts = f.db.table("facts"); expect(facts).toHaveLength(kind === "empty" ? 0 : 1);
    if (kind === "attributed") expect(facts[0]).toMatchObject({ lineage: source.lineage, subject: "User", predicate: "likes", object: "jasmine tea" });
    expect(nativeCalls).toHaveLength(1); expect(f.db.table("runtimeModelAttempts").filter(row => row.operationDocumentId === operation._id)).toHaveLength(1);
    expect(f.db.table("runtimeModelOperations").filter(row => row.operationKey === "memory.extract")).toHaveLength(1);
  });

  it.each([
    ["malformed delimiters", '{"facts":[}'],
    ["Markdown fence", '```json\n{"facts":[]}\n```'],
    ["prose wrapper", 'Answer: {"facts":[]}'],
    ["schema definition", JSON.stringify({ type: "object", properties: { facts: { type: "array" } } })],
    ["extra root field", JSON.stringify({ facts: [], override: true })],
    ["malformed fact", JSON.stringify({ facts: [{ fact: "claimed fact" }] })],
    ["extra nested field", JSON.stringify({ facts: [{ ...valid.facts[0], entities: [{ name: "tea", type: "product", override: true }] }] })],
    ["malformed relation", JSON.stringify({ facts: [{ ...valid.facts[0], relations: [{ subject: "User", predicate: "likes" }] }] })],
    ["missing tags", JSON.stringify({ facts: [{ ...valid.facts[0], tags: undefined }] })],
    ["string tags", JSON.stringify({ facts: [{ ...valid.facts[0], tags: "tea" }] })],
    ["non-string tag", JSON.stringify({ facts: [{ ...valid.facts[0], tags: [1] }] })],
  ])("refuses %s without repair, extra operation, commit or uncertain-liability release", async (_name, text) => {
    const f = await fixture(), event = await f.enqueue(await f.source()); nativeText = text;
    await f.worker(event.eventId);
    const stage = f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")!;
    expect(stage).toMatchObject({ state: "dead_letter", failureCode: "INVALID_CONFIRMED_MODEL_OUTPUT", attempt: 1 });
    expect(stage.payloadCanonical).toBeUndefined();
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ factsState: "dead_letter", vectorsState: "pending" });
    expect(f.db.table("facts")).toEqual([]); expect(f.db.table("runtimeMemoryVectors")).toEqual([]); expect(f.db.table("runtimeBeliefOutbox")).toEqual([]);
    expect(f.db.table("runtimeModelOperations")).toHaveLength(1); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
    const operation = f.db.table("runtimeModelOperations")[0]!;
    expect(operation).toMatchObject({ reservedUnits: 0, settledUnits: 0, uncertainUnits: 100000, cancelled: false });
    const attempt = f.db.table("runtimeModelAttempts")[0]!;
    expect(attempt).toMatchObject({ state: "uncertain", slotReleased: true, resultWithheld: false, resultAttachmentState: "attached" });
    expect(JSON.parse(attempt.privateResultCanonical as string)).toEqual({ text });
    for (const account of f.db.table("runtimeBudgetAccounts")) expect(account).toMatchObject({ reservedUnits: 0, settledUnits: 0, uncertainUnits: 100000, activeConcurrency: 0 });
    const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    await expect(f.call(ingestion.retry, { eventId: event.eventId, stage: "extract" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
    await f.worker(event.eventId);
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
    expect(nativeCalls).toHaveLength(1); expect(language).toHaveBeenCalledTimes(1); expect(embeddings).not.toHaveBeenCalled();
  });

  it("does not reinterpret the retained v3 invalid result or its UNKNOWN event after installing v4", async () => {
    const f = await fixture(16), event = await f.enqueue(await f.source()); nativeText = '{"facts":[}';
    await f.worker(event.eventId);
    // Explicit historical stored state. New failures are classified, but no
    // install/replay migrates a previously published UNKNOWN event.
    f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")!.state = "unknown";
    f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")!.failureCode = "INDEXING_OUTCOME_UNKNOWN";
    f.db.table("runtimeIngestionEvents")[0]!.factsState = "unknown";
    const before = canonicalModelJson({ accounts: f.db.table("runtimeBudgetAccounts"), operations: f.db.table("runtimeModelOperations"),
      attempts: f.db.table("runtimeModelAttempts"), events: f.db.table("runtimeIngestionEvents"), stages: f.db.table("runtimeIngestionStages") });
    expect(JSON.parse(f.db.table("runtimeModelOperations")[0]!.snapshotCanonical as string).pins.promptVersion).toBe("memory-extraction-instance-prompt-v3");
    await f.install(17); await f.worker(event.eventId);
    expect(canonicalModelJson({ accounts: f.db.table("runtimeBudgetAccounts"), operations: f.db.table("runtimeModelOperations"),
      attempts: f.db.table("runtimeModelAttempts"), events: f.db.table("runtimeIngestionEvents"), stages: f.db.table("runtimeIngestionStages") })).toBe(before);
    expect(nativeCalls).toHaveLength(1);
    expect(nativeCalls[0]!.prompt[1]).toMatchObject({ role: "user", content: [{ type: "text", text: expect.stringContaining("Return the facts JSON schema") }] });
  });

  it("true native failure remains UNKNOWN, with no invented retained result or retry", async () => {
    const f = await fixture(), event = await f.enqueue(await f.source()); nativeThrows = true;
    await f.worker(event.eventId);
    expect(f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")).toMatchObject({ state: "unknown", failureCode: "INDEXING_OUTCOME_UNKNOWN" });
    expect(f.db.table("runtimeModelAttempts")[0]!.privateResultCanonical).toBeUndefined();
    await expect(f.call(ingestion.retry, { eventId: event.eventId, stage: "extract" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
    expect(nativeCalls).toHaveLength(1); expect(f.db.table("facts")).toHaveLength(0);
  });
  it("retains a confirmed duplicate extraction unchanged and commits one belief through the original native planner fence", async () => {
    const f = await fixture(), event = await f.enqueue(await f.source());
    nativeText = JSON.stringify({ facts: [valid.facts[0], structuredClone(valid.facts[0])] });
    await f.worker(event.eventId);
    const extract = f.db.table("runtimeIngestionStages").find(s => s.stage === "extract")!;
    expect(JSON.parse(extract.payloadCanonical as string)).toHaveLength(2);
    const before = canonicalModelJson(extract);
    await f.worker(event.eventId, "facts");
    expect(canonicalModelJson(extract)).toBe(before);
    expect(f.db.table("facts")).toHaveLength(1); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(1);
    expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(1); expect(nativeCalls).toHaveLength(1);
    const attempt = f.db.table("runtimeModelAttempts")[0]!;
    expect(JSON.parse(attempt.privateResultCanonical as string)).toEqual({ text: nativeText });
    expect(JSON.parse(attempt.terminalEvidenceCanonical as string).outcome).toBe("confirmed");
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ factsState: "complete", vectorsState: "pending" });
  });
  it("confirmed conflicting values are a known non-retryable ambiguity, without rewriting extraction or funding another call", async () => {
    const f = await fixture(), event = await f.enqueue(await f.source("User likes jasmine tea and lavender tea"));
    nativeText = JSON.stringify({ facts: [valid.facts[0], { ...valid.facts[0], fact: "User likes lavender tea", object: "lavender tea" }] });
    await f.worker(event.eventId); const extract = f.db.table("runtimeIngestionStages").find(s => s.stage === "extract")!;
    const before = canonicalModelJson({ extract, accounts: f.db.table("runtimeBudgetAccounts"), attempts: f.db.table("runtimeModelAttempts") });
    await f.worker(event.eventId, "facts");
    expect(f.db.table("runtimeIngestionStages").find(s => s.stage === "facts")).toMatchObject({ state: "dead_letter", failureCode: "AMBIGUOUS_EXTRACTION_SLOT" });
    expect(canonicalModelJson({ extract, accounts: f.db.table("runtimeBudgetAccounts"), attempts: f.db.table("runtimeModelAttempts") })).toBe(before);
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(0); expect(nativeCalls).toHaveLength(1);
    await expect(f.call(ingestion.retry, { eventId: event.eventId, stage: "facts" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
    await f.worker(event.eventId, "facts"); expect(nativeCalls).toHaveLength(1);
  });
  it.each(["hash", "attachment", "withheld", "terminal", "source"])("%s mismatch cannot promote uncertain work to a known invalid-output disposition", async kind => {
    const f = await fixture(), event = await f.enqueue(await f.source()); nativeText = JSON.stringify({ facts: [{ ...valid.facts[0], tags: null }] });
    const runMutation = f.ctx.runMutation.bind(f.ctx);
    f.ctx.runMutation = (async (reference, args) => {
      if (getFunctionName(reference) === "runtimeIngestion:failStage") {
        const attempt = f.db.table("runtimeModelAttempts")[0]!;
        if (kind === "hash") attempt.terminalEvidenceHash = "a".repeat(64);
        if (kind === "attachment") attempt.resultAttachmentState = "pending";
        if (kind === "withheld") attempt.resultWithheld = true;
        if (kind === "terminal") { const terminal = JSON.parse(attempt.terminalEvidenceCanonical as string); terminal.outcome = "uncertain";
          attempt.terminalEvidenceCanonical = canonicalModelJson(terminal); attempt.terminalEvidenceHash = await semanticHash(attempt.terminalEvidenceCanonical as string); }
        if (kind === "source") f.db.table("runtimeMemorySources")[0]!.contentHash = "a".repeat(64);
      }
      return runMutation(reference, args);
    }) as MutationCtx["runMutation"];
    await f.worker(event.eventId);
    expect(f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")).toMatchObject({ state: "unknown", failureCode: "INDEXING_OUTCOME_UNKNOWN" });
    expect(nativeCalls).toHaveLength(1); expect(f.db.table("facts")).toHaveLength(0);
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0);
    for (const account of f.db.table("runtimeBudgetAccounts")) expect(account).toMatchObject({ reservedUnits: 0, activeConcurrency: 0, uncertainUnits: 100000 });
  });
});
