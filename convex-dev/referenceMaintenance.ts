import { memoryVectorScopeKey, hasMemoryVectorScope } from "./lib/memoryVectorScope";
/** Eight fixed internal administration functions. No erasure or primary content mutation. */
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  uniqueReference,
  PRIMARY_TABLES,
  WRITER_MANIFEST_HASH,
  CONTROL_KEY,
  lifecycleControl,
  lifecycleFailure,
  reserveLifecycle,
  documentTarget,
  extractReferenceSlots,
  referenceDigest,
  ownership,
  slotDigest,
  reconcileSlot,
  removeEdge,
  storageTarget,
  pruneOrphanIdentity,
  type Primary,
  type Reader,
} from "./lib/referenceLifecycle";
import { byteSize, digest } from "./lib/factHistoryProvenance";
type State = Doc<"cortexReferenceState">;
const MIB = 1024 * 1024;
const opts = (
  cursor: string | null,
  numItems: number,
  endCursor?: string | null,
) => ({
  cursor,
  numItems,
  ...(endCursor ? { endCursor } : {}),
  maximumRowsRead: 256,
  maximumBytesRead: 2 * MIB,
});
async function stateRow(ctx: Reader, key: string) {
  return ctx.db
    .query("cortexReferenceState")
    .withIndex("by_key", (q) => q.eq("key", key))
    .take(2)
    .then((rows) => uniqueReference(rows));
}
async function progress(
  ctx: MutationCtx,
  s: State,
  kind: "backfill" | "validation",
) {
  const key = `${kind}:${s.generation}`;
  let p = await stateRow(ctx, key);
  if (!p) {
    const id = await ctx.db.insert("cortexReferenceState", {
      key,
      generation: s.generation,
      kind,
      writerManifestHash: WRITER_MANIFEST_HASH,
      status: s.status,
      phase: "sources",
      tableIndex: 0,
      cursor: null,
      endCursor: null,
      splitTail: null,
      rows: 0,
      complete: false,
    });
    p = await ctx.db.get(id);
  }
  if (!p || p.writerManifestHash !== WRITER_MANIFEST_HASH)
    lifecycleFailure("REFERENCE_PROGRESS_DRIFT");
  return p;
}
async function admitted(ctx: Reader, expected: "building" | "finalizing") {
  const s = await lifecycleControl(ctx);
  if (
    !s ||
    s.status !== expected ||
    s.writerManifestHash !== WRITER_MANIFEST_HASH
  )
    lifecycleFailure("REFERENCE_MAINTENANCE_STATE");
  return s;
}
async function overview(ctx: Reader) {
  const s = await lifecycleControl(ctx);
  const backfill = s ? await stateRow(ctx, `backfill:${s.generation}`) : null,
    validation = s ? await stateRow(ctx, `validation:${s.generation}`) : null,
    work = s ? await stateRow(ctx, `source:${s.generation}`) : null;
  return {
    version: 1,
    unresolved:
      s?.unresolvedCount === undefined
        ? null
        : {
            count: s.unresolvedCount,
            reasons: {
              legacyBirthUnavailable: s.legacyUnknownCount ?? 0,
              sourceMissingOrAmbiguous: s.missingOrAmbiguousCount ?? 0,
            },
          },
    work: work
      ? {
          offset: work.offset ?? 0,
          digest: work.sourceDigest ?? null,
          checkpoint: work.checkpointDigest ?? null,
        }
      : null,
    expectedWriterManifestHash: WRITER_MANIFEST_HASH,
    writerManifestHash: s?.writerManifestHash ?? null,
    generation: s?.generation ?? null,
    state: s?.status ?? "missing",
    ready: Boolean(
      s?.status === "ready" &&
        s.writerManifestHash === WRITER_MANIFEST_HASH &&
        s.unresolvedCount !== undefined,
    ),
    backfill: backfill
      ? {
          phase: backfill.phase,
          tableIndex: backfill.tableIndex,
          rows: backfill.rows ?? 0,
          complete: backfill.complete ?? false,
          checkpoint: backfill.checkpointDigest ?? null,
          cursorDigest: digest({
            cursor: backfill.cursor,
            end: backfill.endCursor,
            tail: backfill.splitTail,
          }),
        }
      : null,
    validation: validation
      ? {
          phase: validation.phase,
          tableIndex: validation.tableIndex,
          rows: validation.rows ?? 0,
          complete: validation.complete ?? false,
          checkpoint: validation.checkpointDigest ?? null,
          cursorDigest: digest({
            cursor: validation.cursor,
            end: validation.endCursor,
            tail: validation.splitTail,
          }),
        }
      : null,
  };
}
function finiteResult<T>(value: T): T {
  if (byteSize(value) > 8 * MIB) lifecycleFailure("REFERENCE_RESULT_BUDGET");
  return value;
}
function nextTable(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= PRIMARY_TABLES.length)
    lifecycleFailure("REFERENCE_PROGRESS_DRIFT");
  return PRIMARY_TABLES[index];
}
// Split tails are linked fixed progress rows, never an unbounded caller ID/cursor array.
async function splitPage(
  ctx: MutationCtx,
  p: State,
  page: {
    pageStatus?: string | null;
    splitCursor?: string | null;
    continueCursor: string;
  },
) {
  if (page.pageStatus !== "SplitRequired") return false;
  if (
    !page.splitCursor ||
    page.splitCursor === p.cursor ||
    page.splitCursor === p.endCursor
  )
    lifecycleFailure("REFERENCE_CURSOR_NONPROGRESS");
  const key = `tail:${p.key}:${digest({ cursor: p.cursor, end: p.endCursor, split: page.splitCursor })}`;
  const existing = await stateRow(ctx, key);
  if (existing) lifecycleFailure("REFERENCE_CURSOR_REPLAY");
  await ctx.db.insert("cortexReferenceState", {
    key,
    generation: p.generation,
    kind: p.kind,
    writerManifestHash: WRITER_MANIFEST_HASH,
    status: p.status,
    cursor: page.splitCursor,
    endCursor: p.endCursor ?? null,
    splitTail: p.splitTail ?? null,
  });
  await ctx.db.patch(p._id, { endCursor: page.splitCursor, splitTail: key });
  return true;
}
async function advancePage(
  ctx: MutationCtx,
  p: State,
  page: { continueCursor: string; isDone: boolean },
  rows: number,
) {
  // Native isDone describes the full query, including beyond a fixed endCursor.
  const done = page.isDone || Boolean(p.endCursor && page.continueCursor === p.endCursor);
  if (!done && page.continueCursor === (p.cursor ?? ""))
    lifecycleFailure("REFERENCE_CURSOR_NONPROGRESS");
  const change = {
    cursor: page.continueCursor,
    rows: (p.rows ?? 0) + rows,
    checkpointDigest: digest({
      cursor: p.cursor,
      next: page.continueCursor,
      rows,
      prior: p.checkpointDigest,
    }),
  };
  if (done && p.splitTail) {
    const tail = await stateRow(ctx, p.splitTail);
    if (!tail || tail.generation !== p.generation)
      lifecycleFailure("REFERENCE_PROGRESS_DRIFT");
    await ctx.db.patch(p._id, {
      ...change,
      cursor: tail.cursor ?? null,
      endCursor: tail.endCursor ?? null,
      splitTail: tail.splitTail ?? null,
    });
    await ctx.db.delete(tail._id);
    return false;
  }
  await ctx.db.patch(p._id, change);
  return done;
}
function currentDigest(table: Primary, row: Record<string, unknown>) {
  return digest({
    physical: row._id,
    references: referenceDigest(table, row),
    ownership: ownership(table, row).ownershipDigest,
    ...(table === "memories" ? {vectorScopeKey: row.vectorScopeKey ?? null} : {}),
  });
}
async function finishSource(
  ctx: MutationCtx,
  s: State,
  table: Primary,
  row: Record<string, unknown>,
  target: Doc<"cortexReferenceTargets">,
) {
  if (table === "memories") {
    const memory = row as Doc<"memories">;
    const key = memoryVectorScopeKey(memory.tenantId, memory.memorySpaceId);
    if (memory.vectorScopeKey !== key) {
      await reserveLifecycle(ctx, 0, byteSize(key) + 1024, 1);
      await ctx.db.patch(memory._id, {vectorScopeKey: key});
    }
  }
  const expected = extractReferenceSlots(table, row),
    edges = await ctx.db
      .query("cortexReferenceEdges")
      .withIndex("by_source", (q) => q.eq("sourceTargetId", target._id))
      .collect(),
    keys = new Set(expected.map((x) => x.role + ":" + x.slot));
  for (const e of edges)
    if (!keys.has(e.role + ":" + e.slot))
      await removeEdge(ctx, e, s.generation);
  const authoritative = (
      await ctx.db
        .query("cortexReferenceEdges")
        .withIndex("by_source", (q) => q.eq("sourceTargetId", target._id))
        .collect()
    ).filter((e) => e.kind === "authority"),
    parent = authoritative.sort((a, b) =>
      (a.role + ":" + a.slot).localeCompare(b.role + ":" + b.slot),
    )[0];
  await ctx.db.patch(target._id, {
    generation: s.generation,
    preparedGeneration: s.generation,
    referenceDigest: referenceDigest(table, row),
    ...ownership(table, row),
    authorityParentTargetId: parent?.targetTargetId,
    authorityParentOwnershipRevision: parent?.capturedOwnershipRevision,
  });
}
export const status = internalQuery({
  args: {},
  handler: async (ctx) => finiteResult(await overview(ctx)),
});
export const planPage = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let index = 0,
      cursor: string | null = null,
      end: string | null = null,
      tails: Array<[string, string | null]> = [];
    if (args.cursor) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(args.cursor);
      } catch {
        return lifecycleFailure("REFERENCE_PLAN_CURSOR");
      }
      if (
        !Array.isArray(parsed) ||
        parsed.length !== 4 ||
        !Number.isInteger(parsed[0]) ||
        !(parsed[1] === null || typeof parsed[1] === "string") ||
        !(parsed[2] === null || typeof parsed[2] === "string") ||
        !Array.isArray(parsed[3]) ||
        parsed[3].some(
          (x: unknown) =>
            !Array.isArray(x) ||
            x.length !== 2 ||
            typeof x[0] !== "string" ||
            !(x[1] === null || typeof x[1] === "string"),
        )
      )
        lifecycleFailure("REFERENCE_PLAN_CURSOR");
      [index, cursor, end, tails] = parsed as [
        number,
        string | null,
        string | null,
        Array<[string, string | null]>,
      ];
    }
    const table = nextTable(index),
      page = await ctx.db.query(table).paginate(opts(cursor, 128, end));
    if (page.pageStatus === "SplitRequired") {
      if (
        !page.splitCursor ||
        page.splitCursor === cursor ||
        page.splitCursor === end
      )
        lifecycleFailure("REFERENCE_CURSOR_NONPROGRESS");
      // Discard provisional rows, visit the head interval, then exhaust every tail.
      const next = JSON.stringify([
        index,
        cursor,
        page.splitCursor,
        [[page.splitCursor, end], ...tails],
      ]);
      return finiteResult({
        version: 1,
        executed: false,
        ready: (await overview(ctx)).ready,
        table,
        rows: 0,
        storageOccurrences: 0,
        split: true,
        done: false,
        nextCursor: next,
      });
    }
    if (!page.isDone && page.continueCursor === cursor)
      lifecycleFailure("REFERENCE_CURSOR_NONPROGRESS");
    let done = false,
      next: string | null;
    const rangeDone = page.isDone || Boolean(end && page.continueCursor === end);
    if (!rangeDone)
      next = JSON.stringify([index, page.continueCursor, end, tails]);
    else if (tails.length) {
      const [head, ...remaining] = tails;
      next = JSON.stringify([index, head[0], head[1], remaining]);
    } else if (index < PRIMARY_TABLES.length - 1)
      next = JSON.stringify([index + 1, null, null, []]);
    else {
      done = true;
      next = null;
    }
    return finiteResult({
      version: 1,
      executed: false,
      ready: (await overview(ctx)).ready,
      table,
      rows: page.page.length,
      storageOccurrences: page.page.reduce(
        (n, row) =>
          n +
          extractReferenceSlots(table, row)
            .filter((x) => x.storageId)
            .reduce((m, x) => m + (x.occurrences ?? 0), 0),
        0,
      ),
      done,
      nextCursor: next,
    });
  },
});
export const startGeneration = internalMutation({
  args: {},
  handler: async (ctx) => {
    let s = await lifecycleControl(ctx);
    if (s?.status === "finalizing") lifecycleFailure("REFERENCE_FINALIZING");
    if (
      s?.status === "ready" &&
      s.writerManifestHash === WRITER_MANIFEST_HASH &&
      s.unresolvedCount !== undefined
    )
      return finiteResult(await overview(ctx));
    if (!s) {
      const id = await ctx.db.insert("cortexReferenceState", {
        key: CONTROL_KEY,
        kind: "control",
        generation: crypto.randomUUID(),
        writerManifestHash: WRITER_MANIFEST_HASH,
        status: "building",
        unresolvedCount: 0,
        legacyUnknownCount: 0,
        missingOrAmbiguousCount: 0,
      });
      s = await ctx.db.get(id);
    } else if (
      s.status === "invalid" ||
      s.writerManifestHash !== WRITER_MANIFEST_HASH ||
      s.unresolvedCount === undefined
    ) {
      await ctx.db.patch(s._id, {
        generation: crypto.randomUUID(),
        writerManifestHash: WRITER_MANIFEST_HASH,
        status: "building",
        unresolvedCount: 0,
        legacyUnknownCount: 0,
        missingOrAmbiguousCount: 0,
      });
      s = await ctx.db.get(s._id);
    }
    if (!s) lifecycleFailure("REFERENCE_STATE_MISSING");
    await progress(ctx, s, "backfill");
    return finiteResult(await overview(ctx));
  },
});
export const advanceBackfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    const s = await admitted(ctx, "building"),
      p = await progress(ctx, s, "backfill");
    if (p.complete) return finiteResult(await overview(ctx));
    const table = nextTable(p.tableIndex ?? 0),
      workKey = `source:${s.generation}`;
    let work = await stateRow(ctx, workKey);
    if (!work) {
      const page = await ctx.db
        .query(table)
        .paginate(opts(p.cursor ?? null, 1, p.endCursor));
      if (await splitPage(ctx, p, page))
        return finiteResult(await overview(ctx));
      if (!page.page.length) {
        if (await advancePage(ctx, p, page, 0)) {
          if ((p.tableIndex ?? 0) === PRIMARY_TABLES.length - 1)
            await ctx.db.patch(p._id, { complete: true, phase: "done" });
          else
            await ctx.db.patch(p._id, {
              tableIndex: (p.tableIndex ?? 0) + 1,
              cursor: null,
              endCursor: null,
              splitTail: null,
            });
        }
        return finiteResult(await overview(ctx));
      }
      const row = page.page[0],
        id = await ctx.db.insert("cortexReferenceState", {
          key: workKey,
          generation: s.generation,
          kind: "source",
          writerManifestHash: WRITER_MANIFEST_HASH,
          status: "building",
          sourceId: row._id,
          sourceTable: table,
          sourceDigest: currentDigest(table, row),
          offset: 0,
          cursor: page.continueCursor,
          complete: page.isDone,
        });
      work = await ctx.db.get(id);
    }
    if (!work || work.sourceTable !== table || !work.sourceId)
      lifecycleFailure("REFERENCE_PROGRESS_DRIFT");
    const id = ctx.db.normalizeId(table, work.sourceId);
    if (!id) lifecycleFailure("REFERENCE_DOCUMENT_TABLE");
    const row = await ctx.db.get(id);
    if (row) {
      const changed = currentDigest(table, row) !== work.sourceDigest,
        offset = changed ? 0 : (work.offset ?? 0),
        target = await documentTarget(ctx, table, row, s.generation),
        slots = extractReferenceSlots(table, row),
        end = Math.min(slots.length, offset + 32);
      if (changed)
        await ctx.db.patch(work._id, {
          sourceDigest: currentDigest(table, row),
          offset: 0,
        });
      await reserveLifecycle(
        ctx,
        Math.max(0, end - offset) * 4096,
        Math.max(0, end - offset) * 6144 + 4096,
        Math.max(0, end - offset) * 3 + 3,
      );
      for (const spec of slots.slice(offset, end))
        await reconcileSlot(ctx, target, row, spec, s.generation, true);
      if (end < slots.length) {
        await ctx.db.patch(work._id, {
          offset: end,
          checkpointDigest: digest({
            source: row._id,
            digest: currentDigest(table, row),
            offset: end,
          }),
        });
        return finiteResult(await overview(ctx));
      }
      await finishSource(ctx, s, table, row, target);
    }
    if (
      await advancePage(
        ctx,
        p,
        { continueCursor: work.cursor ?? "", isDone: work.complete ?? false },
        row ? 1 : 0,
      )
    ) {
      if ((p.tableIndex ?? 0) === PRIMARY_TABLES.length - 1)
        await ctx.db.patch(p._id, { complete: true, phase: "done" });
      else
        await ctx.db.patch(p._id, {
          tableIndex: (p.tableIndex ?? 0) + 1,
          cursor: null,
          endCursor: null,
          splitTail: null,
        });
    }
    await ctx.db.delete(work._id);
    return finiteResult(await overview(ctx));
  },
});
export const beginFinalization = internalMutation({
  args: {},
  handler: async (ctx) => {
    const s = await admitted(ctx, "building"),
      p = await stateRow(ctx, `backfill:${s.generation}`);
    if (!p?.complete) lifecycleFailure("REFERENCE_BACKFILL_INCOMPLETE");
    await ctx.db.patch(s._id, { status: "finalizing" });
    await progress(ctx, { ...s, status: "finalizing" }, "validation");
    return finiteResult(await overview(ctx));
  },
});
async function validateSource(
  ctx: MutationCtx,
  s: State,
  table: Primary,
  row: Record<string, unknown>,
) {
  const target = await ctx.db
    .query("cortexReferenceTargets")
    .withIndex("by_document", (q) =>
      q.eq("table", table).eq("documentId", String(row._id)),
    )
    .take(2)
    .then((rows) => uniqueReference(rows));
  if (
    !target ||
    target.state !== "live" ||
    target.preparedGeneration !== s.generation ||
    target.referenceDigest !== referenceDigest(table, row) ||
    target.ownershipDigest !== ownership(table, row).ownershipDigest
  )
    lifecycleFailure("REFERENCE_SOURCE_DRIFT");
  if (["memories", "facts", "contexts", "conversations", "memorySpaces", "immutable", "mutable", "artifacts"].includes(table) &&
    (!Number.isSafeInteger(target.sourceRevision) || target.sourceRevision! < 1)) lifecycleFailure("GRAPH_SOURCE_REVISION_NOT_READY");
  if (table === "memories" && !hasMemoryVectorScope(row as Doc<"memories">)) lifecycleFailure("MEMORY_VECTOR_SCOPE_NOT_READY");
  const specs = extractReferenceSlots(table, row),
    edges = await ctx.db
      .query("cortexReferenceEdges")
      .withIndex("by_source", (q) => q.eq("sourceTargetId", target._id))
      .collect();
  if (edges.length !== specs.length) lifecycleFailure("REFERENCE_EDGE_DRIFT");
  for (const spec of specs) {
    const edge = await ctx.db
      .query("cortexReferenceEdges")
      .withIndex("by_source_role", (q) =>
        q
          .eq("sourceTargetId", target._id)
          .eq("role", spec.role)
          .eq("slot", spec.slot),
      )
      .take(2)
      .then((rows) => uniqueReference(rows));
    if (
      !edge ||
      edge.logicalDigest !== slotDigest(spec) ||
      edge.generation !== s.generation ||
      edge.sourceReferenceRevision !== target.revision
    )
      lifecycleFailure("REFERENCE_EDGE_DRIFT");
    if (
      spec.storageId &&
      (edge.kind !== "storage" ||
        edge.countedGeneration !== s.generation ||
        edge.occurrenceCount !== spec.occurrences)
    )
      lifecycleFailure("REFERENCE_COUNTER_DRIFT");
  }
}
export const advanceValidation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const s = await admitted(ctx, "finalizing"),
      p = await progress(ctx, s, "validation");
    if (p.complete) return finiteResult(await overview(ctx));
    if (p.phase === "sources") {
      const table = nextTable(p.tableIndex ?? 0),
        page = await ctx.db
          .query(table)
          .paginate(opts(p.cursor ?? null, 32, p.endCursor));
      if (await splitPage(ctx, p, page))
        return finiteResult(await overview(ctx));
      for (const row of page.page) await validateSource(ctx, s, table, row);
      if (await advancePage(ctx, p, page, page.page.length)) {
        if ((p.tableIndex ?? 0) === PRIMARY_TABLES.length - 1)
          await ctx.db.patch(p._id, {
            phase: "edges",
            cursor: null,
            endCursor: null,
            splitTail: null,
          });
        else
          await ctx.db.patch(p._id, {
            tableIndex: (p.tableIndex ?? 0) + 1,
            cursor: null,
            endCursor: null,
            splitTail: null,
          });
      }
    } else if (p.phase === "edges") {
      const page = await ctx.db
        .query("cortexReferenceEdges")
        .paginate(opts(p.cursor ?? null, 128, p.endCursor));
      if (await splitPage(ctx, p, page))
        return finiteResult(await overview(ctx));
      for (const e of page.page) {
        const source = await ctx.db.get(e.sourceTargetId);
        if (!source) {
          await removeEdge(ctx, e, s.generation);
          continue;
        }
        if (source.state !== "live") {
          if (e.kind !== "authority") await removeEdge(ctx, e, s.generation);
          else await ctx.db.patch(e._id, { generation: s.generation });
          continue;
        }
        if (!source.table || !source.documentId)
          lifecycleFailure("REFERENCE_TARGET_DRIFT");
        const id = ctx.db.normalizeId(source.table, source.documentId),
          row = id ? await ctx.db.get(id) : null;
        if (!row) {
          if (e.kind !== "authority") await removeEdge(ctx, e, s.generation);
          await ctx.db.patch(source._id, {
            state: "missing",
            scopeKnown: false,
            ownerState: "unknown",
            owners: [],
          });
          continue;
        }
        if (e.generation !== s.generation)
          lifecycleFailure("REFERENCE_EDGE_DRIFT");
        const unique = await ctx.db
          .query("cortexReferenceEdges")
          .withIndex("by_source_role", (q) =>
            q
              .eq("sourceTargetId", e.sourceTargetId)
              .eq("role", e.role)
              .eq("slot", e.slot),
          )
          .take(2)
          .then((rows) => uniqueReference(rows));
        if (!unique) lifecycleFailure("REFERENCE_EDGE_DRIFT");
      }
      if (await advancePage(ctx, p, page, page.page.length))
        await ctx.db.patch(p._id, {
          phase: "targets",
          cursor: null,
          endCursor: null,
          splitTail: null,
        });
    } else if (p.phase === "targets") {
      const page = await ctx.db
        .query("cortexReferenceTargets")
        .paginate(opts(p.cursor ?? null, 32, p.endCursor));
      if (await splitPage(ctx, p, page))
        return finiteResult(await overview(ctx));
      for (const t of page.page) {
        const unique = await ctx.db
          .query("cortexReferenceTargets")
          .withIndex("by_key", (q) => q.eq("key", t.key))
          .take(2)
          .then((rows) => uniqueReference(rows));
        if (!unique) lifecycleFailure("REFERENCE_TARGET_DRIFT");
        if (t.kind === "storage") {
          if (!t.storageId) lifecycleFailure("REFERENCE_TARGET_DRIFT");
          await storageTarget(ctx, t.storageId, s.generation, false);
        } else if (t.state !== "live") await pruneOrphanIdentity(ctx, t._id);
        else {
          if (!t.table || !t.documentId)
            lifecycleFailure("REFERENCE_TARGET_DRIFT");
          const id = ctx.db.normalizeId(t.table, t.documentId);
          if (!id || !(await ctx.db.get(id)))
            await ctx.db.patch(t._id, {
              state: "missing",
              scopeKnown: false,
              ownerState: "unknown",
              owners: [],
            });
        }
      }
      if (await advancePage(ctx, p, page, page.page.length))
        await ctx.db.patch(p._id, {
          phase: "counters",
          cursor: null,
          endCursor: null,
          splitTail: null,
        });
    } else if (p.phase === "counters") {
      const key = `counter:${s.generation}`;
      let audit = await stateRow(ctx, key);
      if (!audit) {
        const page = await ctx.db
          .query("cortexReferenceTargets")
          .paginate(opts(p.cursor ?? null, 1, p.endCursor));
        if (await splitPage(ctx, p, page))
          return finiteResult(await overview(ctx));
        const target = page.page[0];
        if (!target || target.kind !== "storage") {
          if (await advancePage(ctx, p, page, page.page.length))
            await ctx.db.patch(p._id, { phase: "done", complete: true });
          return finiteResult(await overview(ctx));
        }
        const id = await ctx.db.insert("cortexReferenceState", {
          key,
          generation: s.generation,
          kind: "counter",
          writerManifestHash: WRITER_MANIFEST_HASH,
          status: "finalizing",
          targetId: target._id,
          cursor: null,
          refCount: 0,
          occurrenceCount: 0,
          sourceId: page.continueCursor,
          complete: page.isDone,
        });
        audit = await ctx.db.get(id);
        return finiteResult(await overview(ctx));
      }
      if (!audit?.targetId) lifecycleFailure("REFERENCE_PROGRESS_DRIFT");
      const page = await ctx.db
        .query("cortexReferenceEdges")
        .withIndex("by_target", (q) => q.eq("targetTargetId", audit!.targetId))
        .paginate(opts(audit.cursor ?? null, 128, audit.endCursor));
      if (await splitPage(ctx, audit, page))
        return finiteResult(await overview(ctx));
      let refs = audit.refCount ?? 0,
        occ = audit.occurrenceCount ?? 0;
      for (const e of page.page) {
        if (
          e.kind !== "storage" ||
          e.countedGeneration !== s.generation ||
          !Number.isSafeInteger(e.occurrenceCount) ||
          e.occurrenceCount! < 1
        )
          lifecycleFailure("REFERENCE_COUNTER_DRIFT");
        refs++;
        occ += e.occurrenceCount!;
      }
      if (!Number.isSafeInteger(refs) || !Number.isSafeInteger(occ))
        lifecycleFailure("REFERENCE_COUNTER_DRIFT");
      const done = await advancePage(ctx, audit, page, page.page.length);
      await ctx.db.patch(audit._id, { refCount: refs, occurrenceCount: occ });
      if (done) {
        const target = await ctx.db.get(audit.targetId);
        if (
          !target ||
          target.counterGeneration !== s.generation ||
          target.refCount !== refs ||
          target.occurrenceCount !== occ
        )
          lifecycleFailure("REFERENCE_COUNTER_DRIFT");
        if (
          await advancePage(
            ctx,
            p,
            {
              continueCursor: audit.sourceId ?? "",
              isDone: audit.complete ?? false,
            },
            1,
          )
        )
          await ctx.db.patch(p._id, { phase: "done", complete: true });
        await ctx.db.delete(audit._id);
      }
    } else lifecycleFailure("REFERENCE_PROGRESS_DRIFT");
    await reserveLifecycle(ctx, 0);
    return finiteResult(await overview(ctx));
  },
});
export const activateGeneration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const s = await admitted(ctx, "finalizing"),
      p = await stateRow(ctx, `validation:${s.generation}`),
      b = await stateRow(ctx, `backfill:${s.generation}`);
    if (
      !p?.complete ||
      p.phase !== "done" ||
      !b?.complete ||
      p.writerManifestHash !== WRITER_MANIFEST_HASH
    )
      lifecycleFailure("REFERENCE_VALIDATION_INCOMPLETE");
    await ctx.db.patch(s._id, { status: "ready" });
    return finiteResult(await overview(ctx));
  },
});
export const abortFinalization = internalMutation({
  args: {},
  handler: async (ctx) => {
    const s = await admitted(ctx, "finalizing"),
      generation = crypto.randomUUID();
    await ctx.db.patch(s._id, {
      status: "building",
      generation,
      unresolvedCount: 0,
      legacyUnknownCount: 0,
      missingOrAmbiguousCount: 0,
    });
    await progress(ctx, { ...s, generation, status: "building" }, "backfill");
    return finiteResult(await overview(ctx));
  },
});
