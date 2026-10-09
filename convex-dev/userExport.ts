/** Internal administration only. Local attribution proofs; the SDK computes global reachability. */
import { internalQuery } from "./_generated/server";
import { assertLegacyDomainScope } from "./lib/operatorBoundary";
import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  byteSize,
  operationalExportExclusions,
  directExportDisposition,
  exactScope,
  exportEdgesForUser,
  exportFingerprint,
  exportLogicalId,
  object,
  type ExportDomain,
  type ExportRow,
  type ExportScope,
  type ExportEdge,
} from "./lib/userDataScope";

const domains = [
  "immutable",
  "mutable",
  "conversations",
  "memories",
  "facts",
  "factHistory",
  "contexts",
  "sessions",
  "artifacts",
  "attachments",
  "conversationShares",
  "conversationSnapshots",
  "memorySpaces",
  "agents",
  "governancePolicies",
  "governanceEnforcement",
  "graphSyncQueue",
] as const;
const domain = v.union(
  v.literal("immutable"),
  v.literal("mutable"),
  v.literal("conversations"),
  v.literal("memories"),
  v.literal("facts"),
  v.literal("factHistory"),
  v.literal("contexts"),
  v.literal("sessions"),
  v.literal("artifacts"),
  v.literal("attachments"),
  v.literal("conversationShares"),
  v.literal("conversationSnapshots"),
  v.literal("memorySpaces"),
  v.literal("agents"),
  v.literal("governancePolicies"),
  v.literal("governanceEnforcement"),
  v.literal("graphSyncQueue"),
);
const scope = v.union(
  v.object({ kind: v.literal("tenantless") }),
  v.object({ kind: v.literal("tenant"), tenantId: v.string() }),
);
const identity = { userId: v.string(), scope };
const node = v.union(
  v.object({ domain: v.literal("immutable"), id: v.id("immutable") }),
  v.object({ domain: v.literal("mutable"), id: v.id("mutable") }),
  v.object({ domain: v.literal("conversations"), id: v.id("conversations") }),
  v.object({ domain: v.literal("memories"), id: v.id("memories") }),
  v.object({ domain: v.literal("facts"), id: v.id("facts") }),
  v.object({ domain: v.literal("factHistory"), id: v.id("factHistory") }),
  v.object({ domain: v.literal("contexts"), id: v.id("contexts") }),
  v.object({ domain: v.literal("sessions"), id: v.id("sessions") }),
  v.object({ domain: v.literal("artifacts"), id: v.id("artifacts") }),
  v.object({ domain: v.literal("attachments"), id: v.id("attachments") }),
  v.object({
    domain: v.literal("conversationShares"),
    id: v.id("conversationShares"),
  }),
  v.object({
    domain: v.literal("conversationSnapshots"),
    id: v.id("conversationSnapshots"),
  }),
  v.object({ domain: v.literal("memorySpaces"), id: v.id("memorySpaces") }),
  v.object({ domain: v.literal("agents"), id: v.id("agents") }),
  v.object({
    domain: v.literal("governancePolicies"),
    id: v.id("governancePolicies"),
  }),
  v.object({
    domain: v.literal("governanceEnforcement"),
    id: v.id("governanceEnforcement"),
  }),
  v.object({ domain: v.literal("graphSyncQueue"), id: v.id("graphSyncQueue") }),
);
const fileNode = v.union(
  v.object({ domain: v.literal("artifacts"), id: v.id("artifacts") }),
  v.object({ domain: v.literal("attachments"), id: v.id("attachments") }),
);
const witness = v.object({
  childNode: node,
  childFingerprint: v.string(),
  kind: v.string(),
  ordinal: v.number(),
  parentNode: v.optional(node),
  parentFingerprint: v.optional(v.string()),
  status: v.union(
    v.literal("admissible"),
    v.literal("foreignOwner"),
    v.literal("missing"),
    v.literal("unresolved"),
  ),
  observationTime: v.number(),
});
function validateIdentity(args: {
  userId: string;
  scope: { kind: "tenantless" } | { kind: "tenant"; tenantId: string };
}) {
  if (
    !args.userId.trim() ||
    (args.scope.kind === "tenant" && !args.scope.tenantId.trim())
  )
    throw new ConvexError({ code: "EXPORT_PROTOCOL" });
}

type PhysicalRow = ExportRow & { _id: Id<ExportDomain> };
type Identity = { userId: string; scope: ExportScope };
const MIB = 1024 * 1024;
function fail(code: string): never {
  throw new ConvexError({ code });
}
function envelope(args: Identity) {
  return {
    protocolVersion: 1 as const,
    userId: args.userId,
    scope: args.scope,
    observationTime: Date.now(),
  };
}
function finish<T extends object>(value: T): T {
  if (byteSize(value) > 8 * MIB) fail("EXPORT_RESPONSE_TOO_LARGE");
  return value;
}
class ProofBudget {
  recordReads = 0;
  canonicalReadBytes = 0;
  lookups = 0;
  reserve(count: number) {
    if (this.recordReads + count > 5) fail("EXPORT_BUDGET");
    this.recordReads += count;
    this.lookups++;
  }
  measured(rows: ExportRow[]) {
    for (const row of rows) this.canonicalReadBytes += byteSize(row);
    if (this.canonicalReadBytes > 5 * MIB) fail("EXPORT_BUDGET");
  }
  async get(ctx: QueryCtx, id: Id<ExportDomain>): Promise<PhysicalRow | null> {
    this.reserve(1);
    const row = await ctx.db.get(id);
    if (row) this.measured([row]);
    return row;
  }
}
function projection(domain: ExportDomain, row: PhysicalRow, args: Identity) {
  const disposition = directExportDisposition(
    domain,
    row,
    args.userId,
    args.scope,
  );
  const minimal = {
    node: { domain, id: row._id },
    disposition: disposition.disposition,
    edgeDescriptors: [] as ExportEdge[],
  };
  if (disposition.disposition === "excluded") return minimal;
  const logicalId = exportLogicalId(domain, row);
  return {
    ...minimal,
    ...disposition,
    fingerprint: exportFingerprint(row),
    ...(logicalId ? { logicalId } : {}),
    ...(typeof row.memorySpaceId === "string"
      ? { memorySpaceId: row.memorySpaceId }
      : {}),
    edgeDescriptors: exportEdgesForUser(domain, row, args.userId, args.scope),
    ...(domain === "factHistory" &&
    row.scopeVersion !== 1 &&
    row.userId === args.userId
      ? { rootReason: "legacyActorProvenanceUnresolved" }
      : {}),
  };
}
/** One exact-key lookup, duplicate sentinel included in the four-source slot allowance. */
async function logicalParent(
  ctx: QueryCtx,
  domain: ExportDomain,
  child: ExportRow,
  edge: ExportEdge,
  tenantId: string | undefined,
  budget: ProofBudget,
): Promise<PhysicalRow | null> {
  budget.reserve(2);
  const logical = edge.storedLogicalTarget;
  if (!logical) fail("EXPORT_PROTOCOL");
  const space = child.memorySpaceId;
  let rows: PhysicalRow[];
  switch (domain) {
    case "facts":
      rows = await ctx.db
        .query("facts")
        .withIndex("by_runtime_scope_factId", (q) =>
          q
            .eq("tenantId", tenantId)
            .eq("memorySpaceId", String(space))
            .eq("factId", logical),
        )
        .take(2);
      break;
    case "memories":
      rows = await ctx.db
        .query("memories")
        .withIndex("by_runtime_scope_memoryId", (q) =>
          q
            .eq("tenantId", tenantId)
            .eq("memorySpaceId", String(space))
            .eq("memoryId", logical),
        )
        .take(2);
      break;
    case "conversations":
      rows = await ctx.db
        .query("conversations")
        .withIndex("by_history_scope_conversation", (q) =>
          q
            .eq("tenantId", tenantId)
            .eq("memorySpaceId", String(space))
            .eq("conversationId", logical),
        )
        .take(2);
      break;
    case "memorySpaces":
      rows = await ctx.db
        .query("memorySpaces")
        .withIndex("by_tenant_memorySpaceId", (q) =>
          q.eq("tenantId", tenantId).eq("memorySpaceId", logical),
        )
        .take(2);
      break;
    case "contexts":
      rows = await ctx.db
        .query("contexts")
        .withIndex("by_tenant_contextId", (q) =>
          q.eq("tenantId", tenantId).eq("contextId", logical),
        )
        .take(2);
      break;
    case "attachments":
      rows = await ctx.db
        .query("attachments")
        .withIndex("by_tenant_attachmentId", (q) =>
          q.eq("tenantId", tenantId).eq("attachmentId", logical),
        )
        .take(2);
      break;
    case "immutable": {
      const ref = object(child.immutableRef) ? child.immutableRef : {};
      if (typeof ref.type !== "string") fail("EXPORT_PROTOCOL");
      rows = await ctx.db
        .query("immutable")
        .withIndex("by_tenant_type_id", (q) =>
          q
            .eq("tenantId", tenantId)
            .eq("type", ref.type as string)
            .eq("id", logical),
        )
        .take(2);
      break;
    }
    case "mutable": {
      const ref = object(child.mutableRef) ? child.mutableRef : {};
      if (typeof ref.namespace !== "string") fail("EXPORT_PROTOCOL");
      rows = await ctx.db
        .query("mutable")
        .withIndex("by_tenant_namespace_key", (q) =>
          q
            .eq("tenantId", tenantId)
            .eq("namespace", ref.namespace as string)
            .eq("key", logical),
        )
        .take(2);
      break;
    }
    default:
      return fail("EXPORT_PROTOCOL");
  }
  budget.measured(rows);
  if (rows.length > 1) fail("EXPORT_REFERENCE_AMBIGUOUS");
  return rows[0] ?? null;
}
export const inspect = internalQuery({
  args: identity,
  handler: async (ctx, args) => {
    validateIdentity(args);
    const tenant =
      args.scope.kind === "tenant" ? args.scope.tenantId : undefined;
    await assertLegacyDomainScope(ctx, tenant);
    const profiles = await ctx.db
      .query("immutable")
      .withIndex("by_tenant_type_id", (q) =>
        q.eq("tenantId", tenant).eq("type", "user").eq("id", args.userId),
      )
      .take(2);
    if (profiles.length === 0) fail("EXPORT_PROFILE_NOT_FOUND");
    if (profiles.length !== 1) fail("EXPORT_PROFILE_AMBIGUOUS");
    return {
      protocolVersion: 1 as const,
      kind: "inspect" as const,
      capability: "complete-export" as const,
      ...args,
      observationTime: Date.now(),
      supportedDomains: [...domains],
      operationalExclusions: operationalExportExclusions,
      profile: { domain: "immutable" as const, id: profiles[0]._id },
    };
  },
});
export const page = internalQuery({
  args: {
    ...identity,
    selection: v.object({
      kind: v.union(
        v.literal("rootProjections"),
        v.literal("closureProjections"),
      ),
      domain,
    }),
    cursor: v.union(v.string(), v.null()),
    endCursor: v.optional(v.union(v.string(), v.null())),
    numItems: v.number(),
  },
  handler: async (ctx, args) => {
    validateIdentity(args);
    if (
      !Number.isInteger(args.numItems) ||
      args.numItems < 1 ||
      args.numItems > 100
    )
      throw new ConvexError({ code: "EXPORT_PROTOCOL" });
    const tenant =
      args.scope.kind === "tenant" ? args.scope.tenantId : undefined;
    const d = args.selection.domain;
    const pagination = {
      cursor: args.cursor,
      endCursor: args.endCursor,
      numItems: args.numItems,
      maximumBytesRead: 2 * MIB,
      maximumRowsRead: 256,
    };
    // Excluded operational registries are manifest dispositions, never scanned as user stores.
    if (
      d === "agents" ||
      d === "governancePolicies" ||
      d === "governanceEnforcement" ||
      d === "graphSyncQueue"
    )
      return finish({
        ...envelope(args),
        kind: "page" as const,
        page: [],
        continueCursor: args.cursor ?? "",
        isDone: true,
        proof: { relatedDocumentReads: 0, paginates: 0 },
      });
    const scanned =
      d === "factHistory"
        ? await ctx.db
            .query("factHistory")
            .withIndex("by_history_scope", (q) =>
              args.selection.kind === "rootProjections"
                ? q.eq("scopeVersion", 1).eq("tenantId", tenant)
                : q.eq("scopeVersion", undefined),
            )
            .paginate(pagination)
        : d === "conversationShares"
          ? await ctx.db
              .query("conversationShares")
              .withIndex("by_tenant_shareId", (q) => q.eq("tenantId", tenant))
              .paginate(pagination)
          : d === "conversationSnapshots"
            ? await ctx.db
                .query("conversationSnapshots")
                .withIndex("by_tenant_snapshotId", (q) =>
                  q.eq("tenantId", tenant),
                )
                .paginate(pagination)
            : await ctx.db
                .query(d)
                .withIndex("by_tenantId", (q) => q.eq("tenantId", tenant))
                .paginate(pagination);
    const projected = scanned.page
      .map((row) => projection(d, row, args))
      .filter(
        (p) =>
          d === "factHistory" ||
          (args.selection.kind === "closureProjections"
            ? p.disposition === "unownedCandidate"
            : p.disposition !== "unownedCandidate"),
      );
    return finish({
      ...envelope(args),
      kind: "page" as const,
      ...scanned,
      page: projected,
      proof: {
        relatedDocumentReads: 0,
        paginates: 1,
        scannedRecords: scanned.page.length,
        canonicalReadBytes: scanned.page.reduce(
          (n, row) => n + byteSize(row),
          0,
        ),
      },
    });
  },
});
type Node = { domain: ExportDomain; id: Id<ExportDomain> };
type EdgeArgs = Identity & {
  node: Node;
  expectedFingerprint: string;
  edgeOrdinal: number;
};
async function proveEdge(ctx: QueryCtx, args: EdgeArgs, budget: ProofBudget) {
  validateIdentity(args);
  if (ctx.db.normalizeId(args.node.domain, args.node.id) !== args.node.id)
    fail("EXPORT_PROTOCOL");
  if (
    !Number.isInteger(args.edgeOrdinal) ||
    args.edgeOrdinal < 0 ||
    !/^[a-f0-9]{64}$/.test(args.expectedFingerprint)
  )
    fail("EXPORT_PROTOCOL");
  const child = await budget.get(ctx, args.node.id);
  if (!child) fail("EXPORT_CHANGED");
  const d = args.node.domain,
    legacy = d === "factHistory" && child.scopeVersion !== 1;
  if (!legacy && !exactScope(child, args.scope)) fail("EXPORT_SCOPE");
  if (
    directExportDisposition(d, child, args.userId, args.scope).disposition ===
    "excluded"
  )
    fail("EXPORT_INELIGIBLE");
  if (exportFingerprint(child) !== args.expectedFingerprint)
    fail("EXPORT_CHANGED");
  const edge = exportEdgesForUser(d, child, args.userId, args.scope)[
    args.edgeOrdinal
  ];
  if (!edge) fail("EXPORT_PROTOCOL");
  const base = {
    childNode: args.node,
    childFingerprint: args.expectedFingerprint,
    kind: edge.kind,
    ordinal: edge.ordinal,
    observationTime: Date.now(),
  };
  const tenant = args.scope.kind === "tenant" ? args.scope.tenantId : undefined;
  let parent: PhysicalRow | null = null;
  if (edge.storedDocumentTarget) {
    const id = ctx.db.normalizeId(edge.domain, edge.storedDocumentTarget);
    if (!id) fail("EXPORT_PROTOCOL");
    parent = await budget.get(ctx, id);
  } else if (edge.storedLogicalTarget) {
    parent = await logicalParent(ctx, edge.domain, child, edge, tenant, budget);
  }
  let status: "admissible" | "foreignOwner" | "missing" | "unresolved" =
    "missing";
  if (parent) {
    const parentSpace = parent.memorySpaceId;
    const requiredSpace =
      edge.domain === "memorySpaces"
        ? edge.storedLogicalTarget
        : child.memorySpaceId;
    if (
      !exactScope(parent, args.scope) ||
      (requiredSpace !== undefined &&
        parentSpace !== undefined &&
        parentSpace !== requiredSpace)
    )
      status = "foreignOwner";
    else if (
      edge.storedLogicalTarget &&
      exportLogicalId(edge.domain, parent) !== edge.storedLogicalTarget
    )
      status = "unresolved";
    else if (
      directExportDisposition(edge.domain, parent, args.userId, args.scope)
        .disposition === "excluded"
    )
      status = "foreignOwner";
    else status = legacy || edge.unresolved ? "unresolved" : "admissible";
  } else if (edge.unresolved) status = "unresolved";
  // A foreign record never contributes its fingerprint or physical identity to a witness.
  const witness = {
    ...base,
    status,
    ...(parent && status !== "foreignOwner"
      ? {
          parentNode: { domain: edge.domain, id: parent._id },
          parentFingerprint: exportFingerprint(parent),
        }
      : {}),
  };
  return finish({
    ...envelope(args),
    kind: "edge" as const,
    witness,
    edgePurpose: edge.purpose,
    proof: {
      recordReadSlots: budget.recordReads,
      lookups: budget.lookups,
      canonicalReadBytes: budget.canonicalReadBytes,
      relatedDocumentReads: budget.recordReads - 1,
    },
  });
}
export const inspectEdge = internalQuery({
  args: {
    ...identity,
    node,
    edgeOrdinal: v.number(),
    expectedFingerprint: v.string(),
  },
  handler: async (ctx, args) => {
    const { edgePurpose: _purpose, ...response } = await proveEdge(
      ctx,
      args,
      new ProofBudget(),
    );
    return response;
  },
});
type SavedWitness = {
  childNode: Node;
  childFingerprint: string;
  kind: string;
  ordinal: number;
  parentNode?: Node;
  parentFingerprint?: string;
  status: string;
  observationTime: number;
};
type ReleaseArgs = Identity & {
  node: Node;
  expectedFingerprint: string;
  witness?: SavedWitness;
};
const key = (n: Node) => n.domain + ":" + n.id;
async function authorizedRow(
  ctx: QueryCtx,
  args: ReleaseArgs,
  budget: ProofBudget,
) {
  validateIdentity(args);
  if (ctx.db.normalizeId(args.node.domain, args.node.id) !== args.node.id)
    fail("EXPORT_PROTOCOL");
  if (!/^[a-f0-9]{64}$/.test(args.expectedFingerprint)) fail("EXPORT_PROTOCOL");
  const row = await budget.get(ctx, args.node.id);
  if (!row || exportFingerprint(row) !== args.expectedFingerprint)
    fail("EXPORT_CHANGED");
  if (!exactScope(row, args.scope)) fail("EXPORT_SCOPE");
  const disposition = directExportDisposition(
    args.node.domain,
    row,
    args.userId,
    args.scope,
  );
  if (
    disposition.disposition === "excluded" ||
    (args.node.domain === "factHistory" && row.scopeVersion !== 1)
  )
    fail("EXPORT_INELIGIBLE");
  if (
    (disposition.disposition !== "root" &&
      disposition.disposition !== "membershipProjection") ||
    args.witness
  ) {
    const saved = args.witness;
    if (!saved || saved.status !== "admissible") fail("EXPORT_INELIGIBLE");
    const result = await proveEdge(
        ctx,
        {
          userId: args.userId,
          scope: args.scope,
          node: saved.childNode,
          expectedFingerprint: saved.childFingerprint,
          edgeOrdinal: saved.ordinal,
        },
        budget,
      ),
      now = result.witness;
    if (
      now.status !== "admissible" ||
      now.childFingerprint !== saved.childFingerprint ||
      now.parentFingerprint !== saved.parentFingerprint ||
      now.kind !== saved.kind ||
      now.ordinal !== saved.ordinal ||
      !now.parentNode ||
      !saved.parentNode ||
      key(now.childNode) !== key(saved.childNode) ||
      key(now.parentNode) !== key(saved.parentNode)
    )
      fail("EXPORT_CHANGED");
    const reverse = key(args.node) === key(now.parentNode);
    if (reverse) {
      const support =
        result.edgePurpose === "support" &&
        args.node.domain === "memorySpaces" &&
        (now.kind === "supportSpace" ||
          (now.kind === "shareSpace" &&
            now.childNode.domain === "conversationShares"));
      const fact =
        result.edgePurpose === "inclusion" &&
        args.node.domain === "facts" &&
        now.childNode.domain === "facts" &&
        ["physicalFact:supersedes", "physicalFact:supersededBy"].includes(
          now.kind,
        );
      if (!support && !fact) fail("EXPORT_INELIGIBLE");
    } else if (
      key(args.node) !== key(now.childNode) ||
      result.edgePurpose !== "inclusion"
    )
      fail("EXPORT_INELIGIBLE");
  }
  return {
    row,
    disposition:
      args.node.domain === "memorySpaces"
        ? "membershipProjection"
        : disposition.disposition === "membershipProjection"
          ? "membershipProjection"
          : "record",
  };
}
function membership(domain: ExportDomain, row: PhysicalRow, userId: string) {
  const fields =
    domain === "memorySpaces"
      ? ["memorySpaceId", "name", "type", "status"]
      : domain === "artifacts"
        ? ["memorySpaceId", "artifactId", "kind", "isDeleted"]
        : [
            "memorySpaceId",
            "shareId",
            "conversationId",
            "sourceMemorySpaceId",
            "grantType",
            "grantedTo",
            "permissions",
            "status",
            "createdAt",
            "expiresAt",
            "maxViews",
            "viewCount",
            "revokedAt",
            "redactBefore",
            "redactSensitive",
          ];
  const result: ExportRow = { _id: row._id, _creationTime: row._creationTime };
  if (row.tenantId !== undefined) result.tenantId = row.tenantId;
  for (const field of fields)
    if (row[field] !== undefined) result[field] = row[field];
  if (domain === "memorySpaces")
    result.participants = (
      Array.isArray(row.participants) ? row.participants : []
    ).filter((x) => object(x) && x.type === "human" && x.id === userId);
  if (domain === "artifacts")
    result.collaborators = (
      Array.isArray(row.collaborators) ? row.collaborators : []
    ).filter((x) => object(x) && x.type === "user" && x.id === userId);
  return result;
}
export const readNode = internalQuery({
  args: {
    ...identity,
    node,
    expectedFingerprint: v.string(),
    witness: v.optional(witness),
  },
  handler: async (ctx, args) => {
    const budget = new ProofBudget(),
      authorized = await authorizedRow(ctx, args, budget);
    return finish({
      ...envelope(args),
      kind: "node" as const,
      node: args.node,
      fingerprint: args.expectedFingerprint,
      disposition: authorized.disposition,
      record:
        authorized.disposition === "membershipProjection"
          ? membership(args.node.domain, authorized.row, args.userId)
          : authorized.row,
      proof: {
        recordReadSlots: budget.recordReads,
        relatedDocumentReads: budget.recordReads - 1,
        canonicalReadBytes: budget.canonicalReadBytes,
      },
    });
  },
});
/** Convex _storage.sha256 is canonical base64; export format uses lowercase hex. */
function storageDigest(value: string): string {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) fail("EXPORT_FILE_METADATA");
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let accumulator = 0,
    bits = 0;
  const bytes: number[] = [];
  for (const char of value.slice(0, -1)) {
    accumulator = (accumulator << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >>> bits) & 255);
      accumulator &= (1 << bits) - 1;
    }
  }
  if (bytes.length !== 32 || accumulator !== 0) fail("EXPORT_FILE_METADATA");
  return bytes.map((x) => x.toString(16).padStart(2, "0")).join("");
}
export const resolveFile = internalQuery({
  args: {
    ...identity,
    node: fileNode,
    expectedFingerprint: v.string(),
    witness: v.optional(witness),
    version: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const budget = new ProofBudget(),
      { row, disposition } = await authorizedRow(ctx, args, budget);
    if (disposition !== "record") fail("EXPORT_INELIGIBLE");
    if (
      args.version !== undefined &&
      (!Number.isSafeInteger(args.version) || args.version < 1)
    )
      fail("EXPORT_PROTOCOL");
    let ref: ExportRow | undefined, version: number | undefined;
    if (args.node.domain === "attachments") {
      if (args.version !== undefined) fail("EXPORT_PROTOCOL");
      ref = row;
    } else {
      version = args.version ?? Number(row.versionPointer);
      const refs: ExportRow[] = [];
      if (version === row.versionPointer && object(row.fileRef))
        refs.push(row.fileRef);
      for (const item of Array.isArray(row.versionHistory)
        ? row.versionHistory
        : [])
        if (object(item) && item.version === version && object(item.fileRef))
          refs.push(item.fileRef);
      if (!refs.length) fail("EXPORT_CHANGED");
      if (refs.some((x) => exportFingerprint(x) !== exportFingerprint(refs[0])))
        fail("EXPORT_FILE_METADATA");
      ref = refs[0];
    }
    if (!ref || typeof ref.storageId !== "string") fail("EXPORT_CHANGED");
    const storageId: Id<"_storage"> | null = ctx.db.system.normalizeId(
      "_storage",
      ref.storageId,
    );
    if (!storageId) fail("EXPORT_FILE_METADATA");
    budget.reserve(1);
    const stored = await ctx.db.system.get(storageId);
    if (!stored) fail("EXPORT_CHANGED");
    budget.measured([stored]);
    const sha256 = storageDigest(stored.sha256);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) fail("EXPORT_CHANGED");
    if (
      ref.size !== stored.size ||
      !Number.isSafeInteger(stored.size) ||
      stored.size < 0 ||
      typeof ref.mimeType !== "string" ||
      !ref.mimeType ||
      (stored.contentType !== undefined &&
        stored.contentType !== null &&
        ref.mimeType !== stored.contentType) ||
      (ref.checksum !== undefined &&
        ref.checksum !== stored.sha256 &&
        ref.checksum !== sha256)
    )
      fail("EXPORT_FILE_METADATA");
    return finish({
      ...envelope(args),
      kind: "file" as const,
      node: args.node,
      fingerprint: args.expectedFingerprint,
      file: {
        storageId,
        url,
        size: stored.size,
        mimeType: ref.mimeType,
        sha256,
        ...(version === undefined ? {} : { version }),
      },
      proof: {
        recordReadSlots: budget.recordReads,
        relatedDocumentReads: budget.recordReads - 1,
        canonicalReadBytes: budget.canonicalReadBytes,
      },
    });
  },
});
