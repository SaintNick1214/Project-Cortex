import { reconcileRow, markDeletedRow } from "./lib/referenceLifecycle";
/** Durable fact audit. Public namespaced scope selection is not user authentication. */
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import {
  actionValidator,
  provenanceFields,
  richFields,
  pendingValidator,
  CaptureBudget,
  sourceFact,
  capture,
  canonical,
  clean,
  digest,
  fail,
  operationEvents,
  eventReceipt,
  byteSize,
} from "./lib/factHistoryProvenance";

const scopeArgs = {
  tenantId: v.optional(v.string()),
  memorySpaceId: v.optional(v.string()),
};
const selectorArgs = {
  ...scopeArgs,
  factId: v.optional(v.string()),
  sourceFactId: v.optional(v.id("facts")),
  sourceMemorySpaceId: v.optional(v.id("memorySpaces")),
  incomingFactId: v.optional(v.id("facts")),
  userId: v.optional(v.string()),
  ownerUserId: v.optional(v.string()),
  after: v.optional(v.number()),
  before: v.optional(v.number()),
  action: v.optional(actionValidator),
};
type Selector = {
  tenantId?: string;
  memorySpaceId?: string;
  factId?: string;
  sourceFactId?: Doc<"facts">["_id"];
  sourceMemorySpaceId?: Doc<"memorySpaces">["_id"];
  incomingFactId?: Doc<"facts">["_id"];
  userId?: string;
  ownerUserId?: string;
  after?: number;
  before?: number;
  /** Private purge predicate; never accepted as a public selector. */
  beforeExclusive?: boolean;
  action?: Doc<"factHistory">["action"];
};
/** One existence proof covers every unresolved legacy candidate; no collect/slice. */
async function preflightLegacy(ctx: QueryCtx | MutationCtx, args: Selector) {
  let rows;
  if (args.factId)
    rows = await ctx.db
      .query("factHistory")
      .withIndex("by_history_legacy_fact", (q) =>
        q.eq("scopeVersion", undefined).eq("factId", args.factId!),
      )
      .take(1);
  else if (args.userId)
    rows = await ctx.db
      .query("factHistory")
      .withIndex("by_history_legacy_actor", (q) =>
        q.eq("scopeVersion", undefined).eq("userId", args.userId!),
      )
      .take(1);
  else if (args.memorySpaceId)
    rows = await ctx.db
      .query("factHistory")
      .withIndex("by_history_legacy_space", (q) =>
        q
          .eq("scopeVersion", undefined)
          .eq("memorySpaceId", args.memorySpaceId!),
      )
      .take(1);
  else
    rows = await ctx.db
      .query("factHistory")
      .withIndex("by_history_scope", (q) => q.eq("scopeVersion", undefined))
      .take(1);
  if (rows.length) fail("FACT_HISTORY_PROVENANCE_UNRESOLVED");
}
function selection(ctx: QueryCtx | MutationCtx, args: Selector) {
  if (args.incomingFactId)
    return ctx.db
      .query("factHistory")
      .withIndex("by_history_incoming", (q) =>
        q
          .eq("scopeVersion", 1)
          .eq("tenantId", args.tenantId)
          .eq("supersededByEndpoint.factDocumentId", args.incomingFactId!),
      );
  if (args.sourceFactId)
    return ctx.db
      .query("factHistory")
      .withIndex("by_history_source", (q) =>
        q
          .eq("scopeVersion", 1)
          .eq("tenantId", args.tenantId)
          .eq("sourceFactId", args.sourceFactId!),
      );
  if (args.sourceMemorySpaceId)
    return ctx.db
      .query("factHistory")
      .withIndex("by_history_source_space", (q) =>
        q
          .eq("scopeVersion", 1)
          .eq("tenantId", args.tenantId)
          .eq("sourceMemorySpaceId", args.sourceMemorySpaceId!),
      );
  if (args.factId)
    return ctx.db
      .query("factHistory")
      .withIndex("by_history_fact", (q) =>
        q
          .eq("scopeVersion", 1)
          .eq("tenantId", args.tenantId)
          .eq("factId", args.factId!),
      );
  if (args.ownerUserId)
    return ctx.db
      .query("factHistory")
      .withIndex("by_history_owner", (q) =>
        q
          .eq("scopeVersion", 1)
          .eq("tenantId", args.tenantId)
          .eq("ownerUserId", args.ownerUserId!),
      );
  if (args.userId)
    return ctx.db
      .query("factHistory")
      .withIndex("by_history_actor", (q) =>
        q
          .eq("scopeVersion", 1)
          .eq("tenantId", args.tenantId)
          .eq("userId", args.userId!),
      );
  if (args.memorySpaceId)
    return ctx.db
      .query("factHistory")
      .withIndex("by_history_space", (q) =>
        q
          .eq("scopeVersion", 1)
          .eq("tenantId", args.tenantId)
          .eq("memorySpaceId", args.memorySpaceId!),
      );
  return ctx.db
    .query("factHistory")
    .withIndex("by_history_scope", (q) =>
      q.eq("scopeVersion", 1).eq("tenantId", args.tenantId),
    );
}
function matches(e: Doc<"factHistory">, a: Selector) {
  return (
    (a.sourceFactId === undefined || e.sourceFactId === a.sourceFactId) &&
    (a.incomingFactId === undefined ||
      e.supersededByEndpoint?.factDocumentId === a.incomingFactId) &&
    (a.sourceMemorySpaceId === undefined ||
      e.sourceMemorySpaceId === a.sourceMemorySpaceId) &&
    (a.memorySpaceId === undefined || e.memorySpaceId === a.memorySpaceId) &&
    (a.factId === undefined || e.factId === a.factId) &&
    (a.userId === undefined || e.userId === a.userId) &&
    (a.ownerUserId === undefined || e.ownerUserId === a.ownerUserId) &&
    (a.after === undefined || e.timestamp >= a.after) &&
    (a.before === undefined ||
      (a.beforeExclusive ? e.timestamp < a.before : e.timestamp <= a.before)) &&
    (a.action === undefined || e.action === a.action)
  );
}
function validateTimeRange(args: Pick<Selector, "after" | "before">) {
  for (const value of [args.after, args.before])
    if (
      value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value))
    )
      fail("FACT_HISTORY_INVALID_TIME_RANGE");
  if (
    args.after !== undefined &&
    args.before !== undefined &&
    args.after > args.before
  )
    fail("FACT_HISTORY_INVALID_TIME_RANGE");
}
function validatePageSize(size: number) {
  if (!Number.isInteger(size) || size < 1 || size > 256)
    fail("FACT_HISTORY_INVALID_PAGE_SIZE");
}
function batchHint(limit?: number) {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
    fail("FACT_HISTORY_INVALID_PAGE_SIZE");
  return Math.min(limit ?? 256, 256);
}
async function boundedPage(
  ctx: QueryCtx | MutationCtx,
  args: Selector,
  opts: { numItems: number; cursor: string | null; endCursor?: string | null },
) {
  validatePageSize(opts.numItems);
  validateTimeRange(args);
  await preflightLegacy(ctx, args);
  const result = await selection(ctx, args)
    .order("desc")
    .paginate({ ...opts, maximumRowsRead: 256, maximumBytesRead: 1024 * 1024 });
  const native = await ctx.meta.getTransactionMetrics();
  if (
    native.bytesRead.used > 2 * 1024 * 1024 ||
    native.documentsRead.used > 256
  )
    fail("FACT_HISTORY_BUDGET_EXCEEDED");
  const page = result.page.filter((e) => matches(e, args));
  if (byteSize(page) > 8 * 1024 * 1024) fail("FACT_HISTORY_BUDGET_EXCEEDED");
  return { ...result, page };
}
export const page = query({
  args: { ...selectorArgs, paginationOpts: paginationOptsValidator },
  handler: (ctx, args) => boundedPage(ctx, args, args.paginationOpts),
});

export const logEvent = mutation({
  args: {
    ...scopeArgs,
    memorySpaceId: v.string(),
    factId: v.string(),
    sourceFactId: v.optional(v.id("facts")),
    action: actionValidator,
    ...richFields,
    supersedes: v.optional(v.string()),
    supersededBy: v.optional(v.string()),
    operationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const budget = new CaptureBudget();
    const intent = {
      operationId: args.operationId ?? crypto.randomUUID(),
      phase: "log",
      reason: args.reason,
      confidence: args.confidence,
      pipeline: args.pipeline,
      userId: args.userId,
      participantId: args.participantId,
      conversationId: args.conversationId,
    };
    const existing = await operationEvents(
      ctx,
      args,
      intent.operationId,
      intent.phase,
      budget,
    );
    if (existing.length) {
      if (existing.some((e) => e.requestDigest !== digest(args)))
        fail("FACT_HISTORY_OPERATION_CONFLICT");
      return budget.finish(ctx, {
        eventId: existing[0].eventId,
        _id: existing[0]._id,
        receipt: eventReceipt(existing),
      });
    }
    const fact = await sourceFact(
      ctx,
      args,
      args.factId,
      budget,
      args.sourceFactId,
    );
    if (
      (args.supersedes !== undefined && args.supersedes !== fact.supersedes) ||
      (args.supersededBy !== undefined &&
        args.supersededBy !== fact.supersededBy)
    )
      fail("FACT_HISTORY_RELATIONSHIP_CONFLICT");
    const event = await capture(
      ctx,
      fact,
      {
        action: args.action,
        oldValue: args.oldValue,
        newValue: args.newValue,
        intent,
        role: "source",
        kind: "log",
        request: args,
        affected: [fact._id],
      },
      budget,
    );
    return budget.finish(ctx, {
      eventId: event.eventId,
      _id: event._id,
      receipt: eventReceipt([event]),
    });
  },
});
export const getOperationReceipt = query({
  args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(),
    operationId: v.string(),
    phase: v.string(),
  },
  handler: async (ctx, args) => {
    const budget = new CaptureBudget(4);
    budget.result(args);
    const events = await operationEvents(
      ctx,
      args,
      args.operationId,
      args.phase,
      budget,
    );
    return budget.finish(ctx, events.length ? eventReceipt(events) : null);
  },
});
export const publishPendingEvent = mutation({
  args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(),
    operationId: v.string(),
    phase: v.string(),
    eventRole: v.string(),
    eventId: v.string(),
    pending: pendingValidator,
  },
  handler: async (ctx, args) => {
    const budget = new CaptureBudget(4);
    budget.result(args);
    const events = await operationEvents(
      ctx,
      args,
      args.operationId,
      args.phase,
      budget,
    );
    const event = events.find(
      (e) => e.eventRole === args.eventRole && e.eventId === args.eventId,
    );
    if (!event?.pendingRichEvent) fail("FACT_HISTORY_PENDING_EVENT_UNRESOLVED");
    if (
      canonical(event.pendingRichEvent) !== canonical(args.pending) ||
      digest(args.pending.payload) !== args.pending.payloadDigest
    )
      fail("FACT_HISTORY_OPERATION_CONFLICT");
    const fields: Record<string, unknown> = { publicationState: "complete" };
    for (const key of Object.keys(richFields)) {
      const name = key as keyof typeof richFields;
      const expected = args.pending.payload[name];
      const current = event[name];
      if (expected === undefined) {
        if (current !== undefined) fail("FACT_HISTORY_OPERATION_CONFLICT");
      } else if (
        current !== undefined &&
        canonical(current) !== canonical(expected)
      )
        fail("FACT_HISTORY_OPERATION_CONFLICT");
      else fields[key] = expected;
    }
    budget.write({ ...event, ...fields });
    if (event.publicationState !== "complete")
      await reconcileRow(ctx, event._id, fields);
    return budget.finish(ctx, {
      eventId: event.eventId,
      _id: event._id,
      publicationState: "complete" as const,
    });
  },
});
async function legacyArray(
  ctx: QueryCtx,
  args: Selector,
  limit = 100,
  offset = 0,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 256 || offset !== 0)
    fail("FACT_HISTORY_PAGING_REQUIRED");
  const result = await boundedPage(ctx, args, {
    numItems: limit,
    cursor: null,
  });
  if (
    result.pageStatus === "SplitRequired" ||
    (result.page.length < limit && !result.isDone)
  )
    fail("FACT_HISTORY_PAGING_REQUIRED");
  return result.page;
}
export const getHistory = query({
  args: {
    ...scopeArgs,
    factId: v.string(),
    sourceFactId: v.optional(v.id("facts")),
    limit: v.optional(v.number()),
  },
  handler: (ctx, args) => legacyArray(ctx, args, args.limit),
});
export const getEvent = query({
  args: { tenantId: v.optional(v.string()), eventId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("factHistory")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(2);
    if (rows.length > 1) fail("FACT_HISTORY_SOURCE_AMBIGUOUS");
    const e = rows[0];
    if (e && e.scopeVersion !== 1) fail("FACT_HISTORY_PROVENANCE_UNRESOLVED");
    return e?.tenantId === args.tenantId ? e : null;
  },
});
export const getChangesByTimeRange = query({
  args: {
    ...scopeArgs,
    memorySpaceId: v.string(),
    after: v.optional(v.number()),
    before: v.optional(v.number()),
    action: v.optional(actionValidator),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: (ctx, args) => legacyArray(ctx, args, args.limit, args.offset),
});
function counts(events: Doc<"factHistory">[]) {
  const result = {
    CREATE: 0,
    UPDATE: 0,
    SUPERSEDE: 0,
    DELETE: 0,
    total: events.length,
  };
  for (const event of events) result[event.action]++;
  return result;
}
export const countByAction = query({
  args: {
    ...scopeArgs,
    memorySpaceId: v.string(),
    after: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const p = await boundedPage(ctx, args, { numItems: 256, cursor: null });
    if (!p.isDone) fail("FACT_HISTORY_PAGING_REQUIRED");
    return counts(p.page);
  },
});
export const getActivitySummary = query({
  args: {
    ...scopeArgs,
    memorySpaceId: v.string(),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hours = args.hours ?? 24;
    if (!Number.isFinite(hours) || hours <= 0)
      fail("FACT_HISTORY_INVALID_TIME_RANGE");
    const now = Date.now();
    const since = now - hours * 3600000;
    if (!Number.isFinite(since) || !Number.isFinite(new Date(since).getTime()))
      fail("FACT_HISTORY_INVALID_TIME_RANGE");
    const sinceISO = new Date(since).toISOString();
    const p = await boundedPage(
      ctx,
      { ...args, after: since, before: now },
      { numItems: 256, cursor: null },
    );
    if (!p.isDone) fail("FACT_HISTORY_PAGING_REQUIRED");
    const { total, ...actionCounts } = counts(p.page);
    return {
      timeRange: {
        hours,
        since: sinceISO,
        until: new Date(now).toISOString(),
      },
      totalEvents: total,
      actionCounts,
      uniqueFactsModified: new Set(p.page.map((e) => e.sourceFactId)).size,
      activeParticipants: new Set(
        p.page.flatMap((e) => [e.userId, e.participantId].filter(Boolean)),
      ).size,
    };
  },
});
const deleteArgs = {
  ...selectorArgs,
  paginationOpts: v.optional(paginationOptsValidator),
};
async function deletePage(
  ctx: MutationCtx,
  args: Selector & {
    paginationOpts?: {
      numItems: number;
      cursor: string | null;
      endCursor?: string | null;
    };
  },
) {
  const p = await boundedPage(
    ctx,
    args,
    args.paginationOpts ?? { numItems: 256, cursor: null },
  );
  if (p.pageStatus === "SplitRequired")
    return { ...p, page: [], deleted: 0, remaining: null };
  for (const e of p.page) await markDeletedRow(ctx, e._id);
  return {
    ...p,
    page: [],
    deleted: p.page.length,
    remaining: p.isDone ? 0 : null,
  };
}
export const deleteByFactId = mutation({
  args: { ...deleteArgs, factId: v.string() },
  handler: deletePage,
});
export const deleteByUserId = mutation({
  args: { ...deleteArgs, userId: v.string() },
  handler: deletePage,
});
export const deleteByMemorySpace = mutation({
  args: { ...deleteArgs, memorySpaceId: v.string() },
  handler: deletePage,
});
export const deleteByOwner = mutation({
  args: { ...deleteArgs, ownerUserId: v.string() },
  handler: deletePage,
});
export const purgeOldEvents = mutation({
  args: {
    ...scopeArgs,
    olderThan: v.number(),
    limit: v.optional(v.number()),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: (ctx, args) => {
    if (!Number.isFinite(args.olderThan))
      fail("FACT_HISTORY_INVALID_TIME_RANGE");
    const hint = batchHint(args.limit);
    if (args.paginationOpts) validatePageSize(args.paginationOpts.numItems);
    const opts = args.paginationOpts ?? { numItems: hint, cursor: null };
    return deletePage(ctx, {
      ...args,
      before: args.olderThan,
      beforeExclusive: true,
      paginationOpts: { ...opts, numItems: Math.min(opts.numItems, hint) },
    });
  },
});
/** Single physical vertex; consumers own visited-ID/cursor graph traversal. */
export const chainPage = query({
  args: {
    tenantId: v.optional(v.string()),
    sourceFactId: v.id("facts"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const p = await boundedPage(
      ctx,
      { tenantId: args.tenantId, sourceFactId: args.sourceFactId },
      args.paginationOpts,
    );
    for (const e of p.page)
      for (const ep of [e.supersedesEndpoint, e.supersededByEndpoint])
        if (ep?.state === "unknown")
          fail("FACT_HISTORY_RELATIONSHIP_UNRESOLVED");
    return p;
  },
});
export const getSupersessionChain = query({
  args: { ...scopeArgs, factId: v.string() },
  handler: async (ctx, args) => {
    const rows = await legacyArray(ctx, args, 256);
    const sources = new Set(rows.map((e) => e.sourceFactId));
    if (sources.size > 1) fail("FACT_HISTORY_SOURCE_AMBIGUOUS");
    if (
      rows.some(
        (e) =>
          e.supersedesEndpoint?.state !== "absent" ||
          e.supersededByEndpoint?.state !== "absent",
      )
    )
      fail("FACT_HISTORY_PAGING_REQUIRED");
    return rows.length
      ? [
          {
            factId: args.factId,
            supersededBy: null,
            timestamp: rows[0].timestamp,
            reason: rows[0].reason,
          },
        ]
      : [];
  },
});
/** External contemporaneous evidence is administrator authority, never current uniqueness. */
export const migrateEvidence = internalMutation({
  args: {
    eventDocumentId: v.id("factHistory"),
    dryRun: v.boolean(),
    snapshot: v.object(provenanceFields),
  },
  handler: async (ctx, args) => {
    const budget = new CaptureBudget();
    budget.result(args);
    budget.reserve(1);
    const e = await ctx.db.get(args.eventDocumentId);
    budget.account([e]);
    if (!e) fail("FACT_HISTORY_SOURCE_REQUIRED");
    const p = args.snapshot;
    if (
      p.scopeVersion !== 1 ||
      !p.sourceFactId ||
      p.ownerKnown !== true ||
      p.evidence?.kind !== "verified-migration" ||
      !p.evidence.reference ||
      !p.evidence.hash
    )
      fail("FACT_HISTORY_MIGRATION_EVIDENCE_REQUIRED");
    // Physical IDs are exact ledger witnesses. Missing originals remain attested by
    // externally verified contemporaneous evidence; never query today's logical ID.
    const witnesses = new Map<string, unknown>();
    async function readWitness<T extends TableNames>(
      id: Id<T>,
    ): Promise<Doc<T> | null> {
      if (witnesses.has(id)) return witnesses.get(id) as Doc<T> | null;
      budget.reserve(1);
      const document = await ctx.db.get(id);
      budget.account([document]);
      witnesses.set(id, document);
      return document;
    }
    function conflict(condition: boolean) {
      if (condition) fail("FACT_HISTORY_MIGRATION_CONFLICT");
    }
    conflict(e.tenantId !== undefined && e.tenantId !== p.tenantId);
    for (const key of [
      "sourceFactId",
      "sourceMemorySpaceId",
      "sourceMemoryId",
      "sourceConversationId",
      "sourceRef",
      "ownerKnown",
      "ownerUserId",
      "associationKnown",
      "associatedUserIds",
    ] as const)
      conflict(
        e[key] !== undefined && canonical(e[key]) !== canonical(p[key] ?? null),
      );
    for (const [direction, endpoint] of [
      ["supersedes", p.supersedesEndpoint],
      ["supersededBy", p.supersededByEndpoint],
    ] as const) {
      const logical = e[direction];
      if (
        !endpoint ||
        (logical !== undefined
          ? !logical ||
            endpoint.state !== "known" ||
            endpoint.logicalFactId !== logical ||
            !endpoint.factDocumentId ||
            endpoint.scopeVersion !== 1 ||
            endpoint.tenantId !== p.tenantId ||
            endpoint.memorySpaceId !== e.memorySpaceId ||
            endpoint.factDocumentId === p.sourceFactId ||
            endpoint.logicalFactId === e.factId
          : endpoint.state !== "absent" ||
            Object.keys(endpoint).some(
              (key) =>
                key !== "state" &&
                endpoint[key as keyof typeof endpoint] !== undefined,
            ))
      )
        fail("FACT_HISTORY_RELATIONSHIP_UNRESOLVED");
      if (endpoint.state === "known" && endpoint.factDocumentId) {
        const target = await readWitness(endpoint.factDocumentId);
        conflict(
          !!target &&
            (target.factId !== endpoint.logicalFactId ||
              target.memorySpaceId !== e.memorySpaceId ||
              target.tenantId !== p.tenantId),
        );
      }
    }
    const source = await readWitness(p.sourceFactId);
    conflict(
      !!source &&
        (source.factId !== e.factId ||
          source.memorySpaceId !== e.memorySpaceId ||
          source.tenantId !== p.tenantId ||
          source.userId !== p.ownerUserId ||
          canonical(source.sourceRef ?? null) !==
            canonical(p.sourceRef ?? null)),
    );
    const space = p.sourceMemorySpaceId
      ? await readWitness(p.sourceMemorySpaceId)
      : null;
    conflict(
      !!space &&
        (space.memorySpaceId !== e.memorySpaceId ||
          space.tenantId !== p.tenantId),
    );
    const memory = p.sourceMemoryId
      ? await readWitness(p.sourceMemoryId)
      : null;
    conflict(!!p.sourceMemoryId && !p.sourceRef?.memoryId);
    conflict(
      !!memory &&
        (memory.memorySpaceId !== e.memorySpaceId ||
          memory.tenantId !== p.tenantId ||
          memory.memoryId !== p.sourceRef?.memoryId),
    );
    const conversation = p.sourceConversationId
      ? await readWitness(p.sourceConversationId)
      : null;
    const conversationLogical =
      p.sourceRef?.conversationId ??
      (memory?.userId === undefined
        ? memory?.conversationRef?.conversationId
        : undefined);
    // Match capture's nullish direct selector and strict memory-owner rule.
    // A missing original memory can be attested by the trusted original ledger;
    // a surviving original with a known absent/ineligible edge cannot.
    if (p.sourceConversationId) {
      if (p.sourceRef?.conversationId !== undefined) {
        conflict(!p.sourceRef.conversationId);
      } else {
        conflict(!p.sourceMemoryId);
        conflict(
          !!memory &&
            (memory.userId !== undefined ||
              !memory.conversationRef?.conversationId),
        );
      }
    }
    conflict(
      !!conversation &&
        (conversation.memorySpaceId !== e.memorySpaceId ||
          conversation.tenantId !== p.tenantId ||
          (conversationLogical !== undefined &&
            conversation.conversationId !== conversationLogical)),
    );
    const participants = conversation
      ? [
          conversation.participants.userId,
          ...(conversation.participants.userIds ?? []),
        ].filter((id): id is string => !!id)
      : [];
    const memoryOwner = memory?.userId ?? memory?.sourceUserId;
    const associated = p.ownerUserId
      ? []
      : Array.from(
          new Set([...participants, ...(memoryOwner ? [memoryOwner] : [])]),
        ).sort();
    const allAssociationWitnessesSurvive =
      (!p.sourceMemoryId || !!memory) &&
      (!p.sourceConversationId || !!conversation);
    if (p.associatedUserIds !== undefined) {
      conflict(
        new Set(p.associatedUserIds).size !== p.associatedUserIds.length ||
          associated.some((id) => !p.associatedUserIds!.includes(id)),
      );
      if (p.ownerUserId || allAssociationWitnessesSurvive)
        conflict(
          canonical([...p.associatedUserIds].sort()) !== canonical(associated),
        );
    }
    if (p.associationKnown !== undefined)
      conflict(
        p.associationKnown !==
          !!(p.ownerUserId || p.sourceMemoryId || p.sourceConversationId),
      );
    if (e.scopeVersion === 1) {
      const existing = Object.fromEntries(
        Object.keys(provenanceFields).map((k) => [
          k,
          e[k as keyof typeof provenanceFields],
        ]),
      );
      if (canonical(existing) !== canonical(p))
        fail("FACT_HISTORY_MIGRATION_CONFLICT");
      return budget.finish(ctx, { changed: false, dryRun: args.dryRun });
    }
    budget.write({ ...e, ...p });
    if (!args.dryRun) await reconcileRow(ctx, e._id, clean(p));
    return budget.finish(ctx, { changed: !args.dryRun, dryRun: args.dryRun });
  },
});
