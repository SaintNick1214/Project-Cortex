import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { createDocument } from "@/lib/ai/tools/create-document";

const instructions =
  "Use exactly columns item,color and rows swallow,indigo and tern,amber. Preserve this data.";
function descriptor(userId = "owner") {
  return createDocument({
    conversationId: "owned-chat",
    dataStream: {} as UIMessageStreamWriter,
    session: {
      expires: "2030-01-01",
      user: { id: userId, type: "regular" },
    } as Session,
  });
}
describe("backend-owned artifact request descriptor", () => {
  for (const kind of ["text", "code", "sheet"] as const) {
    it(`${kind} preserves specific instructions without exposing an app-side generator`, () => {
      const tool = descriptor();
      const schema = tool.inputSchema as z.ZodType;
      expect(
        schema.parse({ instructions, kind, title: "Owned QA document" })
      ).toEqual({ instructions, kind, title: "Owned QA document" });
      expect(tool.execute).toBeUndefined();
    });
    it(`${kind} preserves title-only request input`, () => {
      const tool = descriptor();
      expect(
        (tool.inputSchema as z.ZodType).parse({ kind, title: "Title only" })
      ).toEqual({ kind, title: "Title only" });
      expect(tool.execute).toBeUndefined();
    });
  }
  it("caller session labels cannot turn the descriptor into model or persistence authority", () => {
    for (const user of ["owner", "foreign", ""]) {
      expect(descriptor(user).execute).toBeUndefined();
    }
    expect(() =>
      (descriptor().inputSchema as z.ZodType).parse({
        instructions,
        kind: "invented-model",
        title: "No authority",
      })
    ).toThrow();
  });
});
