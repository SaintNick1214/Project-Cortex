import { graphTables, captureGraphChange } from "./graphSync";
import { memoryVectorScopeKey } from "./memoryVectorScope";
/** Transactional derived references. Arbitrary metadata and export associations are not ownership. */
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { WithoutSystemFields } from "convex/server";
import { byteSize, digest } from "./factHistoryProvenance";

export const PRIMARY_TABLES = [
  "conversations",
  "conversationShares",
  "conversationSnapshots",
  "immutable",
  "mutable",
  "memories",
  "facts",
  "factHistory",
  "memorySpaces",
  "contexts",
  "agents",
  "sessions",
  "governancePolicies",
  "governanceEnforcement",
  "graphSyncQueue",
  "artifacts",
  "attachments",
] as const;
export type Primary = (typeof PRIMARY_TABLES)[number];
export const WRITER_MANIFEST_HASH =
  "98f9e5f9e715380e29cb2f24178e533ea0409d7d027acf5339eb3df75c897f66";
export const CONTROL_KEY = "reference-lifecycle-v1";
export type Reader = QueryCtx | MutationCtx;
type Row = Record<string, unknown>;
type Target = Doc<"cortexReferenceTargets">;
export type Edge = Doc<"cortexReferenceEdges">;
type Role = Edge["role"];
export type ReferenceSlot = {
  role: Role;
  slot: string;
  table?: Primary;
  logical?: string;
  physical?: string;
  space?: string;
  qualifier?: string;
  authority?: boolean;
  storageId?: Id<"_storage">;
  occurrences?: number;
  slots?: string[];
};
type CaptureOptions = {
  cloneFrom?: Id<Primary>;
  physicalConversation?: Id<"conversations">;
};
const MIB = 1024 * 1024;
export function lifecycleFailure(code: string): never {
  throw new ConvexError({
    code,
    message:
      code === "REFERENCE_NOT_READY"
        ? "Reference coverage is not ready. Run cortex schema migrate on this deployment."
        : code,
  });
}
const obj = (x: unknown): Row =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Row) : {};
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const text = (x: unknown): string | undefined =>
  typeof x === "string" ? x : undefined;
const strings = (x: unknown): string[] =>
  arr(x).filter((v): v is string => typeof v === "string");
const natural = (x: unknown): number => {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < 0)
    lifecycleFailure("REFERENCE_COUNTER_DRIFT");
  return x;
};
export async function reserveLifecycle(
  ctx: Reader,
  read: number,
  write = 0,
  documents = 0,
): Promise<void> {
  const m = await ctx.meta.getTransactionMetrics();
  if (
    read < 0 ||
    write < 0 ||
    m.bytesRead.used + read > 12 * MIB ||
    m.bytesWritten.used + write > 12 * MIB ||
    m.bytesRead.remaining < read ||
    m.bytesWritten.remaining < write ||
    m.documentsWritten.remaining < documents
  )
    lifecycleFailure("REFERENCE_NATIVE_BUDGET");
}
/** Fixed derived identities must never silently select one of duplicate rows. */
export function uniqueReference<T>(rows: T[]): T | null {
  if (rows.length > 1) lifecycleFailure("REFERENCE_DUPLICATE_IDENTITY");
  return rows[0] ?? null;
}
export async function lifecycleControl(ctx: Reader) {
  return ctx.db
    .query("cortexReferenceState")
    .withIndex("by_key", (q) => q.eq("key", CONTROL_KEY))
    .take(2)
    .then((rows) => uniqueReference(rows));
}
export async function requireLifecycleReady(ctx: Reader) {
  const s = await lifecycleControl(ctx);
  if (
    !s ||
    s.writerManifestHash !== WRITER_MANIFEST_HASH ||
    s.status !== "ready" ||
    s.unresolvedCount === undefined
  )
    lifecycleFailure("REFERENCE_NOT_READY");
  return s;
}
export async function ensureLifecycleState(ctx: MutationCtx) {
  let s = await lifecycleControl(ctx);
  if (s && s.writerManifestHash !== WRITER_MANIFEST_HASH)
    lifecycleFailure("REFERENCE_WRITER_VERSION");
  if (!s) {
    let existing = false;
    for (const table of PRIMARY_TABLES) {
      if (await ctx.db.query(table).first()) {
        existing = true;
        break;
      }
    }
    await reserveLifecycle(ctx, 0, 2048, 1);
    const id = await ctx.db.insert("cortexReferenceState", {
      key: CONTROL_KEY,
      kind: "control",
      generation: crypto.randomUUID(),
      writerManifestHash: WRITER_MANIFEST_HASH,
      unresolvedCount: 0,
      legacyUnknownCount: 0,
      missingOrAmbiguousCount: 0,
      status: existing ? "building" : "ready",
    });
    s = await ctx.db.get(id);
  }
  if (!s) lifecycleFailure("REFERENCE_STATE_MISSING");
  return s;
}
export function identifyDocument(
  ctx: Reader,
  id: string,
): { table: Primary; id: Id<Primary> } {
  for (const table of PRIMARY_TABLES) {
    const normalized = ctx.db.normalizeId(table, id);
    if (normalized) return { table, id: normalized };
  }
  return lifecycleFailure("REFERENCE_DOCUMENT_TABLE");
}
export function ownership(table: Primary, row: Row) {
  const p = obj(row.participants),
    collaborators = arr(row.collaborators).map(obj);
  let owners: string[] = [],
    conflict = false;
  if (table === "conversations") {
    owners = [
      ...(text(p.userId) ? [p.userId as string] : []),
      ...strings(p.userIds),
    ];
    owners.push(
      ...(text(obj(row.collaborativeSettings).ownerUserId)
        ? [obj(row.collaborativeSettings).ownerUserId as string]
        : []),
    );
  } else if (table === "immutable")
    owners =
      row.type === "user" && text(row.id)
        ? [row.id as string]
        : text(row.userId)
          ? [row.userId as string]
          : [];
  else if (table === "conversationSnapshots")
    owners = text(row.createdBy) ? [row.createdBy as string] : [];
  else if (table === "factHistory")
    owners =
      row.scopeVersion === 1 && row.ownerKnown === true && text(row.ownerUserId)
        ? [row.ownerUserId as string]
        : [];
  else if (table === "memorySpaces")
    owners = arr(row.participants)
      .map(obj)
      .filter((x) => x.type === "user" && x.role === "owner")
      .map((x) => text(x.id))
      .filter((x): x is string => x !== undefined);
  else if (table !== "conversationShares")
    owners = text(row.userId) ? [row.userId as string] : [];
  if (table === "artifacts") {
    owners.push(
      ...collaborators
        .filter((x) => x.type === "user" && x.role === "owner")
        .map((x) => text(x.id))
        .filter((x): x is string => x !== undefined),
    );
    conflict ||= collaborators.some(
      (x) => x.type === "agent" && x.role === "owner",
    );
  }
  conflict ||= Boolean(row.agentId && owners.length);
  owners = [...new Set(owners)].sort();
  const ownerState = conflict
    ? ("conflicted" as const)
    : owners.length === 1
      ? ("explicit" as const)
      : owners.length > 1
        ? ("shared" as const)
        : ("unowned" as const);
  const snapshot = {
    tenantId: text(row.tenantId),
    memorySpaceId: text(row.memorySpaceId),
    ownerState,
    owners,
  };
  const ownershipFields = {
    snapshot,
    collaborators: collaborators.map((x) => ({
      id: x.id,
      type: x.type,
      role: x.role,
    })),
    approvedParticipants: strings(
      obj(row.collaborativeSettings).approvedParticipants,
    ).sort(),
    access: arr(row.grantedAccess)
      .map(obj)
      .map((x) => ({ memorySpaceId: x.memorySpaceId, scope: x.scope })),
  };
  return { ...snapshot, ownershipDigest: digest(ownershipFields) };
}
export function naturalIdentity(table: Primary, row: Row) {
  const fields: Record<Primary, string> = {
    conversations: "conversationId",
    conversationShares: "shareId",
    conversationSnapshots: "snapshotId",
    immutable: "id",
    mutable: "key",
    memories: "memoryId",
    facts: "factId",
    factHistory: "eventId",
    memorySpaces: "memorySpaceId",
    contexts: "contextId",
    agents: "agentId",
    sessions: "sessionId",
    governancePolicies: "_id",
    governanceEnforcement: "_id",
    graphSyncQueue: "_id",
    artifacts: "artifactId",
    attachments: "attachmentId",
  };
  return digest({
    table,
    tenantId: text(row.tenantId),
    space:
      table === "contexts" || table === "memorySpaces" || table === "sessions"
        ? undefined
        : text(row.memorySpaceId),
    logical: text(row[fields[table]]),
    qualifier:
      table === "immutable"
        ? text(row.type)
        : table === "mutable"
          ? text(row.namespace)
          : undefined,
  });
}
/** Fixed typed schema slots only. Storage occurrences include every actual retained field. */
export function extractReferenceSlots(
  table: Primary,
  row: Row,
): ReferenceSlot[] {
  const slots: ReferenceSlot[] = [],
    tenantSpace = text(row.memorySpaceId);
  const add = (
    role: Role,
    slot: string,
    target: Primary,
    logical: unknown,
    authority = false,
    physical?: unknown,
    space: string | undefined = tenantSpace,
    qualifier?: string,
  ) => {
    if (typeof logical !== "string" && typeof physical !== "string") return;
    slots.push({
      role,
      slot,
      table: target,
      logical: text(logical),
      physical: text(physical),
      space,
      qualifier,
      authority,
    });
  };
  const ref = (field: string) => obj(row[field]);
  if (typeof row.memorySpaceId === "string" && table !== "memorySpaces")
    add(
      "space",
      "memorySpaceId",
      "memorySpaces",
      row.memorySpaceId,
      false,
      table === "factHistory" ? row.sourceMemorySpaceId : undefined,
      undefined,
    );
  if (table === "memories") {
    add(
      "conversation",
      "conversationRef",
      "conversations",
      ref("conversationRef").conversationId,
      row.sourceType !== "a2a",
    );
    add("fact", "factsRef", "facts", ref("factsRef").factId, true);
    add(
      "immutable",
      "immutableRef",
      "immutable",
      ref("immutableRef").id,
      false,
      undefined,
      undefined,
      text(ref("immutableRef").type),
    );
    add(
      "mutable",
      "mutableRef",
      "mutable",
      ref("mutableRef").key,
      false,
      undefined,
      undefined,
      text(ref("mutableRef").namespace),
    );
  }
  if (table === "facts") {
    add(
      "conversation",
      "sourceRef.conversationId",
      "conversations",
      ref("sourceRef").conversationId,
      true,
    );
    add(
      "memory",
      "sourceRef.memoryId",
      "memories",
      ref("sourceRef").memoryId,
      true,
    );
  }
  if (table === "facts" || table === "factHistory") {
    for (const field of ["supersedes", "supersededBy"] as const) {
      const endpoint = ref(field + "Endpoint");
      add(
        table === "facts"
          ? field === "supersedes"
            ? "fact-supersedes"
            : "fact-supersededBy"
          : field === "supersedes"
            ? "history-supersedes"
            : "history-supersededBy",
        field,
        "facts",
        row[field],
        false,
        endpoint.state === "known" &&
          endpoint.scopeVersion === 1 &&
          endpoint.tenantId === row.tenantId &&
          endpoint.memorySpaceId === row.memorySpaceId &&
          endpoint.logicalFactId === row[field]
          ? endpoint.factDocumentId
          : undefined,
      );
    }
  }
  if (table === "factHistory") {
    add(
      "history-source",
      "sourceFactId",
      "facts",
      row.factId,
      false,
      row.scopeVersion === 1 ? row.sourceFactId : undefined,
    );
    add(
      "history-memory",
      "sourceMemoryId",
      "memories",
      undefined,
      false,
      row.scopeVersion === 1 ? row.sourceMemoryId : undefined,
    );
    add(
      "history-conversation",
      "sourceConversationId",
      "conversations",
      undefined,
      false,
      row.scopeVersion === 1 ? row.sourceConversationId : undefined,
    );
    arr(row.affectedFactIds).forEach((x) =>
      add(
        "history-affected",
        "affectedFactIds:" + String(x),
        "facts",
        undefined,
        false,
        x,
      ),
    );
    add(
      "history-result",
      "resultFactId",
      "facts",
      undefined,
      false,
      row.resultFactId,
    );
    const pending = obj(obj(row.pendingRichEvent).payload);
    if (pending.scopeVersion === 1) {
      add(
        "history-source",
        "pending.sourceFactId",
        "facts",
        pending.factId,
        false,
        pending.sourceFactId,
      );
      add(
        "history-memory",
        "pending.sourceMemoryId",
        "memories",
        undefined,
        false,
        pending.sourceMemoryId,
      );
      add(
        "history-conversation",
        "pending.sourceConversationId",
        "conversations",
        undefined,
        false,
        pending.sourceConversationId,
      );
      add(
        "history-space",
        "pending.sourceMemorySpaceId",
        "memorySpaces",
        pending.memorySpaceId,
        false,
        pending.sourceMemorySpaceId,
        undefined,
      );
      arr(pending.affectedFactIds).forEach((x) =>
        add(
          "history-affected",
          "pending.affectedFactIds:" + String(x),
          "facts",
          undefined,
          false,
          x,
        ),
      );
      add(
        "history-result",
        "pending.resultFactId",
        "facts",
        undefined,
        false,
        pending.resultFactId,
      );
      for (const field of ["supersedes", "supersededBy"] as const) {
        const endpoint = obj(pending[field + "Endpoint"]);
        if (
          endpoint.state === "known" &&
          endpoint.scopeVersion === 1 &&
          endpoint.tenantId === row.tenantId &&
          endpoint.memorySpaceId === row.memorySpaceId &&
          endpoint.logicalFactId === pending[field]
        )
          add(
            field === "supersedes"
              ? "history-supersedes"
              : "history-supersededBy",
            "pending." + field,
            "facts",
            pending[field],
            false,
            endpoint.factDocumentId,
          );
      }
    }
  }
  if (table === "contexts") {
    add(
      "conversation",
      "conversationRef",
      "conversations",
      ref("conversationRef").conversationId,
      true,
    );
    add(
      "context-parent",
      "parentId",
      "contexts",
      row.parentId,
      false,
      undefined,
      undefined,
    );
    add(
      "context-root",
      "rootId",
      "contexts",
      row.rootId,
      false,
      undefined,
      undefined,
    );
    strings(row.childIds).forEach((x) =>
      add(
        "context-child",
        "childIds:" + x,
        "contexts",
        x,
        false,
        undefined,
        undefined,
      ),
    );
    strings(row.participants).forEach((x) =>
      add(
        "participant-space",
        "participants:" + x,
        "memorySpaces",
        x,
        false,
        undefined,
        undefined,
      ),
    );
    arr(row.grantedAccess)
      .map(obj)
      .forEach((x) =>
        add(
          "access-space",
          "grantedAccess:" + String(x.memorySpaceId),
          "memorySpaces",
          x.memorySpaceId,
          false,
          undefined,
          undefined,
        ),
      );
  }
  if (table === "artifacts") {
    add(
      "conversation",
      "conversationRef",
      "conversations",
      ref("conversationRef").conversationId,
      true,
    );
    arr(row.memoryRefs)
      .map(obj)
      .forEach((x) =>
        add(
          "memory",
          "memoryRefs:" + String(x.memoryId),
          "memories",
          x.memoryId,
          true,
        ),
      );
    add(
      "session",
      "streamingMetadata.sessionId",
      "sessions",
      ref("streamingMetadata").sessionId,
      false,
      undefined,
      undefined,
    );
  }
  if (table === "attachments") {
    add("conversation", "conversationId", "conversations", row.conversationId);
    add("memory", "memoryId", "memories", row.memoryId);
    add("artifact", "artifactId", "artifacts", row.artifactId);
  }
  if (table === "conversationShares") {
    add(
      "share-source",
      "conversationId",
      "conversations",
      row.conversationId,
      false,
      undefined,
      text(row.sourceMemorySpaceId),
    );
    add(
      "space",
      "sourceMemorySpaceId",
      "memorySpaces",
      row.sourceMemorySpaceId,
      false,
      undefined,
      undefined,
    );
    add(
      "recipient-space",
      "recipientMemorySpaceId",
      "memorySpaces",
      row.grantType === "space" ? row.grantedTo : undefined,
      false,
      undefined,
      undefined,
    );
  }
  if (table === "conversationSnapshots")
    add(
      "snapshot-source",
      "conversationId",
      "conversations",
      row.conversationId,
    );
  if (table === "conversations" || table === "conversationSnapshots") {
    const ids = new Set<string>();
    for (const value of arr(row.messages)) {
      const message = obj(value),
        id = text(message.id);
      if (!id || ids.has(id)) lifecycleFailure("REFERENCE_DUPLICATE_SLOT");
      ids.add(id);
      strings(message.attachmentIds).forEach((x, index) =>
        add(
          "attachment",
          `messages:${id}:attachment:${index}`,
          "attachments",
          x,
        ),
      );
    }
    strings(obj(row.participants).memorySpaceIds).forEach((x) =>
      add(
        "participant-space",
        "participants.memorySpaceIds:" + x,
        "memorySpaces",
        x,
        false,
        undefined,
        undefined,
      ),
    );
  }
  const blobs = new Map<string, string[]>();
  const file = (x: unknown, slot: string) => {
    const storageId = text(obj(x).storageId);
    if (storageId) {
      const previous = blobs.get(storageId) ?? [];
      previous.push(slot);
      blobs.set(storageId, previous);
    }
  };
  if (table === "artifacts") {
    file(row.fileRef, "fileRef");
    const versions = new Set<number>();
    for (const value of arr(row.versionHistory)) {
      const version = obj(value);
      if (
        typeof version.version !== "number" ||
        !Number.isSafeInteger(version.version) ||
        version.version < 1 ||
        versions.has(version.version)
      )
        lifecycleFailure("REFERENCE_DUPLICATE_SLOT");
      versions.add(version.version);
      file(version.fileRef, "versionHistory:" + version.version);
    }
  }
  if (table === "attachments" && text(row.storageId))
    file({ storageId: row.storageId }, "storageId");
  for (const [storageId, locations] of blobs)
    slots.push({
      role: "storage",
      slot: storageId,
      storageId: storageId as Id<"_storage">,
      occurrences: locations.length,
      slots: locations.sort(),
    });
  const keys = new Set<string>();
  for (const s of slots) {
    const key = s.role + ":" + s.slot;
    if (keys.has(key)) lifecycleFailure("REFERENCE_DUPLICATE_SLOT");
    keys.add(key);
  }
  return slots;
}
export const referenceDigest = (table: Primary, row: Row): string =>
  digest(extractReferenceSlots(table, row));
export async function documentTarget(
  ctx: MutationCtx,
  table: Primary,
  row: Row,
  generation: string,
): Promise<Target> {
  const id = text(row._id);
  if (!id || !ctx.db.normalizeId(table, id))
    lifecycleFailure("REFERENCE_DOCUMENT_TABLE");
  let target = await ctx.db
    .query("cortexReferenceTargets")
    .withIndex("by_key", (q) => q.eq("key", `document:${table}:${id}`))
    .take(2)
    .then((rows) => uniqueReference(rows));
  if (!target) {
    const t = await ctx.db.insert("cortexReferenceTargets", {
      key: `document:${table}:${id}`,
      kind: "document",
      lifecycleVersion: 1,
      generation,
      revision: 1,
      sourceRevision: table in graphTables ? 1 : undefined,
      state: "live",
      table,
      documentId: id,
      scopeKnown: true,
      ...ownership(table, row),
      naturalKeyDigest: naturalIdentity(table, row),
      ownershipRevision: 1,
      referenceDigest: referenceDigest(table, row),
    });
    target = await ctx.db.get(t);
  }
  if (
    !target ||
    target.kind !== "document" ||
    target.documentId !== id ||
    target.table !== table
  )
    lifecycleFailure("REFERENCE_TARGET_DRIFT");
  // Trusted migration/current-write baseline; this is not historical content-version evidence.
  if (table in graphTables && target.sourceRevision === undefined) {
    await reserveLifecycle(ctx, 0, 4096, 1);
    await ctx.db.patch(target._id, {sourceRevision: 1});
    target = (await ctx.db.get(target._id))!;
  }
  const currentOwner = ownership(table, row);
  if (target.state !== "live" || !target.scopeKnown)
    lifecycleFailure("SOURCE_PROVENANCE_UNRESOLVED");
  if (target.ownershipDigest !== currentOwner.ownershipDigest) {
    await ctx.db.patch(target._id, {
      ...currentOwner,
      ownershipRevision: (target.ownershipRevision ?? 1) + 1,
      revision: target.revision + 1,
      naturalKeyDigest: naturalIdentity(table, row),
    });
    target = (await ctx.db.get(target._id))!;
  }
  return target;
}
export async function storageTarget(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  generation: string,
  introduction: boolean,
): Promise<Target> {
  const normalized = ctx.db.system.normalizeId("_storage", storageId);
  if (!normalized) lifecycleFailure("REFERENCE_STORAGE_ID");
  let target = await ctx.db
    .query("cortexReferenceTargets")
    .withIndex("by_key", (q) => q.eq("key", `storage:${storageId}`))
    .take(2)
    .then((rows) => uniqueReference(rows));
  const metadata = await ctx.db.system.get("_storage", normalized);
  if (introduction && (target?.state === "deleted" || !metadata))
    lifecycleFailure("REFERENCE_STORAGE_MISSING");
  if (!target) {
    const id = await ctx.db.insert("cortexReferenceTargets", {
      key: `storage:${storageId}`,
      kind: "storage",
      lifecycleVersion: 1,
      generation,
      revision: 1,
      state: metadata ? "live" : "missing",
      storageId: normalized,
      refCount: 0,
      occurrenceCount: 0,
      counterGeneration: generation,
    });
    target = await ctx.db.get(id);
  }
  if (!target || target.kind !== "storage" || target.storageId !== storageId)
    lifecycleFailure("REFERENCE_TARGET_DRIFT");
  natural(target.refCount);
  natural(target.occurrenceCount);
  if (target.counterGeneration !== generation) {
    await ctx.db.patch(target._id, {
      counterGeneration: generation,
      generation,
      refCount: 0,
      occurrenceCount: 0,
    });
    target = {
      ...target,
      counterGeneration: generation,
      generation,
      refCount: 0,
      occurrenceCount: 0,
    };
  }
  return target;
}
async function resolveBirth(
  ctx: MutationCtx,
  row: Row,
  spec: ReferenceSlot,
  generation: string,
  options: CaptureOptions,
): Promise<Target | null> {
  if (!spec.table) return null;
  const physical =
    spec.role === "conversation" &&
    options.physicalConversation &&
    row.sourceType === "a2a"
      ? options.physicalConversation
      : spec.physical;
  let targetRow: Row | null = null;
  if (physical) {
    const id = ctx.db.normalizeId(spec.table, physical);
    if (!id) lifecycleFailure("REFERENCE_DOCUMENT_TABLE");
    targetRow = await ctx.db.get(id);
    if (!targetRow) {
      const existing = await ctx.db
        .query("cortexReferenceTargets")
        .withIndex("by_key", (q) => q.eq("key", `document:${spec.table}:${id}`))
        .take(2)
        .then((rows) => uniqueReference(rows));
      if (existing) {
        if (
          existing.scopeKnown &&
          (existing.tenantId !== row.tenantId ||
            (spec.space !== undefined && existing.memorySpaceId !== spec.space))
        )
          return null;
        return existing;
      }
      const targetId = await ctx.db.insert("cortexReferenceTargets", {
        key: `document:${spec.table}:${id}`,
        kind: "document",
        lifecycleVersion: 1,
        generation,
        revision: 1,
        state: "missing",
        table: spec.table,
        documentId: id,
        scopeKnown: false,
        ownerState: "unknown",
        owners: [],
        ownershipRevision: 1,
      });
      return ctx.db.get(targetId);
    }
  } else if (spec.logical) {
    const indexes: Partial<Record<Primary, [string, string]>> = {
      conversations: ["by_tenant_conversationId", "conversationId"],
      memories: ["by_memoryId", "memoryId"],
      facts: ["by_factId", "factId"],
      contexts: ["by_contextId", "contextId"],
      artifacts: ["by_artifactId", "artifactId"],
      attachments: ["by_attachmentId", "attachmentId"],
      memorySpaces: ["by_memorySpaceId", "memorySpaceId"],
      sessions: ["by_lifecycle_tenant_sessionId", "sessionId"],
      immutable: ["by_tenant_type_id", "id"],
      mutable: ["by_namespace_key", "key"],
    };
    // Each branch uses a server-owned literal index, never a caller table/index name.
    let candidates: Row[] = [];
    const tenantId = text(row.tenantId),
      logical = spec.logical;
    switch (spec.table) {
      case "conversations":
        candidates = await ctx.db
          .query("conversations")
          .withIndex("by_conversationId", (q) =>
            q.eq("conversationId", logical),
          )
          .filter((q) => q.eq(q.field("tenantId"), tenantId))
          .take(3);
        break;
      case "sessions":
        candidates = await ctx.db
          .query("sessions")
          .withIndex("by_lifecycle_tenant_sessionId", (q) =>
            q.eq("tenantId", tenantId).eq("sessionId", logical),
          )
          .take(3);
        break;
      case "immutable":
        candidates = await ctx.db
          .query("immutable")
          .withIndex("by_tenant_type_id", (q) =>
            q
              .eq("tenantId", tenantId)
              .eq("type", spec.qualifier ?? "")
              .eq("id", logical),
          )
          .take(3);
        break;
      case "mutable":
        candidates = await ctx.db
          .query("mutable")
          .withIndex("by_tenant_namespace_key", (q) =>
            q
              .eq("tenantId", tenantId)
              .eq("namespace", spec.qualifier ?? "")
              .eq("key", logical),
          )
          .collect();
        break;
      case "memories":
        candidates = await ctx.db
          .query("memories")
          .withIndex("by_memoryId", (q) => q.eq("memoryId", logical))
          .collect();
        break;
      case "facts":
        candidates = await ctx.db
          .query("facts")
          .withIndex("by_factId", (q) => q.eq("factId", logical))
          .collect();
        break;
      case "contexts":
        candidates = await ctx.db
          .query("contexts")
          .withIndex("by_tenant_contextId", (q) =>
            q.eq("tenantId", tenantId).eq("contextId", logical),
          )
          .collect();
        break;
      case "artifacts":
        candidates = await ctx.db
          .query("artifacts")
          .withIndex("by_tenant_artifactId", (q) =>
            q.eq("tenantId", tenantId).eq("artifactId", logical),
          )
          .collect();
        break;
      case "attachments":
        candidates = await ctx.db
          .query("attachments")
          .withIndex("by_tenant_attachmentId", (q) =>
            q.eq("tenantId", tenantId).eq("attachmentId", logical),
          )
          .collect();
        break;
      case "memorySpaces":
        candidates = await ctx.db
          .query("memorySpaces")
          .withIndex("by_tenant_memorySpaceId", (q) =>
            q.eq("tenantId", tenantId).eq("memorySpaceId", logical),
          )
          .collect();
        break;
      default:
        void indexes;
        return null;
    }
    candidates = candidates.filter(
      (x) =>
        x.tenantId === tenantId &&
        (spec.space === undefined || x.memorySpaceId === spec.space),
    );
    if (candidates.length !== 1) return null;
    targetRow = candidates[0];
  }
  if (
    !targetRow ||
    targetRow.tenantId !== row.tenantId ||
    (spec.space !== undefined &&
      targetRow.memorySpaceId !== spec.space &&
      row.sourceType !== "a2a")
  )
    return null;
  return documentTarget(ctx, spec.table, targetRow, generation);
}
export function slotDigest(spec: ReferenceSlot): string {
  return digest(spec);
}
export function slotHint(row: Row, spec: ReferenceSlot): string {
  return digest({
    table: spec.table,
    tenantId: text(row.tenantId),
    space: spec.space,
    logical: spec.logical,
    qualifier: spec.qualifier,
  });
}
async function unresolvedDelta(
  ctx: MutationCtx,
  generation: string,
  reason: string | undefined,
  delta: 1 | -1,
) {
  const state = await lifecycleControl(ctx);
  if (!state || state.generation !== generation)
    lifecycleFailure("REFERENCE_PROGRESS_DRIFT");
  const key =
    reason === "legacyBirthUnavailable"
      ? "legacyUnknownCount"
      : reason === "sourceMissingOrAmbiguous"
        ? "missingOrAmbiguousCount"
        : undefined;
  if (!key) lifecycleFailure("REFERENCE_EDGE_DRIFT");
  const total = natural(state.unresolvedCount ?? 0) + delta,
    byReason = natural(state[key] ?? 0) + delta;
  if (total < 0 || byReason < 0) lifecycleFailure("REFERENCE_COUNTER_DRIFT");
  await ctx.db.patch(state._id, { unresolvedCount: total, [key]: byReason });
}
export async function reconcileSlot(
  ctx: MutationCtx,
  source: Target,
  row: Row,
  spec: ReferenceSlot,
  generation: string,
  legacy: boolean,
  options: CaptureOptions = {},
) {
  const old = await ctx.db
    .query("cortexReferenceEdges")
    .withIndex("by_source_role", (q) =>
      q
        .eq("sourceTargetId", source._id)
        .eq("role", spec.role)
        .eq("slot", spec.slot),
    )
    .take(2)
    .then((rows) => uniqueReference(rows));
  const logicalDigest = slotDigest(spec);
  if (old && old.logicalDigest !== logicalDigest)
    await removeEdge(ctx, old, generation);
  let existing = old?.logicalDigest === logicalDigest ? old : null;
  if (!existing && options.cloneFrom) {
    const origin = identifyDocument(ctx, options.cloneFrom),
      actual = await ctx.db.get(origin.id);
    if (!actual) lifecycleFailure("REFERENCE_CLONE_SOURCE");
    const originTarget = await ctx.db
      .query("cortexReferenceTargets")
      .withIndex("by_document", (q) =>
        q.eq("table", origin.table).eq("documentId", options.cloneFrom),
      )
      .take(2)
      .then((rows) => uniqueReference(rows));
    const originSpec = extractReferenceSlots(origin.table, actual).find(
      (x) => x.role === spec.role && x.slot === spec.slot,
    );
    if (originSpec && slotDigest(originSpec) === logicalDigest && originTarget)
      existing = await ctx.db
        .query("cortexReferenceEdges")
        .withIndex("by_source_role", (q) =>
          q
            .eq("sourceTargetId", originTarget._id)
            .eq("role", spec.role)
            .eq("slot", spec.slot),
        )
        .take(2)
        .then((rows) => uniqueReference(rows));
    if (originSpec && slotDigest(originSpec) === logicalDigest && !existing)
      legacy = true;
  }
  const base = {
    sourceTargetId: source._id,
    role: spec.role,
    slot: spec.slot,
    bindingVersion: 1 as const,
    sourceReferenceRevision: source.revision,
    authorityCandidate: Boolean(spec.authority),
    sourceTenantId: text(row.tenantId),
    sourceMemorySpaceId: text(row.memorySpaceId),
    logicalDigest,
    generation,
  };
  if (spec.storageId) {
    const target = await storageTarget(
      ctx,
      spec.storageId,
      generation,
      !legacy,
    );
    const counted =
      old?.logicalDigest === logicalDigest &&
      old.countedGeneration === generation;
    const count = natural(spec.occurrences),
      previous = counted ? natural(old?.occurrenceCount) : 0;
    await ctx.db.patch(target._id, {
      refCount: natural(target.refCount) + (counted ? 0 : 1),
      occurrenceCount: natural(target.occurrenceCount) - previous + count,
      revision: target.revision + 1,
    });
    const fields = {
      ...base,
      kind: "storage" as const,
      targetTargetId: target._id,
      occurrenceCount: count,
      slotDigest: digest(spec.slots),
      countedGeneration: generation,
      evidence: "birth" as const,
    };
    if (old?.logicalDigest === logicalDigest)
      await ctx.db.patch(old._id, fields);
    else await ctx.db.insert("cortexReferenceEdges", fields);
    return;
  }
  if (existing) {
    const { _id: _oldId, _creationTime: _time, ...binding } = existing;
    void _oldId;
    void _time;
    if (existing.kind === "unresolved" && old?.countedGeneration !== generation)
      await unresolvedDelta(ctx, generation, existing.unresolvedReason, 1);
    const fields = {
      ...binding,
      ...base,
      countedGeneration:
        existing.kind === "unresolved"
          ? generation
          : existing.countedGeneration,
      evidence: options.cloneFrom ? ("clone" as const) : existing.evidence,
    };
    if (old?.logicalDigest === logicalDigest)
      await ctx.db.patch(old._id, fields);
    else await ctx.db.insert("cortexReferenceEdges", fields);
    return;
  }
  const target =
    legacy && !spec.physical
      ? null
      : await resolveBirth(ctx, row, spec, generation, options);
  const authority =
    spec.authority &&
    source.ownerState === "unowned" &&
    target &&
    target.tenantId === source.tenantId &&
    target.memorySpaceId === source.memorySpaceId;
  if (!target)
    await unresolvedDelta(
      ctx,
      generation,
      legacy ? "legacyBirthUnavailable" : "sourceMissingOrAmbiguous",
      1,
    );
  await ctx.db.insert("cortexReferenceEdges", {
    ...base,
    countedGeneration: target ? undefined : generation,
    kind: target ? (authority ? "authority" : "physical") : "unresolved",
    targetTargetId: target?._id,
    capturedTargetTenantId: target?.tenantId,
    capturedTargetMemorySpaceId: target?.memorySpaceId,
    capturedOwnershipRevision: target?.ownershipRevision,
    naturalHint: slotHint(row, spec),
    unresolvedReason: target
      ? undefined
      : legacy
        ? "legacyBirthUnavailable"
        : "sourceMissingOrAmbiguous",
    evidence: legacy ? "legacy" : "birth",
  });
}
export async function removeEdge(
  ctx: MutationCtx,
  edge: Edge,
  generation: string,
) {
  if (edge.kind === "unresolved" && edge.countedGeneration === generation)
    await unresolvedDelta(ctx, generation, edge.unresolvedReason, -1);
  if (
    edge.kind === "storage" &&
    edge.targetTargetId &&
    edge.countedGeneration === generation
  ) {
    const t = await ctx.db.get(edge.targetTargetId);
    if (!t || t.kind !== "storage" || t.counterGeneration !== generation)
      lifecycleFailure("REFERENCE_COUNTER_DRIFT");
    const count = natural(t.refCount) - 1,
      occurrences = natural(t.occurrenceCount) - natural(edge.occurrenceCount);
    if (count < 0 || occurrences < 0 || (!count && occurrences))
      lifecycleFailure("REFERENCE_COUNTER_DRIFT");
    await ctx.db.patch(t._id, {
      refCount: count,
      occurrenceCount: occurrences,
      revision: t.revision + 1,
    });
  }
  await ctx.db.delete(edge._id);
}
async function prepareAll(
  ctx: MutationCtx,
  table: Primary,
  row: Row,
  source: Target,
  generation: string,
  legacy: boolean,
  options: CaptureOptions = {},
) {
  const slots = extractReferenceSlots(table, row),
    old = await ctx.db
      .query("cortexReferenceEdges")
      .withIndex("by_source", (q) => q.eq("sourceTargetId", source._id))
      .collect();
  await reserveLifecycle(
    ctx,
    slots.length * 4096 + byteSize(row),
    slots.length * 6144 + old.length * 2048 + 8192,
    slots.length * 3 + old.length + 3,
  );
  const keys = new Set(slots.map((s) => s.role + ":" + s.slot));
  for (const edge of old)
    if (!keys.has(edge.role + ":" + edge.slot))
      await removeEdge(ctx, edge, generation);
  for (const slot of slots)
    await reconcileSlot(ctx, source, row, slot, generation, legacy, options);
  const authority = (
    await ctx.db
      .query("cortexReferenceEdges")
      .withIndex("by_source", (q) => q.eq("sourceTargetId", source._id))
      .collect()
  ).filter((e) => e.kind === "authority");
  const parent = authority.sort((a, b) =>
    (a.role + ":" + a.slot).localeCompare(b.role + ":" + b.slot),
  )[0];
  await ctx.db.patch(source._id, {
    preparedGeneration: generation,
    generation,
    referenceDigest: referenceDigest(table, row),
    authorityParentTargetId: parent?.targetTargetId,
    authorityParentOwnershipRevision: parent?.capturedOwnershipRevision,
  });
}
// Context objects are invocation-local; weak keys do not retain completed transactions.
// Only outermost selected hook metric deltas are counted, never caller reads or bytes.
const lifecycleReads = new WeakMap<object, { depth: number; reads: number }>();
export function lifecycleReadAllowance(ctx: object): number {
  return lifecycleReads.get(ctx)?.reads ?? 0;
}
async function measuredHook<T>(
  ctx: MutationCtx,
  operation: () => Promise<T>,
): Promise<T> {
  let account = lifecycleReads.get(ctx);
  if (!account) {
    account = { depth: 0, reads: 0 };
    lifecycleReads.set(ctx, account);
  }
  if (account.depth) {
    account.depth++;
    try {
      return await operation();
    } finally {
      account.depth--;
    }
  }
  const before = await ctx.meta.getTransactionMetrics();
  account.depth = 1;
  try {
    return await operation();
  } finally {
    account.depth = 0;
    const after = await ctx.meta.getTransactionMetrics(),
      delta = after.documentsRead.used - before.documentsRead.used;
    if (!Number.isSafeInteger(delta) || delta < 0)
      lifecycleFailure("REFERENCE_RESOURCE_METRIC_DRIFT");
    account.reads += delta;
  }
}
async function captureInsertedRowBody<T extends Primary>(
  ctx: MutationCtx,
  table: T,
  row: WithoutSystemFields<Doc<T>>,
  options: CaptureOptions = {},
): Promise<Id<T>> {
  const state = await ensureLifecycleState(ctx);
  if (state.status === "finalizing") lifecycleFailure("REFERENCE_FINALIZING");
  if (state.status === "invalid") lifecycleFailure("REFERENCE_NOT_READY");
  if (table === "memories") {
    const memory = row as unknown as WithoutSystemFields<Doc<"memories">>;
    row = {...row, vectorScopeKey: memoryVectorScopeKey(memory.tenantId, memory.memorySpaceId)};
  }
  const slots = extractReferenceSlots(table, row);
  await reserveLifecycle(
    ctx,
    slots.length * 4096 + byteSize(row),
    byteSize(row) + slots.length * 6144 + 8192,
    3 * slots.length + 3,
  );
  for (const slot of slots)
    if (slot.storageId)
      await storageTarget(ctx, slot.storageId, state.generation, true);
  const id = await ctx.db.insert(table, row);
  const actual = await ctx.db.get(id);
  if (!actual) lifecycleFailure("REFERENCE_SOURCE_MISSING");
  const source = await documentTarget(ctx, table, actual, state.generation);
  await prepareAll(
    ctx,
    table,
    actual,
    source,
    state.generation,
    false,
    options,
  );
  await captureGraphChange(ctx, table, actual, source, "insert");
  return id;
}
function tableSourceRevision(table: Primary, value: number | undefined): number | undefined {
  if (!(table in graphTables)) return undefined;
  if (!Number.isSafeInteger(value) || value! < 1 || value! >= Number.MAX_SAFE_INTEGER)
    lifecycleFailure("GRAPH_SOURCE_REVISION_INVALID");
  return value! + 1;
}
async function reconcileRowBody(
  ctx: MutationCtx,
  id: Id<Primary>,
  patch: Record<string, unknown>,
): Promise<void> {
  const state = await ensureLifecycleState(ctx),
    identity = identifyDocument(ctx, id),
    before = await ctx.db.get(identity.id);
  if (!before) lifecycleFailure("REFERENCE_SOURCE_MISSING");
  // Refresh independently of reference/ownership digest changes, including partial and clone writes.
  if (identity.table === "memories") {
    const memory = {...before, ...patch} as Doc<"memories">;
    patch = {...patch, vectorScopeKey: memoryVectorScopeKey(memory.tenantId, memory.memorySpaceId)};
  }
  const after = { ...before, ...patch },
    oldDigest = referenceDigest(identity.table, before),
    nextDigest = referenceDigest(identity.table, after),
    oldOwner = ownership(identity.table, before),
    nextOwner = ownership(identity.table, after),
    changed =
      oldDigest !== nextDigest ||
      oldOwner.ownershipDigest !== nextOwner.ownershipDigest;
  if (changed && state.status === "finalizing")
    lifecycleFailure("REFERENCE_FINALIZING");
  if (changed && state.status === "invalid")
    lifecycleFailure("REFERENCE_NOT_READY");
  let source = await documentTarget(
    ctx,
    identity.table,
    before,
    state.generation,
  );
  if (
    source.preparedGeneration === state.generation &&
    source.referenceDigest !== oldDigest
  )
    lifecycleFailure("REFERENCE_SOURCE_DIGEST_DRIFT");
  if (changed && source.preparedGeneration !== state.generation)
    lifecycleFailure("REFERENCE_SOURCE_NOT_PREPARED");
  await reserveLifecycle(
    ctx,
    byteSize(after) + 8192,
    byteSize(after) + 4096,
    2,
  );
  const nextSourceRevision = tableSourceRevision(identity.table, source.sourceRevision);
  if (oldOwner.ownershipDigest !== nextOwner.ownershipDigest)
    await captureGraphChange(ctx, identity.table, before, source, "delete", nextSourceRevision ?? source.sourceRevision);
  if (changed) {
    await ctx.db.patch(source._id, {
      sourceRevision: nextSourceRevision,
      ...nextOwner,
      ownershipRevision:
        (source.ownershipRevision ?? 1) +
        (oldOwner.ownershipDigest === nextOwner.ownershipDigest ? 0 : 1),
      revision: source.revision + 1,
      naturalKeyDigest: naturalIdentity(identity.table, after),
    });
    source = (await ctx.db.get(source._id))!;
    await prepareAll(
      ctx,
      identity.table,
      after,
      source,
      state.generation,
      false,
    );
  }
  if (!changed && identity.table in graphTables)
    await ctx.db.patch(source._id, {sourceRevision: nextSourceRevision});
  await ctx.db.patch(identity.id, patch as Partial<Doc<Primary>>);
  if (identity.table in graphTables) {
    source = (await ctx.db.get(source._id))!;
    await captureGraphChange(ctx, identity.table, after, source, "update");
  }
}
export async function invalidateLifecycle(ctx: MutationCtx) {
  let state = await lifecycleControl(ctx);
  if (!state) {
    const id = await ctx.db.insert("cortexReferenceState", {
      key: CONTROL_KEY,
      kind: "control",
      generation: crypto.randomUUID(),
      writerManifestHash: WRITER_MANIFEST_HASH,
      status: "invalid",
    });
    state = await ctx.db.get(id);
  } else await ctx.db.patch(state._id, { status: "invalid" });
  if (!state) lifecycleFailure("REFERENCE_STATE_MISSING");
  return state;
}
async function markDeletedRowBody(
  ctx: MutationCtx,
  id: Id<Primary>,
  options: { raw?: boolean; table?: Primary } = {},
): Promise<void> {
  const identity = identifyDocument(ctx, id);
  if (options.table && options.table !== identity.table)
    lifecycleFailure("REFERENCE_DOCUMENT_TABLE");
  const row = await ctx.db.get(identity.id);
  if (!row) return;
  const state = options.raw
    ? await invalidateLifecycle(ctx)
    : await ensureLifecycleState(ctx);
  if (
    !options.raw &&
    (state.status === "finalizing" || state.status === "invalid")
  )
    lifecycleFailure(
      state.status === "finalizing"
        ? "REFERENCE_FINALIZING"
        : "REFERENCE_NOT_READY",
    );
  const source = await documentTarget(
    ctx,
    identity.table,
    row,
    state.generation,
  );
  if (
    !options.raw &&
    source.preparedGeneration === state.generation &&
    source.referenceDigest !== referenceDigest(identity.table, row)
  )
    lifecycleFailure("REFERENCE_SOURCE_DIGEST_DRIFT");
  if (!options.raw && source.preparedGeneration !== state.generation)
    lifecycleFailure("REFERENCE_SOURCE_NOT_PREPARED");
  const edges = await ctx.db
    .query("cortexReferenceEdges")
    .withIndex("by_source", (q) => q.eq("sourceTargetId", source._id))
    .collect();
  await reserveLifecycle(
    ctx,
    0,
    edges.length * 4096 + 4096,
    edges.length * 2 + 2,
  );
  const nextSourceRevision = tableSourceRevision(identity.table, source.sourceRevision);
  await captureGraphChange(ctx, identity.table, row, source, "delete", nextSourceRevision ?? source.sourceRevision);
  for (const e of edges)
    if (e.kind !== "authority") await removeEdge(ctx, e, state.generation);
  await ctx.db.patch(source._id, {
    state: "deleted",
    sourceRevision: nextSourceRevision,
    revision: source.revision + 1,
    finalSnapshotDigest: digest({
      identity: source.key,
      owner: ownership(identity.table, row),
      authorityParent: source.authorityParentTargetId,
      authorityRevision: source.authorityParentOwnershipRevision,
    }),
    ...ownership(identity.table, row),
  });
  await ctx.db.delete(identity.id);
}
async function deleteUnreferencedStorageBody(
  ctx: MutationCtx,
  id: Id<"_storage">,
): Promise<"deleted" | "protected" | "missing"> {
  const state = await requireLifecycleReady(ctx),
    target = await ctx.db
      .query("cortexReferenceTargets")
      .withIndex("by_key", (q) => q.eq("key", `storage:${id}`))
      .take(2)
      .then((rows) => uniqueReference(rows));
  if (
    !target ||
    target.kind !== "storage" ||
    target.counterGeneration !== state.generation
  )
    lifecycleFailure("REFERENCE_COUNTER_DRIFT");
  const count = natural(target.refCount),
    occurrences = natural(target.occurrenceCount);
  if (!count && occurrences) lifecycleFailure("REFERENCE_COUNTER_DRIFT");
  const incoming = await ctx.db
    .query("cortexReferenceEdges")
    .withIndex("by_target", (q) => q.eq("targetTargetId", target._id))
    .collect();
  let observedOccurrences = 0;
  for (const edge of incoming) {
    if (edge.kind !== "storage" || edge.countedGeneration !== state.generation)
      lifecycleFailure("REFERENCE_COUNTER_DRIFT");
    observedOccurrences += natural(edge.occurrenceCount);
  }
  await reserveLifecycle(ctx, 2048);
  if (incoming.length !== count || observedOccurrences !== occurrences)
    lifecycleFailure("REFERENCE_COUNTER_DRIFT");
  if (count) return "protected";
  const metadata = await ctx.db.system.get("_storage", id);
  if (!metadata) {
    await ctx.db.patch(target._id, { state: "missing" });
    return "missing";
  }
  await reserveLifecycle(ctx, 0, 2048, 1);
  await ctx.storage.delete(id);
  await ctx.db.patch(target._id, {
    state: "deleted",
    revision: target.revision + 1,
  });
  return "deleted";
}
export async function readPhysicalAuthority(
  ctx: Reader,
  targetId: Id<"cortexReferenceTargets">,
  userId: string,
  scope: { tenantId?: string; memorySpaceId?: string },
  memo = new Map<string, boolean>(),
): Promise<boolean> {
  const active = new Set<string>();
  async function visit(id: Id<"cortexReferenceTargets">): Promise<boolean> {
    if (memo.has(id)) return memo.get(id)!;
    if (active.has(id)) return false;
    active.add(id);
    await reserveLifecycle(ctx, 2048);
    let authorized = false;
    try {
      const target = await ctx.db.get(id);
      if (
        !target ||
        target.kind !== "document" ||
        !target.scopeKnown ||
        target.tenantId !== scope.tenantId ||
        (scope.memorySpaceId !== undefined &&
          target.memorySpaceId !== scope.memorySpaceId)
      )
        return false;
      if (
        target.state !== "live" &&
        (target.state !== "deleted" || !target.finalSnapshotDigest)
      )
        return false;
      if (target.ownerState === "explicit" && target.owners?.length === 1) {
        authorized = target.owners[0] === userId;
        return authorized;
      }
      if (target.ownerState !== "unowned" || !target.authorityParentTargetId)
        return false;
      const edges = await ctx.db
          .query("cortexReferenceEdges")
          .withIndex("by_source", (q) => q.eq("sourceTargetId", id))
          .collect(),
        candidates = edges.filter((e) => e.authorityCandidate);
      if (
        !candidates.length ||
        !candidates.some(
          (e) =>
            e.targetTargetId === target.authorityParentTargetId &&
            e.capturedOwnershipRevision ===
              target.authorityParentOwnershipRevision,
        )
      )
        return false;
      for (const edge of candidates) {
        if (edge.kind !== "authority" || !edge.targetTargetId) return false;
        const parent = await ctx.db.get(edge.targetTargetId);
        if (
          !parent ||
          parent.ownershipRevision !== edge.capturedOwnershipRevision ||
          parent.tenantId !== edge.capturedTargetTenantId ||
          parent.memorySpaceId !== edge.capturedTargetMemorySpaceId ||
          !(await visit(parent._id))
        )
          return false;
      }
      authorized = true;
      return true;
    } finally {
      active.delete(id);
      memo.set(id, authorized);
    }
  }
  return visit(targetId);
}
export async function checkTarget(
  ctx: Reader,
  targetId: Id<"cortexReferenceTargets">,
) {
  const target = await ctx.db.get(targetId);
  if (!target) lifecycleFailure("REFERENCE_TARGET_MISSING");
  const incoming = await ctx.db
    .query("cortexReferenceEdges")
    .withIndex("by_target", (q) => q.eq("targetTargetId", targetId))
    .collect();
  const unresolved = target.naturalKeyDigest
    ? await ctx.db
        .query("cortexReferenceEdges")
        .withIndex("by_unresolved_hint", (q) =>
          q.eq("naturalHint", target.naturalKeyDigest),
        )
        .collect()
    : [];
  await reserveLifecycle(ctx, 2048);
  if (unresolved.some((e) => e.kind === "unresolved"))
    lifecycleFailure("SOURCE_PROVENANCE_UNRESOLVED");
  if (incoming.length) lifecycleFailure("REFERENCE_PROTECTED");
  return { incoming: incoming.length, unresolved: 0 };
}
export async function pruneOrphanIdentity(
  ctx: MutationCtx,
  targetId: Id<"cortexReferenceTargets">,
) {
  const target = await ctx.db.get(targetId);
  if (!target || target.kind !== "document" || target.state === "live")
    return false;
  if (
    await ctx.db
      .query("cortexReferenceEdges")
      .withIndex("by_target", (q) => q.eq("targetTargetId", targetId))
      .first()
  )
    return false;
  const edges = await ctx.db
    .query("cortexReferenceEdges")
    .withIndex("by_source", (q) => q.eq("sourceTargetId", targetId))
    .collect();
  if (edges.some((e) => e.kind !== "authority"))
    lifecycleFailure("REFERENCE_TOMBSTONE_DRIFT");
  for (const edge of edges) await ctx.db.delete(edge._id);
  await ctx.db.delete(targetId);
  return true;
}
/** Clone only unchanged slots; actual origin is re-read and known/unresolved bindings retained. */
export async function copyBindingsForClone(
  ctx: MutationCtx,
  originPhysicalId: Id<Primary>,
  newPhysicalId: Id<Primary>,
  unchangedSlotDigest: string,
) {
  const origin = identifyDocument(ctx, originPhysicalId),
    fresh = identifyDocument(ctx, newPhysicalId),
    old = await ctx.db.get(origin.id),
    row = await ctx.db.get(fresh.id);
  if (
    !old ||
    !row ||
    origin.table !== fresh.table ||
    digest(extractReferenceSlots(origin.table, old)) !== unchangedSlotDigest
  )
    lifecycleFailure("REFERENCE_CLONE_SOURCE");
  const state = await ensureLifecycleState(ctx),
    target = await documentTarget(ctx, fresh.table, row, state.generation);
  await prepareAll(ctx, fresh.table, row, target, state.generation, false, {
    cloneFrom: originPhysicalId,
  });
}

export async function captureInsertedRow<T extends Primary>(
  ctx: MutationCtx,
  table: T,
  value: WithoutSystemFields<Doc<T>>,
  options: CaptureOptions = {},
): Promise<Id<T>> {
  return measuredHook(ctx, () =>
    captureInsertedRowBody(ctx, table, value, options),
  );
}
export async function reconcileRow(
  ctx: MutationCtx,
  id: Id<Primary>,
  change: Record<string, unknown>,
): Promise<void> {
  return measuredHook(ctx, () => reconcileRowBody(ctx, id, change));
}
export async function markDeletedRow(
  ctx: MutationCtx,
  id: Id<Primary>,
  options: { raw?: boolean; table?: Primary } = {},
): Promise<void> {
  return measuredHook(ctx, () => markDeletedRowBody(ctx, id, options));
}
export async function deleteUnreferencedStorage(
  ctx: MutationCtx,
  id: Id<"_storage">,
): Promise<"deleted" | "protected" | "missing"> {
  return measuredHook(ctx, () => deleteUnreferencedStorageBody(ctx, id));
}
