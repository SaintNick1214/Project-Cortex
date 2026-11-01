import { ChatSDKError, visibilityBySurface } from "./errors";

export type ChatStreamStage =
  | "request-prepare"
  | "chat-title"
  | "chat-title-save"
  | "model-stream"
  | "stream-consume"
  | "stream-execute"
  | "stream-finish"
  | "stream-response"
  | "provider-close"
  | "cortex-close";

const names = new Set([
  "Error",
  "AbortError",
  "TimeoutError",
  "GraphDatabaseError",
  "AI_APICallError",
  "AI_RetryError",
  "AI_TypeValidationError",
  "AI_InvalidPromptError",
  "AI_NoOutputGeneratedError",
]);
const codes = new Set([
  "GRAPH_REFERENCE_UNRESOLVED",
  "GRAPH_TARGET_NOT_DELIVERED",
  "GRAPH_REFERENCE_CHANGED",
  "GRAPH_IDENTITY_MISMATCH",
  "GRAPH_JOB_UNRESOLVED",
]);
const errorTypes = new Set([
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limit",
  "offline",
]);

/** Deliberately excludes messages, causes, request/response bodies and credentials. */
export function reportChatStreamError(
  stage: ChatStreamStage,
  error: unknown
): void {
  const fields =
    error !== null && typeof error === "object"
      ? (error as {
          name?: unknown;
          statusCode?: unknown;
          code?: unknown;
          data?: unknown;
        })
      : {};
  const data =
    fields.data !== null && typeof fields.data === "object"
      ? (fields.data as { code?: unknown })
      : {};
  const rawCode = fields.code ?? data.code;
  console.error("[Chat stream error]", {
    stage,
    name:
      error instanceof ChatSDKError
        ? "ChatSDKError"
        : typeof fields.name === "string" && names.has(fields.name)
          ? fields.name
          : "UnknownError",
    status:
      typeof fields.statusCode === "number" &&
      Number.isInteger(fields.statusCode) &&
      fields.statusCode >= 100 &&
      fields.statusCode <= 599
        ? fields.statusCode
        : null,
    code:
      error instanceof ChatSDKError &&
      errorTypes.has(error.type) &&
      Object.hasOwn(visibilityBySurface, error.surface)
        ? `${error.type}:${error.surface}`
        : typeof rawCode === "string" && codes.has(rawCode)
          ? rawCode
          : null,
  });
}
