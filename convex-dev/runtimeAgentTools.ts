/** Closed server registry: definitions select these tools, never executable client callbacks. */
import { jsonSchema, tool } from "ai";
import type { Tool } from "ai";
import { ConvexError } from "convex/values";
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
import { NATIVE_TOOL_NAMES, SERVER_TOOL_SCHEMAS } from "../src/domain/agent-tools";
export { NATIVE_TOOL_NAMES, SERVER_TOOL_SCHEMAS } from "../src/domain/agent-tools";
export type ServerToolName = keyof typeof NATIVE_TOOL_NAMES;
export type ToolSourceWitness = ContextSourceWitness;
/** Model-selected tool arguments are tool evidence, never an assertion made by the user. */
export function serverToolSourceLineage(scope: TrustedMemoryScope, operationId: string): SourceLineage {
  const { sourceId, sourceEventId, sourceRevision } = explicitSourceLineage(scope, operationId);
  return { sourceId, sourceEventId, sourceRevision, role: "tool", trust: "verified_tool_evidence", operationId };
}
export function semanticToolName(name: string): ServerToolName {
  if (name === "memory_recall") return "memory.recall";
  if (name === "memory_remember") return "memory.remember";
  throw new ConvexError({ version: 1, code: "TOOL_DENIED", message: "Tool operation denied.", retryable: false, outcome: "not_dispatched" });
}
export function serverTools(names: readonly ServerToolName[]) {
  const tools: Record<string, Tool<{ text: string; limit?: number }>> = {};
  for (const name of names) {
    const native = NATIVE_TOOL_NAMES[name];
    tools[native] = tool({ description: name === "memory.recall" ? "Recall authorized Cortex memory." : "Remember explicit information in authorized Cortex memory.",
      inputSchema: jsonSchema<{ text: string; limit?: number }>({ ...SERVER_TOOL_SCHEMAS[native], required: [...SERVER_TOOL_SCHEMAS[native].required] }) });
    // No execute callback: Workflow owns approval, effect identity and durable result storage.
  }
  return tools;
}
export function validateToolInput(name: ServerToolName, input: unknown): { text: string; limit?: number } {
  const bytes = canonicalModelJson(input); if (utf8Bytes(bytes) > 8192) throw new Error("INVALID_TOOL_INPUT");
  const value: unknown = JSON.parse(bytes);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_TOOL_INPUT");
  const record = value as Record<string, unknown>; const keys = name === "memory.recall" ? ["text", "limit"] : ["text"];
  if (Object.keys(record).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(record, key))
    || typeof record.text !== "string" || !record.text.trim() || utf8Bytes(record.text) > 4096
    || (name === "memory.recall" && (!Number.isSafeInteger(record.limit) || (record.limit as number) < 1 || (record.limit as number) > 10))) throw new Error("INVALID_TOOL_INPUT");
  return { text: record.text, ...(name === "memory.recall" ? { limit: record.limit as number } : {}) };
}
export async function executeServerTool(ctx: ActionCtx, binding: { reference: RuntimeAuthorityReference; runBudgetId: string; operationId: string; parentOperationId?: Id<"runtimeModelOperations">;
  checkCurrent: () => Promise<void>; writeSource: MemoryRepository["putSource"]; commitDerived: MemoryRepository["commitDerived"] },
  name: ServerToolName, input: unknown) {
  const value = validateToolInput(name, input);
  await ctx.runQuery(runtimeAgentReference("checkToolAuthority"), { reference: binding.reference, toolName: name });
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
