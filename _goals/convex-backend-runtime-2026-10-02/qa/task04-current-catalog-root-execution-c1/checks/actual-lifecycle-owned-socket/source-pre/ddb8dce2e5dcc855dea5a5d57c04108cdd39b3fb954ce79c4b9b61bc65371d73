import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { RuntimeAuthorityReference } from "../../../src/auth/verified";
import { semanticHash } from "../../../src/domain/profile";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
type Predicate = (row: Row) => boolean;
function field(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, row);
}
/** Independent transaction fixture with actual selection traces and registered handler calls. */
export class WorkerTestDb {
  rows = new Map<string, Row[]>();
  writes = 0;
  sequence = 0;
  traces: { table: string; index?: string; keys: [string, unknown][]; returned: string[] }[] = [];
  beforeRead?: (table: string) => void;
  table(name: string): Row[] { if (!this.rows.has(name)) this.rows.set(name, []); return this.rows.get(name)!; }
  seed(table: string, value: Record<string, unknown>): Row {
    const row = { ...structuredClone(value), _id: typeof value._id === "string" ? value._id : `${table}:${++this.sequence}`, _creationTime: 1000 };
    this.table(table).push(row); return row;
  }
  query(table: string) {
    const keys: [string, unknown][] = []; const predicates: Predicate[] = []; let index: string | undefined; let order = "asc";
    const selected = () => {
      this.beforeRead?.(table);
      const rows = this.table(table).filter((row) => keys.every(([key, value]) => field(row, key) === value) && predicates.every((test) => test(row)));
      if (order === "desc") rows.reverse();
      this.traces.push({ table, index, keys: [...keys], returned: rows.map((row) => row._id) }); return rows;
    };
    const q = {
      field: (name: string) => name,
      eq: (name: string, value: unknown): Predicate => (row) => field(row, name) === value,
      gt: (name: string, value: number): Predicate => (row) => typeof field(row, name) === "number" && (field(row, name) as number) > value,
      gte: (name: string, value: number): Predicate => (row) => typeof field(row, name) === "number" && (field(row, name) as number) >= value,
      lt: (name: string, value: number): Predicate => (row) => typeof field(row, name) === "number" && (field(row, name) as number) < value,
      lte: (name: string, value: number): Predicate => (row) => typeof field(row, name) === "number" && (field(row, name) as number) <= value,
      and: (...tests: Predicate[]): Predicate => (row) => tests.every((test) => test(row)),
    };
    const builder = {
      withIndex: (name: string, callback: (selector: unknown) => unknown) => {
        index = name;
        const selector = { eq: (key: string, value: unknown) => { keys.push([key, value]); return selector; },
          gte: (key: string, value: number) => { predicates.push(q.gte(key, value)); return selector; },
          lte: (key: string, value: number) => { predicates.push(q.lte(key, value)); return selector; } };
        callback(selector); return builder;
      },
      filter: (callback: (filter: typeof q) => Predicate) => { predicates.push(callback(q)); return builder; },
      order: (direction: string) => { order = direction; return builder; },
      unique: async () => { const rows = selected(); if (rows.length > 1) throw new Error("Nonunique canonical index"); return rows[0] ?? null; },
      first: async () => selected()[0] ?? null,
      collect: async () => [...selected()], take: async (limit: number) => selected().slice(0, limit),
    };
    return builder;
  }
  normalizeId(table: string, id: string): string | null { return id.startsWith(`${table}:`) ? id : null; }
  async get(table: string, id: string): Promise<Row | null> { this.beforeRead?.(table); return this.table(table).find((row) => row._id === id) ?? null; }
  async insert(table: string, value: Record<string, unknown>): Promise<string> { this.writes++; return this.seed(table, value)._id; }
  async patch(table: string, id: string, value: Record<string, unknown>): Promise<void> {
    const row = await this.get(table, id); if (!row) throw new Error("Missing row"); this.writes++;
    Object.assign(row, structuredClone(value));
  }
  async delete(table: string, id: string): Promise<void> { this.writes++; this.rows.set(table, this.table(table).filter((row) => row._id !== id)); }
  async transaction<T>(run: () => Promise<T>): Promise<T> {
    const before = structuredClone(this.rows); const writes = this.writes; const sequence = this.sequence;
    try { return await run(); } catch (error) { this.rows = before; this.writes = writes; this.sequence = sequence; throw error; }
  }
}
export type Registration = { _handler: (ctx: MutationCtx, args: never) => Promise<unknown>; isInternal?: boolean; isPublic?: boolean };
export function invoke<T = unknown>(registration: unknown, ctx: MutationCtx, args: unknown): Promise<T> {
  return (registration as Registration)._handler(ctx, args as never) as Promise<T>;
}
export function fixture(capabilities = ["admin", "read", "tool"], tenantOnly = false) {
  const db = new WorkerTestDb();
  const principal = db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "user-a", actorKind: "user", version: 1, createdAt: 1000 });
  const membership = db.seed("runtimeAuthMemberships", { principalId: principal._id, tenantId: "tenant-a", version: 1, createdAt: 1000 });
  db.seed("runtimeAuthScopes", { tenantId: "tenant-a", epoch: 1, createdAt: 1000 });
  db.seed("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId: "space-a", epoch: 1, createdAt: 1000 });
  const grant = db.seed("runtimeAuthGrants", { principalId: principal._id, membershipId: membership._id, tenantId: "tenant-a",
    ...(tenantOnly ? {} : { memorySpaceId: "space-a", memorySpaceEpoch: 1 }), tenantEpoch: 1,
    capabilities, resourceAccess: tenantOnly ? "tenant" : "own", version: 1, createdAt: 1000 });
  const reference: RuntimeAuthorityReference = { principalId: principal._id, principalVersion: 1, membershipId: membership._id, membershipVersion: 1,
    grantId: grant._id, grantVersion: 1, tenantId: "tenant-a", tenantEpoch: 1, ...(tenantOnly ? {} : { memorySpaceId: "space-a", memorySpaceEpoch: 1 }) };
  const ctx = { db, auth: { getUserIdentity: async () => ({ issuer: "https://host.test", subject: "user-a" }) } } as unknown as MutationCtx;
  const anonymous = { db, auth: { getUserIdentity: async () => null } } as unknown as MutationCtx;
  return { db, ctx, anonymous, principal, membership, grant, reference };
}
export const policy = { organizationId: "tenant-a", memorySpaceId: "space-a",
  conversations: { retention: { deleteAfter: "7y", purgeOnUserRequest: true }, purging: { autoDelete: false } },
  immutable: { retention: { defaultVersions: 10, byType: {} }, purging: { autoCleanupVersions: false } },
  mutable: { retention: {}, purging: { autoDelete: false } },
  vector: { retention: { defaultVersions: 10, byImportance: [{ range: [0, 100], versions: 10 }] }, purging: { autoCleanupVersions: false, deleteOrphaned: false } },
  compliance: { mode: "GDPR", dataRetentionYears: 7, requireJustification: [90], auditLogging: true } };
export async function seedFact(f: ReturnType<typeof fixture>, overrides: Record<string, unknown> = {}) {
  const lineage = { sourceId: "source-a", sourceEventId: "event-a", sourceRevision: 1, role: "user", trust: "user_assertion" };
  const source = f.db.seed("runtimeMemorySources", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id,
    lineage, content: "User prefers tea", contentHash: await semanticHash("User prefers tea"), createdAt: 1000 });
  const fact = f.db.seed("facts", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id,
    lineage, extractionPolicyVersion: "manual-v1", factId: "fact-a", fact: "User prefers tea", factType: "preference", confidence: 100,
    sourceType: "manual", tags: [], version: 1, createdAt: 1000, updatedAt: 1000, ...overrides });
  return { fact, source };
}
export function queueArgs(f: ReturnType<typeof fixture>) {
  return { authority: f.reference, table: "facts", entityId: "fact-a", operation: "insert",
    source: { sourceId: "source-a", sourceEventId: "event-a", sourceRevision: 1 }, expectedVersion: 1, priority: "high" };
}
