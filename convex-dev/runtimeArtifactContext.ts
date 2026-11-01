import { deliveryExpiresAt } from "./runtimeDelivery";
/** Reconstruct the exact authorized artifact metadata consumed by a native tool. */
import { ConvexError } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { ArtifactContextWitness } from "../src/domain/artifact-context";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { recheckAuthority } from "./runtimeAuth";
import { managedConversationAccess } from "./runtimeDataAuth";
import { assetVersion, authorizeAsset, publicAsset } from "./runtimeAssetCatalog";
import { agentComponent, verifyMessage } from "./runtimeTranscript";
import { checkContextSourceWitnesses } from "./runtimeContextWitness";
type Ctx = Pick<QueryCtx, "db"> & Partial<Pick<QueryCtx, "runQuery">>;
function denied(code = "FORBIDDEN"): never { throw new ConvexError({ version: 1, code, message: "Artifact context denied.", retryable: false, outcome: "not_dispatched" }); }
export async function readArtifactContext(ctx: Ctx, reference: RuntimeAuthorityReference, artifactId: string, deadlines?: number[], expected?: ArtifactContextWitness) {
  const reliedOnDeadlines = deadlines ?? [];
  const s = { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId! };
  const artifact = await ctx.db.query("artifacts").withIndex("by_runtime_key", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("artifactId", artifactId)).unique();
  if (!artifact || !artifact.ownerPrincipalId || artifact.isDeleted || artifact.tombstonedAt !== undefined) denied();
  if (expected && artifact.versionPointer !== expected.artifactVersion) denied("STALE_CONTEXT");
  await recheckAuthority(ctx, reference, { ...s, capability: "read", resource: { ...s, resourceType: "artifact", resourceId: artifact.artifactId, ownerPrincipalId: artifact.ownerPrincipalId } });
  if (artifact.conversationRef) {
    const conversation = await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("conversationId", artifact.conversationRef!.conversationId)).unique();
    if (!conversation) denied();
    await managedConversationAccess(ctx, reference, conversation, "read", "canExport", reliedOnDeadlines);
    if (artifact.conversationRef.messageId !== undefined) {
      const messageId = artifact.conversationRef.messageId;
      const bridge = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("nativeMessageId", messageId)).unique();
      if (!bridge || bridge.conversationId !== conversation.conversationId || !ctx.runQuery) denied();
      const native = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: [bridge.nativeMessageId] });
      await verifyMessage({ db: ctx.db, runQuery: ctx.runQuery }, conversation, bridge, native[0]);
      await checkContextSourceWitnesses(ctx, reference, bridge.contextSourceWitnesses ?? [], reliedOnDeadlines);
    }
  }
  const asset = artifact.fileRef?.assetId && artifact.fileRef.assetVersion ? await assetVersion(ctx, s, artifact.fileRef.assetId, artifact.fileRef.assetVersion) : undefined;
  if (artifact.fileRef?.assetId && !asset) denied("STALE_CONTEXT");
  const metadata = { version: 1 as const, artifactId: artifact.artifactId, kind: artifact.kind, title: artifact.title, streamingState: artifact.streamingState,
    artifactVersion: artifact.versionPointer, ...(asset ? { asset: publicAsset(asset) } : {}) };
  if (expected && await semanticHash(canonicalModelJson(metadata)) !== expected.metadataHash) denied("STALE_CONTEXT");
  if (asset) await authorizeAsset(ctx, reference, asset, "storage:read", new Set(), reliedOnDeadlines);
  await deliveryExpiresAt(ctx, reference, reliedOnDeadlines);
  return metadata;
}
export async function artifactMetadataWitness(metadata: Awaited<ReturnType<typeof readArtifactContext>>): Promise<ArtifactContextWitness> {
  return { version: 1, artifactId: metadata.artifactId, artifactVersion: metadata.artifactVersion, metadataHash: await semanticHash(canonicalModelJson(metadata)) };
}
export async function checkArtifactContextWitnesses(ctx: Ctx, reference: RuntimeAuthorityReference, witnesses: readonly ArtifactContextWitness[], deadlines?: number[]): Promise<void> {
  if (witnesses.length > 32) denied("CONTEXT_LIMIT_EXCEEDED");
  const reliedOnDeadlines = deadlines ?? [];
  for (const witness of witnesses) {
    if (witness.version !== 1 || !witness.artifactId || !Number.isSafeInteger(witness.artifactVersion) || witness.artifactVersion < 1 || !/^[a-f0-9]{64}$/.test(witness.metadataHash)) denied("STALE_CONTEXT");
    const current = await artifactMetadataWitness(await readArtifactContext(ctx, reference, witness.artifactId, reliedOnDeadlines, witness));
    if (current.artifactVersion !== witness.artifactVersion || current.metadataHash !== witness.metadataHash) denied("STALE_CONTEXT");
  }
  if (witnesses.length) await deliveryExpiresAt(ctx, reference, reliedOnDeadlines);
}
