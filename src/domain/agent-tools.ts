/** Fixed native definitions, shared by execution and the compiled model qualification. */
export const AGENT_TOOL_REGISTRY_VERSION = "cortex-memory-tools-v1";
export const SERVER_TOOL_SCHEMAS = Object.freeze({
  memory_recall: { type: "object", properties: { text: { type: "string", minLength: 1, maxLength: 4096 },
    limit: { type: "integer", minimum: 1, maximum: 10 } }, required: ["text", "limit"], additionalProperties: false },
  memory_remember: { type: "object", properties: { text: { type: "string", minLength: 1, maxLength: 4096 } },
    required: ["text"], additionalProperties: false },
} as const);
export const NATIVE_TOOL_NAMES = Object.freeze({ "memory.recall": "memory_recall", "memory.remember": "memory_remember" } as const);
export const AGENT_NATIVE_TOOLS = Object.freeze([
  { type: "function", name: "memory_recall", description: "Recall authorized Cortex memory.", inputSchema: SERVER_TOOL_SCHEMAS.memory_recall },
  { type: "function", name: "memory_remember", description: "Remember explicit information in authorized Cortex memory.", inputSchema: SERVER_TOOL_SCHEMAS.memory_remember },
] as const);
/** V1 remains byte-stable for every previously published definition/proof. */
export const AGENT_TOOL_REGISTRY_VERSION_V2 = "cortex-media-tools-v2";
export const NATIVE_TOOL_NAMES_V2 = Object.freeze({ ...NATIVE_TOOL_NAMES,
  "media.image.generate": "media_image_generate", "media.video.generate": "media_video_generate", "artifact.read": "artifact_read" } as const);
export const AGENT_NATIVE_TOOLS_V2 = Object.freeze([...AGENT_NATIVE_TOOLS,
  { type: "function", name: "media_image_generate", description: "Create one governed image and return its durable job and artifact references.", inputSchema: { type: "object", properties: { prompt: { type: "string", minLength: 1, maxLength: 1024 } }, required: ["prompt"], additionalProperties: false } },
  { type: "function", name: "media_video_generate", description: "Create one governed video job and return its durable job and artifact references.", inputSchema: { type: "object", properties: { prompt: { type: "string", minLength: 1, maxLength: 1024 } }, required: ["prompt"], additionalProperties: false } },
  { type: "function", name: "artifact_read", description: "Read authorized artifact metadata and immutable asset references.", inputSchema: { type: "object", properties: { artifactId: { type: "string", minLength: 1, maxLength: 256 } }, required: ["artifactId"], additionalProperties: false } },
] as const);
export function agentToolCatalog(version: string) {
  return version === AGENT_TOOL_REGISTRY_VERSION ? AGENT_NATIVE_TOOLS : version === AGENT_TOOL_REGISTRY_VERSION_V2 ? AGENT_NATIVE_TOOLS_V2 : undefined;
}

/**
 * Conservative UTF8 ceiling over the complete canonical role/part/tool envelope.
 * Sixfold expansion covers JSON escaping/stringified tool arguments; the fixed
 * and per-message allowances cover the qualified native protocol framing. This
 * rule must be qualified with the exact native transform before it enables calls.
 */
export function agentToolsInputBound(canonicalPayload: string, messageCount: number, toolCount: number): number {
  const value = 6 * new TextEncoder().encode(canonicalPayload).length + 64 * (messageCount + toolCount) + 1024;
  if (!Number.isSafeInteger(value) || value < 1 || !Number.isSafeInteger(messageCount) || messageCount < 1
    || !Number.isSafeInteger(toolCount) || toolCount < 0 || toolCount > AGENT_NATIVE_TOOLS.length) throw new Error("INVALID_AGENT_INPUT_BOUND");
  return value;
}
export function agentToolsInputBoundV2(canonicalPayload: string, messageCount: number, toolCount: number): number {
  if (!Number.isSafeInteger(toolCount) || toolCount < 0 || toolCount > AGENT_NATIVE_TOOLS_V2.length) throw new Error("INVALID_AGENT_INPUT_BOUND");
  // Identical framing rule, independently pinned to the new five-tool catalog.
  return agentToolsInputBound(canonicalPayload, messageCount, Math.min(toolCount, AGENT_NATIVE_TOOLS.length)) + 64 * Math.max(0, toolCount - AGENT_NATIVE_TOOLS.length);
}
