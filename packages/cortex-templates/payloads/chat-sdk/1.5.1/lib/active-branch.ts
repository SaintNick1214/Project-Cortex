import isEqual from "fast-deep-equal";
import type { MemoryEntry } from "@cortexmemory/sdk";
import type { AppScope } from "./cortex";
import type { DBMessage, ChatMessage } from "./types";
import { ChatSDKError } from "./errors";
export type RecallBranch = { conversationId: string; edited: boolean };
/** Complete override: current durable text plus owned, unedited conversation recall.
 * Fact/graph-only context lacks branch attribution and is excluded for edited users.
 */
export function branchContext(
  scope: AppScope,
  branches: RecallBranch[],
  current: DBMessage[],
): ((memories: MemoryEntry[]) => string) | undefined {
  if (!branches.some((branch) => branch.edited)) return undefined;
  const allowed = new Set(
    branches
      .filter((branch) => !branch.edited)
      .map((branch) => branch.conversationId),
  );
  const active = current
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role}: ${textParts(message.parts)}`)
    .filter((text) => !text.endsWith(": "))
    .join("\n");
  return (memories) =>
    [
      active,
      ...memories
        .filter(
          (memory) =>
            memory.tenantId === scope.tenantId &&
            memory.memorySpaceId === scope.memorySpaceId &&
            memory.userId === scope.userId &&
            !!memory.conversationRef &&
            allowed.has(memory.conversationRef.conversationId),
        )
        .map((memory) => memory.content),
    ]
      .filter(Boolean)
      .join("\n");
}
function textParts(parts: unknown): string {
  return Array.isArray(parts)
    ? parts
        .filter(
          (part) =>
            part && part.type === "text" && typeof part.text === "string",
        )
        .map((part) => part.text)
        .join("\n")
    : "";
}
/** Client approval can change only a persisted pending approval's boolean choice. */
export function applyToolApprovals(
  current: ChatMessage[],
  proposed: ChatMessage[],
): ChatMessage[] {
  if (current.length !== proposed.length)
    throw new ChatSDKError("bad_request:chat");
  return current.map((message, index) => {
    const candidate = proposed[index];
    if (
      candidate.id !== message.id ||
      candidate.role !== message.role ||
      candidate.parts.length !== message.parts.length
    )
      throw new ChatSDKError("bad_request:chat");
    const parts = message.parts.map((part, partIndex) => {
      const next = candidate.parts[partIndex];
      if (isEqual(part, next)) return part;
      if (
        !("state" in part) ||
        part.state !== "approval-requested" ||
        !("approval" in part) ||
        !part.approval ||
        !("state" in next) ||
        next.state !== "approval-responded" ||
        !("approval" in next) ||
        !next.approval ||
        part.approval.id !== next.approval.id ||
        typeof next.approval.approved !== "boolean"
      )
        throw new ChatSDKError("bad_request:chat");
      const expected = {
        ...part,
        state: "approval-responded",
        approval: {
          id: part.approval.id,
          approved: next.approval.approved,
          ...(next.approval.reason ? { reason: next.approval.reason } : {}),
        },
      };
      if (!isEqual(expected, next))
        throw new ChatSDKError("bad_request:chat");
      return next;
    });
    return { ...message, parts };
  });
}
