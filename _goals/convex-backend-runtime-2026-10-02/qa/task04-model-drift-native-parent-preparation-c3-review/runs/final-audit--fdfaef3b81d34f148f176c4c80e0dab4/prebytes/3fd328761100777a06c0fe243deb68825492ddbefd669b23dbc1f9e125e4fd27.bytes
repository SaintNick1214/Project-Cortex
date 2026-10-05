/** Scoped data selections for alternate public endpoints. Caller labels are never grants. */
import { ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeAuthority, RuntimeAuthorityReference, RuntimeAuthorityRequirement, RuntimeCapability, RuntimeResource } from "../src/auth/verified";
import type { SourceLineage } from "../src/domain/contracts";
import { normalizeSourceText, semanticHash } from "../src/domain/profile";
import { assertSourceLineage } from "../src/domain/sources";
import { assertResourceScope, createAuthorityReader, recheckAuthority, requireAuthority, resolveAuthority, resolveAuthorityReference } from "./runtimeAuth";
import type { AuthorityReader, GrantRecord } from "./runtimeAuth";

export type ScopedDataAuthority = RuntimeAuthority & { memorySpaceId: string; memorySpaceEpoch: number };
type ReadCtx = Pick<QueryCtx, "db">;
type DataTable = "memories" | "facts";
type DataRow = Doc<"memories"> | Doc<"facts">;
type Capability = "read" | "write";
export function dataDenied(code = "FORBIDDEN", message = "Access denied"): never {
  throw new ConvexError({ version: 1, code, message, retryable: false, outcome: "not_dispatched" });
}
function concrete(authority: RuntimeAuthority): ScopedDataAuthority {
  if (!authority.memorySpaceId || authority.memorySpaceEpoch === undefined) dataDenied();
  return { ...authority, memorySpaceId: authority.memorySpaceId, memorySpaceEpoch: authority.memorySpaceEpoch };
}
/** Every external query execution reloads grants; omitted selectors derive one trusted concrete scope. */
export async function requireDataAuthority(ctx: Pick<QueryCtx, "auth" | "db">,
  selectors: { tenantId?: string; memorySpaceId?: string }, capability: RuntimeCapability): Promise<ScopedDataAuthority> {
  const authority = await requireAuthority(ctx, { capability, tenantId: selectors.tenantId, memorySpaceId: selectors.memorySpaceId });
  if (authority.memorySpaceId) return concrete(authority);
  const spaces = await ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space", q => q.eq("tenantId", authority.tenantId)).collect();
  const eligible = spaces.filter(space => space.memorySpaceId && space.deletedAt === undefined);
  if (eligible.length !== 1) dataDenied();
  return concrete(await requireAuthority(ctx, { capability, tenantId: authority.tenantId, memorySpaceId: eligible[0].memorySpaceId }));
}
export async function recheckDataAuthority(ctx: ReadCtx, reference: RuntimeAuthorityReference,
  capability: RuntimeCapability): Promise<ScopedDataAuthority> {
  return concrete(await recheckAuthority(ctx, reference, { capability, tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId }));
}
/** Explicit typed names of actual internal registrations, until coordinator-owned codegen. */
function internalQueryRef<Args extends Record<string, unknown>, Result>(name: string) {
  return makeFunctionReference<"query", Args, Result>(name) as unknown as FunctionReference<"query", "internal", Args, Result>;
}
export const dataAuthReferences = {
  authorize: internalQueryRef<{ requirement: RuntimeAuthorityRequirement }, RuntimeAuthority>("runtimeAuth:authorize"),
  recheck: internalQueryRef<{ reference: RuntimeAuthorityReference; requirement: RuntimeAuthorityRequirement }, RuntimeAuthority>("runtimeAuth:recheck"),
};
/** runQuery inherits Convex-verified auth. No public reference or JWT argument establishes identity. */
export async function requireActionDataAuthority(ctx: Pick<ActionCtx, "runQuery">,
  selectors: { tenantId?: string; memorySpaceId?: string }, capability: Capability): Promise<ScopedDataAuthority> {
  return concrete(await ctx.runQuery(dataAuthReferences.authorize, { requirement: { capability,
    tenantId: selectors.tenantId, memorySpaceId: selectors.memorySpaceId } }));
}
export async function recheckActionDataAuthority(ctx: Pick<ActionCtx, "runQuery">,
  reference: RuntimeAuthorityReference, capability: Capability): Promise<void> {
  await ctx.runQuery(dataAuthReferences.recheck, { reference, requirement: { capability,
    tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId } });
}
/** Actor metadata may narrow/filter requests, but public writes cannot impersonate another actor. */
export function bindDataActor(authority: RuntimeAuthority, label?: string): string {
  if (label !== undefined && label !== authority.userId) dataDenied();
  return authority.userId;
}
export function rejectUnqualifiedEmbedding(embedding?: readonly number[]): void {
  if (embedding !== undefined) dataDenied("PROFILE_NOT_READY", "Caller embeddings lack qualified source/profile provenance; use the modern profiled runtime retrieval adapter");
}
function resource(row: DataRow): RuntimeResource {
  return { resourceType: "memoryId" in row ? "memory" : "fact", resourceId: "memoryId" in row ? row.memoryId : row.factId,
    tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, ownerPrincipalId: row.ownerPrincipalId };
}
export async function assertOwnedResource(ctx: ReadCtx, authority: ScopedDataAuthority, capability: RuntimeCapability,
  target: RuntimeResource): Promise<void> {
  // Missing ownership never becomes adoption, including cross-principal grants.
  if (!target.ownerPrincipalId) dataDenied();
  assertResourceScope(authority, target);
  await recheckAuthority(ctx, authority, { capability, tenantId: authority.tenantId, memorySpaceId: authority.memorySpaceId, resource: target });
}
function sameLineage(a: SourceLineage, b: SourceLineage): boolean {
  return a.sourceId === b.sourceId && a.sourceEventId === b.sourceEventId && a.sourceRevision === b.sourceRevision
    && a.role === b.role && a.trust === b.trust
    && ("operationId" in a ? a.operationId : undefined) === ("operationId" in b ? b.operationId : undefined);
}
/** Private server witness; public validators/metadata never accept it. */
export type CanonicalSourceWitness = Readonly<Doc<"runtimeMemorySources">>;
/** Private linked admissions follow retained source objects across array concatenation. */
type LinkedWitness = {
  table: "conversations" | "immutable" | "mutable" | DataTable;
  target: RuntimeResource; storageId: string;
  selectors: { type?: string; id?: string; namespace?: string; key?: string };
  expectedVersion?: number; messageIds?: readonly string[]; conversationId?: string; dataBinding?: string;
};
function linkedDataBinding(row: DataRow): string {
  return JSON.stringify({ lineage: row.lineage, conversationRef: "conversationRef" in row ? row.conversationRef : undefined,
    factsRef: "factsRef" in row ? row.factsRef : undefined, immutableRef: "immutableRef" in row ? row.immutableRef : undefined,
    mutableRef: "mutableRef" in row ? row.mutableRef : undefined, sourceRef: "sourceRef" in row ? row.sourceRef : undefined });
}
const operationLinks = new WeakMap<CanonicalSourceWitness[], LinkedWitness[]>();
const sourceLinks = new WeakMap<CanonicalSourceWitness, LinkedWitness[]>();
function retainedLinks(witnesses: CanonicalSourceWitness[]): LinkedWitness[] {
  let links = operationLinks.get(witnesses);
  if (!links) { links = []; operationLinks.set(witnesses, links); }
  return links;
}
function allLinkedWitnesses(witnesses: readonly CanonicalSourceWitness[]): LinkedWitness[] {
  return [...new Set(witnesses.flatMap(witness => sourceLinks.get(witness) ?? []))];
}
async function authorizeLinkedWitnesses(ctx: ReadCtx, authority: ScopedDataAuthority, capability: Capability,
  witnesses: readonly CanonicalSourceWitness[]): Promise<void> {
  for (const link of allLinkedWitnesses(witnesses)) await assertOwnedResource(ctx, authority, capability, link.target);
}
/** Final scoped reload checks exact edge predicates without recursion or hashing. */
async function reloadLinkedWitnesses(ctx: ReadCtx, authority: ScopedDataAuthority,
  witnesses: readonly CanonicalSourceWitness[]): Promise<void> {
  const reader = createAuthorityReader(ctx);
  for (const link of allLinkedWitnesses(witnesses)) {
    const { target, selectors } = link;
    let row: (LinkOwner & { tenantId?: string; version?: number }) | null;
    if (link.table === "conversations") {
      const rows = await ctx.db.query("conversations").withIndex("by_tenant_space", q => q.eq("tenantId", authority.tenantId)
        .eq("memorySpaceId", authority.memorySpaceId)).filter(q => q.eq(q.field("conversationId"), target.resourceId)).collect();
      if (rows.length !== 1) dataDenied();
      const conversation = rows[0]; row = conversation;
      if (conversation.participants?.memorySpaceIds?.some(space => space !== authority.memorySpaceId)
        || link.messageIds?.some(id => !conversation.messages.some(message => message.id === id))) dataDenied();
    } else if (link.table === "immutable") {
      row = await ctx.db.query("immutable").withIndex("by_tenant_type_id", q => q.eq("tenantId", authority.tenantId)
        .eq("type", selectors.type!).eq("id", selectors.id!)).unique();
    } else if (link.table === "mutable") {
      row = await ctx.db.query("mutable").withIndex("by_tenant_namespace_key", q => q.eq("tenantId", authority.tenantId)
        .eq("namespace", selectors.namespace!).eq("key", selectors.key!)).unique();
    } else if (link.table === "facts") {
      const fact = await ctx.db.query("facts").withIndex("by_runtime_scope_factId", q => q.eq("tenantId", authority.tenantId)
        .eq("memorySpaceId", authority.memorySpaceId).eq("factId", target.resourceId)).unique(); row = fact;
      if (fact && link.dataBinding !== linkedDataBinding(fact)) dataDenied();
    } else {
      const memory = await ctx.db.query("memories").withIndex("by_runtime_scope_memoryId", q => q.eq("tenantId", authority.tenantId)
        .eq("memorySpaceId", authority.memorySpaceId).eq("memoryId", target.resourceId)).unique(); row = memory;
      if (memory && link.dataBinding !== linkedDataBinding(memory)) dataDenied();
      if (link.conversationId !== undefined && memory?.conversationRef?.conversationId !== link.conversationId) dataDenied();
    }
    if (!row || row._id !== link.storageId || row.tenantId !== target.tenantId
      || row.memorySpaceId !== target.memorySpaceId || row.ownerPrincipalId !== target.ownerPrincipalId
      || row.tombstonedAt !== undefined || (link.expectedVersion !== undefined && row.version !== link.expectedVersion)) dataDenied();
    const key = { tenantId: target.tenantId!, memorySpaceId: target.memorySpaceId,
      resourceType: target.resourceType, resourceId: target.resourceId };
    if (await reader.hasTombstone(key) || await reader.hasTombstone({ ...key, memorySpaceId: undefined })) dataDenied();
  }
}
function sourceWitness(source: Doc<"runtimeMemorySources">): CanonicalSourceWitness {
  return Object.freeze({ ...source, lineage: Object.freeze({ ...source.lineage }) });
}
function sameSource(a: CanonicalSourceWitness, b: CanonicalSourceWitness): boolean {
  return a._id === b._id && a._creationTime === b._creationTime && a.tenantId === b.tenantId
    && a.memorySpaceId === b.memorySpaceId && a.ownerPrincipalId === b.ownerPrincipalId
    && sameLineage(a.lineage, b.lineage) && a.content === b.content && a.contentHash === b.contentHash
    && a.createdAt === b.createdAt && a.tombstonedAt === b.tombstonedAt;
}
function sourceResource(source: CanonicalSourceWitness): RuntimeResource {
  return { resourceType: "source", resourceId: source.lineage.sourceId, tenantId: source.tenantId,
    memorySpaceId: source.memorySpaceId, ownerPrincipalId: source.ownerPrincipalId };
}
/** Reload after all crypto/authorizations; equality requires the entire immutable source witness. */
function uniqueSourceWitnesses(witnesses: readonly CanonicalSourceWitness[]): CanonicalSourceWitness[] {
  const unique = new Map<string, CanonicalSourceWitness>();
  for (const witness of witnesses) {
    const previous = unique.get(witness._id);
    if (previous && !sameSource(previous, witness)) dataDenied("STALE_SOURCE", "Source changed during selection");
    unique.set(witness._id, witness);
  }
  return [...unique.values()];
}
async function authorizeSourceWitnesses(ctx: ReadCtx, authority: ScopedDataAuthority, capability: Capability,
  witnesses: readonly CanonicalSourceWitness[]): Promise<void> {
  await Promise.all(uniqueSourceWitnesses(witnesses).map(async witness => await assertOwnedResource(ctx, authority, capability, sourceResource(witness))));
}
async function reloadSourceWitnesses(ctx: ReadCtx, authority: ScopedDataAuthority,
  witnesses: readonly CanonicalSourceWitness[]): Promise<void> {
  const reader = createAuthorityReader(ctx);
  const selected = await Promise.all(uniqueSourceWitnesses(witnesses).map(async witness => {
    const key = { tenantId: witness.tenantId, memorySpaceId: witness.memorySpaceId, resourceType: "source" as const, resourceId: witness.lineage.sourceId };
    const [current, scopedDeletion, tenantDeletion] = await Promise.all([
      ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", authority.tenantId)
        .eq("memorySpaceId", authority.memorySpaceId).eq("lineage.sourceId", witness.lineage.sourceId))
        .filter(q => q.eq(q.field("ownerPrincipalId"), witness.ownerPrincipalId)).unique(),
      reader.hasTombstone(key), reader.hasTombstone({ ...key, memorySpaceId: undefined }),
    ]);
    return { witness, current, scopedDeletion, tenantDeletion };
  }));
  for (const { witness, current, scopedDeletion, tenantDeletion } of selected) {
    if (scopedDeletion || tenantDeletion) dataDenied();
    if (!current || current.tombstonedAt !== undefined || !sameSource(witness, current)) dataDenied("STALE_SOURCE", "Canonical source changed after hashing");
  }
}
export async function recheckSourceWitnesses(ctx: ReadCtx, authority: ScopedDataAuthority, capability: Capability,
  witnesses: readonly CanonicalSourceWitness[]): Promise<void> {
  await recheckDataAuthority(ctx, authority, capability);
  await authorizeSourceWitnesses(ctx, authority, capability, witnesses);
  await authorizeLinkedWitnesses(ctx, authority, capability, witnesses);
  const grant = await createAuthorityReader(ctx).getGrant(authority.grantId);
  await reloadSourceWitnesses(ctx, authority, witnesses);
  await reloadLinkedWitnesses(ctx, authority, witnesses);
  assertCurrentGrant(authority, capability, grant, Date.now());
}
function assertCurrentGrant(reference: ScopedDataAuthority, capability: Capability, grant: GrantRecord | null, now: number): void {
  if (!grant || grant._id !== reference.grantId || grant.version !== reference.grantVersion
    || grant.principalId !== reference.principalId || grant.membershipId !== reference.membershipId
    || grant.tenantId !== reference.tenantId || grant.tenantEpoch !== reference.tenantEpoch
    || (grant.memorySpaceId !== undefined && (grant.memorySpaceId !== reference.memorySpaceId || grant.memorySpaceEpoch !== reference.memorySpaceEpoch))
    || grant.revokedAt !== undefined || grant.deletedAt !== undefined || !grant.capabilities.includes(capability)
    || (grant.expiresAt !== undefined && (!Number.isFinite(grant.expiresAt) || now >= grant.expiresAt))) dataDenied();
}
/** Current/history multirow reads finish without another hash after the full source reload. */
export async function finalizeDataRead(ctx: ReadCtx, authority: ScopedDataAuthority, witnesses: readonly CanonicalSourceWitness[], rows: readonly DataRow[] = []): Promise<void> {
  for (const row of rows) {
    if (row.tombstonedAt !== undefined) dataDenied();
    await assertOwnedResource(ctx, authority, "read", resource(row));
  }
  await recheckSourceWitnesses(ctx, authority, "read", witnesses);
}
function sourceTimestamp(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 8.64e15; }
function manualSourceText(text: string): string {
  try { return normalizeSourceText(text); } catch { dataDenied("INVALID_INPUT", "Manual source text must be nonempty after normalization"); }
}
async function canonicalSource(source: Doc<"runtimeMemorySources">): Promise<boolean> {
  let content: string;
  try { assertSourceLineage(source.lineage); content = normalizeSourceText(source.content); } catch { return false; }
  return [source.tenantId, source.memorySpaceId, source.ownerPrincipalId].every(id => !!id.trim())
    && sourceTimestamp(source.createdAt) && (source.tombstonedAt === undefined || sourceTimestamp(source.tombstonedAt))
    && content === source.content && await semanticHash(content) === source.contentHash;
}
async function sourceIsCurrent(ctx: ReadCtx, authority: ScopedDataAuthority, capability: Capability, row: DataRow): Promise<CanonicalSourceWitness | undefined> {
  if (!row.lineage || !row.ownerPrincipalId || row.tombstonedAt !== undefined
    || !row.lineage.sourceEventId || !Number.isSafeInteger(row.lineage.sourceRevision) || row.lineage.sourceRevision < 1) return undefined;
  if ("factId" in row && (!row.extractionPolicyVersion || row.lineage.role === "assistant")) return undefined;
  const source = await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("lineage.sourceId", row.lineage!.sourceId))
    .filter(q => q.eq(q.field("ownerPrincipalId"), row.ownerPrincipalId)).unique();
  if (!source || source.tombstonedAt !== undefined || source.ownerPrincipalId !== row.ownerPrincipalId
    || !sameLineage(source.lineage, row.lineage)) return undefined;
  const witness = sourceWitness(source);
  await assertOwnedResource(ctx, authority, capability, sourceResource(witness));
  if (!await canonicalSource(witness)) return undefined;
  await recheckSourceWitnesses(ctx, authority, capability, [witness]);
  return witness;
}
/** Typed structural additions are required for linked legacy tables; absence fails closed. */
type LinkOwner = { _id: string; ownerPrincipalId?: string; memorySpaceId?: string; tombstonedAt?: number };
function nonemptySelector(value: string | undefined): void {
  if (value !== undefined && !value.trim()) dataDenied("INVALID_INPUT", "Reference IDs must be nonempty");
}
export async function assertDataLinks(ctx: ReadCtx, authority: ScopedDataAuthority, capability: Capability,
  input: { conversationRef?: { conversationId: string; messageIds?: string[] }; factsRef?: { factId: string; version?: number };
    immutableRef?: { type: string; id: string; version?: number }; mutableRef?: { namespace: string; key: string };
    sourceRef?: { conversationId?: string; messageIds?: string[]; memoryId?: string }; conversationId?: string },
  activePath = new Set<string>(), witnesses: CanonicalSourceWitness[] = []): Promise<void> {
  if (activePath.size > 64) dataDenied("INVALID_INPUT", "Linked resource graph exceeds bound");
  const anchors = [input.conversationRef?.conversationId, input.sourceRef?.conversationId, input.conversationId];
  for (const anchor of anchors) nonemptySelector(anchor);
  if (input.conversationRef && input.conversationRef.conversationId === undefined) dataDenied("INVALID_INPUT", "Conversation reference requires an anchor");
  if (input.sourceRef?.messageIds !== undefined && input.sourceRef.conversationId === undefined) dataDenied("INVALID_INPUT", "Message references require their conversation anchor");
  if (input.sourceRef && input.sourceRef.conversationId === undefined && input.sourceRef.memoryId === undefined) dataDenied("INVALID_INPUT", "Source reference requires an anchor");
  const selectedAnchors = anchors.filter((anchor): anchor is string => anchor !== undefined);
  if (new Set(selectedAnchors).size > 1) dataDenied("INVALID_INPUT", "Conflicting conversation references");
  const conversationId = selectedAnchors[0];
  const messageIds = [...(input.conversationRef?.messageIds ?? []), ...(input.sourceRef?.messageIds ?? [])];
  for (const id of messageIds) nonemptySelector(id);
  if (conversationId !== undefined) {
    const rows = await ctx.db.query("conversations").withIndex("by_tenant_space", q => q.eq("tenantId", authority.tenantId)
      .eq("memorySpaceId", authority.memorySpaceId)).filter(q => q.eq(q.field("conversationId"), conversationId)).collect();
    if (rows.length !== 1) dataDenied();
    const row = rows[0]; const owner: LinkOwner = row;
    if (owner.tombstonedAt !== undefined || row.participants?.memorySpaceIds?.some(space => space !== authority.memorySpaceId)) dataDenied();
    await assertOwnedResource(ctx, authority, capability, { resourceType: "conversation", resourceId: conversationId,
      tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, ownerPrincipalId: owner.ownerPrincipalId });
    if (messageIds.some(id => !row.messages.some(message => message.id === id))) dataDenied();
    retainedLinks(witnesses).push({ table: "conversations", storageId: row._id,
      target: { resourceType: "conversation", resourceId: conversationId, tenantId: row.tenantId,
        memorySpaceId: row.memorySpaceId, ownerPrincipalId: owner.ownerPrincipalId }, selectors: {}, messageIds: [...messageIds] });
  }
  if (input.factsRef !== undefined) {
    nonemptySelector(input.factsRef.factId);
    if (input.factsRef.version !== undefined && (!Number.isSafeInteger(input.factsRef.version) || input.factsRef.version < 1)) dataDenied("INVALID_INPUT", "Invalid fact reference version");
    // Validate every requested edge version before descending, even for repeated nodes.
    const peer = await getScopedFact(ctx, authority, input.factsRef.factId, capability, activePath, input.factsRef.version, witnesses);
    if (!peer) dataDenied();
    retainedLinks(witnesses).push({ table: "facts", storageId: peer._id, target: resource(peer), selectors: {}, expectedVersion: input.factsRef.version, dataBinding: linkedDataBinding(peer) });
  }
  if (input.sourceRef?.memoryId !== undefined) {
    nonemptySelector(input.sourceRef.memoryId);
    const memory = await getScopedMemory(ctx, authority, input.sourceRef.memoryId, capability, activePath, witnesses);
    if (!memory || (conversationId !== undefined && memory.conversationRef?.conversationId !== conversationId)) dataDenied();
    retainedLinks(witnesses).push({ table: "memories", storageId: memory._id, target: resource(memory), selectors: {}, conversationId, dataBinding: linkedDataBinding(memory) });
  }
  if (input.immutableRef) {
    const ref = input.immutableRef;
    nonemptySelector(ref.type); nonemptySelector(ref.id);
    if (ref.version !== undefined && (!Number.isSafeInteger(ref.version) || ref.version < 1)) dataDenied("INVALID_INPUT", "Invalid immutable reference version");
    const row = await ctx.db.query("immutable").withIndex("by_tenant_type_id", q => q.eq("tenantId", authority.tenantId)
      .eq("type", ref.type).eq("id", ref.id)).unique();
    if (!row) dataDenied(); const owner: LinkOwner = row;
    if (owner.tombstonedAt !== undefined || (ref.version !== undefined && row.version !== ref.version)) dataDenied();
    await assertOwnedResource(ctx, authority, capability, { resourceType: "source", resourceId: `immutable:${ref.type}:${ref.id}`,
      tenantId: row.tenantId, memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.ownerPrincipalId });
    retainedLinks(witnesses).push({ table: "immutable", storageId: row._id,
      target: { resourceType: "source", resourceId: `immutable:${ref.type}:${ref.id}`, tenantId: row.tenantId,
        memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.ownerPrincipalId },
      selectors: { type: ref.type, id: ref.id }, expectedVersion: ref.version });
  }
  if (input.mutableRef) {
    const ref = input.mutableRef;
    nonemptySelector(ref.namespace); nonemptySelector(ref.key);
    const row = await ctx.db.query("mutable").withIndex("by_tenant_namespace_key", q => q.eq("tenantId", authority.tenantId)
      .eq("namespace", ref.namespace).eq("key", ref.key)).unique();
    if (!row) dataDenied(); const owner: LinkOwner = row;
    if (owner.tombstonedAt !== undefined) dataDenied();
    await assertOwnedResource(ctx, authority, capability, { resourceType: "source", resourceId: `mutable:${ref.namespace}:${ref.key}`,
      tenantId: row.tenantId, memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.ownerPrincipalId });
    retainedLinks(witnesses).push({ table: "mutable", storageId: row._id,
      target: { resourceType: "source", resourceId: `mutable:${ref.namespace}:${ref.key}`, tenantId: row.tenantId,
        memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.ownerPrincipalId },
      selectors: { namespace: ref.namespace, key: ref.key } });
  }
  if (!activePath.size) await recheckSourceWitnesses(ctx, authority, capability, witnesses);
}
export async function assertDataRow(ctx: ReadCtx, authority: ScopedDataAuthority, capability: Capability,
  row: DataRow, activePath = new Set<string>(), witnesses: CanonicalSourceWitness[] = []): Promise<CanonicalSourceWitness[]> {
  const target = resource(row); const key = `${target.resourceType}:${target.resourceId}`;
  const root = activePath.size === 0;
  if (activePath.has(key) || activePath.size >= 64) dataDenied("INVALID_INPUT", "Cyclic or excessively deep linked resource graph");
  activePath.add(key);
  try {
    await assertOwnedResource(ctx, authority, capability, target);
    const witness = await sourceIsCurrent(ctx, authority, capability, row);
    if (!witness) dataDenied("STALE_SOURCE", "Source is missing, corrupt, stale or deleted");
    witnesses.push(witness);
    sourceLinks.set(witness, retainedLinks(witnesses));
    await assertDataLinks(ctx, authority, capability, row, activePath, witnesses);
    await assertOwnedResource(ctx, authority, capability, target);
    if (root) await recheckSourceWitnesses(ctx, authority, capability, witnesses);
    return witnesses;
  } finally { activePath.delete(key); }
}
export async function getScopedMemory(ctx: ReadCtx, authority: ScopedDataAuthority, memoryId: string,
  capability: Capability = "read", visited = new Set<string>(), witnesses: CanonicalSourceWitness[] = []): Promise<Doc<"memories"> | null> {
  const row = await ctx.db.query("memories").withIndex("by_runtime_scope_memoryId", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("memoryId", memoryId))
    .filter(q => authority.resourceAccess === "own" ? q.eq(q.field("ownerPrincipalId"), authority.principalId)
      : q.neq(q.field("ownerPrincipalId"), undefined)).unique();
  if (row) await assertDataRow(ctx, authority, capability, row, visited, witnesses);
  return row;
}
export async function getScopedFact(ctx: ReadCtx, authority: ScopedDataAuthority, factId: string,
  capability: Capability = "read", visited = new Set<string>(), expectedVersion?: number, witnesses: CanonicalSourceWitness[] = []): Promise<Doc<"facts"> | null> {
  const row = await ctx.db.query("facts").withIndex("by_runtime_scope_factId", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("factId", factId))
    .filter(q => authority.resourceAccess === "own" ? q.eq(q.field("ownerPrincipalId"), authority.principalId)
      : q.neq(q.field("ownerPrincipalId"), undefined)).unique();
  if (row && expectedVersion !== undefined && row.version !== expectedVersion) dataDenied();
  if (row) await assertDataRow(ctx, authority, capability, row, visited, witnesses);
  return row;
}
async function currentRows<T extends DataRow>(ctx: ReadCtx, authority: ScopedDataAuthority, capability: Capability, rows: T[]): Promise<T[]> {
  const reader = createAuthorityReader(ctx); const result: T[] = []; const witnesses: CanonicalSourceWitness[] = [];
  for (const row of rows) {
    const target = resource(row);
    if (row.tombstonedAt !== undefined || !row.lineage || !row.ownerPrincipalId
      || await reader.hasTombstone({ tenantId: authority.tenantId, memorySpaceId: authority.memorySpaceId,
        resourceType: target.resourceType, resourceId: target.resourceId })
      || await reader.hasTombstone({ tenantId: authority.tenantId, resourceType: target.resourceType, resourceId: target.resourceId })) continue;
    const selected = await sourceIsCurrent(ctx, authority, capability, row);
    if (!selected) continue;
    witnesses.push(selected);
    await assertDataRow(ctx, authority, capability, row, new Set<string>(), witnesses); result.push(row);
  }
  if (capability === "read") await finalizeDataRead(ctx, authority, witnesses, result);
  else await recheckSourceWitnesses(ctx, authority, capability, witnesses);
  return result;
}
export async function listScopedMemories(ctx: ReadCtx, authority: ScopedDataAuthority, capability: Capability = "read"): Promise<Doc<"memories">[]> {
  const rows = await ctx.db.query("memories").withIndex("by_tenant_space", q => q.eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId))
    .filter(q => q.and(q.eq(q.field("tombstonedAt"), undefined),
      authority.resourceAccess === "own" ? q.eq(q.field("ownerPrincipalId"), authority.principalId) : q.neq(q.field("ownerPrincipalId"), undefined))).collect();
  return await currentRows(ctx, authority, capability, rows);
}
export async function listScopedFacts(ctx: ReadCtx, authority: ScopedDataAuthority, capability: Capability = "read"): Promise<Doc<"facts">[]> {
  const rows = await ctx.db.query("facts").withIndex("by_tenant_space", q => q.eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId))
    .filter(q => q.and(q.eq(q.field("tombstonedAt"), undefined), authority.resourceAccess === "own"
      ? q.eq(q.field("ownerPrincipalId"), authority.principalId) : q.neq(q.field("ownerPrincipalId"), undefined))).collect();
  return await currentRows(ctx, authority, capability, rows);
}
export async function searchScopedMemories(ctx: ReadCtx, authority: ScopedDataAuthority, text: string): Promise<Doc<"memories">[]> {
  const rows = await ctx.db.query("memories").withSearchIndex("by_content", q => {
    const scoped = q.search("content", text).eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId);
    return authority.resourceAccess === "own" ? scoped.eq("ownerPrincipalId", authority.principalId) : scoped;
  }).collect();
  return await currentRows(ctx, authority, "read", rows);
}
export async function searchScopedFacts(ctx: ReadCtx, authority: ScopedDataAuthority, text: string): Promise<Doc<"facts">[]> {
  const rows = await ctx.db.query("facts").withSearchIndex("by_content", q => {
    const scoped = q.search("fact", text).eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId);
    return authority.resourceAccess === "own" ? scoped.eq("ownerPrincipalId", authority.principalId) : scoped;
  }).collect();
  return await currentRows(ctx, authority, "read", rows);
}
export type ManualSourceBinding = NonNullable<Doc<"facts">["manualSourceBinding"]>;
export function manualSourceKey(authority: Pick<ScopedDataAuthority, "tenantId" | "memorySpaceId">, binding: ManualSourceBinding): string {
  return `manual:${JSON.stringify([authority.tenantId, authority.memorySpaceId, binding.resourceType, binding.resourceId])}`;
}
/** Source binding is supplied only by trusted writers, never by public args or metadata. */
export async function manualDataSource(ctx: MutationCtx, authority: ScopedDataAuthority, binding: ManualSourceBinding,
  text: string, ownerPrincipalId = authority.principalId, role: "user" | "assistant" = "user"): Promise<SourceLineage> {
  const content = manualSourceText(text);
  nonemptySelector(binding.resourceId);
  const sourceId = manualSourceKey(authority, binding);
  const lineage: SourceLineage = role === "assistant"
    ? { sourceId, sourceEventId: sourceId, sourceRevision: 1, role: "assistant", trust: "assistant_claim" }
    : { sourceId, sourceEventId: sourceId, sourceRevision: 1, role: "user", trust: "user_assertion" };
  await assertOwnedResource(ctx, authority, "write", { resourceType: "source", resourceId: sourceId,
    tenantId: authority.tenantId, memorySpaceId: authority.memorySpaceId, ownerPrincipalId });
  const existing = await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("lineage.sourceId", sourceId)).unique();
  const event = await ctx.db.query("runtimeMemorySources").withIndex("by_scope_event", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("lineage.sourceEventId", sourceId)).unique();
  if (existing || event) dataDenied("IDEMPOTENCY_CONFLICT", "Manual source identity already exists");
  const contentHash = await semanticHash(content);
  const createdAt = Date.now();
  if (!sourceTimestamp(createdAt)) dataDenied("INVALID_INPUT", "Invalid manual source timestamp");
  await assertOwnedResource(ctx, authority, "write", { resourceType: "source", resourceId: sourceId,
    tenantId: authority.tenantId, memorySpaceId: authority.memorySpaceId, ownerPrincipalId });
  const [sourceCollision, eventCollision] = await Promise.all([
    ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", authority.tenantId)
      .eq("memorySpaceId", authority.memorySpaceId).eq("lineage.sourceId", sourceId)).unique(),
    ctx.db.query("runtimeMemorySources").withIndex("by_scope_event", q => q.eq("tenantId", authority.tenantId)
      .eq("memorySpaceId", authority.memorySpaceId).eq("lineage.sourceEventId", sourceId)).unique(),
  ]);
  if (sourceCollision || eventCollision) dataDenied("IDEMPOTENCY_CONFLICT", "Manual source identity changed during hashing");
  await ctx.db.insert("runtimeMemorySources", { tenantId: authority.tenantId, memorySpaceId: authority.memorySpaceId,
    ownerPrincipalId, lineage, content, contentHash, createdAt });
  return lineage;
}
export async function reviseDataSource(ctx: MutationCtx, authority: ScopedDataAuthority, row: DataRow, text: string,
  newResourceId = resource(row).resourceId): Promise<{ lineage: SourceLineage; manualSourceBinding: ManualSourceBinding }> {
  const admittedSources = await assertDataRow(ctx, authority, "write", row);
  const lineage = row.lineage!; const type = "memoryId" in row ? "memory" : "fact";
  const binding = row.manualSourceBinding;
  const dedicated = binding?.resourceType === type && !!binding.resourceId
    && (type !== "memory" || ("memoryId" in row && binding.resourceId === row.memoryId))
    && lineage.sourceId === manualSourceKey(authority, binding) && lineage.sourceEventId === lineage.sourceId
    && lineage.role !== "tool" && (type !== "fact" || ("factId" in row && row.extractionPolicyVersion === "manual-assertion-v1" && row.sourceType === "manual"));
  if (binding && !dedicated) dataDenied("STALE_SOURCE", "Server source binding does not prove a dedicated manual resource");
  // A DerivedFact cannot synthesize the server binding. Shared memory/transcript/tool sources stay intact.
  if (!dedicated) {
    const manualSourceBinding: ManualSourceBinding = { resourceType: type, resourceId: newResourceId };
    const updated = await manualDataSource(ctx, authority, manualSourceBinding, text, row.ownerPrincipalId!,
      type === "memory" && lineage.role === "assistant" ? "assistant" : "user");
    const currentSources = await assertDataRow(ctx, authority, "write", row);
    await finalMutationDelivery(ctx, authority, [], [resource(row)], [], [...admittedSources, ...currentSources]);
    return { lineage: updated, manualSourceBinding };
  }
  const source = await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("lineage.sourceId", lineage.sourceId))
    .filter(q => q.eq(q.field("ownerPrincipalId"), row.ownerPrincipalId)).unique();
  if (!source || !sameLineage(source.lineage, lineage) || !Number.isSafeInteger(lineage.sourceRevision + 1)) dataDenied("STALE_SOURCE");
  const before = sourceWitness(source);
  if (!await canonicalSource(before)) dataDenied("STALE_SOURCE");
  const updated: SourceLineage = { ...lineage, sourceRevision: lineage.sourceRevision + 1 };
  const content = manualSourceText(text);
  const contentHash = await semanticHash(content);
  const witnesses = await assertDataRow(ctx, authority, "write", row);
  await finalMutationDelivery(ctx, authority, [], [resource(row)], [], [...admittedSources, before, ...witnesses]);
  await ctx.db.patch(source._id, { content, contentHash, lineage: updated });
  return { lineage: updated, manualSourceBinding: binding };
}
/** Retained authoritative tombstone fences survive deletion/purge and block later stage writes. */
export interface DataDeletionProof {
  resource: RuntimeResource;
  tombstoneId: Doc<"runtimeAuthTombstones">["_id"];
  deletedAt: number;
  tombstone: Readonly<Doc<"runtimeAuthTombstones">>;
}
export async function tombstoneDataRow(ctx: MutationCtx, authority: ScopedDataAuthority, table: DataTable, row: DataRow): Promise<DataDeletionProof> {
  const witnesses = await assertDataRow(ctx, authority, "write", row); const target = resource(row); const now = Date.now();
  const existing = await ctx.db.query("runtimeAuthTombstones").withIndex("by_resource", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("resourceType", target.resourceType).eq("resourceId", target.resourceId)).unique();
  if (existing) dataDenied();
  const tombstoneId = await ctx.db.insert("runtimeAuthTombstones", { tenantId: authority.tenantId, memorySpaceId: authority.memorySpaceId,
    resourceType: target.resourceType, resourceId: target.resourceId, deletedAt: now });
  const tombstone = await ctx.db.query("runtimeAuthTombstones").withIndex("by_resource", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("resourceType", target.resourceType).eq("resourceId", target.resourceId)).unique();
  if (!tombstone || tombstone._id !== tombstoneId || tombstone.deletedAt !== now) dataDenied();
  const proof = { resource: target, tombstoneId, deletedAt: now, tombstone: Object.freeze({ ...tombstone }) };
  if (table === "memories" && "memoryId" in row) await ctx.db.patch("memories", row._id, { tombstonedAt: now, runtimeEditor: dataEditor(authority, now) });
  else if ("factId" in row) await ctx.db.patch("facts", row._id, { tombstonedAt: now, validUntil: now, updatedAt: now, runtimeEditor: dataEditor(authority, now) });
  await finalMutationDelivery(ctx, authority, [], [target], [proof], witnesses);
  return proof;
}
/** Storage IDs are selectors; trusted scope/owner predicates run before row hydration. */
export async function getScopedMemoryDocument(ctx: ReadCtx, authority: ScopedDataAuthority, id: Doc<"memories">["_id"], witnesses: CanonicalSourceWitness[] = []): Promise<Doc<"memories"> | null> {
  const row = await ctx.db.query("memories").withIndex("by_tenant_space", q => q.eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId))
    .filter(q => q.and(q.eq(q.field("_id"), id), authority.resourceAccess === "own"
      ? q.eq(q.field("ownerPrincipalId"), authority.principalId) : q.neq(q.field("ownerPrincipalId"), undefined))).unique();
  if (row) await assertDataRow(ctx, authority, "read", row, new Set<string>(), witnesses);
  return row;
}
export async function getScopedFactDocument(ctx: ReadCtx, authority: ScopedDataAuthority, id: Doc<"facts">["_id"], witnesses: CanonicalSourceWitness[] = []): Promise<Doc<"facts"> | null> {
  const row = await ctx.db.query("facts").withIndex("by_tenant_space", q => q.eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId))
    .filter(q => q.and(q.eq(q.field("_id"), id), authority.resourceAccess === "own"
      ? q.eq(q.field("ownerPrincipalId"), authority.principalId) : q.neq(q.field("ownerPrincipalId"), undefined))).unique();
  if (row) await assertDataRow(ctx, authority, "read", row, new Set<string>(), witnesses);
  return row;
}
/** Server column remains separate from arbitrary caller metadata and canonical ownership. */
export function dataEditor(authority: RuntimeAuthority, editedAt = Date.now()): NonNullable<Doc<"facts">["runtimeEditor"]> {
  return { principalId: authority.principalId, userId: authority.userId, editedAt };
}
export type HistoricalFactView = Doc<"facts"> & { historical: true; stale: boolean; currentSourceRevision: number };
/** Historical audit alone accepts older revisions. It never feeds current retrieval or writes. */
export async function getHistoricalScopedFact(ctx: ReadCtx, authority: ScopedDataAuthority, factId: string,
  witnesses: CanonicalSourceWitness[] = []): Promise<HistoricalFactView | null> {
  const row = await ctx.db.query("facts").withIndex("by_runtime_scope_factId", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("factId", factId))
    .filter(q => authority.resourceAccess === "own" ? q.eq(q.field("ownerPrincipalId"), authority.principalId)
      : q.neq(q.field("ownerPrincipalId"), undefined)).unique();
  if (!row) return null;
  await assertOwnedResource(ctx, authority, "read", resource(row));
  if (!row.lineage || !row.extractionPolicyVersion || row.tombstonedAt !== undefined || !Number.isSafeInteger(row.lineage.sourceRevision)
    || row.lineage.sourceRevision < 1 || !row.lineage.sourceEventId) dataDenied("STALE_SOURCE");
  const source = await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", authority.tenantId)
    .eq("memorySpaceId", authority.memorySpaceId).eq("lineage.sourceId", row.lineage!.sourceId))
    .filter(q => q.eq(q.field("ownerPrincipalId"), row.ownerPrincipalId)).unique();
  if (!source || source.tombstonedAt !== undefined || source.ownerPrincipalId !== row.ownerPrincipalId
    || !Number.isSafeInteger(source.lineage.sourceRevision) || source.lineage.sourceRevision < row.lineage.sourceRevision
    || !sameLineage(source.lineage, { ...row.lineage, sourceRevision: source.lineage.sourceRevision })) dataDenied("STALE_SOURCE");
  const witness = sourceWitness(source); witnesses.push(witness);
    sourceLinks.set(witness, retainedLinks(witnesses));
  await assertOwnedResource(ctx, authority, "read", sourceResource(witness));
  if (!await canonicalSource(witness)) dataDenied("STALE_SOURCE", "Canonical source content/hash is corrupt");
  await assertDataLinks(ctx, authority, "read", row, new Set<string>(), witnesses);
  await assertOwnedResource(ctx, authority, "read", resource(row));
  await recheckSourceWitnesses(ctx, authority, "read", witnesses);
  return { ...row, historical: true, stale: row.lineage.sourceRevision !== witness.lineage.sourceRevision,
    currentSourceRevision: witness.lineage.sourceRevision };
}

export interface DataMutationReceipt {
  mutationReceipt: true;
  operation: "store" | "update" | "updateInPlace";
  memoryId?: string;
  factId?: string;
}
type MutationReadTarget = { authority: ScopedDataAuthority; resource?: RuntimeResource; sources?: readonly CanonicalSourceWitness[] };
export interface MutationRowsReadAdmission {
  discloseIds: boolean;
  readers: MutationReadTarget[];
  targets: RuntimeResource[];
  sources: CanonicalSourceWitness[];
}
/** No hashes follow this barrier. Both grants' lifetimes are checked after its last await. */
async function finalMutationDelivery(ctx: ReadCtx, writer: ScopedDataAuthority, readers: MutationReadTarget[],
  targets: RuntimeResource[], deletions: readonly DataDeletionProof[] = [], witnesses: readonly CanonicalSourceWitness[] = []): Promise<void> {
  const authorityReader = createAuthorityReader(ctx);
  function sameTombstone(a: Readonly<Doc<"runtimeAuthTombstones">>, b: Readonly<Doc<"runtimeAuthTombstones">>): boolean {
    return a._id === b._id && a._creationTime === b._creationTime && a.tenantId === b.tenantId
      && a.memorySpaceId === b.memorySpaceId && a.resourceType === b.resourceType && a.resourceId === b.resourceId && a.deletedAt === b.deletedAt;
  }
  for (const proof of deletions) {
    const target = proof.resource;
    const row = await ctx.db.query("runtimeAuthTombstones").withIndex("by_resource", q => q.eq("tenantId", target.tenantId!)
      .eq("memorySpaceId", target.memorySpaceId).eq("resourceType", target.resourceType).eq("resourceId", target.resourceId)).unique();
    if (!row || row._id !== proof.tombstoneId || row.deletedAt !== proof.deletedAt || !sameTombstone(row, proof.tombstone)
      || !targets.some(candidate => candidate.resourceType === target.resourceType && candidate.resourceId === target.resourceId
        && candidate.tenantId === target.tenantId && candidate.memorySpaceId === target.memorySpaceId
        && candidate.ownerPrincipalId === target.ownerPrincipalId)) dataDenied();
  }
  // Delegate all controls except the precise operation-created scope tombstone.
  const deletionReader: AuthorityReader = { ...authorityReader, hasTombstone: async key => {
    const proof = deletions.find(candidate => candidate.resource.tenantId === key.tenantId
      && candidate.resource.memorySpaceId === key.memorySpaceId && candidate.resource.resourceType === key.resourceType
      && candidate.resource.resourceId === key.resourceId);
    if (!proof) return await authorityReader.hasTombstone(key);
    const current = await ctx.db.query("runtimeAuthTombstones").withIndex("by_resource", q => q.eq("tenantId", key.tenantId)
      .eq("memorySpaceId", key.memorySpaceId).eq("resourceType", key.resourceType).eq("resourceId", key.resourceId)).unique();
    if (!current || !sameTombstone(current, proof.tombstone)) dataDenied();
    return false;
  } };
  const requirements: { reference: ScopedDataAuthority; capability: Capability; resource?: RuntimeResource }[] = [
    ...targets.map(target => ({ reference: writer, capability: "write" as const, resource: target })),
    ...readers.map(reader => ({ reference: reader.authority, capability: "read" as const,
      resource: reader.resource })),
  ];
  if (!targets.length) requirements.push({ reference: writer, capability: "write" });
  for (const target of targets) assertResourceScope(writer, target);
  for (const reader of readers) {
    if (reader.authority.principalId !== writer.principalId) dataDenied();
    if (reader.resource) assertResourceScope(reader.authority, reader.resource);
  }
  await Promise.all(requirements.map(async ({ reference, capability, resource: target }) =>
    await resolveAuthorityReference(deletionReader, reference, { capability, tenantId: reference.tenantId,
      memorySpaceId: reference.memorySpaceId, ...(target ? { resource: target } : {}) })));
  await authorizeSourceWitnesses(ctx, writer, "write", witnesses);
  await authorizeLinkedWitnesses(ctx, writer, "write", witnesses);
  for (const reader of readers) {
    await authorizeSourceWitnesses(ctx, reader.authority, "read", reader.sources ?? []);
    await authorizeLinkedWitnesses(ctx, reader.authority, "read", reader.sources ?? []);
  }
  const grants = await Promise.all(requirements.map(async requirement => ({ ...requirement,
    grant: await authorityReader.getGrant(requirement.reference.grantId) })));
  const controls = await Promise.all(targets.map(async target => {
    const key = { tenantId: target.tenantId!, memorySpaceId: target.memorySpaceId, resourceType: target.resourceType, resourceId: target.resourceId };
    return await deletionReader.hasTombstone(key) || await deletionReader.hasTombstone({ ...key, memorySpaceId: undefined });
  }));
  if (controls.some(Boolean)) dataDenied();
  const allSources = [...witnesses, ...readers.flatMap(reader => reader.sources ?? [])];
  await reloadSourceWitnesses(ctx, writer, allSources);
  await reloadLinkedWitnesses(ctx, writer, allSources);
  const now = Date.now();
  for (const { reference, capability, grant } of grants) {
    assertCurrentGrant(reference, capability, grant, now);
  }
}
function dataBackendFailure(): ConvexError<{ version: number; code: string; message: string; retryable: boolean; outcome: string }> {
  return new ConvexError({ version: 1, code: "BACKEND_OPERATION_FAILED", message: "Data operation failed.",
    retryable: false, outcome: "not_committed" });
}
/** Callback errors are infrastructure failures, even when their payload resembles a policy denial. */
async function protectedDataRead<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch { throw dataBackendFailure(); }
}
function protectedDataAuthorityReader(ctx: ReadCtx): AuthorityReader {
  const reader = createAuthorityReader(ctx);
  return {
    findPrincipal: (issuer, subject) => protectedDataRead(() => reader.findPrincipal(issuer, subject)),
    getPrincipal: id => protectedDataRead(() => reader.getPrincipal(id)),
    listMemberships: id => protectedDataRead(() => reader.listMemberships(id)),
    getMembership: id => protectedDataRead(() => reader.getMembership(id)),
    listGrants: id => protectedDataRead(() => reader.listGrants(id)),
    getGrant: id => protectedDataRead(() => reader.getGrant(id)),
    getScope: (tenantId, spaceId) => protectedDataRead(() => reader.getScope(tenantId, spaceId)),
    hasTombstone: target => protectedDataRead(() => reader.hasTombstone(target)),
  };
}
/** Only the resolver's exact static permission denial permits a READ-less receipt. */
function ordinaryDataReadDenial(error: unknown): boolean {
  try {
    if (!(error instanceof ConvexError)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(error, "data");
    if (!descriptor || !("value" in descriptor)) return false;
    const data: unknown = descriptor.value;
    if (data === null || typeof data !== "object") return false;
    const prototype: unknown = Object.getPrototypeOf(data);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const fields = Object.getOwnPropertyDescriptors(data);
    if (Reflect.ownKeys(fields).some(key => typeof key !== "string" || !("value" in fields[key]!))) return false;
    if (Object.keys(fields).sort().join(",") !== "code,message,outcome,retryable,version") return false;
    return fields.code!.value === "FORBIDDEN" && fields.message!.value === "Access denied"
      && fields.version!.value === 1 && fields.retryable!.value === false && fields.outcome!.value === "not_dispatched";
  } catch { return false; }
}
async function optionalMutationRead(ctx: Pick<QueryCtx, "auth" | "db">, writer: ScopedDataAuthority,
  target?: RuntimeResource): Promise<ScopedDataAuthority | undefined> {
  // Acquire identity outside the permission catch; protect sync invocation and async rejection alike.
  const identity = await protectedDataRead(() => ctx.auth.getUserIdentity());
  const reader = protectedDataAuthorityReader(ctx);
  try {
    return concrete(await resolveAuthority(reader, identity, { capability: "read", tenantId: writer.tenantId,
      memorySpaceId: writer.memorySpaceId, ...(target ? { resource: target } : {}) }));
  } catch (error) {
    if (!ordinaryDataReadDenial(error)) throw dataBackendFailure();
    // The protected persisted WRITE recheck cannot hide callback failures in candidate pruning.
    const currentWriter = concrete(await resolveAuthorityReference(reader, writer, { capability: "write",
      tenantId: writer.tenantId, memorySpaceId: writer.memorySpaceId }));
    if (currentWriter.capabilities.includes("read")) dataDenied();
    return undefined;
  }
}
export async function memoryMutationResult(ctx: Pick<MutationCtx, "auth" | "db">, writer: ScopedDataAuthority,
  memoryId: string, ownerPrincipalId: string, operation: "store" | "update"): Promise<Doc<"memories"> | DataMutationReceipt> {
  const target: RuntimeResource = { resourceType: "memory", resourceId: memoryId, tenantId: writer.tenantId,
    memorySpaceId: writer.memorySpaceId, ownerPrincipalId };
  await assertOwnedResource(ctx, writer, "write", target);
  const reader = await optionalMutationRead(ctx, writer, target);
  if (!reader) {
    const witnesses: CanonicalSourceWitness[] = [];
    if (!await getScopedMemory(ctx, writer, memoryId, "write", new Set<string>(), witnesses)) dataDenied();
    await finalMutationDelivery(ctx, writer, [], [target], [], witnesses);
    return { mutationReceipt: true, operation, memoryId };
  }
  const readSources: CanonicalSourceWitness[] = [];
  const row = await getScopedMemory(ctx, reader, memoryId, "read", new Set<string>(), readSources);
  if (!row) dataDenied();
  const writeSources = await assertDataRow(ctx, writer, "write", row);
  await finalMutationDelivery(ctx, writer, [{ authority: reader, resource: target, sources: readSources }], [target], [], writeSources);
  return row;
}
export async function factMutationResult(ctx: Pick<MutationCtx, "auth" | "db">, writer: ScopedDataAuthority,
  factId: string, ownerPrincipalId: string, operation: DataMutationReceipt["operation"]): Promise<Doc<"facts"> | DataMutationReceipt> {
  const target: RuntimeResource = { resourceType: "fact", resourceId: factId, tenantId: writer.tenantId,
    memorySpaceId: writer.memorySpaceId, ownerPrincipalId };
  await assertOwnedResource(ctx, writer, "write", target);
  const reader = await optionalMutationRead(ctx, writer, target);
  if (!reader) {
    const witnesses: CanonicalSourceWitness[] = [];
    if (!await getScopedFact(ctx, writer, factId, "write", new Set<string>(), undefined, witnesses)) dataDenied();
    await finalMutationDelivery(ctx, writer, [], [target], [], witnesses);
    return { mutationReceipt: true, operation, factId };
  }
  const readSources: CanonicalSourceWitness[] = [];
  const row = await getScopedFact(ctx, reader, factId, "read", new Set<string>(), undefined, readSources);
  if (!row) dataDenied();
  const writeSources = await assertDataRow(ctx, writer, "write", row);
  await finalMutationDelivery(ctx, writer, [{ authority: reader, resource: target, sources: readSources }], [target], [], writeSources);
  return row;
}
/** Write-only preflight retains every canonical source through batch effects without asking for READ. */
export async function prepareMutationRowsWrite(ctx: ReadCtx, writer: ScopedDataAuthority, rows: DataRow[]): Promise<MutationRowsReadAdmission> {
  const admission: MutationRowsReadAdmission = { discloseIds: false, readers: [], targets: rows.map(resource), sources: [] };
  for (const row of rows) admission.sources.push(...await assertDataRow(ctx, writer, "write", row));
  await finalMutationDelivery(ctx, writer, [], admission.targets, [], admission.sources);
  return admission;
}
/** Filter-selected identifiers are disclosed only if every target has independent read authority. */
export async function canReadMutationRows(ctx: Pick<QueryCtx, "auth" | "db">, writer: ScopedDataAuthority, rows: DataRow[]): Promise<MutationRowsReadAdmission> {
  const admission: MutationRowsReadAdmission = { discloseIds: true, readers: [], targets: rows.map(resource), sources: [] };
  if (!rows.length) {
    const reader = await optionalMutationRead(ctx, writer);
    admission.discloseIds = reader !== undefined;
    if (reader) admission.readers.push({ authority: reader });
  }
  for (const row of rows) {
    const reader = admission.discloseIds ? await optionalMutationRead(ctx, writer, resource(row)) : undefined;
    admission.sources.push(...await assertDataRow(ctx, writer, "write", row));
    if (!reader) admission.discloseIds = false;
    else {
      const sources = await assertDataRow(ctx, reader, "read", row);
      admission.readers.push({ authority: reader, resource: resource(row), sources });
    }
  }
  await finalMutationDelivery(ctx, writer, admission.readers, admission.targets, [], admission.sources);
  return admission;
}
/** Only tombstones actually created by this mutation exempt its admitted targets' deletion check. */
export async function finalizeMutationRowsRead(ctx: ReadCtx, writer: ScopedDataAuthority, admission: MutationRowsReadAdmission,
  deletions: readonly DataDeletionProof[]): Promise<void> {
  await finalMutationDelivery(ctx, writer, admission.readers, admission.targets, deletions, admission.sources);
}
