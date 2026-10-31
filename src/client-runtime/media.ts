import type { RuntimeMediaJob, RuntimeMediaJobState, RuntimeMediaSubmit } from "./types.js";
import { assetReference, assetVersion } from "./assets.js";
import { deliveryDeadline, identifier, invalid, natural, object } from "./validation.js";

export function mediaSubmit(input: unknown): RuntimeMediaSubmit {
  const row = object(input);
  if (Object.keys(row).some(key => !["requestId", "kind", "prompt", "inputAsset", "conversationId"].includes(key))
    || !["image", "video"].includes(row.kind as string) || typeof row.prompt !== "string" || !row.prompt.trim()) invalid();
  const bytes = new TextEncoder().encode(row.prompt);
  if (bytes.length > 1024 || new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes) !== row.prompt) invalid();
  if (row.kind === "image" && row.inputAsset !== undefined) invalid("UNSUPPORTED_MEDIA_INPUT");
  return { requestId: identifier(row.requestId), kind: row.kind as "image" | "video", prompt: row.prompt,
    ...(row.inputAsset === undefined ? {} : { inputAsset: assetReference(row.inputAsset as never) }),
    ...(row.conversationId === undefined ? {} : { conversationId: identifier(row.conversationId) }) };
}
export function mediaJob(input: unknown): RuntimeMediaJob {
  const row = object(input), revision = natural(row.revision), createdAt = natural(row.createdAt), updatedAt = natural(row.updatedAt);
  if (row.version !== 1 || revision < 1 || updatedAt < createdAt || !["image", "video"].includes(row.kind as string)
    || !["pending", "submitting", "submission_unknown", "processing", "downloading", "ready", "failed", "cancelled", "expired"].includes(row.state as string)
    || !["reserved", "incurred_unknown", "settled"].includes(row.costStatus as string)
    || !["not_requested", "not_supported"].includes(row.upstreamCancellation as string)
    || row.failureCode !== undefined && (typeof row.failureCode !== "string" || !/^[A-Z][A-Z0-9_]{0,79}$/.test(row.failureCode))) invalid("INVALID_RESPONSE");
  const asset = row.asset === undefined ? undefined : assetVersion(row.asset);
  if ((asset !== undefined) !== (row.state === "ready") || asset && asset.mediaKind !== row.kind) invalid("INVALID_RESPONSE");
  return Object.freeze({ version: 1, jobId: identifier(row.jobId), artifactId: identifier(row.artifactId),
    kind: row.kind as "image" | "video", state: row.state as RuntimeMediaJobState, revision, createdAt, updatedAt,
    ...(row.deliveryExpiresAt === undefined ? {} : { deliveryExpiresAt: deliveryDeadline(row.deliveryExpiresAt) }),
    costStatus: row.costStatus as RuntimeMediaJob["costStatus"], upstreamCancellation: row.upstreamCancellation as RuntimeMediaJob["upstreamCancellation"],
    ...(asset === undefined ? {} : { asset }), ...(row.failureCode === undefined ? {} : { failureCode: row.failureCode as string }) });
}
export function mediaListOptions(input: unknown): { conversationId?: string; limit?: number } {
  const row = object(input);
  if (Object.keys(row).some(key => !["conversationId", "limit"].includes(key))
    || row.limit !== undefined && (natural(row.limit) < 1 || (row.limit as number) > 50)) invalid();
  return { ...(row.conversationId === undefined ? {} : { conversationId: identifier(row.conversationId) }),
    ...(row.limit === undefined ? {} : { limit: row.limit as number }) };
}
export function mediaJobList(input: unknown, limit: number): { version: 1; jobs: RuntimeMediaJob[] } {
  const row = object(input);
  if (row.version !== 1 || !Array.isArray(row.jobs) || row.jobs.length > limit) invalid("INVALID_RESPONSE");
  const jobs = row.jobs.map(mediaJob);
  if (new Set(jobs.map(job => job.jobId)).size !== jobs.length) invalid("INVALID_RESPONSE");
  return { version: 1, jobs };
}
