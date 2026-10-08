import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { RuntimeAuthorityReference } from "../../../src/auth/verified";
import * as memory from "../../../convex-dev/runtimeMemory";
import * as auth from "../../../convex-dev/runtimeAuth";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
export function registeredHandler<Args, Result>(registration: unknown): (ctx: MutationCtx, args: Args) => Promise<Result> {
  return (registration as { _handler: (ctx: MutationCtx, args: Args) => Promise<Result> })._handler;
}
function field(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, row);
}
export class MemoryTestDb {
  rows = new Map<string, Row[]>();
  writes = 0;
  sequence = 0;
  table(name: string): Row[] { if (!this.rows.has(name)) this.rows.set(name, []); return this.rows.get(name)!; }
  seed(table: string, value: Record<string, unknown>): Row {
    const row = { ...value, _id: typeof value._id === "string" ? value._id : `${table}:${++this.sequence}`, _creationTime: 1000 };
    this.table(table).push(row); return row;
  }
  query(table: string) {
    const filters: [string, unknown][] = [];
    let predicate: (row: Row) => boolean = () => true;
    const selected = () => this.table(table).filter((row) => filters.every(([key, value]) => field(row, key) === value) && predicate(row));
    const builder = {
      withIndex: (_name: string, callback: (q: { eq(key: string, value: unknown): unknown }) => unknown) => {
        const q: { eq(key: string, value: unknown): typeof q } = { eq: (key, value) => { filters.push([key, value]); return q; } };
        callback(q); return builder;
      },
      filter: (callback: (q: {
        field(name: string): string; eq(name: string, value: unknown): (row: Row) => boolean;
        and(...predicates: ((row: Row) => boolean)[]): (row: Row) => boolean;
      }) => (row: Row) => boolean) => {
        predicate = callback({ field: (name) => name, eq: (name, value) => (row) => field(row, name) === value,
          and: (...predicates) => (row) => predicates.every((test) => test(row)) }); return builder;
      },
      unique: async () => { const rows = selected(); if (rows.length > 1) throw new Error("Nonunique canonical index"); return rows[0] ?? null; },
      collect: async () => [...selected()], take: async (limit: number) => selected().slice(0, limit),
    };
    return builder;
  }
  normalizeId(table: string, id: string): string | null { return id.startsWith(`${table}:`) ? id : null; }
  async get(table: string, id: string): Promise<Row | null> { return this.table(table).find((row) => row._id === id) ?? null; }
  async insert(table: string, value: Record<string, unknown>): Promise<string> { this.writes++; return this.seed(table, structuredClone(value))._id; }
  async replace(table: string, id: string, value: Record<string, unknown>): Promise<void> {
    const rows = this.table(table); const index = rows.findIndex((row) => row._id === id);
    if (index < 0) throw new Error("Missing row"); this.writes++;
    rows[index] = { ...structuredClone(value), _id: id, _creationTime: rows[index]!._creationTime };
  }
  async transaction<T>(run: () => Promise<T>): Promise<T> {
    const before = structuredClone(this.rows); const writes = this.writes; const sequence = this.sequence;
    try { return await run(); } catch (error) { this.rows = before; this.writes = writes; this.sequence = sequence; throw error; }
  }
}
export function memoryFixture() {
  const db = new MemoryTestDb();
  const principal = db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "user-a", actorKind: "user", version: 1, createdAt: 1000 });
  const membership = db.seed("runtimeAuthMemberships", { principalId: principal._id, tenantId: "tenant-a", version: 1, createdAt: 1000 });
  db.seed("runtimeAuthScopes", { tenantId: "tenant-a", epoch: 1, createdAt: 1000 });
  db.seed("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId: "space-a", epoch: 1, createdAt: 1000 });
  const grant = db.seed("runtimeAuthGrants", { principalId: principal._id, membershipId: membership._id,
    tenantId: "tenant-a", memorySpaceId: "space-a", tenantEpoch: 1, memorySpaceEpoch: 1,
    capabilities: ["read", "write"], resourceAccess: "own", version: 1, createdAt: 1000 });
  const reference: RuntimeAuthorityReference = { principalId: principal._id, principalVersion: 1,
    membershipId: membership._id, membershipVersion: 1, grantId: grant._id, grantVersion: 1,
    tenantId: "tenant-a", tenantEpoch: 1, memorySpaceId: "space-a", memorySpaceEpoch: 1 };
  const ctx = { db, auth: { getUserIdentity: async () => ({ issuer: "https://host.test", subject: "user-a" }) } } as unknown as MutationCtx;
  const searches: { table: string; index: string; filter: { key: string; value: unknown }; vector: number[] }[] = [];
  const actionCtx = {
    runQuery: async (ref: unknown, args: unknown) => {
      const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]);
      const [module, key] = name.split(":");
      const registration = (module === "runtimeAuth" ? auth : memory) as unknown as Record<string, unknown>;
      return await registeredHandler<unknown, unknown>(registration[key!]!)(ctx, args);
    },
    runMutation: async (ref: unknown, args: unknown) => {
      const key = getFunctionName(ref as Parameters<typeof getFunctionName>[0]).split(":")[1]!;
      return await db.transaction(async () => await registeredHandler<unknown, unknown>((memory as unknown as Record<string, unknown>)[key]!)(ctx, args));
    },
    vectorSearch: async (table: string, index: string, query: { vector: number[]; limit: number; filter(q: unknown): unknown }) => {
      const filter = query.filter({ eq: (key: string, value: unknown) => ({ key, value }) }) as { key: string; value: unknown };
      searches.push({ table, index, filter, vector: query.vector });
      return db.table(table).filter((row) => row[filter.key] === filter.value).slice(0, query.limit).map((row) => ({ _id: row._id, _score: 0.9 }));
    },
  } as unknown as ActionCtx;
  return { db, ctx, actionCtx, reference, principal, membership, grant, searches };
}
