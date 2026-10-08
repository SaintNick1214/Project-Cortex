/** Administrative erasure membership. Associations and caller lists are never ownership. */
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { byteSize, digest } from "./factHistoryProvenance";
import { PRIMARY_TABLES, ownership, readPhysicalAuthority, requireLifecycleReady, reserveLifecycle, extractReferenceSlots, slotHint, type Primary, type Edge, uniqueReference } from "./referenceLifecycle";
import { scopedImmutable, scopedSpace, validateDomainScope } from "./domainScope";
import { graphTables, sourceIdentity } from "./graphSync";

export { PRIMARY_TABLES as erasureTables };
export interface ErasureDomain { kind: "user" | "space"; tenantId?: string; userId?: string; memorySpaceId?: string; rootDocumentId?: string }
export type ErasureAction = "delete" | "detach" | "root" | "preserve" | "block";
export type ErasureRow = Record<string, unknown>;
export interface ErasureProjection {
  table: Primary; id: string; fingerprint: string; action: ErasureAction; reason?: string;
  dependencies: { id: string; kind: "hard" | "data" }[];
  retainedVersions: number; messages: number; serializedBytes: number; storageIds: string[]; managedQueueCount?: number;
  graph?: { identity: ReturnType<typeof sourceIdentity>; sourceRevision: number; ownershipRevision: number; referenceGeneration: string; referenceRevision: number; evidence: {targetId: string; generation: string; physicalSourceId: string; scopeKnown: true} };
}
type Reader = QueryCtx | MutationCtx;
export function erasureFail(code: string): never { throw new ConvexError({code}); }
const obj = (x: unknown): ErasureRow => x && typeof x === "object" && !Array.isArray(x) ? x as ErasureRow : {};
const rows = (x: unknown): ErasureRow[] => Array.isArray(x) ? x.map(obj) : [];
const strings = (x: unknown): string[] => Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
export function validateErasureDomain(domain: ErasureDomain): void {
  validateDomainScope(domain.tenantId);
  const selected = domain.kind === "user" ? domain.userId : domain.memorySpaceId;
  if (!selected?.trim() || selected.length > 256 || (domain.kind === "user" ? domain.memorySpaceId !== undefined : domain.userId !== undefined)) erasureFail("ERASURE_DOMAIN_INVALID");
}
export async function erasureRoot(ctx: Reader, domain: ErasureDomain, allowAbsent=false) {
  validateErasureDomain(domain); await requireLifecycleReady(ctx);
  const root = domain.kind === "user" ? await scopedImmutable(ctx, domain.tenantId, "user", domain.userId!) : await scopedSpace(ctx, domain.tenantId, domain.memorySpaceId!);
  if (domain.rootDocumentId !== undefined && !(allowAbsent&&!root) && root?._id !== domain.rootDocumentId) erasureFail("ERASURE_ROOT_CHANGED");
  return root;
}
/** Pure explicit disposition: undefined means physical source proof is required. */
export function explicitErasureAction(table: Primary, row: ErasureRow, domain: ErasureDomain): {action: ErasureAction; reason?: string} | undefined {
  if (table === "governancePolicies" || table === "governanceEnforcement") return domain.kind === "space" && row.memorySpaceId === domain.memorySpaceId ? {action: "block", reason: "ERASURE_GOVERNANCE_SCOPE_UNKNOWN"} : {action: "preserve", reason: "operationalGovernance"};
  if(table==="factHistory"&&row.scopeVersion!==1&&row.tenantId===undefined&&(domain.kind==="user"?row.userId===domain.userId:row.memorySpaceId===domain.memorySpaceId))return {action:"block",reason:"SOURCE_PROVENANCE_UNRESOLVED"};
  if (row.tenantId !== domain.tenantId) return {action: "preserve", reason: "foreignTenant"};
  if (table === "agents") return {action: "preserve", reason: "sharedRegistry"};
  if (table === "graphSyncQueue") return {action: "preserve", reason: "managedQueueParticipant"};
  if (domain.kind === "space") {
    if (table === "immutable" || table === "mutable") return {action: "preserve", reason: "tenantGlobal"};
    if (table === "memorySpaces") return {action: row.memorySpaceId === domain.memorySpaceId ? "root" : "preserve"};
    if (table === "conversationShares") {
      if (row.grantType === "space" && row.grantedTo === domain.memorySpaceId) return {action: "delete"};
      return undefined; // source binding, not a current logical-ID lookup
    }
    if (table === "factHistory") return undefined;
    if (row.memorySpaceId !== domain.memorySpaceId) return {action: "preserve", reason: "otherSpace"};
    if (table === "conversations" && strings(obj(row.participants).memorySpaceIds).some(id => id !== domain.memorySpaceId)) return {action: "block", reason: "ERASURE_SHARED_CONVERSATION"};
    return {action: "delete"};
  }
  const user = domain.userId!;
  if (table === "memorySpaces") return {action: rows(row.participants).some(p => p.id === user && p.type === "human") ? "detach" : "preserve"};
  if (table === "immutable" && row.type === "user") return {action: row.id === user ? "root" : "preserve", reason: row.id === user ? undefined : "foreignProfile"};
  if (table === "conversationShares") {
    if (row.grantedBy === user || row.userId === user || (row.grantType === "user" && row.grantedTo === user)) return {action: "delete"};
    return {action: "preserve", reason: "foreignGrant"};
  }
  if (table === "factHistory") {
    if (row.scopeVersion === 1 && row.ownerKnown === true && row.ownerUserId === user) return {action: "delete"};
    if (row.scopeVersion === 1 && row.ownerKnown === true && typeof row.ownerUserId === "string") return {action:"preserve",reason:"foreignOwnerActorOnly"};
    return undefined;
  }
  if(table==="conversations") {
    const participants=obj(row.participants),humans=[...new Set([...(typeof participants.userId==="string"?[participants.userId]:[]),...strings(participants.userIds)])];
    const approvalOwner=obj(row.collaborativeSettings).ownerUserId;
    if((humans.includes(user)||approvalOwner===user)&&(humans.length!==1||humans[0]!==user))return {action:"block",reason:"ERASURE_SHARED_OWNER"};
  }
  const owner = ownership(table, row);
  if (owner.owners.includes(user)) {
    if (owner.ownerState !== "explicit") return {action: "block", reason: "ERASURE_SHARED_OWNER"};
    if (table === "conversations" && strings(obj(row.collaborativeSettings).approvedParticipants).some(id => id !== user)) return {action: "block", reason: "ERASURE_APPROVAL_OWNER_CONFLICT"};
    if (table === "conversations" && strings(obj(row.participants).memorySpaceIds).some(id => id !== row.memorySpaceId)) return {action: "block", reason: "ERASURE_SHARED_CONVERSATION"};
    return {action: "delete"};
  }
  if (table === "artifacts" && rows(row.collaborators).some(p => p.id === user && p.type === "user" && p.role !== "owner")) return {action: "detach"};
  if (owner.ownerState !== "unowned") return {action: "preserve", reason: row.sourceUserId === user ? "foreignOwnerAssociation" : "foreignOwner"};
  if (["memories", "facts", "contexts", "artifacts"].includes(table)) return undefined;
  return {action: "preserve", reason: "noExclusiveOwner"};
}
export async function erasureTarget(ctx: Reader, table: Primary, row: ErasureRow) {
  return ctx.db.query("cortexReferenceTargets").withIndex("by_document", q => q.eq("table", table).eq("documentId", String(row._id))).take(2).then(uniqueReference);
}
/** Present aliases supply conservative ordering/blockers only, never historical authority. */
async function hintedTargets(ctx:Reader,table:Primary,row:ErasureRow,edge:Edge) {
  const spec=extractReferenceSlots(table,row).find(slot=>slot.role===edge.role&&slot.slot===edge.slot);
  if(!spec?.table||!spec.logical||!edge.naturalHint||slotHint(row,spec)!==edge.naturalHint)return [];
  const logical=spec.logical,tenantId=typeof row.tenantId==="string"?row.tenantId:undefined;
  let matches:ErasureRow[]=[];
  switch(spec.table) {
    case "conversations":matches=await ctx.db.query("conversations").withIndex("by_tenant_conversationId",q=>q.eq("tenantId",tenantId).eq("conversationId",logical)).collect();break;
    case "memories":matches=await ctx.db.query("memories").withIndex("by_memoryId",q=>q.eq("memoryId",logical)).collect();break;
    case "facts":matches=await ctx.db.query("facts").withIndex("by_factId",q=>q.eq("factId",logical)).collect();break;
    case "contexts":matches=await ctx.db.query("contexts").withIndex("by_tenant_contextId",q=>q.eq("tenantId",tenantId).eq("contextId",logical)).collect();break;
    case "artifacts":matches=await ctx.db.query("artifacts").withIndex("by_tenant_artifactId",q=>q.eq("tenantId",tenantId).eq("artifactId",logical)).collect();break;
    case "attachments":matches=await ctx.db.query("attachments").withIndex("by_tenant_attachmentId",q=>q.eq("tenantId",tenantId).eq("attachmentId",logical)).collect();break;
    case "memorySpaces":matches=await ctx.db.query("memorySpaces").withIndex("by_tenant_memorySpaceId",q=>q.eq("tenantId",tenantId).eq("memorySpaceId",logical)).collect();break;
    case "sessions":matches=await ctx.db.query("sessions").withIndex("by_lifecycle_tenant_sessionId",q=>q.eq("tenantId",tenantId).eq("sessionId",logical)).collect();break;
    case "immutable":if(spec.qualifier)matches=await ctx.db.query("immutable").withIndex("by_tenant_type_id",q=>q.eq("tenantId",tenantId).eq("type",spec.qualifier!).eq("id",logical)).collect();break;
    case "mutable":if(spec.qualifier)matches=await ctx.db.query("mutable").withIndex("by_namespace_key",q=>q.eq("namespace",spec.qualifier!).eq("key",logical)).collect();break;
  }
  const result=[];
  for(const match of matches)if(match.tenantId===tenantId&&(spec.space===undefined||match.memorySpaceId===spec.space)){const target=await erasureTarget(ctx,spec.table,match);if(target)result.push(target);}
  return result;
}
export async function erasureAction(ctx: Reader, table: Primary, row: ErasureRow, domain: ErasureDomain, memo = new Map<string, boolean>()): Promise<{action: ErasureAction; reason?: string}> {
  const direct = explicitErasureAction(table, row, domain);
  if (direct) return direct;
  const target = await erasureTarget(ctx, table, row);
  if (!target || target.preparedGeneration !== (await requireLifecycleReady(ctx)).generation) erasureFail("REFERENCE_SOURCE_NOT_PREPARED");
  if (table === "conversationShares" || table === "factHistory") {
    const edges = await ctx.db.query("cortexReferenceEdges").withIndex("by_source", q => q.eq("sourceTargetId", target._id)).collect();
    const relevant = edges.filter(e => e.role === (table === "conversationShares" ? "share-source" : "history-source"));
    for (const edge of relevant) {
      if (!edge.targetTargetId || edge.kind === "unresolved") return {action: "block", reason: "SOURCE_PROVENANCE_UNRESOLVED"};
      const source = await ctx.db.get(edge.targetTargetId);
      if (!source || !source.scopeKnown || source.ownershipRevision !== edge.capturedOwnershipRevision) return {action: "block", reason: "SOURCE_PROVENANCE_UNRESOLVED"};
      if (domain.kind === "space" && source.tenantId === domain.tenantId && source.memorySpaceId === domain.memorySpaceId) return {action: "delete"};
      if (domain.kind === "user" && await readPhysicalAuthority(ctx, source._id, domain.userId!, {tenantId:domain.tenantId}, memo)) return {action: "delete"};
    }
    if(table==="factHistory"&&(domain.kind==="space"?row.memorySpaceId===domain.memorySpaceId:row.userId===domain.userId||row.ownerUserId===domain.userId||strings(row.associatedUserIds).includes(domain.userId!)))return {action:"block",reason:"SOURCE_PROVENANCE_UNRESOLVED"};
    return {action: "preserve", reason: "foreignSourceOrActorOnly"};
  }
  if (await readPhysicalAuthority(ctx, target._id, domain.userId!, {tenantId:domain.tenantId, memorySpaceId:typeof row.memorySpaceId === "string" ? row.memorySpaceId : undefined}, memo)) return {action: "delete"};
  const edges = await ctx.db.query("cortexReferenceEdges").withIndex("by_source", q => q.eq("sourceTargetId", target._id)).collect();
  const candidates = edges.filter(e => e.authorityCandidate);
  // An unrelated unowned row is preserved. A relevant/unknown authority cannot be blessed by a current alias.
  for(const edge of candidates) {
    if(edge.targetTargetId) {
      const source=await ctx.db.get(edge.targetTargetId);
      // A stable captured exclusive foreign owner is positive preservation
      // evidence, even in the selected tenant. Revision changes remain unknown.
      if(source?.scopeKnown&&source.ownershipRevision===edge.capturedOwnershipRevision&&source.ownerState==="explicit"&&source.owners?.length===1&&source.owners[0]!==domain.userId)continue;
      if(edge.capturedTargetTenantId===domain.tenantId)return {action:"block",reason:"SOURCE_PROVENANCE_UNRESOLVED"};
    } else if(edge.naturalHint) {
      const hints=await hintedTargets(ctx,table,row,edge);
      if(hints.some(source=>source.tenantId===domain.tenantId&&source.owners?.includes(domain.userId!)))return {action:"block",reason:"SOURCE_PROVENANCE_UNRESOLVED"};
    }
  }
  if (row.sourceUserId === domain.userId && !candidates.length) return {action: "block", reason: "SOURCE_PROVENANCE_UNRESOLVED"};
  return {action: "preserve", reason: "noExclusivePhysicalAuthority"};
}
export function erasureEdgeKind(role: string, authority: boolean): "hard" | "data" | "backlink" {
  if (authority || ["context-parent", "context-root", "share-source", "snapshot-source", "history-source", "attachment"].includes(role)) return "hard";
  if (["context-child", "history-affected", "history-result", "fact-supersedes", "fact-supersededBy", "history-supersedes", "history-supersededBy"].includes(role)) return "backlink";
  return "data";
}
export async function projectErasure(ctx: Reader, table: Primary, row: ErasureRow, domain: ErasureDomain): Promise<ErasureProjection> {
  const action = await erasureAction(ctx, table, row, domain), target = await erasureTarget(ctx, table, row);
  const result: ErasureProjection = {table,id:String(row._id),fingerprint:digest(row),...action,dependencies:[],retainedVersions:Array.isArray(row.previousVersions) ? row.previousVersions.length : Array.isArray(row.versionHistory) ? row.versionHistory.length : 0,messages:Array.isArray(row.messages) ? row.messages.length : 0,serializedBytes:byteSize(row),storageIds:[]};
  if (!target || !["delete", "root", "detach"].includes(action.action)) return result;
  if(table==="contexts"&&action.action==="delete") {
    const duplicates=await ctx.db.query("contexts").withIndex("by_tenant_contextId",q=>q.eq("tenantId",domain.tenantId).eq("contextId",String(row.contextId))).take(2);
    if(duplicates.length!==1)erasureFail("ERASURE_CONTEXT_AMBIGUOUS");
    if(!Number.isSafeInteger(row.depth)||(row.depth as number)<0)erasureFail("ERASURE_CONTEXT_HIERARCHY");
  }
  const edges = await ctx.db.query("cortexReferenceEdges").withIndex("by_source", q => q.eq("sourceTargetId", target._id)).collect();
  for (const edge of edges) {
    if (!edge.targetTargetId) {
      if(table==="contexts"&&["context-parent","context-root","context-child","access-space"].includes(edge.role))erasureFail("SOURCE_PROVENANCE_UNRESOLVED");
      // An unresolved hint orders an independently owned consumer first; it is never authority.
      if(edge.kind==="unresolved"&&edge.naturalHint) {
        const hinted=await hintedTargets(ctx,table,row,edge);
        for(const destination of hinted)if(destination.documentId&&destination.documentId!==result.id)result.dependencies.push({id:destination.documentId,kind:"hard"});
      }
      continue;
    }
    const destination = await ctx.db.get(edge.targetTargetId);
    if (!destination) erasureFail("REFERENCE_TARGET_MISSING");
    if (edge.kind === "storage") {if (destination.storageId) result.storageIds.push(destination.storageId);continue;}
    if(table==="contexts"&&["context-parent","context-root","context-child","access-space"].includes(edge.role)) {
      if(destination.tenantId!==row.tenantId||destination.memorySpaceId!==row.memorySpaceId)erasureFail("ERASURE_CONTEXT_CROSS_SCOPE");
      if(edge.role==="context-parent"&&destination.documentId) {
        const parentId=ctx.db.normalizeId("contexts",destination.documentId),parent=parentId?await ctx.db.get(parentId):null;
        if(!parent||parent.depth+1!==row.depth)erasureFail("ERASURE_CONTEXT_HIERARCHY");
      }
    }
    // A source link is hard ownership authority only when eligibility actually
    // borrows that authority. Independently owned payloads retain ordinary data
    // links, including deterministic data SCCs; hierarchy/grant/history roles
    // remain hard regardless of their independent owner.
    const kind = erasureEdgeKind(edge.role, Boolean(edge.authorityCandidate) && explicitErasureAction(table,row,domain)===undefined);
    if (destination.documentId && kind !== "backlink" && destination.documentId !== result.id) result.dependencies.push({id:destination.documentId,kind});
  }
  result.storageIds = [...new Set(result.storageIds)];
  if (table in graphTables && action.action !== "detach") {
    if (!Number.isSafeInteger(target.sourceRevision) || target.sourceRevision! < 1) erasureFail("GRAPH_SOURCE_NOT_PREPARED");
    result.graph = {identity:sourceIdentity(table as keyof typeof graphTables,row),sourceRevision:target.sourceRevision!,ownershipRevision:target.ownershipRevision!,referenceGeneration:target.generation,referenceRevision:target.revision,evidence:{targetId:target._id,generation:target.generation,physicalSourceId:result.id,scopeKnown:true}};
    const queue = await ctx.db.query("graphSyncQueue").withIndex("by_scope_source_state", q=>q.eq("tenantId",domain.tenantId).eq("physicalSourceId",result.id)).take(129);
    if(queue.length>128)erasureFail("GRAPH_ERASURE_QUEUE_BUDGET");
    if(queue.some(job=>job.schemaVersion!==2||job.identity?.key!==result.graph!.identity.key))erasureFail("GRAPH_JOB_UNRESOLVED");
    result.managedQueueCount=queue.length;
  }
  return result;
}
/** Recompute each live incoming source's eligibility. No client selected-ID allowlist. */
export async function checkErasureIncoming(ctx: Reader, table: Primary, row: ErasureRow, domain: ErasureDomain, preflight=false): Promise<void> {
  const target = await erasureTarget(ctx,table,row); if (!target) erasureFail("REFERENCE_TARGET_MISSING");
  const incoming = await ctx.db.query("cortexReferenceEdges").withIndex("by_target", q => q.eq("targetTargetId", target._id)).collect();
  const unknown = target.naturalKeyDigest ? await ctx.db.query("cortexReferenceEdges").withIndex("by_unresolved_hint", q => q.eq("naturalHint", target.naturalKeyDigest)).collect() : [];
  for (const edge of [...incoming,...unknown]) {
    if (edge.kind === "storage") continue;
    const source = await ctx.db.get(edge.sourceTargetId); if (!source) erasureFail("SOURCE_PROVENANCE_UNRESOLVED");
    if (source.state === "deleted" && source.finalSnapshotDigest) continue;
    if (!source.table || !source.documentId) erasureFail("SOURCE_PROVENANCE_UNRESOLVED");
    const id = ctx.db.normalizeId(source.table,source.documentId); const sourceRow = id ? await ctx.db.get(id) : null;
    if (!sourceRow) erasureFail("SOURCE_PROVENANCE_UNRESOLVED");
    if(source.table==="graphSyncQueue") {
      const queue=sourceRow as Doc<"graphSyncQueue">;
      if(queue.schemaVersion===2 && queue.physicalSourceId===row._id && queue.tenantId===domain.tenantId && queue.identity?.physicalSourceId===row._id)continue;
      // A disposed source job may retain its owning-space metadata binding. It is
      // operational history, not a live incoming payload, only after the exact
      // physical source has been deleted and its copied content has been removed.
      if(table==="memorySpaces" && domain.kind==="space" && edge.role==="space" &&
        queue.schemaVersion===2 && queue.tenantKnown===true && queue.tenantId===domain.tenantId &&
        queue.memorySpaceId===domain.memorySpaceId && queue.identity?.tenantId===(domain.tenantId??null) &&
        queue.identity.memorySpaceId===domain.memorySpaceId && queue.identity.physicalSourceId===queue.physicalSourceId &&
        (queue.state==="synced"||queue.state==="suppressed") && Number.isFinite(queue.disposedAt) &&
        queue.entity===undefined && queue.projection===undefined && queue.projectionJson===undefined && queue.requestJson===undefined &&
        queue.table in graphTables && queue.physicalSourceId) {
        const authority=await ctx.db.query("cortexReferenceTargets").withIndex("by_document",q=>q.eq("table",queue.table as Primary).eq("documentId",queue.physicalSourceId!)).take(2).then(uniqueReference);
        if(authority?.state==="deleted" && authority.finalSnapshotDigest && authority.scopeKnown===true &&
          authority.tenantId===domain.tenantId && authority.memorySpaceId===domain.memorySpaceId &&
          Number.isSafeInteger(queue.sourceRevision) && Number.isSafeInteger(authority.sourceRevision) && authority.sourceRevision!>=queue.sourceRevision!)continue;
      }
      // Preparation can include ordinary jobs of another selected live source.
      // This exception is read-only: mutation/root checks still require that
      // source's deletion and copied-data disposal above. Its own projection's
      // managedQueueCount requires the explicit graph participant before writes.
      if(preflight && table==="memorySpaces" && domain.kind==="space" && edge.role==="space" &&
        queue.schemaVersion===2 && queue.tenantKnown===true && queue.tenantId===domain.tenantId &&
        queue.memorySpaceId===domain.memorySpaceId && queue.table in graphTables && queue.physicalSourceId) {
        const primary=queue.table as keyof typeof graphTables;
        const sourceId=ctx.db.normalizeId(primary,queue.physicalSourceId),live=sourceId?await ctx.db.get(sourceId):null;
        const authority=live?await erasureTarget(ctx,primary,live as unknown as ErasureRow):undefined;
        if(live && authority?.state==="live" && authority.scopeKnown===true &&
          authority.tenantId===domain.tenantId && authority.memorySpaceId===domain.memorySpaceId &&
          queue.identity?.key===sourceIdentity(primary,live as unknown as ErasureRow).key &&
          Number.isSafeInteger(queue.sourceRevision) && Number.isSafeInteger(authority.sourceRevision) && authority.sourceRevision!>=queue.sourceRevision!) {
          const membership=await erasureAction(ctx,primary,live as unknown as ErasureRow,domain);
          if(membership.action==="delete"||membership.action==="root")continue;
        }
      }
      erasureFail("GRAPH_JOB_UNRESOLVED");
    }
    const membership = await erasureAction(ctx,source.table,sourceRow as unknown as ErasureRow,domain);
    if (membership.action !== "delete" && membership.action !== "root") erasureFail("ERASURE_FOREIGN_INCOMING");
    if (edge.kind === "unresolved" && !preflight) erasureFail("SOURCE_PROVENANCE_UNRESOLVED");
    await reserveLifecycle(ctx,2048);
  }
}
export function normalizeErasureId(ctx: Reader, table: Primary, value: string): Id<Primary> {const id=ctx.db.normalizeId(table,value);if (!id) erasureFail("ERASURE_PHYSICAL_ID_INVALID");return id;}
export type ErasureTarget = Doc<"cortexReferenceTargets">;
