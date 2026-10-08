import { z } from "zod";
import { canonicalModelJson } from "./model-policy";

const textPart = z.object({ type: z.literal("text"), text: z.string().min(1) }).strict();
const toolCall = z.object({ type: z.literal("tool-call"), toolCallId: z.string().min(1).max(256),
  toolName: z.string().min(1).max(64), input: z.string().min(1) }).strict();
const languageResult = z.object({ version: z.literal(1), kind: z.literal("language"),
  content: z.array(z.discriminatedUnion("type", [textPart, toolCall])).min(1),
  finishReason: z.enum(["stop", "length", "content-filter", "tool-calls"]),
}).strict();
export type AgentLanguageResultV1 = z.infer<typeof languageResult>;

/** Private deterministic replay, never a fabricated provider usage/response object. */
export function parseAgentLanguageResult(value: unknown, allowedTools: readonly string[], maximumToolCalls: number): AgentLanguageResultV1 | undefined {
  try {
    const parsed = languageResult.safeParse(JSON.parse(canonicalModelJson(value)));
    if (!parsed.success || !Number.isSafeInteger(maximumToolCalls) || maximumToolCalls < 0) return undefined;
    const result = parsed.data;
    const calls = result.content.filter(part => part.type === "tool-call");
    if (calls.length > maximumToolCalls || new Set(calls.map(call => call.toolCallId)).size !== calls.length
      || calls.some(call => !allowedTools.includes(call.toolName)) || (result.finishReason === "tool-calls") !== (calls.length > 0)) return undefined;
    for (const call of calls) {
      const input: unknown = JSON.parse(call.input);
      if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
      call.input = canonicalModelJson(input);
    }
    return result;
  } catch { return undefined; }
}
