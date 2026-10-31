import { deliveryDeadline, identifier, invalid, natural, object } from "./validation.js";
import type { RuntimeArtifact, RuntimeEmbeddingProfile, RuntimeMemoryReadiness, RuntimeMemoryReadinessOptions, RuntimeMemoryStage, RuntimeStageWatermark } from "./types.js";
import { assetMime, RUNTIME_ASSET_MAX_BYTES } from "./assets.js";
import { SUPPORTED_EMBEDDING_PROFILES } from "../domain/profile.js";

export function runtimeEmbeddingProfile(input: unknown): RuntimeEmbeddingProfile {
  const row = object(input);
  const dimensions = natural(row.dimensions);
  if (!SUPPORTED_EMBEDDING_PROFILES.some(profile => ["profileId", "modelId", "dimensions", "normalization", "chunking", "indexName"]
    .every(key => row[key] === profile[key as keyof typeof profile]))) invalid("INVALID_RESPONSE");
  return Object.freeze({ profileId: identifier(row.profileId), modelId: identifier(row.modelId), dimensions,
    normalization: identifier(row.normalization), chunking: identifier(row.chunking), indexName: identifier(row.indexName) });
}
export function memoryStages(input: unknown): RuntimeMemoryStage[] {
  if (!Array.isArray(input) || input.length > 3) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Object.getPrototypeOf(input) !== Array.prototype || Reflect.ownKeys(descriptors).length !== input.length + 1
    || Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !("value" in descriptors[key]!))) invalid();
  if (new Set(input).size !== input.length || input.some(value => !["facts", "vectors", "graph"].includes(value as string))) invalid();
  return [...input] as RuntimeMemoryStage[];
}
export function embeddingProfileOptions(input: unknown): { operationKey?: "embedding.memory" | "embedding.query"; expectedProfileId?: string } {
  const row = object(input);
  if (Object.keys(row).some(key => !["operationKey", "expectedProfileId"].includes(key))
    || row.operationKey !== undefined && !["embedding.memory", "embedding.query"].includes(row.operationKey as string)) invalid();
  return { ...(row.operationKey === undefined ? {} : { operationKey: row.operationKey as "embedding.memory" | "embedding.query" }),
    ...(row.expectedProfileId === undefined ? {} : { expectedProfileId: identifier(row.expectedProfileId) }) };
}
export function readinessOptions(input: unknown): RuntimeMemoryReadinessOptions {
  const row = object(input);
  if (Object.keys(row).some(key => !["cutoff", "graphCutoff", "expectedProfileId", "strictStages"].includes(key))) invalid();
  return { ...(row.cutoff === undefined ? {} : { cutoff: natural(row.cutoff) }),
    ...(row.graphCutoff === undefined ? {} : { graphCutoff: natural(row.graphCutoff) }),
    ...(row.expectedProfileId === undefined ? {} : { expectedProfileId: identifier(row.expectedProfileId) }),
    ...(row.strictStages === undefined ? {} : { strictStages: memoryStages(row.strictStages) }) };
}
function watermark(input: unknown, expectedCutoff: number, graph = false): RuntimeStageWatermark {
  const row = object(input), cutoff = natural(row.cutoff), indexedThrough = natural(row.indexedThrough);
  if (cutoff !== expectedCutoff || typeof row.complete !== "boolean") invalid("INVALID_RESPONSE");
  let hole: RuntimeStageWatermark["hole"] = null;
  if (row.hole !== null) {
    const value = object(row.hole), sequence = natural(value.sequence);
    if ((!graph && sequence !== indexedThrough + 1) || sequence > cutoff || !["pending", "failed", "missing"].includes(value.state as string)) invalid("INVALID_RESPONSE");
    hole = { sequence, state: value.state as "pending" | "failed" | "missing" };
  }
  if (row.complete !== (indexedThrough >= cutoff && hole === null)) invalid("INVALID_RESPONSE");
  if (!row.complete && hole === null) invalid("INVALID_RESPONSE");
  return Object.freeze({ cutoff, indexedThrough, complete: row.complete, hole });
}
export function memoryReadiness(input: unknown): RuntimeMemoryReadiness {
  const row = object(input), cutoff = natural(row.cutoff), graphCutoff = natural(row.graphCutoff), raw = object(row.stages);
  if (row.version !== 1 || Object.keys(raw).some(key => !["facts", "vectors", "graph"].includes(key))) invalid("INVALID_RESPONSE");
  const stages: Partial<Record<RuntimeMemoryStage, RuntimeStageWatermark>> = {};
  for (const name of ["facts", "vectors", "graph"] as const) if (raw[name] !== undefined) stages[name] = watermark(raw[name], cutoff, name === "graph");
  if (!stages.facts || !stages.vectors) invalid("INVALID_RESPONSE");
  const strictStages = memoryStages(row.strictStages);
  if (strictStages.some(name => !stages[name]?.complete)) invalid("INVALID_RESPONSE");
  return Object.freeze({ version: 1, cutoff, graphCutoff, profile: runtimeEmbeddingProfile(row.profile), stages: Object.freeze(stages), strictStages: Object.freeze(strictStages) });
}
export function runtimeArtifact(input: unknown): RuntimeArtifact {
  const row = object(input), artifactVersion = natural(row.version), versionPointer = natural(row.versionPointer);
  if (artifactVersion < 1 || versionPointer < 1 || versionPointer > artifactVersion || typeof row.title !== "string"
    || row.content !== undefined && typeof row.content !== "string"
    || !["text", "code", "sheet", "image", "video", "diagram", "html", "custom"].includes(row.kind as string)
    || !["draft", "streaming", "paused", "final", "error"].includes(row.streamingState as string)) invalid("INVALID_RESPONSE");
  let file: RuntimeArtifact["file"];
  if (row.fileRef !== undefined) {
    const value = object(row.fileRef), sizeBytes = natural(value.size), version = natural(value.assetVersion);
    if (!version || !sizeBytes || sizeBytes > RUNTIME_ASSET_MAX_BYTES || typeof value.checksum !== "string" || !/^[a-f0-9]{64}$/.test(value.checksum)
      || row.content !== undefined) invalid("INVALID_RESPONSE");
    file = Object.freeze({ assetId: identifier(value.assetId), version, versionId: identifier(value.versionId), contentHash: value.checksum, sizeBytes, mimeType: assetMime(value.mimeType) });
  }
  const conversation = row.conversationRef === undefined ? undefined : identifier(object(row.conversationRef).conversationId);
  return Object.freeze({ contractVersion: 1, ...(row.deliveryExpiresAt === undefined ? {} : { deliveryExpiresAt: deliveryDeadline(row.deliveryExpiresAt) }), artifactId: identifier(row.artifactId), artifactVersion, versionPointer,
    kind: row.kind as RuntimeArtifact["kind"], title: row.title, streamingState: row.streamingState as RuntimeArtifact["streamingState"],
    createdAt: natural(row.createdAt), updatedAt: natural(row.updatedAt), ...(row.content === undefined ? {} : { content: row.content as string }),
    ...(file === undefined ? {} : { file }), ...(conversation === undefined ? {} : { conversationId: conversation }) });
}
