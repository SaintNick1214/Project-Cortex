/** Unit handler/component fixtures. These are never receipts for a deployed service. */
import { describe, expect, it } from "@jest/globals";
import { ConvexError, type Value } from "convex/values";
import { fixture, invoke } from "../unit/runtimeRegistryAuth/fixture";
import { assetFixture, installMockRoot, artifacts, attachments, transcript } from "../unit/runtimeAssets/fixture";
import { transcriptFixture } from "../unit/runtimeTranscript/fixture";
export { installMockRoot, artifacts, attachments };
export const conversations = await import("../../convex-dev/conversations");
export const shares = await import("../../convex-dev/conversationShares");
export const snapshots = await import("../../convex-dev/conversationSnapshots");
export type NativeCall = { path: string; registration: { isPublic?: boolean; isInternal?: boolean; isMutation?: boolean; isQuery?: boolean; exportArgs(): string } };
const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
export const assetReadNames = new Set(["get", "list", "count", "getByConversation", "getByMessage", "getByIds"]);
export function assetCapability(call: NativeCall) { return call.path.startsWith("attachments:") ? assetReadNames.has(call.path.split(":")[1]) ? "storage:read" : "storage:write" : "write"; }
export function transcriptCapability(call: NativeCall) {
  const [module, name] = call.path.split(":");
  if (module === "conversationShares") return ["get", "checkAccess"].includes(name) ? "read" : "admin";
  if (["setVisibility", "setMetadata", "approveMessage"].includes(name)) return "admin";
  return ["create", "getOrCreate", "addMessage", "rejectMessage", "deleteConversation", "deleteByIds", "deleteSnapshot"].includes(name) ? "write" : "read";
}
export async function assetCase(call: NativeCall) {
  const f = await assetFixture(); const { asset } = await f.upload("catalog bytes");
  const row = f.db.seed("artifacts", { ...scope, artifactId: "artifact-a", ownerPrincipalId: f.principal._id, userId: "user-a", kind: "text", title: "Private artifact", content: "draft", tags: [],
    version: 1, versionPointer: 1, versionHistory: [{ version: 1, content: "draft", title: "Private artifact", timestamp: 1, changeType: "create" }], streamingState: "draft", createdAt: 1, updatedAt: 1 });
  const conversation = await f.call<{ conversationId: string }>(conversations.create, { ...scope, conversationId: "asset-conversation", type: "user-agent", participants: { userId: "user-a", agentId: "label" } });
  const item = await f.call<{ attachmentId: string }>(attachments.create, { ...scope, assetId: asset.assetId, version: asset.assetVersion, attachmentId: "attachment-a", conversationId: conversation.conversationId, messageId: "message-a" });
  const [module, name] = call.path.split(":");
  let args: Record<string, unknown> = { ...scope, attachmentId: item.attachmentId };
  if (module === "artifacts") {
    args = { ...scope, artifactId: "artifact-a" };
    if (name === "completeArtifactUpload") Object.assign(args, { storageId: f.db.table("runtimeAssetVersions")[0].storageId, mimeType: asset.mimeType, size: asset.sizeBytes });
    else if (name === "attachAsset") Object.assign(args, { assetId: asset.assetId, version: asset.assetVersion });
    else if (name === "detachFile") await f.call(artifacts.attachAsset, { ...args, assetId: asset.assetId, version: asset.assetVersion });
  } else if (name === "create") args = { ...scope, assetId: asset.assetId, version: asset.assetVersion, attachmentId: "created-attachment" };
  else if (name === "attach") args = { ...scope, storageId: f.db.table("runtimeAssetVersions")[0].storageId, mimeType: asset.mimeType, size: asset.sizeBytes, userId: "user-a", type: "file", filename: "asset" };
  else if (["removeMany", "getByIds"].includes(name)) args = { ...scope, attachmentIds: [item.attachmentId] };
  else if (["list", "count"].includes(name)) args = { ...scope };
  else if (name === "getByConversation") args = { ...scope, conversationId: conversation.conversationId };
  else if (name === "getByMessage") args = { ...scope, messageId: "message-a" };
  return { f, args, asset, row, name, module };
}
export async function transcriptCase(call: NativeCall) {
  const f = await transcriptFixture();
  const created = await f.call<{ conversationId: string }>(conversations.create, { ...scope, conversationId: "conversation-a", type: "user-agent", participants: { userId: "user-a", agentId: "label" } });
  let row = f.db.table("runtimeConversations")[0];
  if (call.path === "conversations:approveMessage") row.requireApproval = true;
  await f.call(transcript.setPolicy, { conversationId: created.conversationId, expectedRevision: row.historyRevision, manualWriteLocked: false });
  await f.call(conversations.addMessage, { conversationId: created.conversationId, message: { id: "message-a", role: "user", content: "Canonical private text" } });
  row = f.db.table("runtimeConversations")[0];
  const snapshot = await f.call<{ snapshotId: string }>(snapshots.create, { conversationId: created.conversationId, createdBy: "user-a" });
  const permissions = { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: true };
  const share = await f.call<{ shareId: string }>(shares.create, { conversationId: created.conversationId, grantedBy: "user-a", grantType: "space", grantedTo: "space-a", permissions });
  const [module, name] = call.path.split(":");
  let args: Record<string, unknown> = { ...scope, conversationId: created.conversationId };
  if (module === "conversations") {
    if (name === "create") args = { ...scope, conversationId: "created-conversation", type: "user-agent", participants: { userId: "user-a", agentId: "label" } };
    if (name === "getOrCreate") args = { ...scope, type: "user-agent", participants: { userId: "user-a", agentId: "label" } };
    if (name === "findConversation") args = { ...scope, type: "user-agent", userId: "user-a" };
    if (name === "setVisibility") args.visibility = "space";
    if (name === "setMetadata") Object.assign(args, { userId: "user-a", metadata: { title: "Updated title" } });
    if (name === "addMessage") args.message = { id: "new-message", role: "user", content: "Appended canonical text" };
    if (["approveMessage", "rejectMessage", "getMessage"].includes(name)) args.messageId = "message-a";
    if (name === "approveMessage") args.approverId = "user-a";
    if (name === "rejectMessage") args.rejecterId = "user-a";
    if (name === "getMessagesByIds") args.messageIds = ["message-a"];
    if (name === "deleteByIds") args = { ...scope, conversationIds: [created.conversationId] };
    if (name === "deleteMany") args = { ...scope, dryRun: true };
    if (["list", "count"].includes(name)) args = { ...scope };
    if (name === "search") args = { ...scope, query: "Canonical" };
    if (name === "exportConversations") args = { ...scope, format: "json" };
  } else if (module === "conversationShares") {
    if (name === "create") args = { ...scope, conversationId: created.conversationId, grantedBy: "user-a", grantType: "space", grantedTo: "space-a", permissions };
    if (["get", "revoke"].includes(name)) args = { ...scope, shareId: share.shareId };
    if (name === "listByGranter") args = { ...scope, grantedBy: "user-a" };
  } else if (module === "conversationSnapshots") {
    if (name === "create") args.createdBy = "user-a";
    if (["get", "deleteSnapshot"].includes(name)) args = { ...scope, snapshotId: snapshot.snapshotId };
    if (name === "listByUser") args = { ...scope, userId: "user-a" };
  }
  return { f, args, name, module, conversationId: created.conversationId, row, snapshot, share };
}
/** Preserve original authority denial meanings independently of private fixture reads. */
export function openedAuthorityTests(calls: NativeCall[], capability: (call: NativeCall) => string, selectors: (call: NativeCall) => Record<string, unknown>) {
  for (const call of calls) describe(`${call.path} current authority`, () => {
    it.each(["missing", "forgedIssuer", "forgedSubject", "expired", "revoked", "grantDeleted", "capability", "opposite", "tenant", "space", "scopeDeleted", "scopeEpoch", "tenantDeleted", "principalDeleted", "principalRevoked", "membershipRevoked", "membershipDeleted", "tombstone"])("denies %s before private reads and effects", async variant => {
      const f = fixture(["read", "write", "admin", "storage:read", "storage:write"]); const args = selectors(call); const attempts: string[] = [];
      f.db.beforeRead = table => { if (!table.startsWith("runtimeAuth")) { attempts.push(table); throw new Error("PRIVATE_READ"); } };
      f.db.beforeWrite = table => { attempts.push(table); throw new Error("WRITE_EFFECT"); };
      Object.assign(f.ctx, { runQuery: () => { attempts.push("query"); throw new Error("EFFECT"); }, runMutation: () => { attempts.push("mutation"); throw new Error("EFFECT"); }, scheduler: { runAfter: () => { attempts.push("schedule"); throw new Error("EFFECT"); } }, storage: { delete: () => { attempts.push("storage"); throw new Error("EFFECT"); } } });
      if (variant === "missing") f.ctx.auth.getUserIdentity = async () => null;
      if (variant === "forgedIssuer") f.ctx.auth.getUserIdentity = async () => ({ issuer: "forged", subject: "user-a" }) as never;
      if (variant === "forgedSubject") f.ctx.auth.getUserIdentity = async () => ({ issuer: "https://host.test", subject: "forged" }) as never;
      if (variant === "expired") f.grant.expiresAt = Date.now() - 1;
      if (variant === "revoked") f.grant.revokedAt = 1;
      if (variant === "grantDeleted") f.grant.deletedAt = 1;
      if (variant === "capability") f.grant.capabilities = ["run", "tool"];
      if (variant === "opposite") f.grant.capabilities = [capability(call) === "read" ? "write" : capability(call) === "storage:read" ? "storage:write" : "read"];
      if (variant === "tenant") args.tenantId = "tenant-b";
      if (variant === "space") args.memorySpaceId = "space-b";
      if (variant === "scopeDeleted") f.db.table("runtimeAuthScopes")[1].deletedAt = 1;
      if (variant === "scopeEpoch") f.db.table("runtimeAuthScopes")[1].epoch = 2;
      if (variant === "tenantDeleted") f.db.table("runtimeAuthScopes")[0].deletedAt = 1;
      if (variant === "principalDeleted") f.principal.deletedAt = 1;
      if (variant === "principalRevoked") f.principal.revokedAt = 1;
      if (variant === "membershipRevoked") f.membership.revokedAt = 1;
      if (variant === "membershipDeleted") f.membership.deletedAt = 1;
      if (variant === "tombstone") f.db.seed("runtimeAuthTombstones", { ...scope, resourceType: "memorySpace", resourceId: "space-a", deletedAt: 1 });
      const error = await invoke(call.registration, f.ctx, args).then(() => undefined, (failure: unknown) => failure);
      expect(error).toBeInstanceOf(ConvexError); expect((error as ConvexError<Value>).data).toMatchObject({ code: variant === "missing" ? "UNAUTHENTICATED" : "FORBIDDEN", outcome: "not_dispatched" });
      expect(attempts).toEqual([]); expect(f.db.writes).toBe(0);
    });
  });
}
/** Unknown infrastructure faults cannot produce a success or any private effect.
 * Error-envelope sanitation belongs to the endpoint's actual adapter contract;
 * this does not fabricate a deployed Convex diagnostic receipt. */
export function openedFaultTests(calls: NativeCall[], selectors: (call: NativeCall) => Record<string, unknown>) {
  for (const call of calls) describe(`${call.path} infrastructure failures`, () => {
    it.each(["identity", "control"])("rejects %s faults without consulting exception getters or effects", async location => {
      let getters = 0;
      const failures = [new Error("PRIVATE SECRET"), new ConvexError("PRIVATE SECRET"), Object.defineProperty({}, "data", { get() { getters++; throw new Error("GETTER"); } }), new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("PROXY"); } })];
      for (const failure of failures) {
        const f = fixture(["read", "write", "admin", "storage:read", "storage:write"]);
        if (location === "identity") f.ctx.auth.getUserIdentity = async () => { throw failure; };
        else f.db.beforeRead = () => { throw failure; };
        const result = await Promise.resolve().then(() => invoke(call.registration, f.ctx, selectors(call))).then(() => ({ resolved: true }), error => ({ resolved: false, error }));
        expect(result.resolved).toBe(false); expect(f.db.writes).toBe(0);
        expect(f.db.traces.every(trace => trace.table.startsWith("runtimeAuth"))).toBe(true);
      }
      expect(getters).toBe(0);
    });
  });
}

export function assertCurrentArgs(call: NativeCall, args: Record<string, unknown>) {
  const fields = (JSON.parse(call.registration.exportArgs()) as { value: Record<string, { optional: boolean }> }).value;
  expect(Object.keys(args).filter(key => !(key in fields))).toEqual([]);
  for (const [key, field] of Object.entries(fields)) if (!field.optional) expect(args[key]).toBeDefined();
}
