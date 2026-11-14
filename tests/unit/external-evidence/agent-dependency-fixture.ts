/** Shared controlled ports for actual Agent lineage and physical-erasure tests. */
import { getFunctionName } from "convex/server";
import { saveMessages } from "@convex-dev/agent";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { ContextSourceWitness } from "../../../src/domain/context-witness";
import type { RuntimeExternalIngestResult } from "../../../src/client-runtime/external";
const { ingestionFixture, invoke } = await import("../runtimeIngestion/fixture");
const { definitions, runs, transcript } = await import("../runtimeTranscript/fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const sources = await import("../../../convex-dev/runtimeExternalSources");
export async function dependencyFixture(options: { v8?: boolean; tools?: boolean; remember?: boolean } = {}) {
  const f = await ingestionFixture(), oldMutation = f.ctx.runMutation.bind(f.ctx), oldQuery = f.ctx.runQuery.bind(f.ctx);
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return oldQuery(ref, args); }
    const registration = name.startsWith("runtimeAgent:") ? agent[name.split(":")[1] as keyof typeof agent] : undefined;
    return registration ? invoke(registration, f.ctx, args) : oldQuery(ref, args);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return oldMutation(ref, args); }
    const registration = name.startsWith("runtimeAgent:") ? agent[name.split(":")[1] as keyof typeof agent]
      : name === "runs:claimNext" ? runs.claimNext : undefined;
    return registration ? invoke(registration, f.ctx, args) : oldMutation(ref, args);
  }) as MutationCtx["runMutation"];
  const enableTools = options.tools || options.remember;
  if (enableTools) f.grant.capabilities = [...f.grant.capabilities as string[], "tool"];
  const registryHash = options.v8 ? await definitions.executableRegistryHashV3() : await definitions.executableRegistryHash();
  const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
    memorySpaceId: "space-a", clientMutationId: "source-dependency-agent", expectedPreviousVersion: 0,
    definitionInput: { ...f.definitionInput,
      ...(enableTools ? { tools: [{ toolId: "memory.recall", toolVersion: 1, registryHash, requiredCapability: "tool", approval: "none" },
        ...(options.remember ? [{ toolId: "memory.remember", toolVersion: 1, registryHash, requiredCapability: "tool", approval: "none" }] : [])] } : {}),
      context: { ...f.definitionInput.context, maxContextTokens: 16384, ...(options.v8 ? { handlerId: "cortex.transcript.relevant", registryHash: await definitions.executableRegistryHashV3(),
        inputSelection: { version: 1, recentMessages: 4, relevantMemories: 4, relevantFacts: 4, pendingEntries: 4, maxMessages: 16 } } : {}) },
      policies: [{ policyId: "dependency-policy", version: 1, rules: { limits: { inputTokens: 64000, outputTokens: 256, toolSteps: enableTools ? 4 : 0 } } }],
    },
  });
  async function start(conversationId?: string) {
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: { ...f.request("dependency-run", conversationId), agentId: published.agentId, agentVersion: published.version } });
    await f.call(agent.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0]!;
    return { run, owned, attempt: { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number } };
  }
  async function external(id = "dependency-root") {
    const captured = await f.call<RuntimeExternalIngestResult>(sources.ingest, { requestId: id, input: { provider: "archive", externalSourceId: id, externalEventId: `${id}:1`, externalRevision: 1,
      originalText: `ERASE-AGENT-PRIVATE-${id}`, author: { id: "external-author" }, observedAt: 2, provenance: {}, attribution: "unverified_external", extraction: "none" } });
    const source = (await f.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("lineage.sourceId", captured.receipt.reference.sourceId)).unique())!;
    const witness: ContextSourceWitness = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId,
      sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash };
    return { captured, source, witness, scope: { tenantId: "tenant-a", memorySpaceId: "space-a", sourceId: source.lineage.sourceId } };
  }
  return { ...f, start, external };
}
type Fixture = Awaited<ReturnType<typeof dependencyFixture>>;
export async function generated(f: Fixture, witness: ContextSourceWitness) {
  const created = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "dependency-history" });
  const conversation = (await f.ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("conversationId", created.conversationId)).unique())!;
  const saved = await saveMessages(f.ctx, transcript.agentComponent, { threadId: conversation.threadId, messages: [
    { role: "user", content: "Authored host text survives even with matching ERASE-AGENT-PRIVATE-dependency-root" },
    { role: "assistant", content: "Derived answer ERASE-AGENT-PRIVATE-dependency-root" },
  ] });
  await transcript.registerMessages(f.ctx, conversation, f.reference, saved.messages, { contextSourceWitnesses: [witness] });
  const bridges = await f.ctx.db.query("runtimeTranscriptMessages").withIndex("by_conversation_position", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("conversationId", conversation.conversationId)).collect();
  return { conversation, user: bridges.find(row => row.role === "user")!, assistant: bridges.find(row => row.role === "assistant")! };
}
