/** Public projections of native Agent parts. Observer authority is checked by the caller. */
export type RuntimePublicToolPhase = "requested" | "approved" | "running" | "succeeded" | "failed";
export type RuntimePublicOutputPart =
  | { type: "text"; text: string }
  | { type: "text-start" | "text-end"; id: string }
  | { type: "text-delta"; text: string; id?: string }
  | { type: "tool"; toolCallId: string; name: string; phase: RuntimePublicToolPhase }
  | { type: "error"; code: "RUNTIME_OUTPUT_FAILED" };

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
function identifier(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/u.test(value)
    ? value : undefined;
}
const toolPhases: Readonly<Record<string, RuntimePublicToolPhase>> = {
  "tool-input-start": "requested",
  "tool-input-available": "requested",
  "tool-call": "requested",
  "tool-approval-request": "requested",
  "tool-result": "succeeded",
  "tool-output-available": "succeeded",
  "tool-input-error": "failed",
  "tool-output-error": "failed",
  "tool-output-denied": "failed",
};

/**
 * Accepts official TextStreamPart and UIMessageChunk shapes. Only constructed DTOs
 * leave this function; arguments/results, reasoning, context, URLs, errors and
 * provider metadata are never spread into observer output. Visible model text is
 * still model text, so credentials must never be provided to the model itself.
 *
 * knownToolCalls is the caller's scoped durable tool-receipt projection, for a
 * reconnect cursor that begins after a native tool-input chunk. It is not supplied
 * by an observer. Approval is an authoritative server receipt, not inferred here.
 */
export function projectNativeOutputParts(parts: readonly unknown[], allowedTools: readonly string[],
  knownToolCalls: Readonly<Record<string, string>> = {}): RuntimePublicOutputPart[] {
  const allowed = new Set(allowedTools);
  const calls = new Map<string, string>();
  for (const [id, name] of Object.entries(knownToolCalls)) {
    if (identifier(id) && allowed.has(name)) calls.set(id, name);
  }
  const output: RuntimePublicOutputPart[] = [];
  for (const value of parts) {
    const part = record(value);
    if (!part || typeof part.type !== "string") continue;
    if (part.type === "text" && typeof part.text === "string") {
      output.push({ type: "text", text: part.text });
    } else if (part.type === "text-start" || part.type === "text-end") {
      const id = identifier(part.id);
      if (id) output.push({ type: part.type, id });
    } else if (part.type === "text-delta") {
      const text = typeof part.text === "string" ? part.text : part.delta;
      if (typeof text !== "string" || (part.text !== undefined && part.delta !== undefined && part.text !== part.delta)) continue;
      const id = identifier(part.id);
      output.push({ type: "text-delta", text, ...(id === undefined ? {} : { id }) });
    } else if (part.type === "error") {
      output.push({ type: "error", code: "RUNTIME_OUTPUT_FAILED" });
    } else if (Object.prototype.hasOwnProperty.call(toolPhases, part.type)) {
      const nested = part.type === "tool-approval-request" ? record(part.toolCall) : undefined;
      const id = identifier(part.toolCallId ?? nested?.toolCallId ?? part.id);
      if (!id) continue;
      const candidateName = part.toolName ?? nested?.toolName;
      let name = calls.get(id);
      if (candidateName !== undefined) {
        if (typeof candidateName !== "string" || !allowed.has(candidateName) || (name !== undefined && name !== candidateName)) continue;
        name = candidateName;
        calls.set(id, name);
      }
      if (name !== undefined) output.push({ type: "tool", toolCallId: id, name, phase: toolPhases[part.type]! });
    }
  }
  return output;
}
