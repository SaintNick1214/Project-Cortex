/** Owned action for one pinned secondary call; no public provider bypass. */
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { ContentJob } from "./runtimeContentFence";
import { contentOperation, contentSystem, CONTENT_MAX_INPUT_BYTES, CONTENT_MAX_OUTPUT_BYTES, parseContentOutput } from "../src/domain/content";
import { canonicalModelJson } from "../src/domain/model-policy";
import { createBackendGatewayComposition } from "./runtimeGatewayBackend";
import { createGovernedGatewayModel, GatewayDispatchError } from "./runtimeGateway";
import type { GatewayComposition, GatewayBinding } from "./runtimeGateway";
const mutationRef = (name: string) => makeFunctionReference<"mutation">(`runtimeContentJobs:${name}`);
const work = { jobId: v.string(), leaseToken: v.string() };
export type ContentModelFactory = typeof createGovernedGatewayModel;
export async function processContentStageHandler(ctx: ActionCtx, args: { jobId: string; leaseToken: string }, factory: ContentModelFactory = createGovernedGatewayModel): Promise<null> {
  const { job, document } = await ctx.runMutation(mutationRef("input"), args) as { job: ContentJob; document: string };
  const operationKey = job.stage === "primary" ? contentOperation(job.intent) : "conversation.title";
  const binding: GatewayBinding = { reference: job.reference, operationKey, runBudgetId: job.runBudgetId,
    semanticId: `${job.jobId}:${job.stage}`, ordinal: 0,
    ...(job.stage === "title" ? { parentOperationId: job.primaryOperationId! } : job.parentOperationId ? { parentOperationId: job.parentOperationId } : {}) };
  const base = createBackendGatewayComposition(ctx);
  const resolution = await base.ledger.resolve(binding);
  await ctx.runMutation(mutationRef("pin"), { ...args, snapshotCanonical: canonicalModelJson(resolution.snapshot) });
  const guard = async () => { await ctx.runMutation(mutationRef("input"), args); };
  const composition: GatewayComposition = { ...base, ledger: { ...base.ledger,
    resolve: async request => { await guard(); return base.ledger.resolve(request); },
    admit: async request => { await guard(); const admission = await base.ledger.admit(request); await ctx.runMutation(mutationRef("bindOperation"), { ...args, operationId: admission.operationId }); return admission; },
    checkpoint: async request => { await guard(); return base.ledger.checkpoint(request); },
    markVisible: async request => { await guard(); return base.ledger.markVisible(request); },
    attachTerminalResult: async request => { await guard(); return base.ledger.attachTerminalResult(request); },
  } };
  const governed = await factory(composition, binding);
  try {
    if (!("doGenerate" in governed.model)) throw new GatewayDispatchError("CAPABILITY_UNAVAILABLE");
    const intent = job.stage === "title" ? "title" : job.intent;
    const prompt = job.stage === "title" ? job.prompt : `${job.prompt}${document ? `\n\nPinned document:\n${document}` : ""}`;
    // Bound the actual assembled prompt. No truncation or silently omitted source.
    if (new TextEncoder().encode(prompt).length > CONTENT_MAX_INPUT_BYTES + CONTENT_MAX_OUTPUT_BYTES + 32) throw new GatewayDispatchError("CONTENT_INPUT_TOO_LARGE");
    let text: string;
    try {
      const result = await governed.model.doGenerate({ prompt: [{ role: "system", content: contentSystem(intent) }, { role: "user", content: [{ type: "text", text: prompt }] }],
        maxOutputTokens: resolution.snapshot.limits.outputTokens, abortSignal: governed.lifecycle.signal });
      if (result.content.some(part => part.type !== "text")) throw new GatewayDispatchError("CONTENT_OUTPUT_INVALID");
      text = result.content.map(part => part.type === "text" ? part.text : "").join("");
    } catch (error) {
      if (!(error instanceof GatewayDispatchError) || error.code !== "REPLAY_AVAILABLE") throw error;
      const replay = await governed.lifecycle.consumeReplay();
      if (!replay || !("text" in replay)) throw new GatewayDispatchError("INVALID_REPLAY"); text = replay.text;
    }
    parseContentOutput(intent, text);
    await ctx.runMutation(mutationRef("save"), { ...args, text });
    return null;
  } finally { await governed.lifecycle.complete(); }
}
export const processStage = internalAction({ args: work, handler: processContentStageHandler });
