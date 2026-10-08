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
