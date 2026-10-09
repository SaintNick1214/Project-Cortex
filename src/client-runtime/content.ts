import type { ContentSubmitV1, ContentSuggestionV1, RuntimeContentJobV1 } from "../domain/content.js";
import { deliveryDeadline, identifier, invalid, natural, object } from "./validation.js";

const intents = ["title", "text", "code", "sheet", "suggestions"];
const states = ["pending", "running", "ready", "failed", "unknown", "cancelled", "expired"];
function id(value: unknown): string {
  const normalized = identifier(value, 1024);
  if (normalized.length > 256 || /[\x00-\x1f]/.test(normalized)) invalid();
  return normalized;
}
function text(value: unknown, limit: number, code = "INVALID_INPUT"): string {
  if (typeof value !== "string" || !value.trim()) invalid(code);
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > limit || new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes) !== value) invalid(code);
  return value;
}
function exact(row: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (required.some(key => !Object.hasOwn(row, key)) || Object.keys(row).some(key => !required.includes(key) && !optional.includes(key))) invalid();
}
function dense(input: unknown, max: number): unknown[] {
  if (!Array.isArray(input) || input.length > max || Object.getPrototypeOf(input) !== Array.prototype) invalid("INVALID_RESPONSE");
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(descriptors).length !== input.length + 1
    || Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !("value" in descriptors[key]!))) invalid("INVALID_RESPONSE");
  return input;
}
/** Only the closed backend intent and immutable source selectors are accepted from the host. */
export function contentSubmit(input: unknown): ContentSubmitV1 {
  const row = object(input);
  exact(row, ["version", "requestId", "intent", "prompt"], ["conversationId", "sourceMessageId", "parentRunId", "artifact"]);
  if (row.version !== 1 || !intents.includes(row.intent as string)) invalid();
  const conversationId = row.conversationId === undefined ? undefined : id(row.conversationId);
  const sourceMessageId = row.sourceMessageId === undefined ? undefined : id(row.sourceMessageId);
  const parentRunId = row.parentRunId === undefined ? undefined : id(row.parentRunId);
  let artifact: ContentSubmitV1["artifact"];
  if (row.artifact !== undefined) {
    const source = object(row.artifact); exact(source, ["artifactId", "version"]);
    const version = natural(source.version); if (version < 1) invalid();
    artifact = { artifactId: id(source.artifactId), version };
  }
  if (sourceMessageId && !conversationId || row.intent === "title" && (!conversationId || artifact)
    || row.intent === "suggestions" && !artifact) invalid();
  return { version: 1, requestId: id(row.requestId), intent: row.intent as ContentSubmitV1["intent"], prompt: text(row.prompt, 4096),
    ...(conversationId === undefined ? {} : { conversationId }), ...(sourceMessageId === undefined ? {} : { sourceMessageId }),
    ...(parentRunId === undefined ? {} : { parentRunId }), ...(artifact === undefined ? {} : { artifact }) };
}
export function contentListOptions(input: unknown): { conversationId?: string; limit?: number } {
  const row = object(input); exact(row, [], ["conversationId", "limit"]);
  const limit = row.limit === undefined ? undefined : natural(row.limit);
  if (limit !== undefined && (limit < 1 || limit > 50)) invalid();
  return { ...(row.conversationId === undefined ? {} : { conversationId: id(row.conversationId) }), ...(limit === undefined ? {} : { limit }) };
}
export function contentSuggestionInput(input: unknown): { jobId: string; suggestionId: string; artifactVersion: number } {
  const row = object(input); exact(row, ["jobId", "suggestionId", "artifactVersion"]);
  const artifactVersion = natural(row.artifactVersion); if (artifactVersion < 1) invalid();
  return { jobId: id(row.jobId), suggestionId: id(row.suggestionId), artifactVersion };
}
function suggestion(input: unknown): ContentSuggestionV1 {
  const row = object(input);
  return Object.freeze({ suggestionId: id(row.suggestionId), originalText: text(row.originalText, 8192, "INVALID_RESPONSE"),
    suggestedText: text(row.suggestedText, 8192, "INVALID_RESPONSE"), description: text(row.description, 2048, "INVALID_RESPONSE") });
}
/** Copy a bounded public projection. Backend credentials, hidden context and private metadata cannot escape. */
export function contentJob(input: unknown): RuntimeContentJobV1 {
  const row = object(input), revision = natural(row.revision), createdAt = natural(row.createdAt), updatedAt = natural(row.updatedAt);
  if (row.version !== 1 || !intents.includes(row.intent as string) || !states.includes(row.state as string)
    || revision < 1 || updatedAt < createdAt
    || row.failureCode !== undefined && (typeof row.failureCode !== "string" || !/^[A-Z][A-Z0-9_]{0,79}$/.test(row.failureCode))) invalid("INVALID_RESPONSE");
  const artifactVersion = row.artifactVersion === undefined ? undefined : natural(row.artifactVersion);
  if (artifactVersion !== undefined && (artifactVersion < 1 || row.artifactId === undefined)) invalid("INVALID_RESPONSE");
  const suggestions = row.suggestions === undefined ? undefined : dense(row.suggestions, 5).map(suggestion);
  if (suggestions && (suggestions.length < 1 || new Set(suggestions.map(value => value.suggestionId)).size !== suggestions.length)) invalid("INVALID_RESPONSE");
  return Object.freeze({ version: 1, jobId: id(row.jobId), intent: row.intent as RuntimeContentJobV1["intent"], state: row.state as RuntimeContentJobV1["state"], revision, createdAt, updatedAt,
    ...(row.deliveryExpiresAt === undefined ? {} : { deliveryExpiresAt: deliveryDeadline(row.deliveryExpiresAt) }),
    ...(row.conversationId === undefined ? {} : { conversationId: id(row.conversationId) }),
    ...(row.artifactId === undefined ? {} : { artifactId: id(row.artifactId) }), ...(artifactVersion === undefined ? {} : { artifactVersion }),
    ...(row.title === undefined ? {} : { title: text(row.title, 128, "INVALID_RESPONSE") }),
    ...(row.content === undefined ? {} : { content: text(row.content, 32768, "INVALID_RESPONSE") }),
    ...(suggestions === undefined ? {} : { suggestions }), ...(row.failureCode === undefined ? {} : { failureCode: row.failureCode as string }) });
}
export function contentJobList(input: unknown, limit: number): RuntimeContentJobV1[] {
  const jobs = dense(input, limit).map(contentJob);
  if (new Set(jobs.map(job => job.jobId)).size !== jobs.length) invalid("INVALID_RESPONSE");
  return jobs;
}
