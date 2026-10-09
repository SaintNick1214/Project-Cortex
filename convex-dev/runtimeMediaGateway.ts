/** Official alpha media adapters, governed once before the billable submission. */
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { ActionCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeAssetVersion } from "../src/domain/assets";
import { assetContentHash } from "../src/domain/assets";
import { canonicalModelJson, validateModelRequest } from "../src/domain/model-policy";
import type { ModelCallRequest, ModelPolicySnapshotV1 } from "../src/domain/model-policy";
import { decodeMediaBytes, assertMediaBytes, mediaInputBound, mediaContractSchema } from "../src/domain/media-jobs";
import type { MediaEnvelopeV1, MediaResultV1 } from "../src/domain/media-jobs";
import { createBackendGatewayComposition } from "./runtimeGatewayBackend";
import type { GatewayBinding, GatewayResolution } from "./runtimeGateway";
import { storeGeneratedAsset, readPrivateProviderAsset } from "./runtimeAssets";
import { mediaDenied } from "./runtimeMediaFence";
type Job = Doc<"runtimeMediaJobs">;
const ref = <A extends Record<string, unknown>, R>(name: string) => makeFunctionReference<"mutation", A, R>(`runtimeMediaJobs:${name}`) as FunctionReference<"mutation", "public", A, R>;
/** Trusted server factory seam for the disposable actual collector. It cannot be
 * supplied through any public registration or change reservation/checkpoint. */
export interface MediaNativeAdapter {
  image(input: { prompt: string; signal: AbortSignal }): Promise<MediaNativeOutput>;
  start(input: { prompt: string; image?: string; webhookUrl?: string; signal: AbortSignal }): Promise<{ operation: string; inferenceId: string; webhookSecret?: string }>;
  status(operation: string, signal: AbortSignal): Promise<"pending" | "completed" | "failed">;
  download(operation: string, signal: AbortSignal): Promise<MediaNativeOutput>;
}
export interface MediaNativeOutput { data: string | Uint8Array; mimeType: "image/png" | "video/mp4" | "video/webm"; actualModel?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }; aggregateCostUsd?: string }
export type MediaNativeFactory = (modelId: string) => MediaNativeAdapter;
export const officialMediaFactory: MediaNativeFactory = modelId => {
  const image = convexGateway.imageModel(modelId); const video = convexGateway.videoModel(modelId);
  return {
    image: async input => {
      const result = await image.doGenerate({ prompt: input.prompt, n: 1, size: "1024x1024", aspectRatio: undefined, seed: undefined,
        files: undefined, mask: undefined, providerOptions: { convexGateway: { quality: "low", output_format: "png" } }, abortSignal: input.signal });
      if (result.images.length !== 1) throw new Error("MEDIA_OUTPUT_INVALID");
      // response.modelId is a constructor echo; it is not serving evidence.
      return { data: result.images[0]!, mimeType: "image/png" };
    },
    start: async input => {
      const result = await video.doStart({ prompt: input.prompt, n: 1, duration: 4, resolution: "720p", aspectRatio: undefined,
        fps: undefined, seed: undefined, image: input.image ? { type: "file", mediaType: "image/png", data: input.image } : undefined,
        frameImages: undefined, inputReferences: undefined, generateAudio: false,
        providerOptions: { convexGateway: { resolution: "720p", generate_audio: false } }, abortSignal: input.signal, ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}) });
      const metadata = result.providerMetadata?.convexGateway;
      if (typeof result.operation !== "string" || typeof metadata?.inferenceId !== "string" || metadata.webhookSecret !== undefined && typeof metadata.webhookSecret !== "string") throw new Error("MEDIA_SUBMISSION_UNKNOWN");
      return { operation: result.operation, inferenceId: metadata.inferenceId, ...(typeof metadata.webhookSecret === "string" ? { webhookSecret: metadata.webhookSecret } : {}) };
    },
    status: async (operation, signal) => { const result = await video.getStatus({ operation, abortSignal: signal }); return result.status === "error" ? "failed" : result.status; },
    download: async (operation, signal) => {
      const result = await video.download({ operation, abortSignal: signal });
      if (result.videos.length !== 1 || !["video/mp4", "video/webm"].includes(result.videos[0]!.mediaType)) throw new Error("MEDIA_OUTPUT_INVALID");
      return { data: result.videos[0]!.data, mimeType: result.videos[0]!.mediaType as "video/mp4" | "video/webm" };
    },
  };
};
function envelope(job: Job, resolution: GatewayResolution): MediaEnvelopeV1 {
  const contract = mediaContractSchema.parse(resolution.dispatchEvidence.mediaContract);
  if (contract.options.kind !== job.kind) mediaDenied("CAPABILITY_UNAVAILABLE");
  let webhookUrl: string | undefined;
  if (contract.callbacks) {
    const origin = process.env.CONVEX_SITE_URL;
    if (!origin) mediaDenied("CAPABILITY_UNAVAILABLE");
    webhookUrl = `${origin.replace(/\/$/, "")}/cortex/media/video/webhook?jobId=${encodeURIComponent(job.jobId)}`;
  }
  const value: MediaEnvelopeV1 = { version: 1, prompt: job.prompt, options: contract.options, ...(job.input ? { input: job.input } : {}), ...(webhookUrl ? { webhookUrl } : {}) };
  mediaInputBound(value, contract, resolution.snapshot.modelId); return value;
}
function request(job: Job, snapshot: ModelPolicySnapshotV1, value: MediaEnvelopeV1, resolution: GatewayResolution): ModelCallRequest {
  return { semanticId: job.jobId, childCallId: "pending-server-identity", texts: [job.prompt], messages: [{ role: "user", parts: [{ type: "text", text: job.prompt }] }],
    inputTokens: mediaInputBound(value, resolution.dispatchEvidence.mediaContract, snapshot.modelId), outputTokens: 0, toolSteps: 0,
    timeoutMs: snapshot.limits.timeoutMs, reservationUnits: snapshot.costBound.maximumCostUnits, tools: [], options: { maxRetries: 0 },
    promptVersion: snapshot.pins.promptVersion, schemaVersion: snapshot.pins.schemaVersion, extractionVersion: snapshot.pins.extractionVersion,
    toolRegistryVersion: snapshot.pins.toolRegistryVersion, media: value };
}
async function checkpoint(ctx: ActionCtx, job: Job, leaseToken?: string): Promise<Job> { return ctx.runMutation(ref<{ jobId: string; leaseToken?: string }, Job>("checkpoint"), { jobId: job.jobId, ...(leaseToken ? { leaseToken } : {}) }); }
async function fail(ctx: ActionCtx, jobId: string, error: unknown, uncertain: boolean) {
  const text = error instanceof Error ? error.message : "";
  const code = text === "ASSET_TOO_LARGE" ? text : text === "MEDIA_OUTPUT_INVALID" || text === "MEDIA_DOWNLOAD_FAILED" ? text : text.includes("CAPABILITY_UNAVAILABLE") ? "MEDIA_CAPABILITY_UNAVAILABLE" : uncertain ? "MEDIA_SUBMISSION_UNKNOWN" : "MEDIA_PROVIDER_FAILED";
  await ctx.runMutation(ref("markFailure"), { jobId, code, uncertain });
}
function timer(timeoutMs: number) { const controller = new AbortController(); const id = setTimeout(() => controller.abort(), Math.min(120_000, timeoutMs)); return { signal: controller.signal, close: () => clearTimeout(id) }; }
async function captureOutput(ctx: ActionCtx, job: Job, output: MediaNativeOutput, resolution: GatewayResolution): Promise<{ bytes: Uint8Array<ArrayBuffer>; result: MediaResultV1 }> {
  if (!job.attemptId || !job.dispatchIdentity) throw new Error("MEDIA_RESULT_WITHHELD");
  const composition = createBackendGatewayComposition(ctx); const proof = resolution.dispatchEvidence;
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = decodeMediaBytes(output.data, mediaContractSchema.parse(proof.mediaContract).maximumResultBytes); assertMediaBytes(bytes, output.mimeType); if ((job.kind === "image") !== (output.mimeType === "image/png")) throw new Error("MEDIA_OUTPUT_INVALID"); }
  catch (error) {
    // Returned output is genuine terminal evidence even when it cannot be stored.
    await composition.terminalSink.capture({ attemptId: job.attemptId, dispatchIdentity: job.dispatchIdentity,
      receiptCanonical: canonicalModelJson({ version: 1, dispatchIdentity: job.dispatchIdentity, receiptId: `${job.jobId}:terminal`, modelId: resolution.snapshot.modelId,
        nativeInterface: job.kind, outcome: "confirmed_rejected", proof: "provider-terminal-v1", costSource: "unavailable", media: { jobId: job.jobId, status: "completed" } }) });
    throw error;
  }
  const result: MediaResultV1 = { version: 1, kind: "media", jobId: job.jobId, contentHash: await assetContentHash(bytes.buffer), sizeBytes: bytes.byteLength, mimeType: output.mimeType };
  const receipt = { version: 1, dispatchIdentity: job.dispatchIdentity, receiptId: `${job.jobId}:terminal`, modelId: resolution.snapshot.modelId,
    nativeInterface: job.kind, outcome: "confirmed", proof: "provider-terminal-v1", costSource: output.aggregateCostUsd === undefined ? "unavailable" : "gateway-aggregate-usd-v1",
    ...(output.aggregateCostUsd === undefined ? {} : { aggregateCostUsd: output.aggregateCostUsd }), ...(output.usage ? { usage: output.usage } : {}),
    ...(output.actualModel ? { actualModel: output.actualModel } : {}), media: { jobId: job.jobId, status: "completed", contentHash: result.contentHash, sizeBytes: result.sizeBytes, mimeType: result.mimeType } };
  const evidence = await composition.terminalSink.capture({ attemptId: job.attemptId, dispatchIdentity: job.dispatchIdentity, receiptCanonical: canonicalModelJson(receipt) });
  const attached = await composition.ledger.attachTerminalResult({ reference: job.reference, attemptId: job.attemptId, evidenceId: evidence.evidenceId, privateResultCanonical: canonicalModelJson(result) });
  if (!attached.attached) throw new Error("MEDIA_RESULT_WITHHELD"); return { bytes, result };
}
async function materialize(ctx: ActionCtx, job: Job, output: MediaNativeOutput, resolution: GatewayResolution) {
  const captured = await captureOutput(ctx, job, output, resolution);
  await checkpoint(ctx, job);
  await ctx.runMutation(ref("retainResult"), { jobId: job.jobId, resultCanonical: canonicalModelJson(captured.result) });
  const asset = await storeGeneratedAsset(ctx, job.reference, { requestId: `media-output:${job.jobId}`, mimeType: captured.result.mimeType,
    lineage: { kind: "generated", operationId: job.modelOperationId!, modelId: resolution.snapshot.modelId, ...(job.input ? { sourceVersionIds: [job.input.versionId] } : {}) } }, new Blob([captured.bytes], { type: captured.result.mimeType }));
  await ctx.runMutation(ref("materialized"), { jobId: job.jobId, resultCanonical: canonicalModelJson(captured.result), versionId: asset.versionId });
}
export async function processSubmissionHandler(ctx: ActionCtx, args: { jobId: string }, factory: MediaNativeFactory = officialMediaFactory): Promise<null> {
  const job = await ctx.runMutation(ref<{ jobId: string }, (Job & { leaseToken: string }) | null>("claimSubmission"), { jobId: args.jobId }); if (!job) return null;
  let issued = false; let returned = false; let clock: ReturnType<typeof timer> | undefined;
  try {
    const composition = createBackendGatewayComposition(ctx); const binding: GatewayBinding = { reference: job.reference, operationKey: job.kind === "image" ? "media.image.generate" : "media.video.generate", runBudgetId: job.runBudgetId, semanticId: job.jobId, ordinal: 0, ...(job.parentOperationId ? { parentOperationId: job.parentOperationId } : {}) };
    const resolution = await composition.ledger.resolve(binding); const value = envelope(job, resolution);
    const input = canonicalModelJson(validateModelRequest(resolution.snapshot, request(job, resolution.snapshot, value, resolution)).request);
    const admitted = await composition.ledger.admit({ ...binding, requestCanonical: input });
    if (admitted.status !== "reserved") throw new Error("MEDIA_SUBMISSION_UNKNOWN");
    // Persist original permit identity before starting. A save failure cannot cause
    // another native call; the durable lease becomes unknown instead.
    const permit = await composition.ledger.checkpoint({ reference: job.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical });
    if (!permit.dispatchPermit) throw new Error("MEDIA_SUBMISSION_UNKNOWN");
    await ctx.runMutation(ref("bindAttempt"), { jobId: job.jobId, leaseToken: job.leaseToken, attemptId: admitted.attemptId, modelOperationId: admitted.operationId, dispatchIdentity: permit.dispatchIdentity,
      snapshotCanonical: canonicalModelJson(admitted.snapshot), proofCanonical: canonicalModelJson(resolution.dispatchEvidence), envelopeCanonical: canonicalModelJson(value) });
    let image: string | undefined;
    if (job.input) { const privateInput = await readPrivateProviderAsset(ctx, job.reference, { assetId: job.input.assetId, version: job.input.assetVersion, protocol: "image-inline-v1" }); image = privateInput.envelope.image?.split(",", 2)[1]; }
    await checkpoint(ctx, job, job.leaseToken); clock = timer(admitted.snapshot.limits.timeoutMs); const native = factory(admitted.snapshot.modelId); issued = true;
    if (job.kind === "video") {
      const started = await native.start({ prompt: job.prompt, ...(image ? { image } : {}), ...(value.webhookUrl ? { webhookUrl: value.webhookUrl } : {}), signal: clock.signal });
      await ctx.runMutation(ref("acknowledge"), { jobId: job.jobId, leaseToken: job.leaseToken, ...started });
    } else {
      const output = await native.image({ prompt: job.prompt, signal: clock.signal }); returned = true;
      await ctx.runMutation(ref("providerTerminal"), { jobId: job.jobId, status: "completed" });
      const current = await ctx.runMutation(ref<{ jobId: string }, Job>("chargeState"), { jobId: job.jobId }); await materialize(ctx, current, output, resolution);
    }
  } catch (error) {
    if (returned && !(error instanceof Error && ["ASSET_TOO_LARGE", "MEDIA_OUTPUT_INVALID", "MEDIA_RESULT_WITHHELD"].includes(error.message))) await ctx.runMutation(ref("downloadFailed"), { jobId: job.jobId, leaseToken: job.leaseToken });
    else await fail(ctx, job.jobId, error, issued && !returned);
    await ctx.runMutation(ref("cleanupOutput"), { jobId: job.jobId });
  }
  finally { clock?.close(); }
  return null;
}
export async function processPollHandler(ctx: ActionCtx, args: { jobId: string }, factory: MediaNativeFactory = officialMediaFactory): Promise<null> {
  const job = await ctx.runMutation(ref<{ jobId: string }, Job | null>("pollCheckpoint"), args); if (!job) return null;
  const clock = timer(30_000);
  try {
    const snapshot = JSON.parse(job.snapshotCanonical!) as ModelPolicySnapshotV1;
    const status = await factory(snapshot.modelId).status(job.operation!, clock.signal);
    if (status === "pending") { await checkpoint(ctx, job); await ctx.runMutation(ref("pollAgain"), args); }
    else {
      if (status === "failed" && job.attemptId && job.dispatchIdentity) await createBackendGatewayComposition(ctx).terminalSink.capture({ attemptId: job.attemptId, dispatchIdentity: job.dispatchIdentity,
        receiptCanonical: canonicalModelJson({ version: 1, dispatchIdentity: job.dispatchIdentity, receiptId: `${job.jobId}:terminal`, modelId: snapshot.modelId, nativeInterface: "video", outcome: "confirmed_rejected", proof: "provider-terminal-v1", costSource: "unavailable", media: { jobId: job.jobId, status: "failed" } }) });
      await ctx.runMutation(ref("providerTerminal"), { jobId: job.jobId, status: status === "completed" ? "completed" : "failed" });
    }
  } catch { await ctx.runMutation(ref("pollAgain"), args); }
  finally { clock.close(); } return null;
}
export async function processDownloadHandler(ctx: ActionCtx, args: { jobId: string }, factory: MediaNativeFactory = officialMediaFactory): Promise<null> {
  const ready = await ctx.runMutation(ref<{ jobId: string }, { asset: RuntimeAssetVersion; resultCanonical: string } | null>("recoverStoredOutput"), args);
  if (ready) { await ctx.runMutation(ref("materialized"), { jobId: args.jobId, resultCanonical: ready.resultCanonical, versionId: ready.asset.versionId }); return null; }
  const job = await ctx.runMutation(ref<{ jobId: string }, (Job & { leaseToken: string }) | null>("claimDownload"), args); if (!job) return null;
  const clock = timer(120_000);
  try {
    if (!job.operation) throw new Error("MEDIA_DOWNLOAD_FAILED");
    const resolution: GatewayResolution = { snapshot: JSON.parse(job.snapshotCanonical!), dispatchEvidence: JSON.parse(job.proofCanonical!), storageLimits: { canonicalBytes: 180_000, privateResultBytes: 60_000, embeddingValuesPerCall: 1 } };
    const output = await factory(resolution.snapshot.modelId).download(job.operation, clock.signal);
    await materialize(ctx, job, output, resolution);
  } catch (error) {
    if (error instanceof Error && ["ASSET_TOO_LARGE", "MEDIA_OUTPUT_INVALID", "MEDIA_RESULT_WITHHELD", "MEDIA_DOWNLOAD_FAILED"].includes(error.message)) await fail(ctx, job.jobId, error, false);
    else await ctx.runMutation(ref("downloadFailed"), { jobId: job.jobId, leaseToken: job.leaseToken });
    await ctx.runMutation(ref("cleanupOutput"), { jobId: job.jobId });
  } finally { clock.close(); } return null;
}
