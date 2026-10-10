import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: vi.fn(),
  chat: vi.fn(),
  messages: vi.fn(),
}));
vi.mock("@/app/(auth)/auth", () => ({ auth: state.auth }));
vi.mock("@/lib/db/queries", () => ({
  getChatById: state.chat,
  getMessagesByChatId: state.messages,
}));
vi.mock("@/components/runtime-chat", () => ({ RuntimeChatSDK: () => null }));

import Page from "@/app/(chat)/chat/[id]/page";

beforeEach(() => vi.clearAllMocks());
describe("runtime chat page delegates protected data to verified transport", () => {
  for (const id of ["owned-chat", "foreign-chat", "not-found-chat"]) {
    it(`passes ${id} only as a selector and reads no private data at page render`, async () => {
      const element = await Page({ params: Promise.resolve({ id }) });
      expect(element.props.conversationId).toBe(id);
      expect(state.auth).not.toHaveBeenCalled();
      expect(state.chat).not.toHaveBeenCalled();
      expect(state.messages).not.toHaveBeenCalled();
    });
  }
  it("does not use an absent or foreign AuthJS session to authorize runtime content", async () => {
    state.auth.mockResolvedValue(null);
    state.chat.mockRejectedValue(new Error("foreign owner"));
    await Page({ params: Promise.resolve({ id: "selector" }) });
    expect(state.auth).not.toHaveBeenCalled();
    expect(state.chat).not.toHaveBeenCalled();
    expect(state.messages).not.toHaveBeenCalled();
  });
  for (const failure of [
    new Error("parameter unavailable"),
    new TypeError("parameter invalid"),
    { surface: "chat", type: "not_found" },
    new Error("not found text"),
  ]) {
    it("propagates a genuine parameter failure without classifying it as an authorization result", async () => {
      await expect(Page({ params: Promise.reject(failure) })).rejects.toBe(
        failure
      );
      expect(state.chat).not.toHaveBeenCalled();
      expect(state.messages).not.toHaveBeenCalled();
    });
  }
  it("waits for the selected conversation rather than starting a protected query in parallel", async () => {
    let release!: (value: { id: string }) => void;
    const page = Page({
      params: new Promise((resolve) => {
        release = resolve;
      }),
    });
    await Promise.resolve();
    expect(state.auth).not.toHaveBeenCalled();
    expect(state.chat).not.toHaveBeenCalled();
    release({ id: "late-selector" });
    expect((await page).props.conversationId).toBe("late-selector");
  });
});
