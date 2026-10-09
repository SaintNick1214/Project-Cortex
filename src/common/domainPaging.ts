import { randomUUID } from "./crypto";
/** Bounded ordinary query paging and physical-item outcome accounting. */
import { ConvexError } from "convex/values";
import type { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { validateTenantId } from "../auth/validators";
import { DomainOperationPartialError, type DomainReadOptions, type DomainPartial, type DomainItemOutcome, type DomainGraphIdentity } from "../types";

export interface DomainRange { cursor: string | null; endCursor: string | null }
export interface DomainPage<T> {
  page: T[]; isDone: boolean; continueCursor: string;
  splitCursor?: string | null; pageStatus?: "SplitRequired" | "SplitRecommended" | null;
  fingerprints?: Record<string, string>;
  deleteIntents?: Array<{physicalId: string; operationId: string; requestDigest: string; request: Record<string, unknown>}>;
  archiveIntents?: import("../types").ArchiveFactIntent[];
}
export interface SelectedRecord<T> { document: T; physicalId: string; fingerprint: string; deleteIntent?: NonNullable<DomainPage<T>["deleteIntents"]>[number] }
export function isDomainGraphIdentity(value: unknown): value is DomainGraphIdentity {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>, scope = item.tenantScope as Record<string, unknown> | undefined;
  return ["memories", "facts", "conversations"].includes(String(item.table)) && ["Memory", "Fact", "Conversation"].includes(String(item.kind)) &&
    ["sourceDocumentId", "memorySpaceId", "logicalId", "targetId", "generation"].every(key => typeof item[key] === "string") &&
    Number.isSafeInteger(item.referenceRevision) && Number.isSafeInteger(item.ownershipRevision) &&
    !!scope && (scope.kind === "tenantless" || (scope.kind === "tenant" && typeof scope.tenantId === "string")) && Array.isArray(item.bindings);
}
/** Only these fixed ordinary query services, never an arbitrary function/table name. */
export function domainLoader(client: ConvexClient, domain: "memories" | "facts" | "conversations", args: Record<string, unknown>): (range: DomainRange) => Promise<unknown> {
  const reference = makeFunctionReference<"query">(domain === "facts" ? "facts:candidatePage" : `${domain}:domainPage`);
  const selectedArgs = domain === "facts" && args.selectionMode === "delete" ? {...args, deleteOperationPrefix: args.deleteOperationPrefix ?? randomUUID()} : args;
  return range => client.query(reference, {...selectedArgs, ...(domain === "facts" ? {operation: "list"} : {}), paginationOpts: {...range, numItems: domain === "facts" && args.selectionMode && args.selectionMode !== "read" ? 16 : 128}});
}
export function resolveDomainTenant(context: string | undefined, selected?: string): string | undefined {
  if (context !== undefined) validateTenantId(context);
  if (selected !== undefined) validateTenantId(selected);
  if (context !== undefined && selected !== undefined && context !== selected) throw new Error("TENANT_SCOPE_MISMATCH");
  return selected ?? context;
}
export function assertDomainActive(options?: DomainReadOptions): void {
  if (options?.signal?.aborted) throw new Error("DOMAIN_CANCELLED");
}
function envelope<T>(value: unknown): value is DomainPage<T> {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return Array.isArray(p.page) && typeof p.isDone === "boolean" && typeof p.continueCursor === "string" &&
    [undefined, null, "SplitRequired", "SplitRecommended"].includes(p.pageStatus as string | undefined | null) &&
    (p.splitCursor === undefined || p.splitCursor === null || typeof p.splitCursor === "string");
}
/** Native endCursor ends a subrange even when isDone describes the entire query. */
export async function* domainPages<T>(load: (range: DomainRange) => Promise<unknown>, options?: DomainReadOptions): AsyncGenerator<DomainPage<T>> {
  const duration = options?.deadlineMs ?? 60_000;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("DOMAIN_INVALID_DEADLINE");
  const expires = Date.now() + duration;
  const queue: DomainRange[] = [{cursor: null, endCursor: null}], requested = new Set<string>();
  while (queue.length) {
    let range = queue.shift()!;
    for (;;) {
      assertDomainActive(options);
      const key = JSON.stringify([range.cursor, range.endCursor]);
      if (requested.has(key)) throw new Error("DOMAIN_NONADVANCING_CURSOR");
      requested.add(key);
      const value = await boundedRead(load(range), expires - Date.now(), options?.signal);
      if (!envelope<T>(value)) throw new Error("DOMAIN_INVALID_PAGE");
      if (value.pageStatus === "SplitRequired") {
        if (!value.splitCursor || value.splitCursor === range.cursor || value.splitCursor === range.endCursor) throw new Error("DOMAIN_INVALID_SPLIT");
        queue.unshift({cursor: value.splitCursor, endCursor: range.endCursor});
        range = {cursor: range.cursor, endCursor: value.splitCursor};
        continue;
      }
      if (!value.isDone && (!value.continueCursor || value.continueCursor === range.cursor)) throw new Error("DOMAIN_NONADVANCING_CURSOR");
      yield value;
      if (value.isDone || (range.endCursor !== null && value.continueCursor === range.endCursor)) break;
      range = {...range, cursor: value.continueCursor};
    }
  }
}
async function boundedRead<T>(operation: Promise<T>, milliseconds: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("DOMAIN_DEADLINE_EXCEEDED")), Math.max(0, milliseconds));
      cancel = () => reject(new Error("DOMAIN_CANCELLED"));
      signal?.addEventListener("abort", cancel, {once: true});
      if (signal?.aborted) cancel();
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); if (cancel) signal?.removeEventListener("abort", cancel); }
}
export function waitDomainOperation<T>(operation: Promise<T>, options?: DomainReadOptions): Promise<T> {
  const milliseconds = options?.deadlineMs ?? 30_000;
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new Error("DOMAIN_INVALID_DEADLINE");
  return boundedRead(operation, milliseconds, options?.signal);
}
export function immutableDomainIntent<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) immutableDomainIntent(child);
    Object.freeze(value);
  }
  return value;
}
export async function collectDomain<T extends {_id: string}>(load: (range: DomainRange) => Promise<unknown>, options?: DomainReadOptions, limit = Infinity): Promise<T[]> {
  const records = new Map<string, T>();
  if (limit === 0) return [];
  for await (const p of domainPages<T>(load, options)) {
    for (const row of p.page) {
      if (!row || typeof row._id !== "string") throw new Error("DOMAIN_INVALID_RECORD");
      if (!records.has(row._id)) records.set(row._id, row);
      if (records.size >= limit) return [...records.values()];
    }
  }
  return [...records.values()];
}
export async function selectDomain<T extends {_id: string}>(load: (range: DomainRange) => Promise<unknown>, options?: DomainReadOptions): Promise<SelectedRecord<T>[]> {
  const records = new Map<string, SelectedRecord<T>>();
  for await (const p of domainPages<T>(load, options)) {
    for (const document of p.page) {
      const fingerprint = p.fingerprints?.[document._id];
      if (!/^[a-f0-9]{64}$/.test(fingerprint ?? "")) throw new Error("DOMAIN_INVALID_FINGERPRINT");
      const previous = records.get(document._id);
      if (previous && previous.fingerprint !== fingerprint) throw new Error("DOMAIN_SELECTION_CHANGED");
      records.set(document._id, {document, physicalId: document._id, fingerprint: fingerprint!, deleteIntent: p.deleteIntents?.find(item => item.physicalId === document._id)});
    }
  }
  return [...records.values()];
}
export function sameSelection<T>(before: SelectedRecord<T>[], after: SelectedRecord<T>[]): boolean {
  const expected = new Map(before.map(row => [row.physicalId, row.fingerprint]));
  return expected.size === after.length && after.every(row => expected.get(row.physicalId) === row.fingerprint);
}
export function confirmation(count: number, options?: {requireConfirmation?: boolean; confirmationThreshold?: number}): void {
  if (options?.requireConfirmation === true && options.confirmationThreshold === undefined) throw new Error("DOMAIN_CONFIRMATION_REQUIRED");
  const limit = options?.confirmationThreshold ?? 10;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("DOMAIN_INVALID_CONFIRMATION_THRESHOLD");
  if (count > limit) throw new Error("DELETE_MANY_THRESHOLD_EXCEEDED");
}
export function partialFrom(outcomes: DomainItemOutcome[], originalIntents?: unknown[]): DomainPartial {
  const ids = (disposition: DomainItemOutcome["disposition"]) => outcomes.filter(x => x.disposition === disposition).map(x => x.physicalId);
  const confirmedPhysicalIds = ids("knownCommitted"), unknownPhysicalIds = ids("outcomeUnknown");
  return {outcomes, confirmedPhysicalIds, unknownPhysicalIds, remainingPhysicalIds: outcomes.filter(x => x.disposition !== "knownCommitted" && x.disposition !== "alreadyAbsent").map(x => x.physicalId), unstartedPhysicalIds: ids("unstarted"), confirmedCount: confirmedPhysicalIds.length, possibleCount: confirmedPhysicalIds.length + unknownPhysicalIds.length, originalIntents};
}
/** Never route a non-receipted mutation through resilience retry. Caller owns its client. */
export async function mutateSelected<T>(name: string, selected: SelectedRecord<T>[], send: (row: SelectedRecord<T>) => Promise<{deleted: boolean; graphIdentity?: DomainGraphIdentity}>, options?: DomainReadOptions): Promise<DomainPartial> {
  const outcomes: DomainItemOutcome[] = selected.map(row => ({physicalId: row.physicalId, disposition: "unstarted"}));
  for (let i = 0; i < selected.length; i++) {
    try { assertDomainActive(options); }
    catch (cause) { throw new DomainOperationPartialError(name, partialFrom(outcomes), cause); }
    let operation: Promise<{deleted: boolean; graphIdentity?: DomainGraphIdentity}>;
    try { operation = send(selected[i]); }
    catch (cause) { throw new DomainOperationPartialError(name, partialFrom(outcomes), cause); }
    try {
      const result = await boundedRead(operation, options?.deadlineMs ?? 30_000, options?.signal);
      outcomes[i].disposition = result.deleted ? "knownCommitted" : "alreadyAbsent";
      outcomes[i].graphIdentity = result.graphIdentity;
    } catch (cause) {
      // Structured native application errors roll back. Transport/abort/timeout cannot prove settlement.
      outcomes[i].disposition = cause instanceof ConvexError ? "knownRolledBack" : "outcomeUnknown";
      throw new DomainOperationPartialError(name, partialFrom(outcomes), cause);
    }
  }
  return partialFrom(outcomes);
}
