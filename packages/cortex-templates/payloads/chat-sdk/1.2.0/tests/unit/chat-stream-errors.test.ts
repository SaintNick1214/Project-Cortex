import { afterEach, describe, expect, it, vi } from "vitest";
import { reportChatStreamError } from "@/lib/chat-stream-errors";
import { ChatSDKError } from "@/lib/errors";

afterEach(() => vi.restoreAllMocks());
describe("selected chat stream diagnostics", () => {
  it("retains stage/name/status/code but excludes request, response, message and cause", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("secret-message-canary"), {
      name: "AI_APICallError",
      statusCode: 429,
      data: { code: "GRAPH_REFERENCE_UNRESOLVED" },
      cause: { secret: "secret-cause-canary" },
      requestBodyValues: { key: "secret-key-canary" },
      responseBody: "secret-response-canary",
    });
    reportChatStreamError("stream-consume", error);
    expect(log).toHaveBeenCalledExactlyOnceWith("[Chat stream error]", {
      stage: "stream-consume",
      name: "AI_APICallError",
      status: 429,
      code: "GRAPH_REFERENCE_UNRESOLVED",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("canary");
  });
  it("refuses arbitrary names/codes and malformed status", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    reportChatStreamError("stream-response", {
      name: "secret-name-canary",
      code: "SECRET_CODE",
      statusCode: 200.5,
    });
    expect(log).toHaveBeenCalledExactlyOnceWith("[Chat stream error]", {
      stage: "stream-response",
      name: "UnknownError",
      status: null,
      code: null,
    });
  });
  it("retains known ChatSDKError classification without its private cause", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    reportChatStreamError(
      "stream-execute",
      new ChatSDKError("offline:chat", "secret-canary")
    );
    expect(log).toHaveBeenCalledExactlyOnceWith("[Chat stream error]", {
      stage: "stream-execute",
      name: "ChatSDKError",
      status: 503,
      code: "offline:chat",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("canary");
  });
  it("handles missing or primitive rejection values with bounded unknown fields", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    reportChatStreamError("chat-title", undefined);
    reportChatStreamError("chat-title", "secret-canary");
    expect(log.mock.calls).toEqual(
      Array.from({ length: 2 }, () => [
        "[Chat stream error]",
        {
          stage: "chat-title",
          name: "UnknownError",
          status: null,
          code: null,
        },
      ])
    );
  });
});
