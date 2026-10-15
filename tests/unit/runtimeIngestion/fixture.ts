import { getFunctionName } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { transcriptFixture, invoke, ledger, installIngestionMockRoot } from "../runtimeTranscript/fixture";
import { semanticHash } from "../../../src/domain/profile";
import { normalizeSourceText } from "../../../src/domain/profile";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import type { TrustedModelPolicyRecord } from "../../../src/domain/model-policy";
import type { SourceContent } from "../../../src/domain/contracts";
import type { RuntimeAuthorityReference } from "../../../src/auth/verified";
import { parseSourceFactsResponse } from "../../../src/domain/sources";
export { installIngestionMockRoot, invoke };
export const ingestion = await import("../../../convex-dev/runtimeIngestion");
export const beliefs = await import("../../../convex-dev/runtimeBeliefs");
const context = await import("../../../convex-dev/runtimeMemoryContext");
const memory = await import("../../../convex-dev/runtimeMemory");
export async function ingestionFixture() {
  const f = await transcriptFixture({ maxContextTokens: 16384 });
  const oldQuery = f.ctx.runQuery.bind(f.ctx); const oldMutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runQuery = (async (ref, args) => {
    let name: string;
    try { name = getFunctionName(ref); } catch { return await oldQuery(ref, args); }
    if (name === "runtimeModelPolicy:resolve") return await invoke(ledger.resolve, f.ctx, args);
    if (name === "runtimeIngestion:hydrate") return await invoke(ingestion.hydrate, f.ctx, args);
    if (name === "runtimeIngestion:stageInput") return await invoke(ingestion.stageInput, f.ctx, args);
    const reads = { "runtimeMemoryContext:stageProgress": context.stageProgress, "runtimeMemoryContext:pendingContext": context.pendingContext,
      "runtimeMemoryContext:indexedSourceAtCutoff": context.indexedSourceAtCutoff, "runtimeMemory:checkAuthority": memory.checkAuthority,
      "runtimeMemory:readSource": memory.readSource };
    if (name in reads) return await invoke(reads[name as keyof typeof reads], f.ctx, args);
    return await oldQuery(ref, args);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => {
    let name: string;
    try { name = getFunctionName(ref); } catch { return await oldMutation(ref, args); }
    const registered = { "runtimeIngestion:claim": ingestion.claim, "runtimeIngestion:persistStage": ingestion.persistStage,
      "runtimeIngestion:persistDraft": ingestion.persistDraft, "runtimeIngestion:failUnclaimed": ingestion.failUnclaimed, "runtimeIngestion:expireStage": ingestion.expireStage,
      "runtimeIngestion:recoverClaim": ingestion.recoverClaim,
      "runtimeIngestion:commitVectors": ingestion.commitVectors, "runtimeIngestion:failStage": ingestion.failStage,
      "runtimeIngestion:waitForCapacity": ingestion.waitForCapacity, "runtimeBeliefs:commit": beliefs.commit, "runtimeBeliefs:replan": beliefs.replan,
      "runtimeIngestion:retireScopedSource": ingestion.retireScopedSource, "runtimeIngestion:registerCompletedDerived": ingestion.registerCompletedDerived };
    if (name in registered) return await f.transaction(async () => await invoke(registered[name as keyof typeof registered], f.ctx, args));
    return await oldMutation(ref, args);
  }) as MutationCtx["runMutation"];
  async function source(text: string, id = "source-1", revision = 1, role: "user" | "assistant" = "user") {
    const content = normalizeSourceText(text);
    const lineage = { sourceId: id, sourceEventId: id, sourceRevision: revision, ...(role === "user"
      ? { role: "user" as const, trust: "user_assertion" as const } : { role: "assistant" as const, trust: "assistant_claim" as const }) };
    const value: SourceContent = { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
      lineage, content, contentHash: await semanticHash(content), createdAt: Date.now() };
    const row = f.db.table("runtimeMemorySources").find(r => (r.lineage as typeof lineage).sourceId === id);
    if (row) await f.db.replace("runtimeMemorySources", row._id, value as unknown as Record<string, unknown>); else f.db.seed("runtimeMemorySources", value as unknown as Record<string, unknown>);
    return value;
  }
  async function claim(eventId: string, stage: "extract" | "facts" | "vectors" = "extract") {
    return await f.call<Record<string, unknown>>(ingestion.claim, { reference: f.reference, eventId, stage });
  }
  async function extraction(eventId: string, candidates: Record<string, unknown>[] = [], reference: RuntimeAuthorityReference = f.reference) {
    const owned = await f.call<Record<string, unknown>>(ingestion.claim, { reference, eventId, stage: "extract" }); const event = f.db.table("runtimeIngestionEvents").find(e => e.eventId === eventId)!;
    const identity = { reference, eventId, stage: "extract", attempt: owned.attempt, leaseVersion: owned.leaseVersion };
    const semanticId = await semanticHash(canonicalModelJson(["memory.extract", `${eventId}:extract:${owned.attempt}`, event.extractionVersion]));
    const job = f.db.table("runtimeIngestionJobs").find(j => j.eventId === eventId)!;
    const stage = f.db.table("runtimeIngestionStages").find(s => s.eventId === eventId && s.stage === "extract")!;
    // Genuine native operation linkage is exercised by claim/resolve; no dispatched paid model is claimed.
    const nativeSource = { sourceId: (event.lineage as SourceContent["lineage"]).sourceId, sourceEventId: (event.lineage as SourceContent["lineage"]).sourceEventId,
      sourceRevision: (event.lineage as SourceContent["lineage"]).sourceRevision, contentHash: event.contentHash };
    f.db.seed("runtimeModelOperations", { operationId: semanticId, reference, tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId,
      principalId: reference.principalId, semanticId, operationKey: "memory.extract", runAccountId: job.runAccountId, source: nativeSource,
      snapshotCanonical: stage.policyCanonical, resolutionCanonical: canonicalModelJson({ context: { scope: reference, operationKey: "memory.extract", runBudgetId: job.runBudgetId,
        source: { sourceId: nativeSource.sourceId, sourceEventId: nativeSource.sourceEventId, sourceRevision: nativeSource.sourceRevision }, authorizedOverrides: [] },
        policies: ((await import("../../../convex-dev/runtimeGatewayQualifications")).DEFAULT_GATEWAY_POLICY_MANIFEST.policies as readonly TrustedModelPolicyRecord[]).filter(p => !p.operationKey || p.operationKey === "memory.extract"),
        qualifications: (await import("../../../convex-dev/runtimeGatewayQualifications")).DEFAULT_GATEWAY_POLICY_MANIFEST.qualifications }),
      identityCanonical: "{}", identityHash: "a".repeat(64), reservedUnits: 0, settledUnits: 0, uncertainUnits: 0, overrun: false, cancelled: false, createdAt: Date.now() });
    const currentSource = await ingestion.readEventCurrent(f.ctx, reference, eventId, "write");
    const checked = parseSourceFactsResponse({ facts: candidates }, currentSource.source);
    await f.call(ingestion.persistStage, { ...identity, payloadCanonical: canonicalModelJson(JSON.parse(JSON.stringify(checked))) });
    return event;
  }
  return { ...f, get grant() { return f.grant; }, source, claim, extraction };
}
export function candidate(object: string) { return { fact: `User prefers ${object}`, factType: "preference", subject: "User", predicate: "prefers_color", object,
  confidence: 1, tags: [], entities: [], relations: [] }; }
