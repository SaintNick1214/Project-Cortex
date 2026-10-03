/** Actual Convex registrations under a transaction-aware in-memory database fixture.
 * This exercises handler selection/mutation, not a substitute for deployed subscriptions/transactions.
 */
import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { RuntimeAuthority, RuntimeCapability, RuntimeResourceAccess } from "../../../src/auth/verified";
import { authorize, provision, recheck } from "../../../convex-dev/runtimeAuth";
import * as memories from "../../../convex-dev/memories";
import * as facts from "../../../convex-dev/facts";
import { semanticHash } from "../../../src/domain/profile";

type Row = { _id: string; _creationTime: number; [key: string]: unknown };
type Expr = (row: Row) => unknown;
function value(expr: unknown, row: Row): unknown { return typeof expr === "function" ? (expr as Expr)(row) : expr; }
function field(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((previous, key) => previous && typeof previous === "object"
    ? (previous as Record<string, unknown>)[key] : undefined, row);
}
const filters = {
  field: (path: string): Expr => row => field(row, path),
  eq: (a: unknown, b: unknown): Expr => row => value(a, row) === value(b, row),
  neq: (a: unknown, b: unknown): Expr => row => value(a, row) !== value(b, row),
  and: (...expressions: Expr[]): Expr => row => expressions.every(expression => expression(row)),
  or: (...expressions: Expr[]): Expr => row => expressions.some(expression => expression(row)),
};
export class FixtureDb {
  rows = new Map<string, Row[]>();
  attemptedWrites: string[] = [];
  reads: { table: string; index: string; ids: string[] }[] = [];
  private next = 1;
  normalizeId(table: string, id: string) { return id.startsWith(`${table}/`) ? id : null; }
  query(table: string) {
    const predicates: Expr[] = []; let index = "scan"; let descending = false;
    const selected = () => {
      const rows = (this.rows.get(table) ?? []).filter(row => predicates.every(predicate => predicate(row)));
      if (descending) rows.reverse();
      this.reads.push({ table, index, ids: rows.map(row => row._id) });
      return rows;
    };
    const result = {
      withIndex: (name: string, callback: (q: { eq: (key: string, expected: unknown) => unknown }) => unknown) => {
        index = name;
        const q = { eq: (key: string, expected: unknown) => { predicates.push(row => field(row, key) === expected); return q; } };
        callback(q); return result;
      },
      withSearchIndex: (name: string, callback: (q: { eq: (key: string, expected: unknown) => unknown; search: (key: string, text: string) => unknown }) => unknown) => {
        index = name;
        const q = {
          eq: (key: string, expected: unknown) => { predicates.push(row => field(row, key) === expected); return q; },
          search: (key: string, text: string) => { predicates.push(row => String(field(row, key)).toLowerCase().includes(text.toLowerCase())); return q; },
        };
        callback(q); return result;
      },
      filter: (callback: (q: typeof filters) => Expr) => { predicates.push(callback(filters)); return result; },
      order: (direction: string) => { descending = direction === "desc"; return result; },
      first: async () => selected()[0] ?? null,
      unique: async () => { const rows = selected(); if (rows.length > 1) throw new Error("Duplicate canonical row"); return rows[0] ?? null; },
      collect: async () => selected(),
      take: async (limit: number) => selected().slice(0, limit),
    };
    return result;
  }
  async get(tableOrId: string, id?: string) {
    const key = id ?? tableOrId; const table = id ? tableOrId : key.split("/")[0];
    const row = (this.rows.get(table) ?? []).find(row => row._id === key) ?? null;
    this.reads.push({ table, index: "get", ids: row ? [row._id] : [] }); return row;
  }
  async insert(table: string, fields: Record<string, unknown>) {
    const _id = `${table}/${this.next++}`;
    const row = { ...fields, _id, _creationTime: this.next };
    this.rows.set(table, [...(this.rows.get(table) ?? []), row]); this.attemptedWrites.push(`insert:${_id}`); return _id;
  }
  async patch(tableOrId: string, idOrFields: string | Record<string, unknown>, fields?: Record<string, unknown>) {
    const id = typeof idOrFields === "string" ? idOrFields : tableOrId;
    const updates = typeof idOrFields === "string" ? fields! : idOrFields;
    const row = await this.get(id); if (!row) throw new Error("Missing row");
    Object.assign(row, updates); this.attemptedWrites.push(`patch:${id}`);
  }
  async delete(id: string) {
    const table = id.split("/")[0]; this.rows.set(table, (this.rows.get(table) ?? []).filter(row => row._id !== id)); this.attemptedWrites.push(`delete:${id}`);
  }
  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    const before = structuredClone(this.rows);
    try { return await operation(); } catch (error) { this.rows = before; throw error; }
  }
}
/** Convex's runtime _handler exists but is deliberately absent from its published registration types. */
function handler(registration: unknown): (ctx: MutationCtx | ActionCtx, args: Record<string, unknown>) => Promise<unknown> {
  return (registration as { _handler: (ctx: MutationCtx | ActionCtx, args: Record<string, unknown>) => Promise<unknown> })._handler;
}
export const identity = { issuer: "https://host.example", subject: "alice" };
export const forbidden = { data: { code: "FORBIDDEN" } };
export function harness() {
  const db = new FixtureDb(); let verified: Record<string, unknown> | null = identity;
  let vectorCalls = 0; let authReads = 0;
  let authHook: (() => Promise<void>) | undefined;
  let internalHook: ((name: string, stage: "before" | "after") => Promise<void>) | undefined;
  // Single fixture adapter cast: production contexts stay Convex-owned and strongly typed.
  const ctx = { db, auth: { getUserIdentity: async () => { authReads++; await authHook?.(); return verified; } } } as unknown as MutationCtx;
  const registrations: Record<string, unknown> = { "runtimeAuth:authorize": authorize, "runtimeAuth:recheck": recheck,
    "memories:keywordSearchMemories": memories.keywordSearchMemories, "memories:fetchMemoriesByIds": memories.fetchMemoriesByIds,
    "facts:fetchFactsByIds": facts.fetchFactsByIds };
  const actionCtx = { auth: ctx.auth, runQuery: async (reference: Parameters<typeof getFunctionName>[0], args: Record<string, unknown>) => {
    const name = getFunctionName(reference);
    await internalHook?.(name, "before");
    const registration = registrations[name]; if (!registration) throw new Error("Unknown actual internal registration");
    const result = await handler(registration)(ctx, args);
    await internalHook?.(name, "after");
    return result;
  }, vectorSearch: async () => { vectorCalls++; throw new Error("Unqualified legacy vector dispatch must not occur"); } } as unknown as ActionCtx;
  const invoke = async <T = unknown>(registration: unknown, args: Record<string, unknown> = {}): Promise<T> =>
    await db.transaction(async () => await handler(registration)((registration as { isAction?: boolean }).isAction ? actionCtx : ctx, args) as T);
  const provisionScope = async (options: { tenantId?: string; memorySpaceId?: string; subject?: string; capabilities?: RuntimeCapability[]; resourceAccess?: RuntimeResourceAccess } = {}) =>
    await invoke<RuntimeAuthority>(provision, { ...identity, actorKind: "user", metadataUserId: options.subject ? `metadata-${options.subject}` : "metadata-alice",
      subject: options.subject ?? "alice", tenantId: options.tenantId ?? "tenant-a", memorySpaceId: options.memorySpaceId ?? "space-a",
      capabilities: options.capabilities ?? ["read", "write"], resourceAccess: options.resourceAccess ?? "own" });
  const provisionTenantRead = async (expiresAt?: number) => await invoke<RuntimeAuthority>(provision, { ...identity,
    actorKind: "user", metadataUserId: "metadata-alice", tenantId: "tenant-a", capabilities: ["read"], resourceAccess: "tenant",
    ...(expiresAt === undefined ? {} : { expiresAt }) });
  const seedData = async (table: "memories" | "facts", owner: RuntimeAuthority, id: string, extra: Record<string, unknown> = {}) => {
    let manualSourceBinding: { resourceType: string; resourceId: string } | undefined = { resourceType: table === "memories" ? "memory" : "fact", resourceId: id };
    let sourceId = `manual:${JSON.stringify([owner.tenantId, owner.memorySpaceId, manualSourceBinding.resourceType, id])}`;
    if ((db.rows.get("runtimeMemorySources") ?? []).some(row => (row.lineage as { sourceId: string }).sourceId === sourceId)) {
      // Same-ID foreign-owner adversarial fixtures have separate non-manual canonical sources.
      sourceId = `fixture:${sourceId}:${owner.principalId}`; manualSourceBinding = undefined;
    }
    const lineage = { sourceId, sourceEventId: sourceId,
      sourceRevision: 1, role: "user", trust: "user_assertion" };
    const content = `${owner.tenantId} private ${id}`;
    await db.insert("runtimeMemorySources", { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.principalId,
      lineage, content, contentHash: await semanticHash(content), createdAt: Date.now() });
    const common = { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.principalId, lineage, manualSourceBinding,
      runtimeEditor: { principalId: owner.principalId, userId: owner.userId, editedAt: Date.now() },
      userId: owner.userId, participantId: owner.userId, tags: [], version: 1, createdAt: Date.now(), updatedAt: Date.now() };
    return await db.insert(table, table === "memories" ? { ...common, memoryId: id, content, contentType: "raw", sourceType: "system", sourceTimestamp: Date.now(),
      importance: 50, accessCount: 0, previousVersions: [], ...extra } : { ...common, factId: id, fact: content, factType: "preference", confidence: 80,
      extractionPolicyVersion: "manual-assertion-v1", sourceType: "manual", subject: "alice", predicate: "prefers", object: "dark", ...extra });
  };
  return { db, ctx, invoke, provisionScope, provisionTenantRead, seedData, setIdentity: (value: Record<string, unknown> | null) => { verified = value; },
    setAuthHook: (hook: typeof authHook) => { authHook = hook; },
    setInternalHook: (hook: typeof internalHook) => { internalHook = hook; }, authReads: () => authReads, vectorCalls: () => vectorCalls };
}
export const memoryStoreArgs = { memorySpaceId: "space-a", content: "Remember this assertion", contentType: "raw", sourceType: "tool", importance: 50, tags: [] };
export const factStoreArgs = { memorySpaceId: "space-a", fact: "Alice prefers dark mode", factType: "preference", confidence: 80, sourceType: "tool", tags: [], subject: "alice", predicate: "prefers", object: "dark" };
/** The first response hash runs under READ, the second under the last WRITE row check. */
export async function withFinalWriteHash<T>(h: ReturnType<typeof harness>, table: "memories" | "facts",
  onFinalHash: () => Promise<void>, operation: () => Promise<T>): Promise<T> {
  let readAdmitted = false; let hashes = 0;
  h.setAuthHook(async () => { if (h.db.attemptedWrites.some(write => write.startsWith(`patch:${table}/`))) readAdmitted = true; });
  const digest = globalThis.crypto.subtle.digest;
  globalThis.crypto.subtle.digest = async (algorithm, data) => {
    if (readAdmitted && ++hashes === 2) await onFinalHash();
    return await digest.call(globalThis.crypto.subtle, algorithm, data);
  };
  try { return await operation(); } finally { globalThis.crypto.subtle.digest = digest; h.setAuthHook(undefined); }
}

/** Inject a real asynchronous crypto boundary while executing actual registered handlers. */
export async function withSourceHashBoundary<T>(onHash: () => Promise<void>, operation: () => Promise<T>,
  select: (content: string) => boolean = () => true): Promise<void> {
  const digest = globalThis.crypto.subtle.digest; let injected = false;
  globalThis.crypto.subtle.digest = async (algorithm, data) => {
    const content = new TextDecoder().decode(data);
    if (!injected && select(content)) { injected = true; await onHash(); }
    return await digest.call(globalThis.crypto.subtle, algorithm, data);
  };
  try { await operation(); if (!injected) throw new Error("Source hash injection boundary was not reached"); }
  finally { globalThis.crypto.subtle.digest = digest; }
}
