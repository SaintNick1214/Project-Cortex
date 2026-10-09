import { z } from "zod";
import { canonicalModelJson } from "./model-policy.js";
import { ASSET_MAX_BYTES, assertAssetSize } from "./assets.js";
import type { RuntimeAssetVersion } from "./assets.js";
import { assertUnicode, utf8Bytes } from "./transcript.js";
import { mediaEnvelopeSchema, mediaContractSchema } from "./media-schemas.js";
import type { MediaEnvelopeV1, MediaResultV1 } from "./media-schemas.js";
export { mediaInputAssetSchema, mediaEnvelopeSchema, mediaContractSchema, mediaResultSchema } from "./media-schemas.js";
export type { MediaEnvelopeV1, QualifiedMediaContractV1, MediaResultV1 } from "./media-schemas.js";

export const MEDIA_JOB_STATES = ["pending", "submitting", "submission_unknown", "processing", "downloading", "ready", "failed", "cancelled", "expired"] as const;
export type MediaJobState = typeof MEDIA_JOB_STATES[number];
export const MEDIA_LEASE_MS = 120_000;
export const MEDIA_OPERATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MEDIA_MAX_DOWNLOAD_ATTEMPTS = 3;
export const MEDIA_MAX_POLLS = 2048;
const identifier = z.string().min(1).max(256).refine(value => value.trim() === value);
export const mediaSubmitSchema = z.object({ requestId: identifier, kind: z.enum(["image", "video"]),
  prompt: z.string().min(1).refine(value => { try { assertUnicode(value); return !!value.trim() && utf8Bytes(value) <= 1024; } catch { return false; } }),
  inputAsset: z.object({ assetId: identifier, version: z.number().int().positive() }).strict().optional(),
  conversationId: identifier.optional() }).strict();
export type MediaSubmitV1 = z.infer<typeof mediaSubmitSchema>;
export interface RuntimeMediaJobV1 {
  version: 1; jobId: string; artifactId: string; kind: "image" | "video"; state: MediaJobState;
  revision: number; createdAt: number; updatedAt: number; asset?: RuntimeAssetVersion; failureCode?: string; deliveryExpiresAt?: number;
  costStatus: "reserved" | "incurred_unknown" | "settled"; upstreamCancellation: "not_requested" | "not_supported";
}
export function assertMediaBytes(bytes: Uint8Array, mimeType: MediaResultV1["mimeType"]): void {
  const matches = mimeType === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    : mimeType === "video/webm" ? [26, 69, 223, 163].every((value, index) => bytes[index] === value)
    : bytes.length >= 12 && [102, 116, 121, 112].every((value, index) => bytes[index + 4] === value);
  if (!matches) throw new Error("MEDIA_OUTPUT_INVALID");
}
export function mediaInputBound(input: unknown, contractInput: unknown, modelId: string): number {
  const envelope = mediaEnvelopeSchema.parse(JSON.parse(canonicalModelJson(input)));
  const contract = mediaContractSchema.parse(JSON.parse(canonicalModelJson(contractInput)));
  assertUnicode(envelope.prompt);
  if (!envelope.prompt.trim() || utf8Bytes(envelope.prompt) > 1024 || canonicalModelJson(envelope.options) !== canonicalModelJson(contract.options)
    || (envelope.input !== undefined) !== (contract.inputProtocol === "immutable-image-inline-v1")
    || envelope.options.kind === "image" && (envelope.input || envelope.webhookUrl || contract.callbacks)
    || (envelope.webhookUrl !== undefined) !== contract.callbacks) throw new Error("POLICY_DENIED: media envelope differs from qualification");
  if (envelope.input && (envelope.input.sizeBytes > contract.maximumInputAssetBytes || envelope.options.kind !== "video")) throw new Error("POLICY_DENIED: private input exceeds qualified envelope");
  if (envelope.webhookUrl) {
    const url = new URL(envelope.webhookUrl);
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.convex\.site$/.test(url.hostname) || url.username || url.password || url.port
      || url.pathname !== "/cortex/media/video/webhook" || url.hash || [...url.searchParams.keys()].join() !== "jobId" || !url.searchParams.get("jobId")) throw new Error("POLICY_DENIED: unsupported callback origin");
  }
  const body = mediaWireBody(envelope, modelId, envelope.input ? "" : undefined);
  // Base64 uses JSON-safe ASCII. Count the complete native framing and exact
  // encoded immutable byte length without storing it in a Convex document.
  return utf8Bytes(canonicalModelJson(body)) + (envelope.input ? 4 * Math.ceil(envelope.input.sizeBytes / 3) : 0);
}
export function mediaWireBody(envelope: MediaEnvelopeV1, modelId: string, privateBase64?: string): Record<string, unknown> {
  const options = envelope.options;
  return options.kind === "image" ? { model: modelId, prompt: envelope.prompt, n: 1, size: options.size, quality: options.quality, output_format: options.outputFormat }
    : { model: modelId, prompt: envelope.prompt, duration: options.duration, resolution: options.resolution, generate_audio: options.generateAudio,
      ...(envelope.input ? { frame_images: [{ type: "image_url", frame_type: "first_frame", image_url: { url: `data:${envelope.input.mimeType};base64,${privateBase64 ?? ""}` } }] } : {}),
      ...(envelope.webhookUrl ? { webhook_url: envelope.webhookUrl } : {}) };
}
export function decodeMediaBytes(input: string | Uint8Array, cap = ASSET_MAX_BYTES): Uint8Array<ArrayBuffer> {
  if (input instanceof Uint8Array) { assertAssetSize(input.byteLength, cap); return new Uint8Array(input); }
  if (!input || input.length > 4 * Math.ceil(cap / 3) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input)) throw new Error(input.length > 4 * Math.ceil(cap / 3) ? "ASSET_TOO_LARGE" : "MEDIA_OUTPUT_INVALID");
  const padding = input.endsWith("==") ? 2 : input.endsWith("=") ? 1 : 0;
  assertAssetSize(input.length / 4 * 3 - padding, cap);
  const binary = atob(input); if (btoa(binary) !== input) throw new Error("MEDIA_OUTPUT_INVALID");
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
