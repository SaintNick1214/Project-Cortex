/** Test-only export of exact candidate adapter; no product export and no PURE mocks. */
import { describe, expect, it } from "@jest/globals";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { domainControl } from "./instrumented";
import { canonicalModelJson, resolveModelPolicy, validateModelRequest, assertModelRequestIdentity } from "/workspace/Project-Cortex/src/domain/model-policy";
function thrown(call: () => unknown) { try { call(); } catch (error) { return error; } throw new Error("Expected rejection"); }
describe("test-only private adapter inspection", () => {
  it("preserves typed error identity, full attempt state and all data", () => {
    const error = new ConvexError({ code: "FORBIDDEN", attemptState: "dispatch_pending", outcome: "uncertain" });
    expect(thrown(() => domainControl(() => { throw error; }))).toBe(error);
    expect(error.data).toEqual({ code: "FORBIDDEN", attemptState: "dispatch_pending", outcome: "uncertain" });
  });
  it.each([new Error("ordinary upstream private detail"),new Error("OTHER_DENIAL: private"),new Error("IDEMPOTENCY_CONFLICTevil: private"),new Error(" INVALID_INPUT: private"),new Error("INVALID_INPUT:private"),"INVALID_INPUT: private",{ message: "INVALID_INPUT: private" },z.string().safeParse(1).error])("preserves unrelated value %# exactly", (error) => {
    expect(thrown(() => domainControl(() => { throw error; }))).toBe(error);
  });
  it("never executes message getter and retains original hostile Error", () => {
    let reads = 0; const error = new Error(); Object.defineProperty(error,"message",{ get() { reads++; throw new Error("getter private"); } });
    expect(thrown(() => domainControl(() => { throw error; }))).toBe(error); expect(reads).toBe(0);
  });
  it("proxy metadata trap cannot replace the original thrown object or become a denial", () => {
    const error = new Proxy(new Error("INVALID_INPUT: private"),{ getPrototypeOf() { throw new Error("metadata private"); } });
    expect(thrown(() => domainControl(() => { throw error; }))).toBe(error);
  });
  it("canonical input trap failures retain actual cause through real PURE call", () => {
    const error = new Error("external plain object trap private");
    const value = new Proxy({}, { getPrototypeOf() { throw error; } });
    expect(thrown(() => domainControl(() => canonicalModelJson(value)))).toBe(error);
  });
  it("normalizes authentic PURE contract and identity errors with static sanitized envelope", () => {
    const invalid = thrown(() => domainControl(() => resolveModelPolicy({})));
    expect(invalid).toBeInstanceOf(ConvexError);
    expect((invalid as ConvexError<never>).data).toEqual({ version: 1, code: "INVALID_INPUT", message: "Model operation control failed.", retryable: false, outcome: "not_dispatched" });
    const identity = thrown(() => domainControl(() => assertModelRequestIdentity({ canonical: "private-a", hash: "same" }, { canonical: "private-b", hash: "same" }), "uncertain"));
    expect((identity as ConvexError<never>).data).toEqual({ version: 1, code: "IDEMPOTENCY_CONFLICT", message: "Model operation control failed.", retryable: false, outcome: "uncertain" });
  });
});

it("authentic embedding request/profile denial keeps PROFILE_NOT_READY without raw detail", async () => {
  const { base, request } = await import("./domain-input");
  const { DEFAULT_EMBEDDING_PROFILE } = await import("/workspace/Project-Cortex/src/domain/profile");
  const input = base(); input.context.operationKey = "embedding.query"; input.context.semanticProfile = DEFAULT_EMBEDDING_PROFILE;
  input.policies[0].rules.modelId = DEFAULT_EMBEDDING_PROFILE.modelId;
  input.policies[0].rules.nativeInterface = "embedding";
  input.policies[0].rules.allowedModels = [DEFAULT_EMBEDDING_PROFILE.modelId];
  input.policies[0].rules.interfaces = ["embedding"]; input.policies[0].rules.capabilities = ["embedding"];
  input.qualifications[0] = { ...input.qualifications[0], modelId: DEFAULT_EMBEDDING_PROFILE.modelId, nativeInterface: "embedding", capabilities: ["embedding"] };
  const snapshot = resolveModelPolicy(input);
  const error = thrown(() => domainControl(() => validateModelRequest(snapshot, { ...request, messages: undefined })));
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<never>).data).toEqual({ version: 1, code: "PROFILE_NOT_READY", message: "Model operation control failed.", retryable: false, outcome: "not_dispatched" });
});
