/** Credential-free native peers and official injected-fetch transform fixtures only.
 * Synthetic qualifications never enter the production bootstrap registry. */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4GenerateResult, LanguageModelV4StreamPart, EmbeddingModelV4 } from "@ai-sdk/provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import type { GatewayBinding, GatewayComposition, GatewayLedgerPort, GatewayResolution } from "/workspace/Project-Cortex/convex-dev/runtimeGateway";
import { canonicalModelJson, resolveModelPolicy, validateModelRequest } from "/workspace/Project-Cortex/src/domain/model-policy";
import type { ModelCallRequest } from "/workspace/Project-Cortex/src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE } from "/workspace/Project-Cortex/src/domain/profile";
import type { Id } from "/workspace/Project-Cortex/convex-dev/_generated/dataModel";
import type { RuntimeAuthorityReference } from "/workspace/Project-Cortex/src/auth/verified";
const server = await import("convex/server");
const tokenLookup = jest.fn<() => Promise<string>>().mockRejectedValue(new Error("OFFLINE_TOKEN_PROHIBITED"));
jest.unstable_mockModule("convex/server", () => ({ ...server, getServiceToken: tokenLookup }));
const { conservativeUsdDecimal, createGovernedGatewayModel, governGatewayLanguageModel, governGatewayEmbeddingModel } = await import("/workspace/Project-Cortex/convex-dev/runtimeGateway");
const hash = "a".repeat(64);
const reference = { tenantId: "t", tenantEpoch: 1, memorySpaceId: "s", memorySpaceEpoch: 1, principalId: "p", principalVersion: 1, membershipId: "m", membershipVersion: 1, grantId: "g", grantVersion: 1 } as RuntimeAuthorityReference;
const binding: GatewayBinding = { reference, operationKey: "agent.respond", runBudgetId: "budget", semanticId: "stable-semantic", ordinal: 0 };
const pins = { promptVersion: "p1", schemaVersion: "s1", extractionVersion: "e1", toolRegistryVersion: "t1", priceRevision: "price1", boundRevision: "bound1" };
function resolution(embedding = false): GatewayResolution {
  const modelId = embedding ? DEFAULT_EMBEDDING_PROFILE.modelId : "openai/gpt-4o-mini";
  const nativeInterface = embedding ? "embedding" as const : "chat" as const;
  const limits = { inputTokens: 10000, contextTokens: 11000, outputTokens: 64, toolSteps: 4, timeoutMs: 1000, operationBudgetUnits: 100000, runBudgetUnits: 1000000, tenantBudgetUnits: 1000000, concurrency: 3 };
  const q = { receiptId: "fixture", modelId, nativeInterface, capabilities: embedding ? ["embedding" as const] : ["text" as const], allowedOptions: ["temperature" as const, "seed" as const], limits,
    costBound: { kind: "qualified-call-ceiling" as const, maximumCostUnits: 10000, provenance: "SYNTHETIC-OFFLINE-ONLY", coversAllProviderCharges: true as const }, priceRevision: "price1", boundRevision: "bound1" };
  const snapshot = resolveModelPolicy({ context: { scope: reference, operationKey: embedding ? "embedding.query" : "agent.respond", runBudgetId: "budget", authorizedOverrides: [], ...(embedding ? { semanticProfile: DEFAULT_EMBEDDING_PROFILE } : {}) },
    policies: [{ policyId: "d", version: 1, scope: "deployment", rules: { modelId, nativeInterface, allowedModels: [modelId], interfaces: [nativeInterface], capabilities: q.capabilities, allowedOptions: q.allowedOptions, allowedTools: [], fallbackModels: [], limits, pins } }], qualifications: [q] });
  return { snapshot, storageLimits: { canonicalBytes: 180000, privateResultBytes: 60000, embeddingValuesPerCall: 1 }, dispatchEvidence: {
    receiptId: "fixture", modelId, nativeInterface, evidenceHash: hash, providerVersion: "0.2.1", priceRevision: "price1", boundRevision: "bound1", checkedAt: 0, expiresAt: 100000,
    terminalCost: "gateway-aggregate-usd-v1", terminalProof: "provider-terminal-v1",
    inputBound: { ruleId: embedding ? "default-embedding-utf8-v1" : "plain-chat-cookbook-utf8-v1", featureEnvelope: embedding ? "default-embedding-v1" : "plain-chat-v1", revision: 1, proofHash: hash, documentHash: hash, nativeTransformHash: hash },
    resultBound: { maximumPrivateResultBytes: 60000, maximumOutputTokens: 64, maximumEmbeddingValues: 1, proofHash: hash } } };
}
const params = (): LanguageModelV4CallOptions => ({ prompt: [{ role: "user", content: [{ type: "text", text: " hello\r\n " }] }], maxOutputTokens: 16 });
function raw(text = "answer", cost: unknown = "0.0005") { return { id: "convex-receipt", model: "openai/gpt-4o-mini", choices: [{ finish_reason: "stop", message: { content: text } }], usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10, cost } }; }
function generated(text = "answer", body = raw(text)): LanguageModelV4GenerateResult {
  return { content: [{ type: "text", text }, { type: "reasoning", text: "SECRET_REASONING" }], finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 2, text: 2, reasoning: 0 } }, response: { body }, warnings: [] };
}
function fixture(embedding = false) {
  const r = resolution(embedding); const b = { ...binding, operationKey: embedding ? "embedding.query" as const : "agent.respond" as const };
  const events: string[] = []; const receipts: string[] = []; const admissions: (GatewayBinding & { requestCanonical: string })[] = []; let disposition: "reserved" | "uncertain" | "inflight" | "replay" = "reserved";
  const nativeCalls: LanguageModelV4CallOptions[] = []; let nativeCount = 0; let revoked = false; let captureFails = false; let changedPermit = false; let changedAdmit = false; let ledgerSettled = false;
  const ledger: GatewayLedgerPort = {
    resolve: async () => { events.push("resolve"); if (revoked) throw new Error("revoked"); return r; },
    admit: async (args) => {
      events.push("admit"); admissions.push(args);
      if (disposition !== "reserved") return disposition === "replay" ? { status: "replay", operationId: "op" as Id<"runtimeModelOperations">, resultCanonical: canonicalModelJson({ text: "saved" }) }
        : { status: disposition, operationId: "op" as Id<"runtimeModelOperations">, attemptId: "attempt" as Id<"runtimeModelAttempts"> };
      const input = JSON.parse(args.requestCanonical) as ModelCallRequest;
      const request = { ...input, childCallId: "server-child", ...(changedAdmit ? { texts: ["tampered"], messages: [{ role: "user" as const, parts: [{ type: "text" as const, text: "tampered" }] }] } : {}) };
      validateModelRequest(r.snapshot, request);
      return { status: "reserved", operationId: "op" as Id<"runtimeModelOperations">, attemptId: "attempt" as Id<"runtimeModelAttempts">, snapshot: r.snapshot, requestCanonical: canonicalModelJson(request) };
    },
    checkpoint: async (args) => { events.push("checkpoint"); disposition = "uncertain"; return { dispatchPermit: true, dispatchIdentity: "dispatch", snapshot: r.snapshot, requestCanonical: changedPermit ? "{}" : args.requestCanonical }; },
    markVisible: async (args) => { events.push(args.outputVisible ? "visible" : "current"); if (ledgerSettled) throw new Error("B visibility requires pending state"); if (revoked) throw new Error("revoked"); return { recorded: true }; },
    settle: async (args) => { events.push("settle"); if (revoked) throw new Error("revoked"); const receipt = JSON.parse(args.receiptCanonical) as { costSource: string; privateResultCanonical?: string };
      ledgerSettled = receipt.costSource !== "unavailable"; return { state: receipt.costSource === "unavailable" ? "uncertain" : "settled", resultWithheld: !receipt.privateResultCanonical }; },
  };
  const composition: GatewayComposition = { ledger, now: () => 1000, terminalSink: { capture: async (e) => { events.push("capture"); if (captureFails) throw new Error("sink unavailable"); receipts.push(e.receiptCanonical); return { evidenceId: "durable-evidence" }; } } };
  const model: LanguageModelV4 = { specificationVersion: "v4", modelId: r.snapshot.modelId, provider: "convexGateway.chat", supportedUrls: {},
    doGenerate: async (input) => { events.push("native"); nativeCount++; nativeCalls.push(input); return generated(); },
    doStream: async (input) => { events.push("native"); nativeCount++; nativeCalls.push(input); return { stream: streamParts() }; } };
  function streamParts(parts?: LanguageModelV4StreamPart[]) { const items: LanguageModelV4StreamPart[] = parts ?? [
    { type: "reasoning-delta", id: "r", delta: "SECRET_REASONING" }, { type: "text-delta", id: "t", delta: "answer" },
    { type: "raw", rawValue: { id: "convex-receipt", model: r.snapshot.modelId, choices: [{ finish_reason: "stop" }] } },
    { type: "raw", rawValue: { id: "convex-receipt", model: r.snapshot.modelId, choices: [], usage: raw().usage } },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: generated().usage } ];
    return new ReadableStream<LanguageModelV4StreamPart>({ start(c) { items.forEach((x) => c.enqueue(x)); c.close(); } });
  }
  return { r, b, events, receipts, admissions, nativeCalls, model, composition, streamParts, count: () => nativeCount,
    disposition: (x: typeof disposition) => { disposition = x; }, revoke: () => { revoked = true; }, captureFail: () => { captureFails = true; }, captureResume: () => { captureFails = false; }, changedPermit: () => { changedPermit = true; }, changedAdmit: () => { changedAdmit = true; } };
}
beforeEach(() => { tokenLookup.mockClear(); });


describe("independent hostile deadline",()=>{
 it("reader deadline also bounds a paused visibility RPC and suppresses late delivery",async()=>{
  const f=fixture(); f.r.snapshot.limits.timeoutMs=20;
  let enter!:()=>void;let release!:()=>void;
  const entered=new Promise<void>(r=>enter=r);const paused=new Promise<void>(r=>release=r);
  f.composition.ledger.markVisible=async()=>{enter();await paused;return {recorded:true};};
  const h=governGatewayLanguageModel(f.model,f.composition,f.b,f.r);
  const result=await h.model.doStream(params());const reader=result.stream.getReader();await entered;
  let finished=false; const completion=h.lifecycle.complete().then(()=>{finished=true;},()=>{finished=true;});
  await new Promise(r=>setTimeout(r,70));
  const aborted=h.lifecycle.signal.aborted;const finishedAtDeadline=finished;
  release();const seen:LanguageModelV4StreamPart[]=[];
  try {for(;;){const x=await reader.read();if(x.done)break;seen.push(x.value);}}catch{}
  await completion;
  expect(aborted).toBe(true);
  expect({finishedAtDeadline,lateDeltas:seen.filter(x=>x.type==="text-delta")}).toEqual({finishedAtDeadline:true,lateDeltas:[]});
 });
});
