import { describe, expect, it } from "@jest/globals";
import { projectNativeOutputParts } from "../../../convex-dev/runtimeOutputProjection";

const tools = ["memory_recall", "memory_remember"];
describe("native Agent observer projection", () => {
  it("preserves typed text in both official stream shapes without copying private fields", () => {
    const parts = [{ type: "text-start", id: "text-0", providerMetadata: "SECRET_PROVIDER" },
      { type: "text-delta", id: "text-0", text: "Hello", context: "SECRET_CONTEXT" },
      { type: "text-delta", id: "text-0", delta: " world", providerMetadata: "SECRET_PROVIDER" },
      { type: "text-end", id: "text-0" }, { type: "text", text: "Final", reasoning: "SECRET_REASONING" }];
    expect(projectNativeOutputParts(parts, tools)).toEqual([{ type: "text-start", id: "text-0" },
      { type: "text-delta", id: "text-0", text: "Hello" }, { type: "text-delta", id: "text-0", text: " world" },
      { type: "text-end", id: "text-0" }, { type: "text", text: "Final" }]);
    expect(JSON.stringify(projectNativeOutputParts(parts, tools))).not.toContain("SECRET");
  });
  it("emits tool identity and phases without input, result, approval payload or error details", () => {
    const parts = [{ type: "tool-input-start", id: "call-1", toolName: "memory_recall", input: "SECRET_INPUT" },
      { type: "tool-call", toolCallId: "call-1", toolName: "memory_recall", input: { token: "SECRET_TOKEN" } },
      { type: "tool-approval-request", toolCall: { toolCallId: "call-1", toolName: "memory_recall", input: "SECRET_INPUT" }, approvalId: "SECRET_APPROVAL" },
      { type: "tool-output-available", toolCallId: "call-1", output: "SECRET_RESULT", providerMetadata: "SECRET_METADATA" },
      { type: "tool-output-error", toolCallId: "call-1", errorText: "SECRET_ERROR" }];
    expect(projectNativeOutputParts(parts, tools)).toEqual(["requested", "requested", "requested", "succeeded", "failed"].map(phase =>
      ({ type: "tool", toolCallId: "call-1", name: "memory_recall", phase })));
    expect(JSON.stringify(projectNativeOutputParts(parts, tools))).not.toContain("SECRET");
  });
  it("uses scoped durable call names for reconnect chunks without native names", () => {
    expect(projectNativeOutputParts([{ type: "tool-result", toolCallId: "call-2", output: { token: "SECRET" } }], tools,
      { "call-2": "memory_remember", "call-hidden": "unregistered" })).toEqual([
      { type: "tool", toolCallId: "call-2", name: "memory_remember", phase: "succeeded" }]);
  });
  it("drops unknown names, unbound reconnect calls, identity conflicts and native tool input deltas", () => {
    expect(projectNativeOutputParts([{ type: "tool-call", toolCallId: "hidden", toolName: "unregistered", input: "SECRET" },
      { type: "tool-output-available", toolCallId: "unbound", output: "SECRET" },
      { type: "tool-call", toolCallId: "known", toolName: "memory_remember", input: "SECRET" },
      { type: "tool-input-delta", toolCallId: "known", inputTextDelta: "SECRET" }], tools, { known: "memory_recall" })).toEqual([]);
  });
  it("drops raw reasoning, context, provider metadata, sources, URLs and speculative statuses", () => {
    expect(projectNativeOutputParts([{ type: "reasoning-delta", text: "SECRET_REASONING" }, { type: "context", context: "SECRET_CONTEXT" },
      { type: "source", url: "SECRET_URL" }, { type: "file", url: "SECRET_URL" }, { type: "raw", rawValue: "SECRET_RAW" },
      { type: "finish", providerMetadata: "SECRET_PROVIDER", finishReason: "stop" }, { type: "tool-approved", toolCallId: "call-1", toolName: "memory_recall" }], tools)).toEqual([]);
  });
  it("constructs a fixed error DTO instead of copying native errors", () => {
    expect(projectNativeOutputParts([{ type: "error", error: { stack: "SECRET_STACK", token: "SECRET_TOKEN" }, errorText: "SECRET_ERROR" }], tools))
      .toEqual([{ type: "error", code: "RUNTIME_OUTPUT_FAILED" }]);
  });
  it("handles malformed parts and conflicting text fields without leaking or mutating inputs", () => {
    const parts = Object.freeze([null, 3, [], { type: 4 }, { type: "text-delta", text: "A", delta: "B" },
      { type: "tool-call", toolCallId: "bad\nidentity", toolName: "memory_recall" }, { type: "text-delta", delta: "Valid" }]);
    expect(projectNativeOutputParts(parts, tools)).toEqual([{ type: "text-delta", text: "Valid" }]);
    expect(parts).toHaveLength(7);
    expect(projectNativeOutputParts([], tools)).toEqual([]);
  });
});
