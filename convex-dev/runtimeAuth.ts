/** Trusted authorization boundary. Registered functions in this module are internal only. */
import { ConvexError, v } from "convex/values";
import { getFunctionAddress, makeFunctionReference } from "convex/server";
import type { AgentComponent, MessageDoc } from "@convex-dev/agent";
import type { FunctionReference, UserIdentity } from "convex/server";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type {
  RuntimeActorKind, RuntimeAuthority, RuntimeAuthorityReference, RuntimeAuthorityRequirement,
  RuntimeCapability, RuntimeResource, RuntimeResourceAccess, RuntimeResourceType,
} from "../src/auth/verified";
import {
  runtimeActorKind, runtimeAuthorityReference, runtimeAuthorityRequirement,
  runtimeCapability, runtimeResourceAccess, runtimeResourceType,
} from "./runtimeAuthSchema";

type Lifecycle = { version: number; revokedAt?: number; deletedAt?: number };
export interface PrincipalRecord extends Lifecycle {
  _id: string; issuer: string; subject: string; actorKind: RuntimeActorKind; metadataUserId?: string;
}
export interface MembershipRecord extends Lifecycle {
  _id: string; principalId: string; tenantId: string;
}
export interface GrantRecord extends Lifecycle {
  _id: string; principalId: string; membershipId: string; tenantId: string;
  memorySpaceId?: string; tenantEpoch: number; memorySpaceEpoch?: number;
  capabilities: RuntimeCapability[]; resourceAccess: RuntimeResourceAccess; expiresAt?: number;
}
export interface ScopeRecord {
  tenantId: string; memorySpaceId?: string; epoch: number; deletedAt?: number;
}
export interface TombstoneKey {
  tenantId: string; memorySpaceId?: string; resourceType: RuntimeResourceType; resourceId: string;
}
/** Adapter reads only trusted control tables; no user metadata or semantic memory. */
export interface AuthorityReader {
  findPrincipal(issuer: string, subject: string): Promise<PrincipalRecord | null>;
  getPrincipal(id: string): Promise<PrincipalRecord | null>;
  listMemberships(principalId: string): Promise<MembershipRecord[]>;
  getMembership(id: string): Promise<MembershipRecord | null>;
  listGrants(membershipId: string): Promise<GrantRecord[]>;
  getGrant(id: string): Promise<GrantRecord | null>;
  getScope(tenantId: string, memorySpaceId?: string): Promise<ScopeRecord | null>;
  hasTombstone(key: TombstoneKey): Promise<boolean>;
}

const authorityReadScope: unique symbol = Symbol("cortex.native-authority-read-scope");
const policyMetadataReadScope: unique symbol = Symbol("cortex.native-policy-metadata-read-scope");
const nativeTranscriptReadScope: unique symbol = Symbol("cortex.native-transcript-read-scope");
const v8ReadScope: unique symbol = Symbol("cortex.native-v8-read-scope");
const managedSourceReadScope: unique symbol = Symbol("cortex.native-managed-source-read-scope");
const managedSourceValidationScope: unique symbol = Symbol("cortex.native-managed-source-validation-scope");
const nativeReadScopeOwner: unique symbol = Symbol("cortex.native-read-scope-owner");
interface ManagedSourceReader {
  sources(tenantId: string, memorySpaceId: string, sourceId: string): Promise<Doc<"runtimeMemorySources">[]>;
  conversations(tenantId: string, memorySpaceId: string, conversationId: string): Promise<Doc<"runtimeConversations">[]>;
  bridges(tenantId: string, memorySpaceId: string, nativeMessageId: string): Promise<Doc<"runtimeTranscriptMessages">[]>;
  runs(tenantId: string, memorySpaceId: string, runId: string): Promise<Doc<"runtimeRuns">[]>;
  fresh(): void;
}
type ManagedSourceContext = Pick<QueryCtx, "db"> & { [managedSourceReadScope]?: ManagedSourceReader };
export const MANAGED_SOURCE_READ_SCOPE_MAX_ENTRIES = 512;
export const MANAGED_SOURCE_READ_SCOPE_MAX_BYTES = 1_000_000;
/** Closed raw graph queries only. Their callers retain duplicate/currentness,
 * permission and recursive traversal checks on every logical read. */
export async function readManagedSourceRows(ctx: Pick<QueryCtx, "db">, tenantId: string, memorySpaceId: string, sourceId: string): Promise<Doc<"runtimeMemorySources">[]> {
  const reader = (ctx as ManagedSourceContext)[managedSourceReadScope];
  return reader ? await reader.sources(tenantId, memorySpaceId, sourceId)
    : await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("lineage.sourceId", sourceId)).take(2);
}
export async function readManagedConversationRows(ctx: Pick<QueryCtx, "db">, tenantId: string, memorySpaceId: string, conversationId: string): Promise<Doc<"runtimeConversations">[]> {
  const reader = (ctx as ManagedSourceContext)[managedSourceReadScope];
  return reader ? await reader.conversations(tenantId, memorySpaceId, conversationId)
    : await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("conversationId", conversationId)).take(2);
}
export async function readManagedTranscriptBridgeRows(ctx: Pick<QueryCtx, "db">, tenantId: string, memorySpaceId: string, nativeMessageId: string): Promise<Doc<"runtimeTranscriptMessages">[]> {
  const reader = (ctx as ManagedSourceContext)[managedSourceReadScope];
  return reader ? await reader.bridges(tenantId, memorySpaceId, nativeMessageId)
    : await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("nativeMessageId", nativeMessageId)).take(2);
}
export async function readManagedSourceRunRows(ctx: Pick<QueryCtx, "db">, tenantId: string, memorySpaceId: string, runId: string): Promise<Doc<"runtimeRuns">[]> {
  const reader = (ctx as ManagedSourceContext)[managedSourceReadScope];
  return reader ? await reader.runs(tenantId, memorySpaceId, runId)
    : await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("runId", runId)).take(2);
}
/** Explicit original source-fence boundary; never clears or caches a decision. */
export function freshManagedSourceReads<Ctx>(ctx: Ctx): Ctx {
  (ctx as ManagedSourceContext)[managedSourceReadScope]?.fresh();
  return ctx;
}
/** Same native owner only. Share raw graph rows and writer invalidation while
 * the original source branch keeps uncached authority/policy/message reads. */
export function withManagedSourceReads<Ctx extends Pick<QueryCtx, "db">>(ctx: Ctx, parent: Ctx): Ctx {
  const reader = (parent as ManagedSourceContext)[managedSourceReadScope];
  const owner = (parent as Ctx & { [nativeReadScopeOwner]?: Ctx })[nativeReadScopeOwner];
  if (!reader || owner !== ctx) return ctx;
  const view = { ...ctx, db: parent.db };
  for (const name of ["runQuery", "runMutation"] as const) {
    const value: unknown = Reflect.get(parent, name);
    if (typeof value === "function") Object.defineProperty(view, name, { enumerable: true, value });
  }
  Object.defineProperty(view, managedSourceReadScope, { value: reader });
  return view;
}
/** A fresh authority reader for one synchronous managed-source traversal only.
 * The next source getter/final fence creates a new reader. Raw graph rows may
 * remain shared, but no currentness/permission verdict crosses this boundary. */
type ManagedValidationContext = { [managedSourceValidationScope]?: () => AuthorityReader };
export function freshManagedSourceValidation<Ctx extends Pick<QueryCtx, "db">>(ctx: Ctx): Ctx {
  const create = (ctx as ManagedValidationContext)[managedSourceValidationScope];
  // A full parent already has the original bounded raw reader. Replacing it
  // would discard retained raw rows; only graph-only source views need this.
  if (!create || (ctx as AuthorityReadContext)[authorityReadScope]) return ctx;
  const view = Object.create(ctx) as Ctx;
  Object.defineProperty(view, authorityReadScope, { value: create() });
  return view;
}
/** K26's graph-only view remains unchanged. Only exact-owner private callers
 * explicitly share this additional traversal-local raw reader factory. */
export function withManagedSourceValidationReads<Ctx extends Pick<QueryCtx, "db">>(ctx: Ctx, parent: Ctx): Ctx {
  const view = withManagedSourceReads(ctx, parent);
  const create = (parent as ManagedValidationContext)[managedSourceValidationScope];
  if (view === ctx || !create) return view;
  Object.defineProperty(view, managedSourceValidationScope, { value: create });
  return view;
}
/** Explicit same-native-snapshot view. The official native runQuery contract
 * shares its parent's transaction; Action/child RPC contexts cannot inherit this
 * nonserialized owner token. Only raw bounded readers cross helper traversals,
 * never their permission/currentness decisions or mutable account/output reads.
 * Keep the original native context for a caller's independent fresh fence. */
export function withNativeSnapshotReads<Ctx extends Pick<QueryCtx, "db">>(nativeCtx: Ctx, parentScope: Ctx): Ctx {
  const owner = (parentScope as Ctx & { [nativeReadScopeOwner]?: Ctx })[nativeReadScopeOwner];
  if (owner !== nativeCtx || !(parentScope as AuthorityReadContext)[authorityReadScope]) return nativeCtx;
  const view = { ...nativeCtx, db: parentScope.db };
  for (const name of ["runQuery", "runMutation"] as const) {
    const value: unknown = Reflect.get(parentScope, name);
    if (typeof value === "function") Object.defineProperty(view, name, { enumerable: true, value });
  }
  for (const name of [authorityReadScope, policyMetadataReadScope, nativeTranscriptReadScope,
    managedSourceReadScope, managedSourceValidationScope] as const) {
    const value: unknown = Reflect.get(parentScope, name);
    if (value !== undefined) Object.defineProperty(view, name, { value });
  }
  Object.defineProperty(view, nativeReadScopeOwner, { value: owner });
  return view;
}
/** Read-only public memory native entries opt in explicitly; this does not
 * acquire the V8 control-writer retention behavior or brand other routes. */
export function createMemorySourceReadScope<Ctx extends Pick<QueryCtx, "db">>(ctx: Ctx): Ctx {
  return createRawReadScope(ctx, { policyMetadata: true, executableMetadata: true, nativeTranscript: true, managedSources: true }, false);
}
type NativeMessageReference = AgentComponent["messages"]["getMessagesByIds"];
interface NativeTranscriptReader {
  read(reference: NativeMessageReference, messageIds: string[], invoke: () => Promise<(MessageDoc | null)[]>): Promise<(MessageDoc | null)[]>;
  fresh(): void;
  beginWrite(retain?: boolean): void;
  endWrite(retain?: boolean): void;
}
type NativeTranscriptContext = { [nativeTranscriptReadScope]?: NativeTranscriptReader };
export const NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES = 16;
export const NATIVE_TRANSCRIPT_READ_SCOPE_MAX_BYTES = 250_000;
/** Only the official exact message-ID lookup; every canonical/private/currentness
 * validator remains in its caller. No pagination, source or decision caching. */
export async function readNativeTranscriptMessages(ctx: Pick<QueryCtx, "runQuery">, reference: NativeMessageReference, messageIds: string[]): Promise<(MessageDoc | null)[]> {
  const invoke = async () => await ctx.runQuery(reference, { messageIds });
  const reader = (ctx as NativeTranscriptContext)[nativeTranscriptReadScope];
  return reader ? await reader.read(reference, messageIds, invoke) : await invoke();
}
export function freshNativeTranscriptReads<Ctx>(ctx: Ctx): Ctx {
  (ctx as NativeTranscriptContext)[nativeTranscriptReadScope]?.fresh();
  return ctx;
}
/** Bound retained raw Convex values, including bytes/undefined/BigInt. */
function nativeTranscriptBytes(value: unknown): number {
  if (typeof value === "string") return new TextEncoder().encode(value).length;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (Array.isArray(value)) return value.reduce((total: number, item: unknown) => total + nativeTranscriptBytes(item), 8);
  if (value !== null && typeof value === "object") return Object.entries(value).reduce((total, [key, item]) => total + nativeTranscriptBytes(key) + nativeTranscriptBytes(item), 8);
  return 8;
}
function createNativeTranscriptReader(): NativeTranscriptReader {
  const rows = new Map<string, (MessageDoc | null)[]>();
  let epoch = 0, writers = 0, bytes = 0;
  const fresh = () => { rows.clear(); bytes = 0; epoch++; };
  return {
    fresh,
    beginWrite: retain => { writers++; if (retain) epoch++; else fresh(); },
    endWrite: retain => { writers--; if (retain) epoch++; else fresh(); },
    read: async (reference, messageIds, invoke) => {
      const key = JSON.stringify([getFunctionAddress(reference), messageIds]), started = epoch;
      if (!writers && rows.has(key)) return cloneAuthorityValue(rows.get(key)!);
      const value = cloneAuthorityValue(await invoke());
      if (!writers && epoch === started && rows.size < NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES) {
        const size = nativeTranscriptBytes(value) + new TextEncoder().encode(key).length;
        if (bytes + size <= NATIVE_TRANSCRIPT_READ_SCOPE_MAX_BYTES) { rows.set(key, value); bytes += size; }
      }
      return cloneAuthorityValue(value);
    },
  };
}

interface PolicyMetadataReader {
  deploymentRows(): Promise<Doc<"runtimeModelPolicies">[]>;
  qualificationRows(receiptId: string, revision: number): Promise<Doc<"runtimeModelQualifications">[]>;
  executableDefinitionRows?(tenantId: string, memorySpaceId: string, agentId: string, version: number): Promise<Doc<"runtimeAgentDefinitions">[]>;
  tenantRows?(tenantId: string): Promise<Doc<"runtimeModelPolicies">[]>;
  fresh(): void;
}
type PolicyMetadataContext = Pick<QueryCtx, "db"> & { [policyMetadataReadScope]?: PolicyMetadataReader };
type AuthorityReadContext = Pick<QueryCtx, "db"> & { [authorityReadScope]?: AuthorityReader };
export const AUTHORITY_READ_SCOPE_MAX_ENTRIES = 512;
export const POLICY_METADATA_READ_SCOPE_MAX_ENTRIES = 64;
export const EXECUTABLE_METADATA_READ_SCOPE_MAX_ENTRIES = 32;
export const EXECUTABLE_METADATA_READ_SCOPE_MAX_BYTES = 1_000_000;
/** Exact original bounded raw queries; callers retain every validation predicate. */
export async function readDeploymentPolicyRows(ctx: Pick<QueryCtx, "db">): Promise<Doc<"runtimeModelPolicies">[]> {
  const reader = (ctx as PolicyMetadataContext)[policyMetadataReadScope];
  if (reader) return await reader.deploymentRows();
  return await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", q => q.eq("scope", "deployment").eq("tenantId", undefined).eq("active", true)).take(65);
}
export async function readQualificationRows(ctx: Pick<QueryCtx, "db">, receiptId: string, revision: number): Promise<Doc<"runtimeModelQualifications">[]> {
  const reader = (ctx as PolicyMetadataContext)[policyMetadataReadScope];
  if (reader) return await reader.qualificationRows(receiptId, revision);
  return await ctx.db.query("runtimeModelQualifications").withIndex("by_receipt", q => q.eq("receiptId", receiptId).eq("version", revision)).take(2);
}
/** These two closed families require a private V8 or explicit public-read parent.
 * Legacy policyMetadata scopes retain their original uncached behavior. */
export async function readExecutableDefinitionRows(ctx: Pick<QueryCtx, "db">, tenantId: string, memorySpaceId: string, agentId: string, version: number): Promise<Doc<"runtimeAgentDefinitions">[]> {
  const reader = (ctx as PolicyMetadataContext)[policyMetadataReadScope];
  if (reader?.executableDefinitionRows) return await reader.executableDefinitionRows(tenantId, memorySpaceId, agentId, version);
  return await ctx.db.query("runtimeAgentDefinitions").withIndex("by_scoped_version", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("agentId", agentId).eq("version", version)).take(2);
}
export async function readTenantPolicyRows(ctx: Pick<QueryCtx, "db">, tenantId: string): Promise<Doc<"runtimeModelPolicies">[]> {
  const reader = (ctx as PolicyMetadataContext)[policyMetadataReadScope];
  if (reader?.tenantRows) return await reader.tenantRows(tenantId);
  return await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", q => q.eq("scope", "tenant").eq("tenantId", tenantId).eq("active", true)).take(65);
}
/** Only opted-in metadata is cleared: the original context/writer/authority reader is retained. */
export function freshPolicyMetadataReads<Ctx extends Pick<QueryCtx, "db">>(ctx: Ctx): Ctx {
  (ctx as PolicyMetadataContext)[policyMetadataReadScope]?.fresh();
  return ctx;
}

/** Trusted native DB records are plain Convex values. Preserve optional undefined
 * fields and BigInt without relying on a Node-only structuredClone global. */
function cloneAuthorityValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => cloneAuthorityValue(item)) as T;
  if (value instanceof ArrayBuffer) return value.slice(0) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneAuthorityValue(item)])) as T;
  }
  return value;
}
function authorityReadKey(method: string, args: readonly (string | undefined)[]): string {
  return JSON.stringify([method, ...args.map(value => value === undefined ? ["undefined"] : ["value", value])]);
}
/** Explicit native invocation only. This reuses raw reads, never an authorization
 * decision: all requirement, generation, expiry and resource predicates still run.
 * Every writer invalidates before/after and suppresses cache use while in flight. */
export function createAuthorityReadScope<Ctx extends Pick<QueryCtx, "db">>(ctx: Ctx, options?: { policyMetadata?: true; nativeTranscript?: true }): Ctx {
  // Only an explicit V8 parent can carry this private, nonserialized brand.
  // Default contexts still receive a fresh reader, including nested scopes.
  if ((ctx as Ctx & { [v8ReadScope]?: true })[v8ReadScope]) return ctx;
  return createRawReadScope(ctx, options, false);
}
/** Opt-in native V8 transaction only. No derived decision or mutable account/run
 * row is retained; every original predicate continues to execute. */
export function createV8AuthorityReadScope<Ctx extends Pick<QueryCtx, "db">>(ctx: Ctx, options?: { managedSources: true }): Ctx {
  if ((ctx as Ctx & { [v8ReadScope]?: true })[v8ReadScope]
    && (!options?.managedSources || (ctx as ManagedSourceContext)[managedSourceReadScope])) return ctx;
  return createRawReadScope(ctx, { policyMetadata: true, executableMetadata: true, nativeTranscript: true, ...options }, true);
}
type RawAuthorityRead = <T>(method: string, args: readonly (string | undefined)[], invoke: () => Promise<T>) => Promise<T>;
function mappedAuthorityReader(base: AuthorityReader, read: RawAuthorityRead): AuthorityReader {
  return {
    findPrincipal: (issuer, subject) => read("findPrincipal", [issuer, subject], () => base.findPrincipal(issuer, subject)),
    getPrincipal: id => read("getPrincipal", [id], () => base.getPrincipal(id)),
    listMemberships: id => read("listMemberships", [id], () => base.listMemberships(id)),
    getMembership: id => read("getMembership", [id], () => base.getMembership(id)),
    listGrants: id => read("listGrants", [id], () => base.listGrants(id)),
    getGrant: id => read("getGrant", [id], () => base.getGrant(id)),
    getScope: (tenant, space) => read("getScope", [tenant, space], () => base.getScope(tenant, space)),
    hasTombstone: key => read("hasTombstone", [key.tenantId, key.memorySpaceId, key.resourceType, key.resourceId], () => base.hasTombstone(key)),
  };
}

function createRawReadScope<Ctx extends Pick<QueryCtx, "db">>(ctx: Ctx, options: { policyMetadata?: true; executableMetadata?: true; nativeTranscript?: true; managedSources?: true } | undefined, v8: boolean): Ctx {
  const values = new Map<string, unknown>();
  const metadata = new Map<string, unknown>();
  const executableMetadata = new Map<string, unknown>();
  let executableMetadataBytes = 0;
  const graph = new Map<string, unknown>();
  let graphBytes = 0, graphEpoch = 0;
  const freshGraph = () => { graph.clear(); graphBytes = 0; graphEpoch++; };
  // Nested helper scopes share only this explicitly opted-in parent reader.
  // Native child RPC contexts never receive the symbol through serialized args.
  const nativeTranscript = (ctx as NativeTranscriptContext)[nativeTranscriptReadScope] ?? (options?.nativeTranscript ? createNativeTranscriptReader() : undefined);
  let epoch = 0, writers = 0;
  let metadataEpoch = 0;
  const freshMetadata = () => { metadata.clear(); executableMetadata.clear(); executableMetadataBytes = 0; metadataEpoch++; };
  const invalidate = () => { values.clear(); epoch++; freshMetadata(); };
  const read = async <T>(method: string, args: readonly (string | undefined)[], invoke: () => Promise<T>): Promise<T> => {
    const key = authorityReadKey(method, args), started = epoch;
    if (!writers && values.has(key)) return cloneAuthorityValue(values.get(key)) as T;
    const value = cloneAuthorityValue(await invoke());
    if (!writers && epoch === started && values.size < AUTHORITY_READ_SCOPE_MAX_ENTRIES) values.set(key, value);
    return cloneAuthorityValue(value);
  };
  const base = createUncachedAuthorityReader(ctx);
  const reader = mappedAuthorityReader(base, read);
  const freshSourceReader = (): AuthorityReader => {
    const rows = new Map<string, unknown>();
    let sourceEpoch = epoch;
    return mappedAuthorityReader(base, async <T>(method: string, args: readonly (string | undefined)[], invoke: () => Promise<T>): Promise<T> => {
      if (sourceEpoch !== epoch) { rows.clear(); sourceEpoch = epoch; }
      const key = authorityReadKey(method, args), started = epoch;
      if (!writers && rows.has(key)) return cloneAuthorityValue(rows.get(key)) as T;
      const value = cloneAuthorityValue(await invoke());
      if (!writers && epoch === started && rows.size < AUTHORITY_READ_SCOPE_MAX_ENTRIES) rows.set(key, value);
      return cloneAuthorityValue(value);
    });
  };
  const readMetadata = async <T>(key: string, invoke: () => Promise<T>): Promise<T> => {
    const started = epoch, freshness = metadataEpoch;
    if (!writers && metadata.has(key)) return cloneAuthorityValue(metadata.get(key)) as T;
    const value = cloneAuthorityValue(await invoke());
    if (!writers && epoch === started && metadataEpoch === freshness && metadata.size < POLICY_METADATA_READ_SCOPE_MAX_ENTRIES) metadata.set(key, value);
    return cloneAuthorityValue(value);
  };
  const readExecutableMetadata = async <T>(key: string, invoke: () => Promise<T>): Promise<T> => {
    const started = epoch, freshness = metadataEpoch;
    if (!writers && executableMetadata.has(key)) return cloneAuthorityValue(executableMetadata.get(key)) as T;
    const value = cloneAuthorityValue(await invoke());
    if (!writers && epoch === started && metadataEpoch === freshness && !executableMetadata.has(key)
      && executableMetadata.size < EXECUTABLE_METADATA_READ_SCOPE_MAX_ENTRIES) {
      const bytes = nativeTranscriptBytes(value) + new TextEncoder().encode(key).length;
      if (executableMetadataBytes + bytes <= EXECUTABLE_METADATA_READ_SCOPE_MAX_BYTES) {
        executableMetadata.set(key, value); executableMetadataBytes += bytes;
      }
    }
    return cloneAuthorityValue(value);
  };
  const readGraph = async <T>(family: string, args: readonly string[], invoke: () => Promise<T>): Promise<T> => {
    const key = authorityReadKey(family, args), started = graphEpoch;
    if (!writers && graph.has(key)) return cloneAuthorityValue(graph.get(key)) as T;
    const value = cloneAuthorityValue(await invoke());
    if (!writers && graphEpoch === started && !graph.has(key) && graph.size < MANAGED_SOURCE_READ_SCOPE_MAX_ENTRIES) {
      const bytes = nativeTranscriptBytes(value) + new TextEncoder().encode(key).length;
      if (graphBytes + bytes <= MANAGED_SOURCE_READ_SCOPE_MAX_BYTES) { graph.set(key, value); graphBytes += bytes; }
    }
    return cloneAuthorityValue(value);
  };
  // Explicit native tables only. State writes affect none of the retained raw
  // families. Financial writes retain authority alone: accounts/operations/
  // attempts are never cached, and policy/message rows are freshly read.
  const retention = (method: string, args: unknown[]): "all" | "authority" | undefined => {
    if (!v8 || typeof args[0] !== "string") return undefined;
    const table = args[0];
    const state = ["runtimeAgentExecutions", "runtimeAgentOperations", "runtimeRunOutbox", "runtimeRuns"].includes(table);
    const finance = ["runtimeBudgetAccounts", "runtimeModelOperations", "runtimeModelAttempts"].includes(table);
    if (!state && !finance) return undefined;
    if (method === "insert") return args.length === 2 ? state ? "all" : "authority" : undefined;
    if (args.length !== (method === "delete" ? 2 : 3) || typeof args[1] !== "string") return undefined;
    // The native normalizer proves the ID belongs to the explicit table. If
    // unavailable/refused, invoke the original writer under full invalidation.
    const normalize: unknown = Reflect.get(ctx.db, "normalizeId", ctx.db);
    try {
      if (typeof normalize !== "function" || Reflect.apply(normalize, ctx.db, [table, args[1]]) !== args[1]) return undefined;
    } catch { return undefined; }
    return state ? "all" : "authority";
  };
  const writing = async (invoke: () => unknown, retained?: "all" | "authority"): Promise<unknown> => {
    // Even a previously proven control-only writer can change an origin run.
    // Graph values never use the authority/policy writer-retention exemption.
    const boundary = () => { freshGraph(); if (retained) { epoch++; if (retained === "authority") freshMetadata(); } else invalidate(); };
    boundary(); writers++; nativeTranscript?.beginWrite(retained === "all");
    try { return await invoke(); } finally { writers--; nativeTranscript?.endWrite(retained === "all"); boundary(); }
  };
  const db = new Proxy(ctx.db, { get(target, key) {
    const value: unknown = Reflect.get(target, key, target);
    if (typeof value !== "function") return value;
    const invoke = (args: unknown[]): unknown => Reflect.apply(value, target, args) as unknown;
    if (["insert", "patch", "replace", "delete"].includes(String(key))) return (...args: unknown[]) => writing(() => invoke(args), retention(String(key), args));
    // Fluent table writers are intentionally unknown to this mode. Never let
    // another native writing surface bypass the invalidation fence.
    if ((v8 || options?.managedSources) && key === "table") return (...args: unknown[]) => {
      const table = invoke(args);
      if (table === null || typeof table !== "object") return table;
      return new Proxy(table, { get(target, method) {
        const fn: unknown = Reflect.get(target, method, target);
        if (typeof fn !== "function") return fn;
        return (...input: unknown[]) => ["insert", "patch", "replace", "delete"].includes(String(method))
          ? writing(() => Reflect.apply(fn, target, input) as unknown) : Reflect.apply(fn, target, input) as unknown;
      } });
    };
    return (...args: unknown[]) => invoke(args);
  } });
  const scoped = { ...ctx, db };
  for (const name of ["runQuery", "runMutation"] as const) {
    const value: unknown = Reflect.get(ctx, name);
    if (typeof value !== "function") continue;
    Object.defineProperty(scoped, name, { enumerable: true, value: name === "runMutation"
      ? (...args: unknown[]) => writing(() => Reflect.apply(value, ctx, args) as unknown)
      : (...args: unknown[]) => Reflect.apply(value, ctx, args) as unknown });
  }
  Object.defineProperty(scoped, authorityReadScope, { value: reader });
  Object.defineProperty(scoped, nativeReadScopeOwner, { value: (ctx as Ctx & { [nativeReadScopeOwner]?: Ctx })[nativeReadScopeOwner] ?? ctx });
  if (v8) Object.defineProperty(scoped, v8ReadScope, { value: true });
  if (nativeTranscript) Object.defineProperty(scoped, nativeTranscriptReadScope, { value: nativeTranscript });
  if (options?.policyMetadata) Object.defineProperty(scoped, policyMetadataReadScope, { value: {
    deploymentRows: () => readMetadata("deployment", async () => await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", q => q.eq("scope", "deployment").eq("tenantId", undefined).eq("active", true)).take(65)),
    qualificationRows: (receiptId: string, revision: number) => readMetadata(JSON.stringify(["qualification", receiptId, revision]), async () =>
      await ctx.db.query("runtimeModelQualifications").withIndex("by_receipt", q => q.eq("receiptId", receiptId).eq("version", revision)).take(2)),
    ...(options.executableMetadata ? {
      executableDefinitionRows: (tenantId: string, memorySpaceId: string, agentId: string, version: number) => readExecutableMetadata(JSON.stringify(["definition", tenantId, memorySpaceId, agentId, version]), async () =>
        await ctx.db.query("runtimeAgentDefinitions").withIndex("by_scoped_version", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("agentId", agentId).eq("version", version)).take(2)),
      tenantRows: (tenantId: string) => readExecutableMetadata(JSON.stringify(["tenant", tenantId]), async () =>
        await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", q => q.eq("scope", "tenant").eq("tenantId", tenantId).eq("active", true)).take(65)),
    } : {}),
    fresh: freshMetadata,
  } satisfies PolicyMetadataReader });
  if (options?.managedSources) {
    Object.defineProperty(scoped, managedSourceValidationScope, { value: freshSourceReader });
    Object.defineProperty(scoped, managedSourceReadScope, { value: {
    sources: (tenantId: string, memorySpaceId: string, sourceId: string) => readGraph("source", [tenantId, memorySpaceId, sourceId], async () =>
      await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("lineage.sourceId", sourceId)).take(2)),
    conversations: (tenantId: string, memorySpaceId: string, conversationId: string) => readGraph("conversation", [tenantId, memorySpaceId, conversationId], async () =>
      await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("conversationId", conversationId)).take(2)),
    bridges: (tenantId: string, memorySpaceId: string, nativeMessageId: string) => readGraph("bridge", [tenantId, memorySpaceId, nativeMessageId], async () =>
      await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("nativeMessageId", nativeMessageId)).take(2)),
    runs: (tenantId: string, memorySpaceId: string, runId: string) => readGraph("run", [tenantId, memorySpaceId, runId], async () =>
      await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId).eq("runId", runId)).take(2)),
    fresh: freshGraph,
  } satisfies ManagedSourceReader });
  }
  return scoped;
}

function deny(code: "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" = "FORBIDDEN"): never {
  throw new ConvexError({ version: 1, code, message: code === "UNAUTHENTICATED"
    ? "Verified identity required" : code === "INVALID_INPUT" ? "Invalid authority configuration" : "Access denied",
  retryable: false, outcome: "not_dispatched" });
}

function active(record: Lifecycle | null): record is Lifecycle {
  return record !== null && Number.isSafeInteger(record.version) && record.version > 0
    && record.revokedAt === undefined && record.deletedAt === undefined;
}

/** Inspect the trusted raw grant scope before capability/ownership/currentness pruning. */
function boundGrants(
  grants: GrantRecord[], principalId: string, membership: MembershipRecord,
  memorySpaceId?: string, exactScope = false,
): GrantRecord[] {
  return grants.filter((grant) => grant.principalId === principalId && grant.membershipId === membership._id
    && grant.tenantId === membership.tenantId && (exactScope ? grant.memorySpaceId === memorySpaceId
      : memorySpaceId === undefined || grant.memorySpaceId === undefined || grant.memorySpaceId === memorySpaceId));
}

function assertSingleActiveGeneration(grants: GrantRecord[]): void {
  const groups = new Set<string>();
  for (const grant of grants) {
    // Expiry or a malformed version does not repair duplicate unrevoked generations.
    // Provisioning revokes the old generation before replacement, including expired grants.
    if (grant.revokedAt !== undefined || grant.deletedAt !== undefined) continue;
    const key = JSON.stringify([grant.principalId, grant.membershipId, grant.tenantId, grant.memorySpaceId]);
    if (groups.has(key)) deny();
    groups.add(key);
  }
}

function validateRequirement(requirement: RuntimeAuthorityRequirement): void {
  const resource = requirement.resource;
  if (resource && (!resource.tenantId || !resource.resourceId
    || (requirement.tenantId !== undefined && requirement.tenantId !== resource.tenantId)
    || (requirement.memorySpaceId !== undefined && requirement.memorySpaceId !== resource.memorySpaceId))) deny();
  if (requirement.tenantId === "" || requirement.memorySpaceId === "") deny();
}

/** Scope/ownership check for canonical rows. A missing row tenant is never global permission. */
export function assertResourceScope(authority: RuntimeAuthority, resource: RuntimeResource): void {
  if (!resource.tenantId || resource.tenantId !== authority.tenantId
    || (authority.memorySpaceId !== undefined && resource.memorySpaceId !== authority.memorySpaceId)) deny();
  if (authority.resourceAccess === "own" && resource.ownerPrincipalId !== authority.principalId) deny();
  if (authority.resourceAccess === "space"
    && (authority.memorySpaceId === undefined || resource.memorySpaceId !== authority.memorySpaceId)) deny();
}

async function assertCurrentScope(
  reader: AuthorityReader, tenantId: string, memorySpaceId?: string,
): Promise<{ tenantEpoch: number; memorySpaceEpoch?: number }> {
  const tenant = await reader.getScope(tenantId);
  if (!tenant || tenant.tenantId !== tenantId || tenant.memorySpaceId !== undefined
    || tenant.deletedAt !== undefined || !Number.isSafeInteger(tenant.epoch) || tenant.epoch < 1
    || await reader.hasTombstone({ tenantId, resourceType: "tenant", resourceId: tenantId })) deny();
  if (memorySpaceId === undefined) return { tenantEpoch: tenant.epoch };
  const space = await reader.getScope(tenantId, memorySpaceId);
  if (!space || space.tenantId !== tenantId || space.memorySpaceId !== memorySpaceId
    || space.deletedAt !== undefined || !Number.isSafeInteger(space.epoch) || space.epoch < 1
    || await reader.hasTombstone({ tenantId, memorySpaceId, resourceType: "memorySpace", resourceId: memorySpaceId })) deny();
  return { tenantEpoch: tenant.epoch, memorySpaceEpoch: space.epoch };
}

async function materialize(
  reader: AuthorityReader, principal: PrincipalRecord, membership: MembershipRecord,
  grant: GrantRecord, requirement: RuntimeAuthorityRequirement, now: number,
  pinned?: RuntimeAuthorityReference,
): Promise<RuntimeAuthority> {
  const tenantId = requirement.resource?.tenantId ?? requirement.tenantId ?? pinned?.tenantId ?? grant.tenantId;
  const memorySpaceId = requirement.resource?.memorySpaceId ?? requirement.memorySpaceId
    ?? pinned?.memorySpaceId ?? grant.memorySpaceId;
  if (!active(principal) || !active(membership) || !active(grant)
    || membership.principalId !== principal._id || grant.principalId !== principal._id
    || grant.membershipId !== membership._id || membership.tenantId !== grant.tenantId
    || tenantId !== grant.tenantId || !grant.capabilities.includes(requirement.capability)
    || (requirement.actorKind !== undefined && requirement.actorKind !== principal.actorKind)
    || (grant.expiresAt !== undefined && (!Number.isFinite(grant.expiresAt) || now >= grant.expiresAt))
    || (grant.memorySpaceId !== undefined && grant.memorySpaceId !== memorySpaceId)
    || (grant.resourceAccess === "space" && grant.memorySpaceId === undefined)
    || (grant.resourceAccess === "tenant" && grant.memorySpaceId !== undefined)) deny();
  const epochs = await assertCurrentScope(reader, tenantId, memorySpaceId);
  if (epochs.tenantEpoch !== grant.tenantEpoch
    || (grant.memorySpaceId !== undefined && epochs.memorySpaceEpoch !== grant.memorySpaceEpoch)) deny();
  const authority: RuntimeAuthority = {
    principalId: principal._id, principalVersion: principal.version,
    membershipId: membership._id, membershipVersion: membership.version,
    grantId: grant._id, grantVersion: grant.version, tenantId, ...epochs,
    ...(memorySpaceId === undefined ? {} : { memorySpaceId }),
    actorKind: principal.actorKind, userId: principal.metadataUserId ?? principal._id,
    capabilities: [...grant.capabilities], resourceAccess: grant.resourceAccess,
  };
  if (pinned && (pinned.principalId !== authority.principalId || pinned.principalVersion !== authority.principalVersion
    || pinned.membershipId !== authority.membershipId || pinned.membershipVersion !== authority.membershipVersion
    || pinned.grantId !== authority.grantId || pinned.grantVersion !== authority.grantVersion
    || pinned.tenantId !== authority.tenantId || pinned.tenantEpoch !== authority.tenantEpoch
    || pinned.memorySpaceId !== authority.memorySpaceId
    || pinned.memorySpaceEpoch !== authority.memorySpaceEpoch)) deny();
  if (requirement.resource) {
    assertResourceScope(authority, requirement.resource);
    const key = { tenantId, memorySpaceId: requirement.resource.memorySpaceId,
      resourceType: requirement.resource.resourceType, resourceId: requirement.resource.resourceId };
    if (await reader.hasTombstone(key)
      || (key.memorySpaceId !== undefined && await reader.hasTombstone({ ...key, memorySpaceId: undefined }))) deny();
  }
  return authority;
}

/** Pure authority resolution. Only Convex-verified issuer/subject enter this function. */
export async function resolveAuthority(
  reader: AuthorityReader, identity: Pick<UserIdentity, "issuer" | "subject"> | null,
  requirement: RuntimeAuthorityRequirement, now = Date.now(),
): Promise<RuntimeAuthority> {
  if (!identity?.issuer || !identity.subject) deny("UNAUTHENTICATED");
  validateRequirement(requirement);
  const principal = await reader.findPrincipal(identity.issuer, identity.subject);
  if (!principal || !active(principal) || principal.issuer !== identity.issuer || principal.subject !== identity.subject) deny();
  const candidates: RuntimeAuthority[] = [];
  const tenantId = requirement.resource?.tenantId ?? requirement.tenantId;
  const memorySpaceId = requirement.resource?.memorySpaceId ?? requirement.memorySpaceId;
  for (const membership of await reader.listMemberships(principal._id)) {
    if (!active(membership) || membership.principalId !== principal._id
      || (tenantId !== undefined && membership.tenantId !== tenantId)) continue;
    const grants = boundGrants(await reader.listGrants(membership._id), principal._id, membership, memorySpaceId);
    assertSingleActiveGeneration(grants);
    for (const grant of grants) {
      if (!active(grant) || !grant.capabilities.includes(requirement.capability)) continue;
      try {
        candidates.push(await materialize(reader, principal, membership, grant, requirement, now));
      } catch (error) {
        if (!(error instanceof ConvexError) || error.data.code !== "FORBIDDEN") throw error;
      }
    }
  }
  const scopes = new Set(candidates.map((candidate) => JSON.stringify([candidate.tenantId, candidate.memorySpaceId])));
  if (scopes.size !== 1) deny(); // No eligible grant or omitted selectors are ambiguous.
  // Provisioning admits only one active grant per membership/scope; fail closed on corrupt duplicates.
  if (candidates.length !== 1) deny();
  return candidates[0]!;
}

/** Background authority is reloaded at each sensitive read/effect/commit; it needs no session JWT. */
export async function resolveAuthorityReference(
  reader: AuthorityReader, reference: RuntimeAuthorityReference,
  requirement: RuntimeAuthorityRequirement, now = Date.now(),
): Promise<RuntimeAuthority> {
  validateRequirement(requirement);
  const principal = await reader.getPrincipal(reference.principalId);
  const membership = await reader.getMembership(reference.membershipId);
  const grant = await reader.getGrant(reference.grantId);
  if (!principal || !membership || !grant) deny();
  // A pinned ID is not an exception to the one-active-generation invariant.
  // Group by the grant's raw scope, not an effective space narrowed from a tenant-wide grant.
  const grants = boundGrants(await reader.listGrants(membership._id), principal._id, membership, grant.memorySpaceId, true);
  assertSingleActiveGeneration(grants);
  if (!grants.some((candidate) => candidate._id === grant._id)) deny();
  return await materialize(reader, principal, membership, grant, requirement, now, reference);
}

/** Avoid native unique() diagnostics containing trusted control document IDs. */
async function boundedSingle<T>(query: { take(limit: number): Promise<T[]> }): Promise<T | null> {
  const rows = await query.take(2);
  if (rows.length > 1) throw new ConvexError({ version: 1, code: "AUTHORITY_LOOKUP_AMBIGUOUS",
    message: "Authority lookup is ambiguous", retryable: false, outcome: "not_dispatched" });
  return rows[0] ?? null;
}

export function createAuthorityReader(ctx: Pick<QueryCtx, "db">): AuthorityReader {
  return (ctx as AuthorityReadContext)[authorityReadScope] ?? createUncachedAuthorityReader(ctx);
}
function createUncachedAuthorityReader(ctx: Pick<QueryCtx, "db">): AuthorityReader {
  return {
    findPrincipal: async (issuer, subject) => await boundedSingle(ctx.db.query("runtimeAuthPrincipals")
      .withIndex("by_issuer_subject", (q) => q.eq("issuer", issuer).eq("subject", subject))),
    getPrincipal: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthPrincipals", id);
      return normalized ? await ctx.db.get("runtimeAuthPrincipals", normalized) : null;
    },
    listMemberships: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthPrincipals", id);
      return normalized ? await ctx.db.query("runtimeAuthMemberships")
        .withIndex("by_principal_tenant", (q) => q.eq("principalId", normalized)).collect() : [];
    },
    getMembership: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthMemberships", id);
      return normalized ? await ctx.db.get("runtimeAuthMemberships", normalized) : null;
    },
    listGrants: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthMemberships", id);
      return normalized ? await ctx.db.query("runtimeAuthGrants")
        .withIndex("by_membership", (q) => q.eq("membershipId", normalized)).collect() : [];
    },
    getGrant: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthGrants", id);
      return normalized ? await ctx.db.get("runtimeAuthGrants", normalized) : null;
    },
    getScope: async (tenantId, memorySpaceId) => await boundedSingle(ctx.db.query("runtimeAuthScopes")
      .withIndex("by_tenant_space", (q) => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId))),
    hasTombstone: async (key) => (await boundedSingle(ctx.db.query("runtimeAuthTombstones")
      .withIndex("by_resource", (q) => q.eq("tenantId", key.tenantId).eq("memorySpaceId", key.memorySpaceId)
        .eq("resourceType", key.resourceType).eq("resourceId", key.resourceId)))) !== null,
  };
}

export async function requireAuthority(
  ctx: Pick<QueryCtx, "auth" | "db">, requirement: RuntimeAuthorityRequirement,
): Promise<RuntimeAuthority> {
  return await resolveAuthority(createAuthorityReader(ctx), await ctx.auth.getUserIdentity(), requirement);
}

export async function recheckAuthority(
  ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, requirement: RuntimeAuthorityRequirement,
): Promise<RuntimeAuthority> {
  return await resolveAuthorityReference(createAuthorityReader(ctx), reference, requirement);
}
async function retireGraphAuthority(ctx: MutationCtx, selector: { grantId?: string; principalId?: string; membershipId?: string; tenantId?: string; memorySpaceId?: string; sourceId?: string; conversationId?: string }) {
  // This child mutation shares the authority change's transaction. Cleanup never
  // borrows the obsolete grant, and the connector's operator scope is separate.
  await ctx.runMutation(makeFunctionReference<"mutation", typeof selector, null>("runtimeGraph:retireAuthority"), selector);
}

/** Actions invoke this internal query with inherited verified Convex auth (codegen in Task 03B/06). */
export const authorize = internalQuery({
  args: { requirement: runtimeAuthorityRequirement },
  handler: async (ctx, args) => await requireAuthority(ctx, args.requirement),
});
export const recheck = internalQuery({
  args: { reference: runtimeAuthorityReference, requirement: runtimeAuthorityRequirement },
  handler: async (ctx, args) => await recheckAuthority(ctx, args.reference, args.requirement),
});

function nonempty(value: string): void {
  if (!value.trim()) deny("INVALID_INPUT");
}

async function ensureScope(ctx: MutationCtx, tenantId: string, memorySpaceId?: string): Promise<ScopeRecord> {
  const existing = await ctx.db.query("runtimeAuthScopes")
    .withIndex("by_tenant_space", (q) => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId)).unique();
  if (existing) {
    if (existing.deletedAt !== undefined) deny();
    return existing;
  }
  if (await createAuthorityReader(ctx).hasTombstone({ tenantId, memorySpaceId,
    resourceType: memorySpaceId === undefined ? "tenant" : "memorySpace", resourceId: memorySpaceId ?? tenantId })) deny();
  const scope = { tenantId, ...(memorySpaceId === undefined ? {} : { memorySpaceId }), epoch: 1, createdAt: Date.now() };
  await ctx.db.insert("runtimeAuthScopes", scope);
  return scope;
}

/** Trusted deployment operator only. No public self-provisioning, even with an admin claim. */
export const provision = internalMutation({
  args: {
    issuer: v.string(), subject: v.string(), actorKind: runtimeActorKind,
    metadataUserId: v.optional(v.string()), tenantId: v.string(), memorySpaceId: v.optional(v.string()),
    capabilities: v.array(runtimeCapability), resourceAccess: runtimeResourceAccess, expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    [args.issuer, args.subject, args.tenantId].forEach(nonempty);
    if (args.memorySpaceId !== undefined) nonempty(args.memorySpaceId);
    if (args.metadataUserId !== undefined) nonempty(args.metadataUserId);
    if (args.capabilities.length === 0 || (args.resourceAccess === "space" && args.memorySpaceId === undefined)
      || (args.resourceAccess === "tenant" && args.memorySpaceId !== undefined)
      || (args.expiresAt !== undefined && (!Number.isFinite(args.expiresAt) || args.expiresAt <= Date.now()))) deny("INVALID_INPUT");
    const now = Date.now();
    const reader = createAuthorityReader(ctx);
    const tenant = await ensureScope(ctx, args.tenantId);
    const space = args.memorySpaceId === undefined ? undefined : await ensureScope(ctx, args.tenantId, args.memorySpaceId);
    let principal = await ctx.db.query("runtimeAuthPrincipals")
      .withIndex("by_issuer_subject", (q) => q.eq("issuer", args.issuer).eq("subject", args.subject)).unique();
    if (principal && (!active(principal) || principal.actorKind !== args.actorKind
      || principal.metadataUserId !== args.metadataUserId)) deny();
    if (!principal) {
      const id = await ctx.db.insert("runtimeAuthPrincipals", {
        issuer: args.issuer, subject: args.subject, actorKind: args.actorKind,
        ...(args.metadataUserId === undefined ? {} : { metadataUserId: args.metadataUserId }), version: 1, createdAt: now,
      });
      principal = await ctx.db.get("runtimeAuthPrincipals", id);
    }
    if (!principal) deny();
    let membership = await ctx.db.query("runtimeAuthMemberships")
      .withIndex("by_principal_tenant", (q) => q.eq("principalId", principal._id).eq("tenantId", args.tenantId)).unique();
    if (membership && !active(membership)) deny();
    if (!membership) {
      const id = await ctx.db.insert("runtimeAuthMemberships", {
        principalId: principal._id, tenantId: args.tenantId, version: 1, createdAt: now,
      });
      membership = await ctx.db.get("runtimeAuthMemberships", id);
    }
    if (!membership) deny();
    const previous = (await reader.listGrants(membership._id)).filter((grant) => grant.memorySpaceId === args.memorySpaceId);
    const capabilities = [...new Set(args.capabilities)].sort();
    const current = previous.filter((grant) => active(grant));
    if (current.length > 1) deny();
    if (current[0] && JSON.stringify([...current[0].capabilities].sort()) === JSON.stringify(capabilities)
      && current[0].resourceAccess === args.resourceAccess && current[0].expiresAt === args.expiresAt
      && current[0].tenantEpoch === tenant.epoch && current[0].memorySpaceEpoch === space?.epoch) {
      return await materialize(reader, principal, membership, current[0], { capability: capabilities[0]! }, now);
    }
    // Changing authority creates a new immutable grant generation and invalidates the old reference.
    for (const old of current) {
      const id = ctx.db.normalizeId("runtimeAuthGrants", old._id);
      if (!id) deny();
      await ctx.db.patch("runtimeAuthGrants", id, { revokedAt: now });
      await retireGraphAuthority(ctx, { grantId: old._id });
    }
    const id = await ctx.db.insert("runtimeAuthGrants", {
      principalId: principal._id, membershipId: membership._id, tenantId: args.tenantId,
      ...(args.memorySpaceId === undefined ? {} : { memorySpaceId: args.memorySpaceId, memorySpaceEpoch: space!.epoch }),
      tenantEpoch: tenant.epoch, capabilities, resourceAccess: args.resourceAccess,
      version: Math.max(0, ...previous.map((grant) => grant.version)) + 1, createdAt: now,
      ...(args.expiresAt === undefined ? {} : { expiresAt: args.expiresAt }),
    });
    const grant = await ctx.db.get("runtimeAuthGrants", id);
    if (!grant) deny();
    return await materialize(reader, principal, membership, grant, { capability: capabilities[0]! }, now);
  },
});

export const revokeGrant = internalMutation({
  args: { grantId: v.id("runtimeAuthGrants") },
  handler: async (ctx, args) => {
    const grant = await ctx.db.get("runtimeAuthGrants", args.grantId);
    if (grant && grant.revokedAt === undefined) {
      await ctx.db.patch("runtimeAuthGrants", grant._id, { revokedAt: Date.now() });
      await retireGraphAuthority(ctx, { grantId: String(grant._id) });
    }
  },
});
export const revokeMembership = internalMutation({
  args: { membershipId: v.id("runtimeAuthMemberships") },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get("runtimeAuthMemberships", args.membershipId);
    if (membership && membership.revokedAt === undefined) await ctx.db.patch("runtimeAuthMemberships", membership._id,
      { revokedAt: Date.now(), version: membership.version + 1 });
    if (membership) await retireGraphAuthority(ctx, { membershipId: String(membership._id) });
  },
});
export const deletePrincipal = internalMutation({
  args: { principalId: v.id("runtimeAuthPrincipals") },
  handler: async (ctx, args) => {
    const principal = await ctx.db.get("runtimeAuthPrincipals", args.principalId);
    if (principal && principal.deletedAt === undefined) await ctx.db.patch("runtimeAuthPrincipals", principal._id,
      { deletedAt: Date.now(), version: principal.version + 1 });
    if (principal) { await retireGraphAuthority(ctx, { principalId: String(principal._id) });
      await ctx.runMutation(makeFunctionReference<"mutation">("runtimeAssets:retireAuthority"), { principalId: String(principal._id) }); }
  },
});
export const deleteScope = internalMutation({
  args: { tenantId: v.string(), memorySpaceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const scope = await ctx.db.query("runtimeAuthScopes")
      .withIndex("by_tenant_space", (q) => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId)).unique();
    if (scope && scope.deletedAt === undefined) await ctx.db.patch("runtimeAuthScopes", scope._id,
      { deletedAt: Date.now(), epoch: scope.epoch + 1 });
    const key = { ...args, resourceType: args.memorySpaceId === undefined ? "tenant" as const : "memorySpace" as const,
      resourceId: args.memorySpaceId ?? args.tenantId };
    if (!await createAuthorityReader(ctx).hasTombstone(key)) await ctx.db.insert("runtimeAuthTombstones", { ...key, deletedAt: Date.now() });
    await retireGraphAuthority(ctx, args);
    await ctx.runMutation(makeFunctionReference<"mutation">("runtimeAssets:retireAuthority"), args);
  },
});
export const tombstoneResource = internalMutation({
  args: { tenantId: v.string(), memorySpaceId: v.optional(v.string()), resourceType: runtimeResourceType, resourceId: v.string() },
  handler: async (ctx, args) => {
    nonempty(args.tenantId); nonempty(args.resourceId);
    if (!await createAuthorityReader(ctx).hasTombstone(args)) await ctx.db.insert("runtimeAuthTombstones", { ...args, deletedAt: Date.now() });
    if (args.resourceType === "source" && args.memorySpaceId) await ctx.runMutation(
      makeFunctionReference("runtimeIngestion:retireScopedSource") as unknown as FunctionReference<"mutation", "internal", {
        tenantId: string; memorySpaceId: string; sourceId: string }, null>,
      { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, sourceId: args.resourceId });
    else if (args.resourceType === "source") await retireGraphAuthority(ctx, { tenantId: args.tenantId, sourceId: args.resourceId });
    if (args.resourceType === "conversation") await retireGraphAuthority(ctx, { tenantId: args.tenantId,
      ...(args.memorySpaceId ? { memorySpaceId: args.memorySpaceId } : {}), conversationId: args.resourceId });
    if (args.resourceType === "fact") {
      const rows = await ctx.db.query("facts").withIndex("by_factId", q => q.eq("factId", args.resourceId))
        .filter(q => q.and(q.eq(q.field("tenantId"), args.tenantId), ...(args.memorySpaceId ? [q.eq(q.field("memorySpaceId"), args.memorySpaceId)] : []))).take(2);
      for (const fact of rows) if (fact.lineage) await retireGraphAuthority(ctx, { tenantId: args.tenantId, memorySpaceId: fact.memorySpaceId, sourceId: fact.lineage.sourceId });
    }
  },
});
