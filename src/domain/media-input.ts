import { z } from "zod";
import { canonicalModelJson } from "./model-policy.js";

/** Fixed first-frame envelope; storage20M and general provider16MiB limits are separate. */
export const PRIVATE_FRAME_VIDEO_MAX_JSON_BYTES = 8192;
export const PRIVATE_FRAME_VIDEO_MAX_IMAGE_BYTES = 4096;
export const PRIVATE_FRAME_VIDEO_MODEL_ID = "google/veo-3.1";
const bodySchema = z.object({
  model: z.literal(PRIVATE_FRAME_VIDEO_MODEL_ID), prompt: z.string().min(1),
  resolution: z.literal("720p"), duration: z.literal(4), generate_audio: z.literal(false),
  frame_images: z.tuple([z.object({ type: z.literal("image_url"), frame_type: z.literal("first_frame"),
    image_url: z.object({ url: z.string() }).strict() }).strict()]),
}).strict();
export type PrivateFrameVideoBody = z.infer<typeof bodySchema>;
const denied = (): never => { throw new Error("POLICY_DENIED: private frame video envelope mismatch"); };
/** Actual complete native JSON, not an estimate or provider option supplied by a client. */
export function privateFrameVideoInputBound(canonical: string, modelId: string): number {
  const encoded = new TextEncoder().encode(canonical).byteLength;
  if (encoded > PRIVATE_FRAME_VIDEO_MAX_JSON_BYTES || modelId !== PRIVATE_FRAME_VIDEO_MODEL_ID) denied();
  let input: unknown; try { input = JSON.parse(canonical); } catch { return denied(); }
  const parsed = bodySchema.safeParse(input); if (!parsed.success) return denied();
  const body = parsed.data;
  if (canonicalModelJson(body) !== canonical || !body.prompt.trim() || new TextEncoder().encode(body.prompt).byteLength > 1024) denied();
  for (const point of body.prompt) { const code = point.codePointAt(0)!; if (code >= 0xd800 && code <= 0xdfff) denied(); }
  const url = body.frame_images[0].image_url.url, prefix = "data:image/png;base64,";
  if (!url.startsWith(prefix)) denied();
  const base64 = url.slice(prefix.length);
  if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) denied();
  let decoded: string; try { decoded = atob(base64); } catch { return denied(); }
  if (decoded.length > PRIVATE_FRAME_VIDEO_MAX_IMAGE_BYTES || decoded.length < 8 || btoa(decoded) !== base64
    || [137, 80, 78, 71, 13, 10, 26, 10].some((byte, index) => decoded.charCodeAt(index) !== byte)) denied();
  return encoded;
}
