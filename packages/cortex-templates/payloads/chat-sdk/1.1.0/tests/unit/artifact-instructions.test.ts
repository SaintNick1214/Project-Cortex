import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { UIMessageStreamWriter } from "ai";
import type { ChatMessage } from "@/lib/types";
const mocks = vi.hoisted(() => ({ text: vi.fn(), object: vi.fn(), scope: vi.fn(), save: vi.fn(), chat: vi.fn() }));
vi.mock("@/lib/cortex", () => ({ requireScope: mocks.scope }));
vi.mock("@/lib/db/queries", () => ({ getChatById: mocks.chat, getDocumentById: vi.fn(), saveDocument: mocks.save }));
vi.mock("@/lib/ai/providers", () => ({ getArtifactModel: () => ({}) }));
vi.mock("ai", async (original) => ({ ...(await original<typeof import("ai")>()), streamText: mocks.text, streamObject: mocks.object, smoothStream: vi.fn() }));
import { createDocument } from "@/lib/ai/tools/create-document";

const session = { user: { id: "owned-user", type: "regular" }, expires: "2030-01-01" } as Session;
const instructions = "Use exactly columns item,color and rows swallow,indigo and tern,amber. Preserve this data.";
async function* textStream() { yield { type: "text-delta", text: "Owned requested content" }; }
async function* objectStream() { yield { type: "object", object: { code: "print('requested')", csv: "item,color\nswallow,indigo\ntern,amber" } }; }
function documentTool() {
  return createDocument({ session, conversationId: "owned-chat", dataStream: { write: vi.fn() } as unknown as UIMessageStreamWriter<ChatMessage> });
}
describe("artifact content request reaches actual downstream generators", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.scope.mockResolvedValue({}); mocks.chat.mockResolvedValue({ userId: "owned-user" }); mocks.text.mockImplementation(() => ({ fullStream: textStream() })); mocks.object.mockImplementation(() => ({ fullStream: objectStream() })); });
  for (const kind of ["text", "code", "sheet"] as const) {
    it(`${kind} forwards specific instructions through tool and owned handler to model`, async () => {
      const tool = documentTool();
      await tool.execute?.({ title: "Owned QA document", kind, instructions }, { toolCallId: "owned-create", messages: [] });
      const model = kind === "text" ? mocks.text : mocks.object;
      expect(model).toHaveBeenCalledWith(expect.objectContaining({ prompt: `Title: Owned QA document\n\nRequested content and requirements:\n${instructions}` }));
      expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ userId: "owned-user", conversationId: "owned-chat", kind, content: kind === "text" ? "Owned requested content" : kind === "code" ? "print('requested')" : "item,color\nswallow,indigo\ntern,amber" }));
    });
    it(`${kind} preserves title-only creation`, async () => {
      const tool = documentTool();
      await tool.execute?.({ title: "Title only", kind }, { toolCallId: "owned-create", messages: [] });
      expect(kind === "text" ? mocks.text : mocks.object).toHaveBeenCalledWith(expect.objectContaining({ prompt: "Title only" }));
    });
  }
  it("instructions do not bypass scope refusal before model or save", async () => {
    mocks.scope.mockRejectedValueOnce(new Error("scope refused"));
    const tool = documentTool();
    await expect(tool.execute?.({ title: "No authority", kind: "sheet", instructions }, { toolCallId: "refused", messages: [] })).rejects.toThrow("scope refused");
    expect(mocks.text).not.toHaveBeenCalled(); expect(mocks.object).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
});
