/** Fixed ordinary-domain selection. Caller scope is selection, not authentication. */
import { ConvexError, convexToJson, v, type Value } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { digest } from "./factHistoryProvenance";
import { validateDomainScope } from "./domainScope";
import { requireLifecycleReady, readPhysicalAuthority, referenceDigest } from "./referenceLifecycle";

export const memoryFilterFields = {
  tenantId: v.optional(v.string()), memorySpaceId: v.string(),
  userId: v.optional(v.string()), participantId: v.optional(v.string()),
  sourceType: v.optional(v.union(v.literal("conversation"), v.literal("system"), v.literal("tool"), v.literal("a2a"), v.literal("fact-extraction"))),
  tags: v.optional(v.array(v.string())), tagMatch: v.optional(v.union(v.literal("any"), v.literal("all"))),
  minImportance: v.optional(v.number()), importance: v.optional(v.number()),
  createdBefore: v.optional(v.number()), createdAfter: v.optional(v.number()),
  updatedBefore: v.optional(v.number()), updatedAfter: v.optional(v.number()),
  lastAccessedBefore: v.optional(v.number()), lastAccessedAfter: v.optional(v.number()),
  accessCount: v.optional(v.number()), version: v.optional(v.number()),
  contentType: v.optional(v.union(v.literal("raw"), v.literal("summarized"), v.literal("fact"))),
};
export const conversationFilterFields = {
  tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()),
  userId: v.optional(v.string()), participantId: v.optional(v.string()),
  type: v.optional(v.union(v.literal("user-agent"), v.literal("agent-agent"))),
  dateStart: v.optional(v.number()), dateEnd: v.optional(v.number()),
  createdBefore: v.optional(v.number()), createdAfter: v.optional(v.number()),
  updatedBefore: v.optional(v.number()), updatedAfter: v.optional(v.number()),
  lastMessageBefore: v.optional(v.number()), lastMessageAfter: v.optional(v.number()),
  messageCountMin: v.optional(v.number()), messageCountMax: v.optional(v.number()),
  metadata: v.optional(v.any()), conversationIds: v.optional(v.array(v.string())),
};
export interface MemorySelection {
  tenantId?: string; memorySpaceId: string; userId?: string; participantId?: string;
  sourceType?: string; tags?: string[]; tagMatch?: "any" | "all"; minImportance?: number; importance?: number;
  createdBefore?: number; createdAfter?: number; updatedBefore?: number; updatedAfter?: number;
  lastAccessedBefore?: number; lastAccessedAfter?: number; accessCount?: number; version?: number; contentType?: string;
}
export interface ConversationSelection {
  tenantId?: string; memorySpaceId?: string; userId?: string; participantId?: string;
  type?: string; dateStart?: number; dateEnd?: number; createdBefore?: number; createdAfter?: number;
  updatedBefore?: number; updatedAfter?: number; lastMessageBefore?: number;
  lastMessageAfter?: number; messageCountMin?: number; messageCountMax?: number;
  metadata?: unknown; conversationIds?: string[];
}
export function domainInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new ConvexError("DOMAIN_INVALID_WINDOW");
  return value;
}
/** Validate fixed selected-domain filters even when the selected query is empty. */
export function validateDomainSelection(value: object): void {
  const args = value as Record<string, unknown>;
  for (const key of ["memorySpaceId", "memoryId", "conversationId", "userId", "participantId"])
    if (args[key] !== undefined && (typeof args[key] !== "string" || !(args[key] as string).trim())) throw new ConvexError("DOMAIN_INVALID_FILTER");
  for (const key of ["dateStart", "dateEnd", "createdBefore", "createdAfter", "updatedBefore", "updatedAfter", "lastMessageBefore", "lastMessageAfter", "lastAccessedBefore", "lastAccessedAfter", "since", "until", "validAt"])
    if (args[key] !== undefined && (typeof args[key] !== "number" || !Number.isFinite(args[key]) || (args[key] as number) < 0)) throw new ConvexError("DOMAIN_INVALID_DATE");
  for (const [start, end] of [["dateStart", "dateEnd"], ["since", "until"]])
    if (args[start] !== undefined && args[end] !== undefined && (args[start] as number) > (args[end] as number)) throw new ConvexError("DOMAIN_INVALID_DATE_RANGE");
  for (const key of ["messageCountMin", "messageCountMax", "accessCount", "version", "offset"])
    if (args[key] !== undefined) domainInteger(args[key] as number, 0);
  for (const key of ["importance", "minImportance", "minConfidence", "confidence"])
    if (args[key] !== undefined && (typeof args[key] !== "number" || !Number.isFinite(args[key]) || (args[key] as number) < 0 || (args[key] as number) > 100)) throw new ConvexError("DOMAIN_INVALID_FILTER");
}
export function domainFingerprint(document: unknown): string { return digest(document); }
export function checkFingerprint(document: unknown, expected: string): void {
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new ConvexError("DOMAIN_INVALID_FINGERPRINT");
  if (domainFingerprint(document) !== expected) throw new ConvexError("DOMAIN_SELECTION_CHANGED");
}
export async function domainBudget(ctx: Pick<QueryCtx, "meta">, result: unknown): Promise<void> {
  const native = await ctx.meta.getTransactionMetrics();
  if (native.documentsRead.used > 256 || native.bytesRead.used > 2 * 1024 * 1024)
    throw new ConvexError("DOMAIN_READ_BUDGET_EXCEEDED");
  if (new TextEncoder().encode(JSON.stringify(convexToJson(result as Value))).byteLength > 8 * 1024 * 1024)
    throw new ConvexError("DOMAIN_RESULT_BUDGET_EXCEEDED");
}
export function domainPageOptions(opts: {numItems: number; cursor: string | null; endCursor?: string | null}) {
  if (!Number.isInteger(opts.numItems) || opts.numItems < 1 || opts.numItems > 128)
    throw new ConvexError("DOMAIN_INVALID_PAGE_SIZE");
  return {...opts, maximumRowsRead: 256, maximumBytesRead: 2 * 1024 * 1024};
}
export async function scopedMemory(ctx: Pick<QueryCtx, "db">, args: {tenantId?: string; memorySpaceId: string; memoryId: string}) {
  validateDomainSelection(args);
  validateDomainScope(args.tenantId);
  const rows = await ctx.db.query("memories").withIndex("by_history_scope_memory", q =>
    q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("memoryId", args.memoryId)).take(2);
  if (rows.length > 1) throw new ConvexError("DOMAIN_SCOPE_AMBIGUOUS");
  return rows[0] ?? null;
}
export async function scopedConversation(ctx: Pick<QueryCtx, "db">, args: {tenantId?: string; conversationId: string}) {
  validateDomainSelection(args);
  validateDomainScope(args.tenantId);
  const rows = await ctx.db.query("conversations").withIndex("by_tenant_conversationId", q =>
    q.eq("tenantId", args.tenantId).eq("conversationId", args.conversationId)).take(2);
  if (rows.length > 1) throw new ConvexError("DOMAIN_SCOPE_AMBIGUOUS");
  return rows[0] ?? null;
}
export function matchesMemory(row: Doc<"memories">, args: MemorySelection): boolean {
  return row.tenantId === args.tenantId && row.memorySpaceId === args.memorySpaceId &&
    (args.userId === undefined || row.userId === args.userId || row.sourceUserId === args.userId) &&
    (args.participantId === undefined || row.participantId === args.participantId) &&
    (args.sourceType === undefined || row.sourceType === args.sourceType) &&
    (args.minImportance === undefined || row.importance >= args.minImportance) &&
    (args.importance === undefined || row.importance === args.importance) &&
    (args.createdBefore === undefined || row.createdAt < args.createdBefore) &&
    (args.createdAfter === undefined || row.createdAt > args.createdAfter) &&
    (args.updatedBefore === undefined || row.updatedAt < args.updatedBefore) &&
    (args.updatedAfter === undefined || row.updatedAt > args.updatedAfter) &&
    (args.lastAccessedBefore === undefined || (row.lastAccessed !== undefined && row.lastAccessed < args.lastAccessedBefore)) &&
    (args.lastAccessedAfter === undefined || (row.lastAccessed !== undefined && row.lastAccessed > args.lastAccessedAfter)) &&
    (args.accessCount === undefined || row.accessCount === args.accessCount) &&
    (args.version === undefined || row.version === args.version) &&
    (args.contentType === undefined || row.contentType === args.contentType) &&
    (!args.tags?.length || (args.tagMatch === "all" ? args.tags.every(tag => row.tags.includes(tag)) : args.tags.some(tag => row.tags.includes(tag))));
}
export function matchesConversation(row: Doc<"conversations">, args: ConversationSelection): boolean {
  const last = row.messages[row.messages.length - 1]?.timestamp ?? row.createdAt;
  return row.tenantId === args.tenantId &&
    (args.memorySpaceId === undefined || row.memorySpaceId === args.memorySpaceId) &&
    (args.userId === undefined || row.participants.userId === args.userId) &&
    (args.participantId === undefined || row.participantId === args.participantId) &&
    (args.type === undefined || row.type === args.type) &&
    (args.dateStart === undefined || row.createdAt >= args.dateStart) &&
    (args.dateEnd === undefined || row.createdAt <= args.dateEnd) &&
    (args.createdBefore === undefined || row.createdAt < args.createdBefore) &&
    (args.createdAfter === undefined || row.createdAt > args.createdAfter) &&
    (args.updatedBefore === undefined || row.updatedAt < args.updatedBefore) &&
    (args.updatedAfter === undefined || row.updatedAt > args.updatedAfter) &&
    (args.lastMessageBefore === undefined || last < args.lastMessageBefore) &&
    (args.lastMessageAfter === undefined || last > args.lastMessageAfter) &&
    (args.messageCountMin === undefined || row.messageCount >= args.messageCountMin) &&
    (args.messageCountMax === undefined || row.messageCount <= args.messageCountMax) &&
    (!args.conversationIds || args.conversationIds.includes(row.conversationId)) &&
    (args.metadata === undefined || (args.metadata !== null && typeof args.metadata === "object" && !Array.isArray(args.metadata) && row.metadata !== undefined && Object.entries(args.metadata as Record<string, unknown>)
      .every(([key, value]) => Object.prototype.hasOwnProperty.call(row.metadata, key) && digest(row.metadata![key]) === digest(value))));
}

/** Existing physical bindings only. Export-only factHistory associations confer no authority. */
export async function selectedFactSource(ctx: QueryCtx, fact: Doc<"facts">, memory: Doc<"memories">): Promise<boolean> {
  await requireLifecycleReady(ctx);
  const targets = await ctx.db.query("cortexReferenceTargets").withIndex("by_key", q => q.eq("key", `document:facts:${fact._id}`)).take(2);
  if (targets.length !== 1) throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
  const source = targets[0];
  if (source.state !== "live" || source.referenceDigest !== referenceDigest("facts", fact)) throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
  const bindings = await ctx.db.query("cortexReferenceEdges").withIndex("by_source", q => q.eq("sourceTargetId", source._id)).collect();
  const matches = bindings.filter(edge => edge.slot === "sourceRef.memoryId" && edge.role === "memory");
  if (matches.length !== 1 || !matches[0].targetTargetId || !["authority", "physical"].includes(matches[0].kind)) throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
  const edge = matches[0], target = await ctx.db.get(edge.targetTargetId!);
  if (!target || target.kind !== "document" || target.table !== "memories") throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
  // A retained tombstone binding never becomes authority over a replacement logical ID.
  if (target.documentId !== memory._id) return false;
  const owner = memory.userId ?? memory.sourceUserId;
  if (owner === undefined || (fact.userId !== undefined && fact.userId !== owner) || target.ownershipRevision !== edge.capturedOwnershipRevision || !(await readPhysicalAuthority(ctx, source._id, owner, {tenantId: memory.tenantId, memorySpaceId: memory.memorySpaceId}))) throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
  return true;
}

/** Capture before deletion removes ordinary outgoing edges. Graph completion belongs Task20. */
export async function domainGraphIdentity(ctx: Pick<QueryCtx, "db">, table: "memories" | "facts" | "conversations", row: Doc<"memories"> | Doc<"facts"> | Doc<"conversations">) {
  const targets = await ctx.db.query("cortexReferenceTargets").withIndex("by_key", q => q.eq("key", `document:${table}:${row._id}`)).take(2);
  if (targets.length !== 1 || targets[0].state !== "live") throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
  const target = targets[0];
  const edges = await ctx.db.query("cortexReferenceEdges").withIndex("by_source", q => q.eq("sourceTargetId", target._id)).take(257);
  if (edges.length > 256) throw new ConvexError("DOMAIN_READ_BUDGET_EXCEEDED");
  const logicalId = table === "memories" ? (row as Doc<"memories">).memoryId : table === "facts" ? (row as Doc<"facts">).factId : (row as Doc<"conversations">).conversationId;
  return {table, kind: table === "memories" ? "Memory" as const : table === "facts" ? "Fact" as const : "Conversation" as const, sourceDocumentId: row._id, tenantScope: row.tenantId === undefined ? {kind: "tenantless" as const} : {kind: "tenant" as const, tenantId: row.tenantId}, memorySpaceId: row.memorySpaceId, logicalId, targetId: target._id, generation: target.generation, referenceRevision: target.revision, ownershipRevision: target.ownershipRevision ?? 1,
    bindings: edges.map(edge => ({role: edge.role, slot: edge.slot, kind: edge.kind, ...(edge.targetTargetId ? {targetId: edge.targetTargetId} : {}), ...(edge.capturedOwnershipRevision !== undefined ? {capturedOwnershipRevision: edge.capturedOwnershipRevision} : {}), ...(edge.capturedTargetTenantId !== undefined ? {capturedTenantId: edge.capturedTargetTenantId} : {}), ...(edge.capturedTargetMemorySpaceId !== undefined ? {capturedMemorySpaceId: edge.capturedTargetMemorySpaceId} : {})}))};
}

/** Guarded archive/update rechecks the captured physical source, never a logical replacement. */
export async function checkArchiveFactAuthority(ctx: QueryCtx, fact: Doc<"facts">): Promise<void> {
  if (!fact.sourceRef?.memoryId) return;
  const targets = await ctx.db.query("cortexReferenceTargets").withIndex("by_key", q => q.eq("key", `document:facts:${fact._id}`)).take(2);
  if (targets.length !== 1) throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
  const edges = await ctx.db.query("cortexReferenceEdges").withIndex("by_source", q => q.eq("sourceTargetId", targets[0]._id)).take(257);
  if (edges.length > 256) throw new ConvexError("DOMAIN_READ_BUDGET_EXCEEDED");
  const selected = edges.filter(edge => edge.role === "memory" && edge.slot === "sourceRef.memoryId");
  if (selected.length !== 1 || !selected[0].targetTargetId) throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
  const target = await ctx.db.get(selected[0].targetTargetId!);
  const id = target?.table === "memories" && target.documentId ? ctx.db.normalizeId("memories", target.documentId) : null;
  const memory = id ? await ctx.db.get(id) : null;
  if (!memory || !(await selectedFactSource(ctx, fact, memory))) throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
}
/** A concurrent new physical dependant is refused in the source-deletion transaction. */
export async function requireNoLinkedFacts(ctx: QueryCtx, memory: Doc<"memories">): Promise<void> {
  const targets = await ctx.db.query("cortexReferenceTargets").withIndex("by_key", q => q.eq("key", `document:memories:${memory._id}`)).take(2);
  if (targets.length !== 1) throw new ConvexError("SOURCE_PROVENANCE_UNRESOLVED");
  const edges = await ctx.db.query("cortexReferenceEdges").withIndex("by_target", q => q.eq("targetTargetId", targets[0]._id)).take(257);
  if (edges.length > 256) throw new ConvexError("DOMAIN_READ_BUDGET_EXCEEDED");
  for (const edge of edges) {
    if (edge.role !== "memory" || edge.slot !== "sourceRef.memoryId") continue;
    const source = await ctx.db.get(edge.sourceTargetId);
    if (source?.state === "live" && source.table === "facts" && source.documentId) {
      const id = ctx.db.normalizeId("facts", source.documentId);
      const fact = id ? await ctx.db.get(id) : null;
      if (fact && fact.tenantId === memory.tenantId && fact.memorySpaceId === memory.memorySpaceId) throw new ConvexError("DOMAIN_SELECTION_CHANGED");
    }
  }
}
