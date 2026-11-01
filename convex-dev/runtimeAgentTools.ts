import { artifactMetadataWitness } from "./runtimeArtifactContext";
import type { readArtifactContext } from "./runtimeArtifactContext";
/** Closed server registry: definitions select these tools, never executable client callbacks. */
import { jsonSchema, tool } from "ai";
import type { Tool } from "ai";
import { ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MemoryRepository, SourceLineage, TrustedMemoryScope } from "../src/domain/contracts";
import type { ContextSourcePermission, ContextSourceWitness } from "../src/domain/context-witness";
import { mergeContextWitness } from "../src/domain/context-witness";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import { canonicalModelJson } from "../src/domain/model-policy";
import { createActionMemoryRepository } from "./runtimeMemoryRepository";
import { createGatewayMemoryModel } from "./runtimeMemoryGateway";
import { explicitSourceLineage, recallMemory, rememberMemory } from "./runtimeMemoryServices";
import { runtimeAgentReference } from "./runtimeAgentReferences";
import { utf8Bytes } from "../src/domain/transcript";
import { NATIVE_TOOL_NAMES_V2 as NATIVE_TOOL_NAMES, AGENT_NATIVE_TOOLS_V2 } from "../src/domain/agent-tools";
import { processSubmissionHandler } from "./runtimeMediaGateway";
import type { RuntimeMediaJobV1 } from "../src/domain/media-jobs";
export { NATIVE_TOOL_NAMES_V2 as NATIVE_TOOL_NAMES, SERVER_TOOL_SCHEMAS } from "../src/domain/agent-tools";
export type ServerToolName = keyof typeof NATIVE_TOOL_NAMES;
export type ToolSourceWitness = ContextSourceWitness;
/** Model-selected tool arguments are tool evidence, never an assertion made by the user. */
export function serverToolSourceLineage(scope: TrustedMemoryScope, operationId: string): SourceLineage {
  const { sourceId, sourceEventId, sourceRevision } = explicitSourceLineage(scope, operationId);
  return { sourceId, sourceEventId, sourceRevision, role: "tool", trust: "verified_tool_evidence", operationId };
}
export function semanticToolName(name: string): ServerToolName {
  for (const [semantic, native] of Object.entries(NATIVE_TOOL_NAMES)) if (native === name) return semantic as ServerToolName;
  throw new ConvexError({ version: 1, code: "TOOL_DENIED", message: "Tool operation denied.", retryable: false, outcome: "not_dispatched" });
}
export function serverTools(names: readonly ServerToolName[]) {
  const tools: Record<string, Tool<Record<string, unknown>>> = {};
  for (const name of names) {
    const native = NATIVE_TOOL_NAMES[name];
    const definition = AGENT_NATIVE_TOOLS_V2.find(item => item.name === native)!;
    tools[native] = tool({ description: definition.description,
      inputSchema: jsonSchema<Record<string, unknown>>({ ...definition.inputSchema, required: [...definition.inputSchema.required] }) });
    // No execute callback: Workflow owns approval, effect identity and durable result storage.
  }
  return tools;
}
type ToolInput = { text: string; limit?: number } | { prompt: string } | { artifactId: string };
export function validateToolInput(name: "memory.remember" | "memory.recall", input: unknown): { text: string; limit?: number };
export function validateToolInput(name: ServerToolName, input: unknown): ToolInput;
export function validateToolInput(name: ServerToolName, input: unknown): ToolInput {
  const bytes = canonicalModelJson(input); if (utf8Bytes(bytes) > 8192) throw new Error("INVALID_TOOL_INPUT");
  const value: unknown = JSON.parse(bytes);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_TOOL_INPUT");
  const record = value as Record<string, unknown>;
  if (name === "media.image.generate" || name === "media.video.generate" || name === "artifact.read") {
    const key = name === "artifact.read" ? "artifactId" : "prompt";
    if (Object.keys(record).length !== 1 || typeof record[key] !== "string" || !record[key].trim() || utf8Bytes(record[key]) > (key === "prompt" ? 1024 : 256)) throw new Error("INVALID_TOOL_INPUT");
    return key === "prompt" ? { prompt: record[key] } : { artifactId: record[key] };
  }
  const keys = name === "memory.recall" ? ["text", "limit"] : ["text"];
  if (Object.keys(record).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(record, key))
    || typeof record.text !== "string" || !record.text.trim() || utf8Bytes(record.text) > 4096
    || (name === "memory.recall" && (!Number.isSafeInteger(record.limit) || (record.limit as number) < 1 || (record.limit as number) > 10))) throw new Error("INVALID_TOOL_INPUT");
  return { text: record.text, ...(name === "memory.recall" ? { limit: record.limit as number } : {}) };
}
export async function executeServerTool(ctx: ActionCtx, binding: { reference: RuntimeAuthorityReference; runBudgetId: string; operationId: string; parentOperationId?: Id<"runtimeModelOperations">;
  runAccountId?: Id<"runtimeBudgetAccounts">; conversationId?: string; witnesses?: ToolSourceWitness[];
  nativeRecall?: (input: { text: string; limit: number }) => Promise<{ result: { context: string; profileId: string }; witnesses: ToolSourceWitness[] }>;
  checkCurrent: () => Promise<void>; writeSource: MemoryRepository["putSource"]; commitDerived: MemoryRepository["commitDerived"] },
  name: ServerToolName, input: unknown) {
  const value = validateToolInput(name, input);
  await ctx.runQuery(runtimeAgentReference("checkToolAuthority"), { reference: binding.reference, toolName: name });
  if (name === "media.image.generate" || name === "media.video.generate") {
    if (!("prompt" in value) || !binding.runAccountId || !binding.parentOperationId || !binding.conversationId) throw new Error("TOOL_DENIED");
    await binding.checkCurrent();
    const job = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, RuntimeMediaJobV1>("runtimeMediaJobs:enqueueTrusted"),
      { reference: binding.reference, requestId: binding.operationId, kind: name === "media.image.generate" ? "image" : "video", prompt: value.prompt,
        runBudgetId: binding.runBudgetId, runAccountId: binding.runAccountId, parentOperationId: binding.parentOperationId, conversationId: binding.conversationId, witnesses: binding.witnesses ?? [] });
    await processSubmissionHandler(ctx, { jobId: job.jobId });
    await binding.checkCurrent();
    const current = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, RuntimeMediaJobV1>("runtimeMediaJobs:getTrusted"), { reference: binding.reference, jobId: job.jobId });
    return { result: current, witnesses: [] as ToolSourceWitness[] };
  }
  if (name === "artifact.read") {
    if (!("artifactId" in value)) throw new Error("INVALID_TOOL_INPUT"); await binding.checkCurrent();
    const result = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, Awaited<ReturnType<typeof readArtifactContext>>>("runtimeMediaJobs:readArtifactTrusted"), { reference: binding.reference, artifactId: value.artifactId });
    await binding.checkCurrent(); return { result, witnesses: [] as ToolSourceWitness[], artifactWitnesses: [await artifactMetadataWitness(result)] };
  }
  if (!("text" in value)) throw new Error("INVALID_TOOL_INPUT");
  if (name === "memory.recall" && binding.nativeRecall) {
    return await binding.nativeRecall({ text: value.text, limit: value.limit! });
  }
  const base = createActionMemoryRepository(ctx, binding.reference, name === "memory.remember" ? "write" : "read");
  const witnesses = new Map<string, ToolSourceWitness>();
  const rememberSource = async (sourceId: string, expected: { sourceEventId: string; sourceRevision: number; contentHash?: string }, permission: ContextSourcePermission) => {
    const source = await base.getSource(sourceId); if (!source) throw new Error("STALE_CONTEXT");
    if (source.lineage.sourceEventId !== expected.sourceEventId || source.lineage.sourceRevision !== expected.sourceRevision
      || expected.contentHash !== undefined && source.contentHash !== expected.contentHash) throw new Error("STALE_CONTEXT");
    const witness = mergeContextWitness(witnesses.get(sourceId), { sourceId, sourceEventId: source.lineage.sourceEventId,
      sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash, permissions: [permission] });
    if (!witness) throw new Error("STALE_CONTEXT");
    witnesses.set(sourceId, witness);
  };
  const repository = { ...base, recheckAuthority: async () => { await binding.checkCurrent(); await base.recheckAuthority(); },
    listFacts: async (...args: Parameters<typeof base.listFacts>) => { await binding.checkCurrent(); const facts = await base.listFacts(...args);
      for (const fact of facts) await rememberSource(fact.lineage.sourceId, fact.lineage, "canViewFacts"); return facts; },
    searchVectors: async (...args: Parameters<typeof base.searchVectors>) => { await binding.checkCurrent(); const matches = await base.searchVectors(...args);
      for (const match of matches) await rememberSource(match.source.lineage.sourceId, { ...match.source.lineage, contentHash: match.source.contentHash }, "canViewMemories"); return matches; },
    putSource: async (...args: Parameters<typeof base.putSource>) => { await binding.checkCurrent(); return await binding.writeSource(...args); },
    commitDerived: async (...args: Parameters<typeof base.commitDerived>) => { await binding.checkCurrent(); return await binding.commitDerived(...args); } };
  const model = createGatewayMemoryModel(ctx, repository, { runBudgetId: binding.runBudgetId, parentOperationId: binding.parentOperationId });
  const adapters = { repository, model, clock: { now: () => Date.now() } };
  if (name === "memory.recall") {
    const recalled = await recallMemory(adapters, { text: value.text, requestId: binding.operationId, limit: value.limit! });
    // Private tool result may contain scoped memory. Public output exposes its phase only.
    if (utf8Bytes(recalled.context) > 8192 || witnesses.size > 32) throw new Error("CONTEXT_LIMIT_EXCEEDED");
    return { result: { context: recalled.context, profileId: recalled.profileId }, witnesses: [...witnesses.values()] };
  }
  const lineage = serverToolSourceLineage(repository.scope, binding.operationId);
  const result = await rememberMemory(adapters, { text: value.text, lineage });
  return { result: { sourceId: result.sourceId, sourceRevision: result.sourceRevision, receiptId: result.receiptId, created: result.created }, witnesses: [] as ToolSourceWitness[] };
}
