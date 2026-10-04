import type { RuntimeCapability, RuntimeResourceAccess } from "../../../src/auth/verified";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import * as artifacts from "../../../convex-dev/artifacts";

// Independent03A fixture. No memory/fact/metadata/worker guards or fixtures are
// reused. External changes injected by hooks are observed at checkpoints; thrown
// native mutation handlers roll back their own writes as Convex does.
export type RecordRow = Record<string, any>;
type Expr = (row: RecordRow) => any;
const value = (input: any, row: RecordRow) => typeof input === "function" ? input(row) : input;
const field = (row: RecordRow, name: string): unknown => {
  let current: unknown = row;
  for (const part of name.split(".")) current = current !== null && typeof current === "object"
    ? (current as Record<string, unknown>)[part] : undefined;
  return current;
};
const filterBuilder = {
  field: (name: string): Expr => (row) => field(row, name),
  eq: (left: any, right: any): Expr => (row) => value(left, row) === value(right, row),
  neq: (left: any, right: any): Expr => (row) => value(left, row) !== value(right, row),
  and: (...entries: Expr[]): Expr => (row) => entries.every((entry) => entry(row)),
};
export class Database {
  readonly tables = new Map<string, RecordRow[]>();
  readonly reads: { table: string; ids: string[]; index?: string; filters: [string, unknown][] }[] = [];
  readonly writes: { action: string; table: string; id: string }[] = [];
  readonly attempts: { action: string; table: string; id: string }[] = [];
  hook?: (event: { action: string; table: string; id?: string }) => void;
  private sequence = 0;
  rows(table: string): RecordRow[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }
  add(table: string, row: RecordRow): RecordRow {
    const added = { _id: `${table}:${++this.sequence}`, _creationTime: 1, ...row };
    this.rows(table).push(added); return added;
  }
  normalizeId(table: string, id: string) { return id.startsWith(`${table}:`) ? id : null; }
  async get(first: string, second?: string): Promise<RecordRow | null> {
    const id = second ?? first;
    const table = id.split(":")[0];
    this.hook?.({ action: "get", table, id });
    return structuredClone(this.rows(table).find((row) => row._id === id) ?? null);
  }
  query(table: string) {
    const predicates: Expr[] = [];
    const filters: [string, unknown][] = [];
    let index: string | undefined;
    const query = {
      withIndex: (name: string, callback: (builder: any) => void) => {
        index = name;
        const builder = { eq: (name: string, expected: unknown) => {
          filters.push([name, expected]); predicates.push((row) => field(row, name) === expected); return builder;
        } };
        callback(builder); return query;
      },
      filter: (callback: (builder: typeof filterBuilder) => Expr) => { predicates.push(callback(filterBuilder)); return query; },
      collect: async () => {
        this.hook?.({ action: "query", table });
        const rows = this.rows(table).filter((row) => predicates.every((predicate) => predicate(row)));
        this.reads.push({ table, ids: rows.map((row) => row._id), index, filters });
        return structuredClone(rows);
      },
      first: async () => (await query.collect())[0] ?? null,
      unique: async () => { const rows = await query.collect(); if (rows.length > 1) throw new Error("duplicate unique row"); return rows[0] ?? null; },
    };
    return query;
  }
  async patch(id: string, patch: RecordRow): Promise<void> {
    const table = id.split(":")[0];
    const row = this.rows(table).find((candidate) => candidate._id === id);
    if (!row) throw new Error("missing patch row");
    for (const [name, item] of Object.entries(patch)) {
      if (item === undefined) delete row[name]; else row[name] = structuredClone(item);
    }
    this.writes.push({ action: "patch", table, id }); this.attempts.push({ action: "patch", table, id }); this.hook?.({ action: "patch", table, id });
  }
  async insert(table: string, row: RecordRow): Promise<string> {
    const inserted = this.add(table, structuredClone(row));
    this.writes.push({ action: "insert", table, id: inserted._id }); this.attempts.push({ action: "insert", table, id: inserted._id }); this.hook?.({ action: "insert", table, id: inserted._id });
    return inserted._id;
  }
  async delete(id: string): Promise<void> {
    const table = id.split(":")[0];
    this.tables.set(table, this.rows(table).filter((row) => row._id !== id));
    this.writes.push({ action: "delete", table, id }); this.attempts.push({ action: "delete", table, id });
  }
  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    const before = structuredClone(this.tables);
    const previousWrites = this.writes.length;
    try { return await operation(); } catch (error) {
      this.tables.clear(); for (const [table, rows] of before) this.tables.set(table, rows);
      this.writes.splice(previousWrites); throw error;
    }
  }
}
export const selected = ["create", "update", "deleteArtifact", "undo", "redo", "setStreamingState", "purgeVersions",
  "get", "getByConversation", "list", "count", "getVersion", "getHistory", "startStreaming", "appendContent",
  "pauseStreaming", "resumeStreaming", "cancelStreaming", "finalizeStreaming", "setStreamingError", "retryFromError"] as const;
export type Selected = typeof selected[number];
export const native = artifacts as unknown as Record<string, { _handler: (ctx: MutationCtx, args: RecordRow) => Promise<any>; isPublic?: boolean; isInternal?: boolean }>;
export function fixture(capabilities: RuntimeCapability[] = ["read", "write"], access: RuntimeResourceAccess = "own") {
  const db = new Database();
  const principal = db.add("runtimeAuthPrincipals", { issuer: "https://issuer.example", subject: "verified-subject",
    actorKind: "user", metadataUserId: "trusted-user", version: 1 });
  const membership = db.add("runtimeAuthMemberships", { principalId: principal._id, tenantId: "tenant-a", version: 1 });
  const grant = db.add("runtimeAuthGrants", { principalId: principal._id, membershipId: membership._id,
    tenantId: "tenant-a", memorySpaceId: "space-a", tenantEpoch: 1, memorySpaceEpoch: 1,
    capabilities, resourceAccess: access, version: 1 });
  db.add("runtimeAuthScopes", { tenantId: "tenant-a", epoch: 1 });
  db.add("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId: "space-a", epoch: 1 });
  let identity: RecordRow | null = { issuer: principal.issuer, subject: principal.subject };
  const storage = { delete: async () => { throw new Error("unexpected storage deletion"); },
    getUrl: async () => { throw new Error("unexpected raw file delivery"); } };
  // This intentional context cast supplies only the native handlers' actual
  // dependencies; there is no mock of Convex registration or authorization.
  const ctx = { db, auth: { getUserIdentity: async () => identity }, storage } as unknown as MutationCtx;
  const row = (overrides: RecordRow = {}) => db.add("artifacts", { artifactId: "artifact-a", tenantId: "tenant-a",
    memorySpaceId: "space-a", ownerPrincipalId: principal._id, userId: "trusted-user", kind: "text", title: "Document",
    content: "first", tags: [], version: 2, versionPointer: 2,
    versionHistory: [{ version: 1, content: "first", title: "First", timestamp: 1, changeType: "create" },
      { version: 2, content: "second", title: "Second", timestamp: 2, changeType: "update" }],
    streamingState: "draft", createdAt: 1, updatedAt: 2, ...overrides });
  const conversation = (overrides: RecordRow = {}) => db.add("conversations", { conversationId: "conversation-a",
    tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: principal._id,
    type: "user-agent", participants: { userId: "attacker-label" },
    messages: [{ id: "message-a", role: "user", content: "Private canonical message", timestamp: 1 }],
    messageCount: 1, createdAt: 1, updatedAt: 1, ...overrides });
  const invoke = (name: string, args: RecordRow = {}) => db.transaction(() => native[name]._handler(ctx, args));
  return { db, ctx, principal, membership, grant, row, conversation, invoke,
    identity: (value: RecordRow | null) => { identity = value; } };
}
export function happyCase(name: Selected) {
  const f = fixture();
  const args: RecordRow = { artifactId: "artifact-a", tenantId: "tenant-a", memorySpaceId: "space-a" };
  if (name === "create") { args.artifactId = "created-a"; args.content = "created content"; }
  else {
    const overrides: RecordRow = {};
    if (name === "redo") overrides.versionPointer = 1;
    if (["appendContent", "pauseStreaming", "cancelStreaming", "finalizeStreaming", "setStreamingError"].includes(name)) {
      overrides.streamingState = "streaming"; overrides.streamingMetadata = { sessionId: "session-a", startedAt: 1, bytesReceived: 0 };
      args.sessionId = "session-a";
    }
    if (name === "resumeStreaming") { overrides.streamingState = "paused"; overrides.streamingMetadata = { sessionId: "session-a" }; args.sessionId = "session-a"; }
    if (name === "retryFromError") overrides.streamingState = "error";
    if (name === "getByConversation") { f.conversation(); overrides.conversationRef = { conversationId: "conversation-a", messageId: "message-a" }; args.conversationId = "conversation-a"; }
    f.row(overrides);
  }
  if (name === "update") args.content = "updated content";
  if (name === "setStreamingState") args.streamingState = "streaming";
  if (name === "purgeVersions") args.keepLatest = 1;
  if (name === "getVersion") args.version = 1;
  if (name === "appendContent") args.chunk = " 😀";
  if (name === "setStreamingError") { args.errorCode = "manual-error"; args.errorMessage = "Interrupted"; }
  return { ...f, args };
}
