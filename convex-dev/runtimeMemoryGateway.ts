/** Governed backend memory calls. No public action, client, token or tool loop. */
import type { LanguageModelV4, EmbeddingModelV4 } from "@ai-sdk/provider";
import { ConvexError } from "convex/values";
import type { MemoryModel, MemoryRepository, InternalModelOperation, SourceReference } from "../src/domain/contracts";
import { CONFLICT_DECISION_JSON_SCHEMA, parseConflictDecision } from "../src/domain/conflicts";
import { FACTS_JSON_SCHEMA } from "../src/domain/extraction";
import { assertEmbeddingVector, assertProfileMatches, assertSupportedEmbeddingProfile, semanticHash } from "../src/domain/profile";
import { canonicalModelJson } from "../src/domain/model-policy";
import type { ModelOperationKey } from "../src/domain/model-policy";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { EmbeddingProfile } from "../src/domain/profile";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { Id } from "./_generated/dataModel";
import { dataAuthorityReference } from "./runtimeDataAuth";
import { createBackendGatewayComposition, ensureBackendGatewayBudget } from "./runtimeGatewayBackend";
import type { BackendGatewayContext } from "./runtimeGatewayBackend";
import { createGovernedGatewayModel, GatewayDispatchError } from "./runtimeGateway";
import type { GatewayBinding, GatewayComposition } from "./runtimeGateway";
import { memoryError } from "./runtimeMemoryRepository";

/** Existing run bindings are server-issued and checked again by the native ledger. */
export interface MemoryGatewayRun {
  runBudgetId?: string;
  parentOperationId?: Id<"runtimeModelOperations">;
}

function sourceKey(source: SourceReference): string {
  return canonicalModelJson([source.sourceId, source.sourceEventId, source.sourceRevision]);
}
/** A returned native result can already be billable even when domain parsing fails. */
function invalidModelOutput(message: string): never {
  throw new ConvexError({ version: 1, code: "INVALID_MODEL_OUTPUT", message, retryable: false, outcome: "uncertain" });
}

export function createGatewayMemoryModel(
  ctx: BackendGatewayContext, repository: MemoryRepository, run: MemoryGatewayRun = {},
): MemoryModel {
  const reference = dataAuthorityReference(repository.scope);
  const native = createBackendGatewayComposition(ctx);
  let budget: Promise<string> | undefined = run.runBudgetId ? Promise.resolve(run.runBudgetId) : undefined;
  const extractionParents = new Map<string, Id<"runtimeModelOperations">>();
  // Observe the admitted identity, including replay. No second reservation/settlement.
  const composition: GatewayComposition = { ...native, ledger: { ...native.ledger,
    admit: async (args) => {
      const admitted = await native.ledger.admit(args);
      if (args.operationKey === "memory.extract" && args.source) {
        extractionParents.set(sourceKey(args.source), admitted.operationId);
      }
      return admitted;
    },
  } };
  async function prepare(request: InternalModelOperation, key: ModelOperationKey, ordinal: number) {
    if (request.attempt !== 1) memoryError("INVALID_INPUT", "Memory inference retries require a new governed operation");
    await repository.recheckAuthority();
    let source: GatewayBinding["source"];
    if (request.source) {
      const current = await repository.getSource(request.source.sourceId);
      if (!current || current.lineage.sourceEventId !== request.source.sourceEventId
        || current.lineage.sourceRevision !== request.source.sourceRevision) memoryError("STALE_SOURCE", "Source changed before model dispatch or commit");
      // Domain extraction supplies SourceLineage (role/trust included). Native
      // modelSource is a strictly smaller RPC contract; never spread attribution.
      source = { sourceId: request.source.sourceId, sourceEventId: request.source.sourceEventId,
        sourceRevision: request.source.sourceRevision, contentHash: current.contentHash };
    }
    const semanticId = await semanticHash(canonicalModelJson([key, request.operationId, request.policyVersion]));
    if (!budget) {
      budget = ensureBackendGatewayBudget(ctx, { reference, operationKey: key, requestId: semanticId,
        requestCanonical: canonicalModelJson(request) }).then((value) => value.runBudgetId);
    }
    const parent = key === "memory.extract" ? run.parentOperationId
      : request.source ? extractionParents.get(sourceKey(request.source)) ?? run.parentOperationId : run.parentOperationId;
    const binding: GatewayBinding = { reference, operationKey: key, runBudgetId: await budget, semanticId, ordinal,
      ...(source ? { source } : {}), ...(parent ? { parentOperationId: parent } : {}) };
    // Caps are trusted policy data. A concurrent policy change can only make the
    // subsequent model admission reject; caller options cannot enlarge the caps.
    const resolution = await composition.ledger.resolve(binding);
    const governed = await createGovernedGatewayModel(composition, binding);
    return { ...governed, resolution };
  }
  async function text(request: Parameters<MemoryModel["extract"]>[0] | Parameters<MemoryModel["resolve"]>[0]): Promise<string> {
    const call = await prepare(request, request.purpose, 0);
    try {
      if (!("doGenerate" in call.model)) throw new GatewayDispatchError("MODEL_IDENTITY_MISMATCH");
      try {
        const schema = request.purpose === "memory.extract" ? FACTS_JSON_SCHEMA : CONFLICT_DECISION_JSON_SCHEMA;
        // Semantic admission metadata is not sent as native response_format.
        // Include the trusted schema in the actual prompt, so its bytes are also
        // measured, admitted and recorded by the governed model middleware.
        const system = `${request.system}\n\nReturn ONLY a JSON object conforming to this schema. Do not use Markdown fences or add other fields:\n${canonicalModelJson(schema)}`;
        const result = await (call.model as LanguageModelV4).doGenerate({
          prompt: [{ role: "system", content: system },
            { role: "user", content: [{ type: "text", text: request.prompt }] }],
          maxOutputTokens: Math.min(call.resolution.snapshot.limits.outputTokens,
            call.resolution.dispatchEvidence.resultBound.maximumOutputTokens),
          abortSignal: call.lifecycle.signal,
        });
        const content = result.content.filter((part) => part.type === "text").map((part) => part.text).join("");
        if (!content.trim()) invalidModelOutput("Memory model returned no text");
        return content;
      } catch (error) {
        if (!(error instanceof GatewayDispatchError) || error.code !== "REPLAY_AVAILABLE") throw error;
        const replay = await call.lifecycle.consumeReplay();
        if (!replay || !("text" in replay)) throw new GatewayDispatchError("INVALID_REPLAY");
        return replay.text;
      }
    } finally { await call.lifecycle.complete(); }
  }
  return {
    resolveProfile: async (purpose) => {
      await repository.recheckAuthority();
      if (!budget) budget = ensureBackendGatewayBudget(ctx, { reference, operationKey: purpose,
        requestId: await semanticHash(canonicalModelJson([purpose, "profile-resolution", run.parentOperationId ?? null])),
        requestCanonical: canonicalModelJson({ purpose, profileResolution: 1 }) }).then(value => value.runBudgetId);
      const runBudgetId = await budget;
      const profile = await ctx.runQuery(makeFunctionReference("runtimeModelPolicy:embeddingProfile") as unknown as FunctionReference<"query", "internal",
        { reference: RuntimeAuthorityReference; operationKey: "embedding.memory" | "embedding.query"; runBudgetId: string }, EmbeddingProfile>,
        { reference, operationKey: purpose, runBudgetId });
      assertSupportedEmbeddingProfile(profile); return { profile, runBudgetId };
    },
    extract: async (request) => {
      if (canonicalModelJson(request.schema) !== canonicalModelJson(FACTS_JSON_SCHEMA)) memoryError("INVALID_INPUT", "Extraction schema does not match the deployed domain contract");
      // Domain extraction validates this JSON and assigns source attribution.
      const content = await text(request);
      try { return JSON.parse(content) as unknown; }
      catch { return invalidModelOutput("Memory extraction returned invalid JSON"); }
    },
    resolve: async (request) => {
      const content = await text(request);
      try { return parseConflictDecision(content); }
      catch { return invalidModelOutput("Memory conflict resolution returned invalid JSON"); }
    },
    embed: async (request) => {
      assertSupportedEmbeddingProfile(request.profile);
      const vectors: number[][] = [];
      // One native request/reservation per value. A hidden SDK batch split cannot
      // create a second billable request under the first operation's reservation.
      for (let ordinal = 0; ordinal < request.texts.length; ordinal++) {
        const call = await prepare(request, request.purpose, ordinal);
        try {
          assertProfileMatches(request.profile, call.resolution.snapshot.semanticProfile!);
          if (!("doEmbed" in call.model)) throw new GatewayDispatchError("MODEL_IDENTITY_MISMATCH");
          try {
            const result = await (call.model as EmbeddingModelV4).doEmbed({ values: [request.texts[ordinal]!], abortSignal: call.lifecycle.signal });
            try { assertEmbeddingVector(result.embeddings[0]!, request.profile); }
            catch { invalidModelOutput("Memory model returned an invalid embedding"); }
            vectors.push([...result.embeddings[0]!]);
          } catch (error) {
            if (!(error instanceof GatewayDispatchError) || error.code !== "REPLAY_AVAILABLE") throw error;
            const replay = await call.lifecycle.consumeReplay();
            if (!replay || !("vectors" in replay)) throw new GatewayDispatchError("INVALID_REPLAY");
            assertProfileMatches(replay.profile, request.profile);
            assertEmbeddingVector(replay.vectors[0]!, request.profile);
            vectors.push([...replay.vectors[0]!]);
          }
        } finally { await call.lifecycle.complete(); }
      }
      return { profile: request.profile, vectors };
    },
  };
}
