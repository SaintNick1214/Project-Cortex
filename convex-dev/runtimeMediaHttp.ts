/** Raw signed callback signal. Job credentials never reach application clients. */
import { verifyVideoWebhook } from "@convex-dev/ai-sdk-provider";
import { makeFunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";
import { readBoundedAsset } from "../src/domain/assets";
import { semanticHash } from "../src/domain/profile";
export const videoWebhook = httpAction(async (ctx, request) => {
  const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
  try {
    const url = new URL(request.url); const jobId = url.searchParams.get("jobId");
    if (!jobId || jobId.length > 256 || !request.body) throw new Error("DENIED");
    const claimed = request.headers.get("Content-Length"); if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > 4096)) throw new Error("DENIED");
    const bytes = await readBoundedAsset(request.body, 4096); const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const held = await ctx.runMutation(makeFunctionReference<"mutation", { jobId: string }, { secret: string; operation: string; inferenceId: string } | null>("runtimeMediaJobs:callbackLookup"), { jobId });
    if (!held) return new Response(JSON.stringify({ version: 1, code: "MEDIA_CALLBACK_NOT_READY" }), { status: 409, headers });
    const event = await verifyVideoWebhook({ body, signature: request.headers.get("x-convex-video-signature"), secret: held.secret });
    if (event.operation !== held.operation || event.id !== held.inferenceId) throw new Error("DENIED");
    await ctx.runMutation(makeFunctionReference<"mutation">("runtimeMediaJobs:acceptCallback"), { jobId, operation: held.operation, inferenceId: held.inferenceId, status: event.status, secretHash: await semanticHash(held.secret), bodyHash: await semanticHash(body) });
    return new Response(JSON.stringify({ version: 1, accepted: true }), { status: 200, headers });
  } catch { return new Response(JSON.stringify({ version: 1, code: "MEDIA_CALLBACK_DENIED" }), { status: 403, headers }); }
});
