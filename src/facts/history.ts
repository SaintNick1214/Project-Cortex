/**
 * Cortex SDK - Fact History Service
 *
 * SDK wrapper for fact change history operations.
 * Provides audit trail for belief revision decisions.
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../common/backendApi";
import type { ResilienceLayer } from "../resilience";
import type { AuthContext } from "../auth/types";
import type { Id } from "../../convex-dev/_generated/dataModel";
import type {
  PendingRichEventV1 as BackendPendingRichEventV1,
  HistoryIntent,
  eventReceipt,
} from "../../convex-dev/lib/factHistoryProvenance";
import { makeFunctionReference } from "convex/server";
import { api as publicApi } from "../../convex-dev/_generated/api";
import { isDeploymentOperatorClient } from "../common/deploymentOperator";
import { scopedPages, resolveFactScope, type ScopedPage } from "./discovery";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fact change action types
 */
export type FactChangeAction = "CREATE" | "UPDATE" | "SUPERSEDE" | "DELETE";

/**
 * Pipeline information for a change event
 */
export interface FactChangePipeline {
  slotMatching?: boolean;
  semanticMatching?: boolean;
  llmResolution?: boolean;
}

/**
 * Fact change event record
 */
export interface FactChangeEvent {
  _id?: string;
  scopeVersion?: 1;
  tenantId?: string;
  sourceFactId?: string;
  sourceMemoryId?: string;
  sourceConversationId?: string;
  sourceRef?: BackendPendingRichEventV1["payload"]["sourceRef"];
  evidence?: BackendPendingRichEventV1["payload"]["evidence"];
  operationId?: string;
  phase?: string;
  eventRole?: string;
  operationKind?: string;
  requestDigest?: string;
  /** Native canonical original intent; never part of the version1 pending payload. */
  requestJson?: string;
  affectedFactIds?: string[];
  resultFactId?: string;
  sourceMemorySpaceId?: string;
  ownerKnown?: boolean;
  ownerUserId?: string;
  associationKnown?: boolean;
  associatedUserIds?: string[];
  supersedesEndpoint?: BackendPendingRichEventV1["payload"]["supersedesEndpoint"];
  supersededByEndpoint?: BackendPendingRichEventV1["payload"]["supersededByEndpoint"];
  pendingRichEvent?: BackendPendingRichEventV1;
  publicationState?: "pending" | "complete";
  eventId: string;
  factId: string;
  memorySpaceId: string;
  action: FactChangeAction;
  oldValue?: string;
  newValue?: string;
  supersededBy?: string;
  supersedes?: string;
  reason?: string;
  confidence?: number;
  pipeline?: FactChangePipeline;
  userId?: string;
  participantId?: string;
  conversationId?: string;
  timestamp: number;
}

/**
 * Parameters for logging a change event
 */
export interface LogEventParams {
  tenantId?: string;
  sourceFactId?: Id<"facts">;
  incomingFactId?: Id<"facts">;
  operationId?: string;
  factId: string;
  memorySpaceId: string;
  action: FactChangeAction;
  oldValue?: string;
  newValue?: string;
  supersededBy?: string;
  supersedes?: string;
  reason?: string;
  confidence?: number;
  pipeline?: FactChangePipeline;
  userId?: string;
  participantId?: string;
  conversationId?: string;
}

/**
 * Filter for querying change events
 */
export interface ChangeFilter {
  tenantId?: string;
  memorySpaceId: string;
  after?: Date;
  before?: Date;
  action?: FactChangeAction;
  limit?: number;
  offset?: number;
}

/**
 * Activity summary for a time period
 */
export interface ActivitySummary {
  timeRange: {
    hours: number;
    since: string;
    until: string;
  };
  totalEvents: number;
  actionCounts: {
    CREATE: number;
    UPDATE: number;
    SUPERSEDE: number;
    DELETE: number;
  };
  uniqueFactsModified: number;
  activeParticipants: number;
}

/**
 * Supersession chain entry
 */
export interface SupersessionChainEntry {
  sourceFactId?: string;
  factId: string;
  supersededBy: string | null;
  timestamp: number;
  reason?: string;
}

/**
 * Public history writes and maintenance require trusted backend execution.
 * This static browser-safe error contains no caller input or private metadata.
 */
export class FactHistoryCapabilityError extends Error {
  readonly version = 1;
  readonly code = "CAPABILITY_UNAVAILABLE";
  readonly retryable = false;
  readonly outcome = "not_dispatched";

  constructor() {
    super(
      "Fact history writes and maintenance require trusted backend execution. " +
        "No operation was dispatched by this client.",
    );
    this.name = "FactHistoryCapabilityError";
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FactHistoryService
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Service for managing fact change history
 *
 * @example
 * ```typescript
 * const history = new FactHistoryService(convexClient);
 *
 * // Log a change event
 * await history.log({
 *   factId: "fact-123",
 *   memorySpaceId: "space-1",
 *   action: "UPDATE",
 *   oldValue: "User likes blue",
 *   newValue: "User likes purple",
 *   reason: "User explicitly stated preference change",
 * });
 *
 * // Get history for a fact
 * const events = await history.getHistory("fact-123");
 *
 * // Get changes in a time range
 * const recentChanges = await history.getChanges({
 *   memorySpaceId: "space-1",
 *   after: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
 * });
 * ```
 */
export interface HistorySelector {
  tenantId?: string;
  memorySpaceId?: string;
  factId?: string;
  sourceFactId?: Id<"facts">;
  sourceMemorySpaceId?: Id<"memorySpaces">;
  incomingFactId?: Id<"facts">;
  userId?: string;
  ownerUserId?: string;
  after?: number;
  before?: number;
  action?: FactChangeAction;
}
export type PendingRichEventV1 = BackendPendingRichEventV1;
export type HistoryReceipt = ReturnType<typeof eventReceipt>;
export class HistoryWriteAfterCommitError extends Error {
  readonly committed = true;
  readonly phase = "rich_publication";
  constructor(
    readonly receipt: HistoryReceipt,
    readonly scope: { tenantId?: string; memorySpaceId: string },
    readonly originalCause: unknown,
  ) {
    freeze(receipt);
    super("Fact committed; rich history publication remains pending");
    this.name = "HistoryWriteAfterCommitError";
  }
}
export class RevisionAfterCommitError extends Error {
  readonly phase = "revision_link";
  constructor(
    readonly receipt: {
      store: {
        committed: true;
        createdFactId: string;
        createdDocumentId: string;
        storeAnchor?: HistoryReceipt;
      };
      link: { committed: false } | { outcome: "unknown" };
      scope: { tenantId?: string; memorySpaceId: string };
      intent: HistoryIntent;
      expectedOldFactId: string;
      expectedNewFactId: string;
    },
    readonly originalCause: unknown,
  ) {
    freeze(receipt);
    super("Revision store committed; relationship phase incomplete");
    this.name = "RevisionAfterCommitError";
  }
}
export class DecisionLogError extends Error {
  readonly committed = false;
  readonly phase = "decision_log";
  constructor(readonly originalCause: unknown) {
    super("Fact decision history logging failed; no fact mutation committed");
    this.name = "DecisionLogError";
  }
}
export class FactCommittedResultUnavailableError extends Error {
  readonly committed = true;
  readonly phase = "committed_result_unavailable";
  constructor(
    readonly receipt: HistoryReceipt,
    readonly scope: { tenantId?: string; memorySpaceId: string },
    readonly originalCause: unknown,
  ) {
    super("FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE");
    freeze(receipt);
    this.name = "FactCommittedResultUnavailableError";
  }
}
/** Backend acknowledged commitment, but its retained receipt cannot be resolved. */
export class FactCommittedReceiptUnresolvedError extends Error {
  readonly committed = true;
  readonly phase = "committed_receipt_unresolved";
  constructor(
    readonly operationId: string,
    readonly mutationPhase: string,
    readonly scope: { tenantId?: string; memorySpaceId: string },
    readonly receiptDisposition: "missing" | "unavailable",
    readonly originalCause: unknown,
    readonly receiptCause?: unknown,
  ) {
    super("Fact committed; retained operation receipt unresolved");
    this.name = "FactCommittedReceiptUnresolvedError";
  }
}
export class FactCommitOutcomeUnknownError extends Error {
  constructor(
    readonly operationId: string,
    readonly phase: string,
    readonly originalCause: unknown,
  ) {
    super(
      "Fact commit outcome unknown; reconcile the original operation before retrying",
    );
    this.name = "FactCommitOutcomeUnknownError";
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function validateTimeRange(
  selector: Pick<HistorySelector, "after" | "before">,
) {
  for (const value of [selector.after, selector.before])
    if (
      value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value))
    )
      throw new Error("FACT_HISTORY_INVALID_TIME_RANGE");
  if (
    selector.after !== undefined &&
    selector.before !== undefined &&
    selector.after > selector.before
  )
    throw new Error("FACT_HISTORY_INVALID_TIME_RANGE");
}
function timestamp(date: Date): number {
  if (!(date instanceof Date))
    throw new Error("FACT_HISTORY_INVALID_TIME_RANGE");
  try {
    const value = Date.prototype.getTime.call(date);
    if (!Number.isFinite(value))
      throw new Error("FACT_HISTORY_INVALID_TIME_RANGE");
    return value;
  } catch {
    throw new Error("FACT_HISTORY_INVALID_TIME_RANGE");
  }
}
function optionalTimestamp(date?: Date): number | undefined {
  return date === undefined ? undefined : timestamp(date);
}
function batchHint(limit?: number): number {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
    throw new Error("FACT_HISTORY_INVALID_PAGE_SIZE");
  return Math.min(limit ?? 256, 256);
}
export class FactHistoryService {
  constructor(
    private client: ConvexClient,
    private resilience?: ResilienceLayer,
    private authContext?: AuthContext,
  ) {}
  private scope(tenantId?: string) {
    return resolveFactScope(this.authContext?.tenantId, tenantId);
  }
  private executeWithResilience<T>(
    operation: () => Promise<T>,
    name: string,
  ): Promise<T> {
    return this.resilience
      ? this.resilience.execute(operation, name)
      : operation();
  }
  async log(params: LogEventParams): Promise<{ eventId: string }> {
    if (!isDeploymentOperatorClient(this.client)) throw new FactHistoryCapabilityError();
    const operationId = params.operationId ?? crypto.randomUUID();
    return this.executeWithResilience(
      () =>
        this.client.mutation(api.factHistory.logEvent, {
          ...params,
          tenantId: this.scope(params.tenantId),
          operationId,
        }),
      "factHistory:log",
    );
  }
  async *pages(
    selector: HistorySelector = {},
  ): AsyncGenerator<FactChangeEvent[]> {
    if (!isDeploymentOperatorClient(this.client)) throw new FactHistoryCapabilityError();
    validateTimeRange(selector);
    const args = { ...selector, tenantId: this.scope(selector.tenantId) };
    for await (const page of scopedPages<FactChangeEvent>(
      (range) =>
        this.executeWithResilience(
          async () =>
            (await this.client.query(api.factHistory.page, {
              ...args,
              paginationOpts: { ...range, numItems: 256 },
            })) as ScopedPage<FactChangeEvent>,
          "factHistory:page",
        ),
      "factHistory",
    ))
      yield page;
  }
  async getHistory(
    factId: string,
    limit = 100,
    selector: HistorySelector = {},
  ): Promise<FactChangeEvent[]> {
    if (!isDeploymentOperatorClient(this.client)) return this.executeWithResilience(() => this.client.query(publicApi.factHistory.getHistory, { factId, limit, tenantId: this.scope(selector.tenantId), memorySpaceId: selector.memorySpaceId }), "factHistory:getHistory") as Promise<FactChangeEvent[]>;
    if (!Number.isInteger(limit) || limit < 1)
      throw new Error("FACT_HISTORY_INVALID_PAGE_SIZE");
    const result: FactChangeEvent[] = [];
    for await (const page of this.pages({ ...selector, factId })) {
      result.push(...page.slice(0, limit - result.length));
      if (result.length >= limit) break;
    }
    return result;
  }
  async getEvent(eventId: string): Promise<FactChangeEvent | null> {
    return this.executeWithResilience(
      () =>
        this.client.query(api.factHistory.getEvent, {
          eventId,
          tenantId: this.scope(),
        }),
      "factHistory:getEvent",
    );
  }
  async getChanges(filter: ChangeFilter): Promise<FactChangeEvent[]> {
    if (!isDeploymentOperatorClient(this.client)) return this.executeWithResilience(() => this.client.query(publicApi.factHistory.getChangesByTimeRange, { memorySpaceId: filter.memorySpaceId, tenantId: this.scope(filter.tenantId), after: optionalTimestamp(filter.after), before: optionalTimestamp(filter.before), action: filter.action, limit: filter.limit, offset: filter.offset }), "factHistory:getChanges") as Promise<FactChangeEvent[]>;
    const result: FactChangeEvent[] = [];
    let skip = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    if (
      skip < 0 ||
      !Number.isInteger(skip) ||
      limit < 1 ||
      !Number.isInteger(limit)
    )
      throw new Error("FACT_HISTORY_INVALID_PAGE_SIZE");
    for await (const page of this.pages({
      memorySpaceId: filter.memorySpaceId,
      tenantId: filter.tenantId,
      after: optionalTimestamp(filter.after),
      before: optionalTimestamp(filter.before),
      action: filter.action,
    })) {
      if (skip >= page.length) {
        skip -= page.length;
        continue;
      }
      result.push(...page.slice(skip, skip + limit - result.length));
      skip = 0;
      if (result.length >= limit) break;
    }
    return result;
  }
  async countByAction(memorySpaceId: string, after?: Date, before?: Date) {
    if (!isDeploymentOperatorClient(this.client)) return this.executeWithResilience(() => this.client.query(publicApi.factHistory.countByAction, { memorySpaceId, tenantId: this.scope(), after: optionalTimestamp(after), before: optionalTimestamp(before) }), "factHistory:countByAction");
    const counts = { CREATE: 0, UPDATE: 0, SUPERSEDE: 0, DELETE: 0, total: 0 };
    for await (const page of this.pages({
      memorySpaceId,
      after: optionalTimestamp(after),
      before: optionalTimestamp(before),
    }))
      for (const event of page) {
        counts[event.action]++;
        counts.total++;
      }
    return counts;
  }
  async getActivitySummary(
    memorySpaceId: string,
    hours = 24,
  ): Promise<ActivitySummary> {
    if (!isDeploymentOperatorClient(this.client)) return this.executeWithResilience(() => this.client.query(publicApi.factHistory.getActivitySummary, { memorySpaceId, tenantId: this.scope(), hours }), "factHistory:getActivitySummary") as Promise<ActivitySummary>;
    if (!Number.isFinite(hours) || hours <= 0)
      throw new Error("FACT_HISTORY_INVALID_TIME_RANGE");
    const now = Date.now(),
      since = now - hours * 3600000,
      actionCounts = { CREATE: 0, UPDATE: 0, SUPERSEDE: 0, DELETE: 0 };
    if (!Number.isFinite(since) || !Number.isFinite(new Date(since).getTime()))
      throw new Error("FACT_HISTORY_INVALID_TIME_RANGE");
    const sinceISO = new Date(since).toISOString();
    const facts = new Set<string>(),
      participants = new Set<string>();
    let totalEvents = 0;
    for await (const page of this.pages({
      memorySpaceId,
      after: since,
      before: now,
    }))
      for (const e of page) {
        actionCounts[e.action]++;
        totalEvents++;
        facts.add(e.sourceFactId ?? e.factId);
        if (e.userId) participants.add(e.userId);
        if (e.participantId) participants.add(e.participantId);
      }
    return {
      timeRange: {
        hours,
        since: sinceISO,
        until: new Date(now).toISOString(),
      },
      totalEvents,
      actionCounts,
      uniqueFactsModified: facts.size,
      activeParticipants: participants.size,
    };
  }
  async getOperationReceipt(
    memorySpaceId: string,
    operationId: string,
    phase: string,
    tenantId?: string,
  ): Promise<HistoryReceipt | null> {
    const receipt = await this.client.query(
      api.factHistory.getOperationReceipt,
      { memorySpaceId, operationId, phase, tenantId: this.scope(tenantId) },
    );
    return receipt ? freeze(receipt) : null;
  }
  async retryHistory(receipt: HistoryReceipt): Promise<{ eventIds: string[] }> {
    if (!isDeploymentOperatorClient(this.client)) throw new FactHistoryCapabilityError();
    freeze(receipt);
    const eventIds: string[] = [];
    for (const event of receipt.events) {
      const pending = event.pending;
      if (!pending) throw new Error("FACT_HISTORY_PENDING_EVENT_UNRESOLVED");
      const p = pending.payload;
      if (!p.operationId || !p.phase || !p.eventRole)
        throw new Error("FACT_HISTORY_PENDING_EVENT_UNRESOLVED");
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.factHistory.publishPendingEvent, {
            tenantId: this.scope(p.tenantId),
            memorySpaceId: p.memorySpaceId,
            operationId: p.operationId!,
            phase: p.phase!,
            eventRole: p.eventRole!,
            eventId: event.eventId,
            pending,
          }),
        "factHistory:publishPendingEvent",
      );
      eventIds.push(result.eventId);
    }
    return { eventIds };
  }
  async getSupersessionChain(
    factId: string,
    selector: HistorySelector = {},
  ): Promise<SupersessionChainEntry[]> {
    if (!isDeploymentOperatorClient(this.client)) return this.executeWithResilience(() => this.client.query(publicApi.factHistory.getSupersessionChain, { factId, tenantId: this.scope(selector.tenantId) }), "factHistory:getSupersessionChain") as Promise<SupersessionChainEntry[]>;
    const tenantId = this.scope(selector.tenantId);
    const initial: FactChangeEvent[] = [];
    for await (const page of this.pages({ ...selector, tenantId, factId }))
      initial.push(...page);
    if (!initial.length) return [];
    const identities = new Set(initial.map((e) => e.sourceFactId));
    if (identities.size !== 1 || !initial[0]?.sourceFactId)
      throw new Error("FACT_HISTORY_SOURCE_AMBIGUOUS");
    const queue = [initial[0].sourceFactId],
      visited = new Set<string>(),
      nodes = new Map<string, SupersessionChainEntry>(),
      outgoing = new Map<string, string>(),
      observed = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const traversalScope = {
        ...selector,
        tenantId,
        factId: undefined,
        memorySpaceId: initial[0].memorySpaceId,
      };
      for (const traversalSelector of [
        {
          ...traversalScope,
          incomingFactId: undefined,
          sourceFactId: id as Id<"facts">,
          memorySpaceId: initial[0].memorySpaceId,
        },
        {
          ...traversalScope,
          sourceFactId: undefined,
          incomingFactId: id as Id<"facts">,
          memorySpaceId: initial[0].memorySpaceId,
        },
      ])
        for await (const page of this.pages(traversalSelector))
          for (const e of page) {
            if (!e.sourceFactId)
              throw new Error("FACT_HISTORY_PROVENANCE_UNRESOLVED");
            const endpoints = [e.supersedesEndpoint, e.supersededByEndpoint];
            if (endpoints.some((ep) => !ep || ep.state === "unknown"))
              throw new Error("FACT_HISTORY_RELATIONSHIP_UNRESOLVED");
            if (
              !observed.has(e.sourceFactId) ||
              e.timestamp > (nodes.get(e.sourceFactId)?.timestamp ?? 0)
            )
              nodes.set(e.sourceFactId, {
                factId: e.factId,
                sourceFactId: e.sourceFactId,
                supersededBy: e.supersededBy ?? null,
                timestamp: e.timestamp,
                reason: e.reason,
              });
            observed.add(e.sourceFactId);
            if (e.sourceFactId !== id) queue.push(e.sourceFactId);
            for (const ep of endpoints) {
              if (ep?.state !== "known") continue;
              if (
                ep.tenantId !== tenantId ||
                ep.memorySpaceId !== e.memorySpaceId ||
                !ep.factDocumentId
              )
                throw new Error("FACT_HISTORY_SCOPE_MISMATCH");
              if (!nodes.has(ep.factDocumentId))
                nodes.set(ep.factDocumentId, {
                  factId: ep.logicalFactId!,
                  sourceFactId: ep.factDocumentId,
                  supersededBy: null,
                  timestamp: e.timestamp,
                  reason: "Retained physical relationship endpoint",
                });
              queue.push(ep.factDocumentId);
            }
            const target = e.supersededByEndpoint;
            if (target?.state === "known" && target.factDocumentId) {
              const previous = outgoing.get(e.sourceFactId);
              if (previous && previous !== target.factDocumentId)
                throw new Error("FACT_HISTORY_RELATIONSHIP_CONFLICT");
              outgoing.set(e.sourceFactId, target.factDocumentId);
            }
          }
    }
    for (const id of outgoing.keys()) {
      const seen = new Set<string>();
      let next: string | undefined = id;
      while (next) {
        if (seen.has(next)) throw new Error("FACT_HISTORY_RELATIONSHIP_CYCLE");
        seen.add(next);
        next = outgoing.get(next);
      }
    }
    return Array.from(nodes.entries())
      .map(([id, node]) => ({
        ...node,
        supersededBy: outgoing.has(id)
          ? (nodes.get(outgoing.get(id)!)?.factId ?? node.supersededBy)
          : node.supersededBy,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  private async deletePages(
    name:
      | "deleteByFactId"
      | "deleteByUserId"
      | "deleteByMemorySpace"
      | "deleteByOwner"
      | "purgeOldEvents",
    selector: HistorySelector & { olderThan?: number; limit?: number },
    numItems = 256,
  ) {
    if (!isDeploymentOperatorClient(this.client)) throw new FactHistoryCapabilityError();
    validateTimeRange(selector);
    let deleted = 0;
    try {
      for await (const _page of scopedPages<never>(async (range) => {
        const p = (await this.client.mutation(
          makeFunctionReference<"mutation">(`factHistory:${name}`),
          {
            ...selector,
            tenantId: this.scope(selector.tenantId),
            paginationOpts: { ...range, numItems },
          },
        )) as ScopedPage<never> & { deleted: number };
        deleted += p.deleted;
        return p;
      }, `factHistory:${name}`)) {
        /* receipt is accumulated */
      }
    } catch (error) {
      throw new HistoryDeletePartialError(deleted, error);
    }
    return { deleted };
  }
  async deleteByFactId(factId: string) {
    return this.deletePages("deleteByFactId", { factId });
  }
  async deleteByUserId(userId: string) {
    return this.deletePages("deleteByUserId", { userId });
  }
  async deleteByMemorySpace(memorySpaceId: string) {
    return this.deletePages("deleteByMemorySpace", { memorySpaceId });
  }
  async deleteByOwner(ownerUserId: string, memorySpaceId?: string) {
    return this.deletePages("deleteByOwner", { ownerUserId, memorySpaceId });
  }
  async purgeOldEvents(
    olderThan: Date,
    memorySpaceId?: string,
    limit?: number,
  ): Promise<{ deleted: number; remaining: number }> {
    if (!isDeploymentOperatorClient(this.client)) throw new FactHistoryCapabilityError();
    const cutoff = timestamp(olderThan);
    const numItems = batchHint(limit);
    const result = await this.deletePages(
      "purgeOldEvents",
      {
        memorySpaceId,
        olderThan: cutoff,
        limit,
      },
      numItems,
    );
    return { ...result, remaining: 0 };
  }
}
export class HistoryDeletePartialError extends Error {
  constructor(
    readonly deleted: number,
    readonly originalCause: unknown,
  ) {
    super("History deletion incomplete");
    this.name = "HistoryDeletePartialError";
  }
}

/** Acknowledged scalar transactions remain committed when a later page fails. */
export class FactsDeletionPartialError extends Error {
  constructor(
    readonly deleted: number,
    readonly memorySpaceId: string,
    readonly originalCause: unknown,
  ) {
    super("Fact deletion partially committed; paging did not complete");
    this.name = "FactsDeletionPartialError";
  }
}
