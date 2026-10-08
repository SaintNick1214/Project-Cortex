/** Fixed export attribution rules. Joint export association is not exclusive erasure ownership. */
import { canonical, digest, byteSize } from "./factHistoryProvenance";

export { canonical, byteSize };
/** Derived operational coverage; excluded from primary export content and eligibility. */
export const operationalExportExclusions = {
  cortexReferenceTargets: "derivedPhysicalIdentityAndGlobalCounters",
  cortexReferenceEdges: "derivedReferenceBindings",
  cortexReferenceState: "derivedMigrationProgress",
  cortexErasureReceipts: "temporaryErasureReconciliation",
} as const;

export const exportDomains = [
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
export type ExportDomain = (typeof exportDomains)[number];
export type ExportScope =
  | { kind: "tenantless" }
  | { kind: "tenant"; tenantId: string };
export type ExportRow = Record<string, unknown>;
export type ExportDisposition =
  | "root"
  | "unownedCandidate"
  | "membershipProjection"
  | "excluded";
export interface ExportEdge {
  ordinal: number;
  kind: string;
  domain: ExportDomain;
  storedLogicalTarget?: string;
  storedDocumentTarget?: string;
  purpose: "inclusion" | "support" | "reference" | "legacy";
  unresolved?: boolean;
}
export function object(value: unknown): value is ExportRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function exactScope(row: ExportRow, scope: ExportScope): boolean {
  return (
    row.tenantId === (scope.kind === "tenant" ? scope.tenantId : undefined)
  );
}
function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}
function members(row: ExportRow): ExportRow[] {
  return Array.isArray(row.collaborators)
    ? row.collaborators.filter(object)
    : [];
}
export function directExportDisposition(
  domain: ExportDomain,
  row: ExportRow,
  userId: string,
  scope: ExportScope,
): { disposition: ExportDisposition; rootReason?: string } {
  const result = (disposition: ExportDisposition, rootReason?: string) =>
    rootReason ? { disposition, rootReason } : { disposition };
  if (domain === "factHistory" && row.scopeVersion !== 1)
    return result("unownedCandidate", "legacyProvenanceUnresolved");
  if (!exactScope(row, scope)) return result("excluded");
  switch (domain) {
    case "immutable":
      if (row.type === "user")
        return row.id === userId
          ? result("root", "scopedProfile")
          : result("excluded");
      return row.userId === userId
        ? result("root", "explicitOwner")
        : result("excluded");
    case "mutable":
    case "sessions":
    case "attachments":
      return row.userId === userId
        ? result("root", "explicitOwner")
        : result("excluded");
    case "conversations": {
      const p = object(row.participants) ? row.participants : {};
      return p.userId === userId || strings(p.userIds).includes(userId)
        ? result("root", "humanConversationAssociation")
        : result("excluded");
    }
    case "conversationSnapshots":
      // Schema requires an explicit creator; a foreign creator cannot be replaced by a source reference.
      return row.createdBy === userId
        ? result("root", "snapshotCreator")
        : result("excluded");
    case "memories":
      if (row.userId !== undefined && row.userId !== userId)
        return result("excluded");
      return row.userId === userId || row.sourceUserId === userId
        ? result("root", "memoryOwnerOrSourceUser")
        : result("unownedCandidate");
    case "facts":
    case "contexts":
      return row.userId === userId
        ? result("root", "explicitOwner")
        : row.userId === undefined
          ? result("unownedCandidate")
          : result("excluded");
    case "artifacts": {
      const owners = members(row).filter(
        (x) => x.type === "user" && x.role === "owner",
      );
      if (row.userId === userId || owners.some((x) => x.id === userId))
        return result("root", "artifactOwnerOrCoOwner");
      if (members(row).some((x) => x.type === "user" && x.id === userId))
        return result("membershipProjection", "artifactMembership");
      return row.userId === undefined && owners.length === 0
        ? result("unownedCandidate")
        : result("excluded");
    }
    case "factHistory":
      if (row.ownerKnown === true && row.ownerUserId === userId)
        return result("root", "durableHistoryOwner");
      if (
        row.associationKnown === true &&
        strings(row.associatedUserIds).includes(userId)
      )
        return result("root", "durableHistoryAssociation");
      if (row.userId === userId) return result("root", "historyActorOnly");
      return row.ownerKnown === true &&
        row.ownerUserId !== undefined &&
        row.ownerUserId !== userId
        ? result("excluded")
        : result("unownedCandidate");
    case "conversationShares":
      return row.grantedBy === userId
        ? result("root", "outgoingShare")
        : row.grantType === "user" && row.grantedTo === userId
          ? result("membershipProjection", "incomingShare")
          : result("excluded");
    case "memorySpaces": {
      const participants = Array.isArray(row.participants)
        ? row.participants.filter(object)
        : [];
      return participants.some((x) => x.type === "human" && x.id === userId)
        ? result("membershipProjection", "humanSpaceMembership")
        : result("unownedCandidate");
    }
    case "agents":
    case "governancePolicies":
    case "governanceEnforcement":
    case "graphSyncQueue":
      return result("excluded");
  }
}
export function exportFingerprint(row: ExportRow): string {
  return digest(row);
}
export function exportLogicalId(
  domain: ExportDomain,
  row: ExportRow,
): string | undefined {
  const field: Partial<Record<ExportDomain, string>> = {
    immutable: "id",
    conversations: "conversationId",
    memories: "memoryId",
    facts: "factId",
    factHistory: "eventId",
    contexts: "contextId",
    sessions: "sessionId",
    artifacts: "artifactId",
    attachments: "attachmentId",
    conversationShares: "shareId",
    conversationSnapshots: "snapshotId",
    memorySpaces: "memorySpaceId",
  };
  const key = field[domain];
  return key && typeof row[key] === "string" ? row[key] : undefined;
}
/** Every descriptor comes from a schema field; arbitrary metadata never creates an edge. */
export function exportEdges(
  domain: ExportDomain,
  row: ExportRow,
): ExportEdge[] {
  const edges: ExportEdge[] = [];
  const add = (
    kind: string,
    targetDomain: ExportDomain,
    purpose: ExportEdge["purpose"],
    logical: unknown,
    physical?: unknown,
    unresolved = false,
  ) => {
    if (
      typeof logical !== "string" &&
      typeof physical !== "string" &&
      !unresolved
    )
      return;
    edges.push({
      ordinal: edges.length,
      kind,
      domain: targetDomain,
      purpose,
      ...(typeof logical === "string" ? { storedLogicalTarget: logical } : {}),
      ...(typeof physical === "string"
        ? { storedDocumentTarget: physical }
        : {}),
      ...(unresolved ? { unresolved: true } : {}),
    });
  };
  const ref = (field: string) => (object(row[field]) ? row[field] : {});
  if (domain === "factHistory" && row.scopeVersion !== 1) {
    add("legacyFact", "facts", "legacy", row.factId, row.sourceFactId, true);
    add(
      "legacySpace",
      "memorySpaces",
      "legacy",
      row.memorySpaceId,
      row.sourceMemorySpaceId,
      true,
    );
    return edges;
  }
  if (domain === "memories") {
    add(
      "memoryConversation",
      "conversations",
      "inclusion",
      ref("conversationRef").conversationId,
    );
    add("memoryFact", "facts", "inclusion", ref("factsRef").factId);
    add("memoryImmutable", "immutable", "reference", ref("immutableRef").id);
    add("memoryMutable", "mutable", "reference", ref("mutableRef").key);
  }
  if (domain === "facts") {
    add(
      "factConversation",
      "conversations",
      "inclusion",
      ref("sourceRef").conversationId,
    );
    add("factMemory", "memories", "inclusion", ref("sourceRef").memoryId);
  }
  if (domain === "facts" || domain === "factHistory") {
    for (const name of ["supersedes", "supersededBy"]) {
      const endpoint = ref(name + "Endpoint"),
        logical = row[name];
      const absent =
        logical === undefined &&
        (endpoint.state === "absent" || Object.keys(endpoint).length === 0);
      if (absent) continue;
      const known =
        typeof logical === "string" &&
        endpoint.state === "known" &&
        endpoint.logicalFactId === logical &&
        typeof endpoint.factDocumentId === "string" &&
        endpoint.scopeVersion === 1 &&
        endpoint.tenantId === row.tenantId &&
        endpoint.memorySpaceId === row.memorySpaceId;
      add(
        "physicalFact:" + name,
        "facts",
        "inclusion",
        logical,
        known ? endpoint.factDocumentId : undefined,
        !known,
      );
    }
  }
  if (domain === "factHistory")
    add(
      "historySourceFact",
      "facts",
      "inclusion",
      row.factId,
      row.sourceFactId,
      row.sourceFactId === undefined,
    );
  if (domain === "contexts") {
    add(
      "contextConversation",
      "conversations",
      "inclusion",
      ref("conversationRef").conversationId,
    );
    add("contextParent", "contexts", "reference", row.parentId);
    add("contextRoot", "contexts", "reference", row.rootId);
    for (const child of strings(row.childIds))
      add("contextChild", "contexts", "reference", child);
  }
  if (domain === "artifacts") {
    add(
      "artifactConversation",
      "conversations",
      "inclusion",
      ref("conversationRef").conversationId,
    );
    for (const memory of Array.isArray(row.memoryRefs)
      ? row.memoryRefs.filter(object)
      : [])
      add("artifactMemory", "memories", "inclusion", memory.memoryId);
  }
  if (domain === "conversations")
    for (const message of Array.isArray(row.messages)
      ? row.messages.filter(object)
      : [])
      for (const attachment of strings(message.attachmentIds))
        add("messageAttachment", "attachments", "reference", attachment);
  if (
    domain !== "memorySpaces" &&
    domain !== "conversationShares" &&
    typeof row.memorySpaceId === "string"
  )
    add(
      "supportSpace",
      "memorySpaces",
      "support",
      row.memorySpaceId,
      domain === "factHistory" ? row.sourceMemorySpaceId : undefined,
    );
  if (domain === "conversationShares")
    add("shareSpace", "memorySpaces", "support", row.sourceMemorySpaceId);
  return edges;
}
/** Projection-only membership and actor attribution cannot seed substantive records/spaces. */
export function exportEdgesForUser(
  domain: ExportDomain,
  row: ExportRow,
  userId: string,
  scope: ExportScope,
): ExportEdge[] {
  const rule = directExportDisposition(domain, row, userId, scope);
  if (
    rule.disposition === "excluded" ||
    (rule.disposition === "membershipProjection" && domain !== "memorySpaces")
  )
    return [];
  return exportEdges(domain, row)
    .filter(
      (edge) =>
        rule.rootReason !== "historyActorOnly" || edge.purpose !== "support",
    )
    .map((edge, ordinal) => ({ ...edge, ordinal }));
}
