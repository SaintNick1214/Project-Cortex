import { lifecycleReadAllowance } from "./referenceLifecycle";
import { captureInsertedRow } from "./referenceLifecycle";
/** Private exact-scope fact audit primitives. Selection is not authentication. */
import {
  ConvexError,
  convexToJson,
  v,
  type Infer,
  type Value,
} from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export const endpointValidator = v.object({
  state: v.union(v.literal("absent"), v.literal("known"), v.literal("unknown")),
  logicalFactId: v.optional(v.string()),
  factDocumentId: v.optional(v.id("facts")),
  memorySpaceId: v.optional(v.string()),
  tenantId: v.optional(v.string()),
  scopeVersion: v.optional(v.literal(1)),
});
export type Endpoint = Infer<typeof endpointValidator>;
export const actionValidator = v.union(
  v.literal("CREATE"),
  v.literal("UPDATE"),
  v.literal("SUPERSEDE"),
  v.literal("DELETE"),
);
export const richFields = {
  oldValue: v.optional(v.string()),
  newValue: v.optional(v.string()),
  reason: v.optional(v.string()),
  confidence: v.optional(v.number()),
  pipeline: v.optional(
    v.object({
      slotMatching: v.optional(v.boolean()),
      semanticMatching: v.optional(v.boolean()),
      llmResolution: v.optional(v.boolean()),
    }),
  ),
  userId: v.optional(v.string()),
  participantId: v.optional(v.string()),
  conversationId: v.optional(v.string()),
};
export const intentValidator = v.object({
  operationId: v.string(),
  phase: v.string(),
  reason: richFields.reason,
  confidence: richFields.confidence,
  pipeline: richFields.pipeline,
  userId: richFields.userId,
  participantId: richFields.participantId,
  conversationId: richFields.conversationId,
});
export type HistoryIntent = Infer<typeof intentValidator>;
export const provenanceFields = {
  scopeVersion: v.optional(v.literal(1)),
  tenantId: v.optional(v.string()),
  sourceFactId: v.optional(v.id("facts")),
  sourceMemorySpaceId: v.optional(v.id("memorySpaces")),
  ownerKnown: v.optional(v.boolean()),
  ownerUserId: v.optional(v.string()),
  sourceMemoryId: v.optional(v.id("memories")),
  sourceConversationId: v.optional(v.id("conversations")),
  associationKnown: v.optional(v.boolean()),
  associatedUserIds: v.optional(v.array(v.string())),
  sourceRef: v.optional(
    v.object({
      conversationId: v.optional(v.string()),
      memoryId: v.optional(v.string()),
      messageIds: v.optional(v.array(v.string())),
    }),
  ),
  supersedesEndpoint: v.optional(endpointValidator),
  supersededByEndpoint: v.optional(endpointValidator),
  evidence: v.optional(
    v.object({
      kind: v.union(v.literal("live-source"), v.literal("verified-migration")),
      reference: v.optional(v.string()),
      hash: v.optional(v.string()),
    }),
  ),
};
export const eventFields = {
  eventId: v.string(),
  factId: v.string(),
  memorySpaceId: v.string(),
  action: actionValidator,
  ...richFields,
  ...provenanceFields,
  supersedes: v.optional(v.string()),
  supersededBy: v.optional(v.string()),
  timestamp: v.number(),
  operationId: v.optional(v.string()),
  phase: v.optional(v.string()),
  eventRole: v.optional(v.string()),
  operationKind: v.optional(v.string()),
  requestDigest: v.optional(v.string()),
  affectedFactIds: v.optional(v.array(v.id("facts"))),
  resultFactId: v.optional(v.id("facts")),
};
export const pendingValidator = v.object({
  version: v.literal(1),
  payload: v.object(eventFields),
  absentFields: v.array(v.string()),
  payloadDigest: v.string(),
});
export type PendingRichEventV1 = Infer<typeof pendingValidator>;
export const eventValidator = v.object(eventFields);
export type AuditEvent = Infer<typeof eventValidator>;
export type Scope = { tenantId?: string; memorySpaceId: string };
export type Fact = Doc<"facts">;
export type Context = MutationCtx | QueryCtx;
const MIB = 1024 * 1024;
export function fail(code: string): never {
  throw new ConvexError(code);
}
export function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object" && !(value instanceof ArrayBuffer)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, clean(v)]),
    ) as T;
  }
  return value;
}
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sorted(v)]),
    );
  return value;
}
export function canonical(value: unknown): string {
  return JSON.stringify(sorted(convexToJson(clean(value) as Value)));
}
export function byteSize(value: unknown): number {
  return new TextEncoder().encode(canonical(value)).length;
}
/** SHA-256 over canonical Convex encoding. No dependency or runtime crypto assumption. */
export function digest(value: unknown): string {
  const data = new TextEncoder().encode(canonical(value));
  const length = Math.ceil((data.length + 9) / 64) * 64;
  const bytes = new Uint8Array(length);
  bytes.set(data);
  bytes[data.length] = 128;
  const view = new DataView(bytes.buffer);
  view.setUint32(length - 4, data.length * 8);
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const r = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < length; offset += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15],
        b = w[i - 2];
      w[i] =
        (w[i - 16] +
          (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) +
          w[i - 7] +
          (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>>
        0;
    }
    let [a, b, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const t =
        (j +
          (r(e, 6) ^ r(e, 11) ^ r(e, 25)) +
          ((e & f) ^ (~e & g)) +
          k[i] +
          w[i]) >>>
        0;
      const u =
        ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      j = g;
      g = f;
      f = e;
      e = (d + t) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t + u) >>> 0;
    }
    [a, b, c, d, e, f, g, j].forEach((x, i) => {
      h[i] = (h[i] + x) >>> 0;
    });
  }
  return h.map((x) => x.toString(16).padStart(8, "0")).join("");
}
export class CaptureBudget {
  reads = 0;
  rawBytes = 0;
  writeBytes = 0;
  spaces = new Map<string, Doc<"memorySpaces">[]>();
  memories = new Map<string, Doc<"memories">[]>();
  conversations = new Map<string, Doc<"conversations">[]>();
  constructor(readonly maxReads = 16) {}
  reserve(count: number) {
    if (
      this.reads + count > this.maxReads ||
      this.rawBytes + count * MIB > 12 * MIB
    )
      fail("FACT_HISTORY_BUDGET_EXCEEDED");
  }
  account(values: unknown[]) {
    this.reads += values.length;
    this.rawBytes += values.reduce<number>((sum, v) => sum + byteSize(v), 0);
    if (this.reads > this.maxReads || this.rawBytes > 12 * MIB)
      fail("FACT_HISTORY_BUDGET_EXCEEDED");
  }
  write(value: unknown) {
    const bytes = byteSize(value);
    this.writeBytes += bytes;
    if (bytes >= MIB || this.writeBytes > 3 * MIB)
      fail("FACT_HISTORY_BUDGET_EXCEEDED");
  }
  result<T>(value: T): T {
    if (byteSize(value) > 8 * MIB) fail("FACT_HISTORY_BUDGET_EXCEEDED");
    return value;
  }
  async finish<T>(ctx: Context, value: T): Promise<T> {
    const native = await ctx.meta.getTransactionMetrics();
    if (
      native.documentsRead.used > this.maxReads + lifecycleReadAllowance(ctx) ||
      native.bytesRead.used > 12 * MIB ||
      native.bytesWritten.used > 3 * MIB
    )
      fail("FACT_HISTORY_BUDGET_EXCEEDED");
    return this.result(value);
  }
}
export function assertScope(
  fact: { tenantId?: string; memorySpaceId: string },
  scope: Scope,
) {
  if (
    fact.tenantId !== scope.tenantId ||
    fact.memorySpaceId !== scope.memorySpaceId
  )
    fail("FACT_HISTORY_SCOPE_MISMATCH");
}
export async function sourceFact(
  ctx: Context,
  scope: Scope,
  factId: string,
  budget: CaptureBudget,
  expected?: Id<"facts">,
): Promise<Fact> {
  // Even a supplied physical ID cannot bypass duplicate logical identity evidence.
  budget.reserve(2);
  const rows = await ctx.db
    .query("facts")
    .withIndex("by_runtime_scope_factId", (q) =>
      q
        .eq("tenantId", scope.tenantId)
        .eq("memorySpaceId", scope.memorySpaceId)
        .eq("factId", factId),
    )
    .take(2);
  budget.account(rows);
  if (rows.length !== 1 || !rows[0])
    fail(
      rows.length > 1
        ? "FACT_HISTORY_SOURCE_AMBIGUOUS"
        : "FACT_HISTORY_SOURCE_REQUIRED",
    );
  const fact = rows[0];
  if (expected !== undefined && fact._id !== expected)
    fail("FACT_HISTORY_SOURCE_MISMATCH");
  assertScope(fact, scope);
  if (fact.factId !== factId) fail("FACT_HISTORY_SOURCE_MISMATCH");
  return fact;
}
export function endpoint(fact: Fact): Endpoint {
  return clean({
    state: "known" as const,
    scopeVersion: 1 as const,
    tenantId: fact.tenantId,
    memorySpaceId: fact.memorySpaceId,
    logicalFactId: fact.factId,
    factDocumentId: fact._id,
  });
}
export function relationship(
  fact: Fact,
  direction: "supersedes" | "supersededBy",
): Endpoint {
  const saved =
    fact[
      direction === "supersedes" ? "supersedesEndpoint" : "supersededByEndpoint"
    ];
  const logical = fact[direction];
  if (logical === undefined) {
    if (
      saved &&
      (saved.state !== "absent" ||
        Object.keys(saved).some(
          (key) =>
            key !== "state" && saved[key as keyof Endpoint] !== undefined,
        ))
    )
      fail("FACT_HISTORY_RELATIONSHIP_CONFLICT");
    return { state: "absent" };
  }
  if (!logical) fail("FACT_HISTORY_RELATIONSHIP_CONFLICT");
  if (!saved) return { state: "unknown", logicalFactId: logical };
  if (
    saved.state === "absent" ||
    saved.logicalFactId !== logical ||
    (saved.state === "unknown" &&
      Object.keys(saved).some(
        (key) =>
          key !== "state" &&
          key !== "logicalFactId" &&
          saved[key as keyof Endpoint] !== undefined,
      )) ||
    (saved.state === "known" &&
      (saved.tenantId !== fact.tenantId ||
        saved.memorySpaceId !== fact.memorySpaceId ||
        !saved.factDocumentId ||
        saved.scopeVersion !== 1 ||
        saved.factDocumentId === fact._id ||
        saved.logicalFactId === fact.factId))
  )
    fail("FACT_HISTORY_RELATIONSHIP_CONFLICT");
  return saved;
}
export function assertTail(fact: Fact) {
  if (
    relationship(fact, "supersedes").state === "unknown" ||
    relationship(fact, "supersededBy").state !== "absent"
  )
    fail("FACT_HISTORY_RELATIONSHIP_UNRESOLVED");
}
export async function provenance(
  ctx: Context,
  fact: Fact,
  budget: CaptureBudget,
) {
  const spaceKey = canonical([fact.tenantId ?? null, fact.memorySpaceId]);
  let spaces = budget.spaces.get(spaceKey);
  if (!spaces) {
    budget.reserve(2);
    spaces = await ctx.db
      .query("memorySpaces")
      .withIndex("by_tenant_memorySpaceId", (q) =>
        q.eq("tenantId", fact.tenantId).eq("memorySpaceId", fact.memorySpaceId),
      )
      .take(2);
    budget.account(spaces);
    budget.spaces.set(spaceKey, spaces);
  }
  if (spaces.length > 1) fail("FACT_HISTORY_SOURCE_AMBIGUOUS");
  let memory: Doc<"memories"> | undefined,
    conversation: Doc<"conversations"> | undefined;
  if (fact.sourceRef?.memoryId) {
    const key = canonical([
      fact.tenantId ?? null,
      fact.memorySpaceId,
      fact.sourceRef.memoryId,
    ]);
    let rows = budget.memories.get(key);
    if (!rows) {
      budget.reserve(2);
      rows = await ctx.db
        .query("memories")
        .withIndex("by_runtime_scope_memoryId", (q) =>
          q
            .eq("tenantId", fact.tenantId)
            .eq("memorySpaceId", fact.memorySpaceId)
            .eq("memoryId", fact.sourceRef!.memoryId!),
        )
        .take(2);
      budget.account(rows);
      budget.memories.set(key, rows);
    }
    if (rows.length > 1) fail("FACT_HISTORY_SOURCE_AMBIGUOUS");
    if (rows[0]) {
      assertScope(rows[0], fact);
      memory = rows[0];
    }
  }
  const conversationId =
    fact.sourceRef?.conversationId ??
    (memory?.userId === undefined
      ? memory?.conversationRef?.conversationId
      : undefined);
  if (conversationId) {
    const key = canonical([
      fact.tenantId ?? null,
      fact.memorySpaceId,
      conversationId,
    ]);
    let rows = budget.conversations.get(key);
    if (!rows) {
      budget.reserve(2);
      rows = await ctx.db
        .query("conversations")
        .withIndex("by_history_scope_conversation", (q) =>
          q
            .eq("tenantId", fact.tenantId)
            .eq("memorySpaceId", fact.memorySpaceId)
            .eq("conversationId", conversationId),
        )
        .take(2);
      budget.account(rows);
      budget.conversations.set(key, rows);
    }
    if (rows.length > 1) fail("FACT_HISTORY_SOURCE_AMBIGUOUS");
    if (rows[0]) {
      assertScope(rows[0], fact);
      conversation = rows[0];
    }
  }
  const participants = conversation
    ? [
        conversation.participants.userId,
        ...(conversation.participants.userIds ?? []),
      ].filter((x): x is string => !!x)
    : [];
  const memoryOwner = memory?.userId ?? memory?.sourceUserId;
  const associated = fact.userId
    ? []
    : Array.from(
        new Set([...participants, ...(memoryOwner ? [memoryOwner] : [])]),
      ).sort();
  return clean({
    scopeVersion: 1 as const,
    tenantId: fact.tenantId,
    sourceFactId: fact._id,
    sourceMemorySpaceId: spaces[0]?._id,
    ownerKnown: true,
    ownerUserId: fact.userId,
    sourceMemoryId: memory?._id,
    sourceConversationId: conversation?._id,
    associationKnown: !!(fact.userId || memory || conversation),
    associatedUserIds: associated,
    sourceRef: fact.sourceRef,
    supersedesEndpoint: relationship(fact, "supersedes"),
    supersededByEndpoint: relationship(fact, "supersededBy"),
    evidence: { kind: "live-source" as const },
  });
}
export async function operationEvents(
  ctx: Context,
  scope: Scope,
  operationId: string,
  phase: string,
  budget: CaptureBudget,
) {
  budget.reserve(4);
  const events = await ctx.db
    .query("factHistory")
    .withIndex("by_history_operation", (q) =>
      q
        .eq("scopeVersion", 1)
        .eq("tenantId", scope.tenantId)
        .eq("memorySpaceId", scope.memorySpaceId)
        .eq("operationId", operationId)
        .eq("phase", phase),
    )
    .take(4);
  budget.account(events);
  if (events.length > 3) fail("FACT_HISTORY_OPERATION_CONFLICT");
  return events;
}
export async function replay(
  ctx: Context,
  scope: Scope,
  intent: HistoryIntent | undefined,
  request: unknown,
  budget: CaptureBudget,
) {
  budget.result(request); // Canonical argument envelope is bounded before any write.
  if (!intent) return [];
  const events = await operationEvents(
    ctx,
    scope,
    intent.operationId,
    intent.phase,
    budget,
  );
  if (events.some((e) => e.requestDigest !== digest(request)))
    fail("FACT_HISTORY_OPERATION_CONFLICT");
  return events;
}
export async function prepareCapture(
  ctx: MutationCtx,
  fact: Fact,
  args: {
    action: Infer<typeof actionValidator>;
    oldValue?: string;
    newValue?: string;
    intent: HistoryIntent;
    role: string;
    kind: string;
    request: unknown;
    affected: Id<"facts">[];
    result?: Id<"facts">;
    publish?: boolean;
  },
  budget: CaptureBudget,
) {
  const origin = await provenance(ctx, fact, budget);
  const event = clean({
    eventId: `fh-${crypto.randomUUID()}`,
    factId: fact.factId,
    memorySpaceId: fact.memorySpaceId,
    action: args.action,
    ...origin,
    ...args.intent,
    oldValue: args.oldValue,
    newValue: args.newValue,
    timestamp: Date.now(),
    eventRole: args.role,
    operationKind: args.kind,
    requestDigest: digest(args.request),
    affectedFactIds: args.affected,
    resultFactId: args.result,
    supersedes: fact.supersedes,
    supersededBy: fact.supersededBy,
  });
  const absentFields = Object.keys(richFields).filter((key) => !(key in event));
  const pendingRichEvent = {
    version: 1 as const,
    payload: event,
    absentFields,
    payloadDigest: digest(event),
  };
  const document = clean({
    ...event,
    // Native canonical intent is outside the immutable version1 pending payload.
    requestJson: canonical(args.request),
    pendingRichEvent,
    publicationState:
      args.publish === false ? ("pending" as const) : ("complete" as const),
  });
  if (args.publish === false)
    for (const key of Object.keys(richFields)) {
      if (key !== "userId") delete (document as Record<string, unknown>)[key];
    }
  budget.write(document);
  return document;
}
export async function insertPrepared(
  ctx: MutationCtx,
  document: Awaited<ReturnType<typeof prepareCapture>>,
) {
  const _id = await captureInsertedRow(ctx, "factHistory", document);
  return { ...document, _id };
}
export async function capture(
  ctx: MutationCtx,
  fact: Fact,
  args: Parameters<typeof prepareCapture>[2],
  budget: CaptureBudget,
) {
  return insertPrepared(ctx, await prepareCapture(ctx, fact, args, budget));
}
export function eventReceipt(
  events: ReadonlyArray<
    Pick<
      Doc<"factHistory">,
      | "eventId"
      | "_id"
      | "pendingRichEvent"
      | "affectedFactIds"
      | "resultFactId"
      | "graphJobs"
      | "requestJson"
    >
  >,
) {
  // Index ordering differs from writer ordering. Receipts must replay identically.
  const ordered = [...events].sort((a, b) => {
    const roleA = a.pendingRichEvent?.payload.eventRole ?? "";
    const roleB = b.pendingRichEvent?.payload.eventRole ?? "";
    const rank = (role: string) =>
      role === "old" || role === "kept" ? 0 : role === "new" ? 1 : 2;
    return (
      rank(roleA) - rank(roleB) ||
      roleA.localeCompare(roleB) ||
      a.eventId.localeCompare(b.eventId)
    );
  });
  return {
    committed: true as const,
    graphJobs: ordered.flatMap(e => e.graphJobs ?? []),
    events: ordered.map((e) => ({
      eventId: e.eventId,
      _id: e._id,
      pending: e.pendingRichEvent,
      ...(e.requestJson === undefined ? {} : {requestJson: e.requestJson}),
    })),
    affectedFactIds: Array.from(
      new Set(ordered.flatMap((e) => e.affectedFactIds ?? [])),
    ),
    resultFactId: ordered[0]?.resultFactId,
  };
}
