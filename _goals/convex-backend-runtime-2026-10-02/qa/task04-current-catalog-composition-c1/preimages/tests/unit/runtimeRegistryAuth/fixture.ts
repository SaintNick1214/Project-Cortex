import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { RuntimeAuthorityReference } from "../../../src/auth/verified";
import { convexToJson, jsonToConvex, type Value } from "convex/values";
import { createRequire } from "node:module";
// Convex does not publish types for this installed internal method. Validate the narrow native
// fixture seam at runtime instead of accepting an untyped authorization or handler return.
function installedUnique() {
  const nativeExports: unknown = createRequire(import.meta.url)("../../../node_modules/convex/dist/esm/server/impl/query_impl.js");
  const nativeConstructor: unknown = nativeExports && typeof nativeExports === "object" && "QueryImpl" in nativeExports ? nativeExports.QueryImpl : null;
  const nativePrototype: unknown = typeof nativeConstructor === "function" ? nativeConstructor.prototype : null;
  const unique = nativePrototype && typeof nativePrototype === "object" && "unique" in nativePrototype ? nativePrototype.unique : null;
  if (typeof unique !== "function") throw new Error("Installed native QueryImpl.unique unavailable"); return unique;
}
const nativeUnique = installedUnique();

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
type Predicate = (row: Row) => boolean;
/** Native value cloning retains backend-realm buffers and avoids cross-realm codec artifacts. */
function clone<T>(value: T): T { return jsonToConvex(convexToJson(value as Value)) as T; }
function field(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, row);
}
/** Independent transaction fixture with actual selection traces and registered handler calls. */
export class RegistryTestDb {
  rows = new Map<string, Row[]>();
  writes = 0;
  sequence = 0;
  traces: { table: string; index?: string; keys: [string, unknown][]; returned: string[] }[] = [];
  beforeRead?: (table: string) => void;
  beforeWrite?: (table: string, id?: string) => void;
  table(name: string): Row[] { if (!this.rows.has(name)) this.rows.set(name, []); return this.rows.get(name)!; }
  seed(table: string, value: Record<string, unknown>): Row {
    const row = { ...clone(value), _id: typeof value._id === "string" ? value._id : `${table}:${++this.sequence}`, _creationTime: 1000 };
    this.table(table).push(row); return row;
  }
  query(table: string) {
    const keys: [string, unknown][] = []; const predicates: Predicate[] = []; let index: string | undefined; let order = "asc";
    const selected = () => {
      this.beforeRead?.(table);
      const rows = this.table(table).filter((row) => keys.every(([key, value]) => field(row, key) === value) && predicates.every((test) => test(row)));
      if (order === "desc") rows.reverse();
      this.traces.push({ table, index, keys: [...keys], returned: rows.map((row) => row._id) }); return clone(rows);
    };
    const q = {
      field: (name: string) => name,
      eq: (name: string, value: unknown): Predicate => (row) => field(row, name) === value,
      neq: (name: string, value: unknown): Predicate => (row) => field(row, name) !== value,
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
      // Use the installed native implementation, including its private-ID ambiguity diagnostic.
      // Its only query dependency is take(2), delegated to this traced transaction fixture.
      unique: async (): Promise<Row | null> => await Reflect.apply(nativeUnique,
        { take: async (limit: number) => await builder.take(limit), tableNameForErrorMessages: table }, []) as Row | null,
      first: async () => selected()[0] ?? null,
      collect: async () => [...selected()], take: async (limit: number) => selected().slice(0, limit),
    };
    return builder;
  }
  normalizeId(table: string, id: string): string | null { return id.startsWith(`${table}:`) ? id : null; }
  async get(table: string, id: string): Promise<Row | null> { this.beforeRead?.(table); return this.table(table).find((row) => row._id === id) ?? null; }
  async insert(table: string, value: Record<string, unknown>): Promise<string> { this.beforeWrite?.(table); this.writes++; return this.seed(table, value)._id; }
  async patch(table: string, id: string, value: Record<string, unknown>): Promise<void> {
    this.beforeWrite?.(table, id); const row = this.table(table).find((value) => value._id === id); if (!row) throw new Error("Missing row"); this.writes++;
    for (const [key, item] of Object.entries(value)) if (item === undefined) delete row[key];
    Object.assign(row, clone(value));
  }
  async delete(table: string, id: string): Promise<void> { this.writes++; this.rows.set(table, this.table(table).filter((row) => row._id !== id)); }
  async transaction<T>(run: () => Promise<T>): Promise<T> {
    const before = new Map([...this.rows].map(([table, rows]) => [table, clone(rows)])); const writes = this.writes; const sequence = this.sequence;
    try { return await run(); } catch (error) { this.rows = before; this.writes = writes; this.sequence = sequence; throw error; }
  }
}
export type Registration = { _handler: (ctx: MutationCtx, args: never) => Promise<unknown>; isInternal?: boolean; isPublic?: boolean };
export function invoke<T = unknown>(registration: unknown, ctx: MutationCtx, args: unknown): Promise<T> {
  return (registration as Registration)._handler(ctx, args as never) as Promise<T>;
}
export function fixture(capabilities = ["admin", "read", "write"], tenantOnly = false) {
  const db = new RegistryTestDb();
  const principal = db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "user-a", actorKind: "user", metadataUserId: "user-a", version: 1, createdAt: 1000 });
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

export type Fixture = ReturnType<typeof fixture>;
export function seedSpace(f: Fixture, overrides: Record<string, unknown> = {}) {
  return f.db.seed("memorySpaces", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id,
    type: "personal", participants: [], metadata: {}, status: "active", createdAt: 1000, updatedAt: 1000, ...overrides });
}
export function seedAgent(f: Fixture, overrides: Record<string, unknown> = {}) {
  return f.db.seed("agents", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id,
    agentId: "agent-a", name: "Agent A", status: "active", metadata: {}, config: {}, registeredAt: 1000, updatedAt: 1000, ...overrides });
}
export function seedContext(f: Fixture, overrides: Record<string, unknown> = {}) {
  return f.db.seed("contexts", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id,
    contextId: "context-a", purpose: "Task A", status: "active", userId: "user-a", rootId: "context-a", depth: 0,
    childIds: [], participants: ["space-a"], grantedAccess: [], data: { private: "a" }, metadata: {}, lastUpdatedBy: f.principal._id, version: 1, previousVersions: [],
    createdAt: 1000, updatedAt: 1000, ...overrides });
}
export function addSpaceGrant(f: Fixture, id = "space-b", capabilities = ["admin", "read", "write"], access = "own") {
  f.db.seed("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId: id, epoch: 1, createdAt: 1000 });
  const grant = f.db.seed("runtimeAuthGrants", { principalId: f.principal._id, membershipId: f.membership._id, tenantId: "tenant-a", memorySpaceId: id,
    memorySpaceEpoch: 1, tenantEpoch: 1, capabilities, resourceAccess: access, version: 1, createdAt: 1000 });
  seedSpace(f, { memorySpaceId: id }); return grant;
}
