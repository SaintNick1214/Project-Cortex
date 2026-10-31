import { z } from "zod";
import { ASSET_MAX_BYTES } from "./assets.js";

// Schema-only leaf: model policy must initialize without importing job helpers.
const identifier = z.string().min(1).max(256).refine(value => value.trim() === value);
/** Immutable private input proof. Binary materialization is confined to an action. */
export const mediaInputAssetSchema = z.object({ assetId: identifier, assetVersion: z.number().int().positive(), versionId: identifier,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/), sizeBytes: z.number().int().min(1).max(ASSET_MAX_BYTES), mimeType: z.literal("image/png") }).strict();
const imageOptions = z.object({ kind: z.literal("image"), n: z.literal(1), size: z.literal("1024x1024"), quality: z.literal("low"), outputFormat: z.literal("png") }).strict();
const videoOptions = z.object({ kind: z.literal("video"), n: z.literal(1), duration: z.literal(4), resolution: z.literal("720p"), generateAudio: z.literal(false) }).strict();
export const mediaEnvelopeSchema = z.object({ version: z.literal(1), prompt: z.string().min(1),
  options: z.discriminatedUnion("kind", [imageOptions, videoOptions]), input: mediaInputAssetSchema.optional(),
  webhookUrl: z.string().optional() }).strict();
export type MediaEnvelopeV1 = z.infer<typeof mediaEnvelopeSchema>;
export const mediaContractSchema = z.object({ version: z.literal(1), options: z.discriminatedUnion("kind", [imageOptions, videoOptions]),
  inputProtocol: z.enum(["none", "immutable-image-inline-v1"]), maximumInputAssetBytes: z.number().int().min(0).max(4096),
  maximumResultBytes: z.number().int().min(1).max(ASSET_MAX_BYTES), callbacks: z.boolean(),
  terminalIdentity: z.enum(["requested-only", "observed-model-id"]), usage: z.enum(["optional", "tokens-required"]) }).strict();
export type QualifiedMediaContractV1 = z.infer<typeof mediaContractSchema>;
export const mediaResultSchema = z.object({ version: z.literal(1), kind: z.literal("media"), jobId: identifier,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/), sizeBytes: z.number().int().min(1).max(ASSET_MAX_BYTES),
  mimeType: z.enum(["image/png", "video/mp4", "video/webm"]) }).strict();
export type MediaResultV1 = z.infer<typeof mediaResultSchema>;
