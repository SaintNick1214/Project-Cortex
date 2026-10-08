import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  chat: vi.fn(),
  object: vi.fn(),
  save: vi.fn(),
  scope: vi.fn(),
  text: vi.fn(),
}));
vi.mock("@/lib/cortex", () => ({ requireScope: mocks.scope }));
vi.mock("@/lib/db/queries", () => ({
  getChatById: mocks.chat,
  getDocumentById: vi.fn(),
  saveDocument: mocks.save,
}));
vi.mock("@/lib/ai/providers", () => ({ getArtifactModel: () => ({}) }));
vi.mock("ai", async (original) => ({
  ...(await original<typeof import("ai")>()),
  smoothStream: vi.fn(),
  streamObject: mocks.object,
  streamText: mocks.text,
}));

import { createDocument } from "@/lib/ai/tools/create-document";

const session = {
  expires: "2030-01-01",
  user: { id: "owned-user", type: "regular" },
} as Session;
const instructions =
  "Use exactly columns item,color and rows swallow,indigo and tern,amber. Preserve this data.";
async function* textStream() {
  yield { text: "Owned requested content", type: "text-delta" };
}
async function* objectStream() {
  yield {
    object: {
      code: "print('requested')",
      csv: "item,color\nswallow,indigo\ntern,amber",
    },
    type: "object",
  };
}
function documentTool() {
  return createDocument({
    conversationId: "owned-chat",
    dataStream: {
      write: vi.fn(),
    } as unknown as UIMessageStreamWriter<ChatMessage>,
    session,
  });
}
describe("artifact content request reaches actual downstream generators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scope.mockResolvedValue({});
    mocks.chat.mockResolvedValue({ userId: "owned-user" });
    mocks.text.mockImplementation(() => ({ fullStream: textStream() }));
    mocks.object.mockImplementation(() => ({ fullStream: objectStream() }));
  });
  for (const kind of ["text", "code", "sheet"] as const) {
    it(`${kind} forwards specific instructions through tool and owned handler to model`, async () => {
      const tool = documentTool();
      await tool.execute?.(
        { instructions, kind, title: "Owned QA document" },
        { context: {}, messages: [], toolCallId: "owned-create" }
      );
      const model = kind === "text" ? mocks.text : mocks.object;
      expect(model).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: `Title: Owned QA document\n\nRequested content and requirements:\n${instructions}`,
        })
      );
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          content:
            kind === "text"
              ? "Owned requested content"
              : kind === "code"
                ? "print('requested')"
                : "item,color\nswallow,indigo\ntern,amber",
          conversationId: "owned-chat",
          kind,
          userId: "owned-user",
        })
      );
    });
    it(`${kind} preserves title-only creation`, async () => {
      const tool = documentTool();
      await tool.execute?.(
        { kind, title: "Title only" },
        { context: {}, messages: [], toolCallId: "owned-create" }
      );
      expect(kind === "text" ? mocks.text : mocks.object).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "Title only" })
      );
    });
  }
  it("instructions do not bypass scope refusal before model or save", async () => {
    mocks.scope.mockRejectedValueOnce(new Error("scope refused"));
    const tool = documentTool();
    await expect(
      tool.execute?.(
        { instructions, kind: "sheet", title: "No authority" },
        { context: {}, messages: [], toolCallId: "refused" }
      )
    ).rejects.toThrow("scope refused");
    expect(mocks.text).not.toHaveBeenCalled();
    expect(mocks.object).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
