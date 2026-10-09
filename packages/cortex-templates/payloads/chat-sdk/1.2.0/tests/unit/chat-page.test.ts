import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSDKError } from "@/lib/errors";

const state = vi.hoisted(() => ({
  auth: vi.fn(),
  chat: vi.fn(),
  messages: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/app/(auth)/auth", () => ({ auth: state.auth }));
vi.mock("@/lib/db/queries", () => ({
  getChatById: state.chat,
  getMessagesByChatId: state.messages,
}));
vi.mock("next/navigation", () => ({
  notFound: state.notFound,
  redirect: state.redirect,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/components/chat", () => ({ Chat: () => null }));
vi.mock("@/components/data-stream-handler", () => ({
  DataStreamHandler: () => null,
}));
vi.mock("@/lib/utils", () => ({ convertToUIMessages: (v: unknown) => v }));

import Page from "@/app/(chat)/chat/[id]/page";

const missing = new Error("NEXT_HTTP_ERROR_FALLBACK;404");
const login = new Error("NEXT_REDIRECT");
function render() {
  const page = Page({ params: Promise.resolve({ id: "owned-chat" }) });
  const child = page.props.children as ReactElement<{
    params: Promise<{ id: string }>;
  }>;
  return (
    child.type as (
      props: typeof child.props
    ) => Promise<ReactElement<{ children: ReactElement<{ id: string }>[] }>>
  )(child.props);
}
beforeEach(() => {
  vi.clearAllMocks();
  state.auth.mockResolvedValue({ user: { id: "owner" } });
  state.chat.mockResolvedValue({
    id: "owned-chat",
    userId: "owner",
    visibility: "private",
  });
  state.messages.mockResolvedValue([]);
  state.notFound.mockImplementation(() => {
    throw missing;
  });
  state.redirect.mockImplementation(() => {
    throw login;
  });
});
describe("protected chat page boundary", () => {
  it("renders the owned chat and reads messages", async () => {
    const result = await render();
    expect(result.props.children[0].props.id).toBe("owned-chat");
    expect(state.messages).toHaveBeenCalledWith({ id: "owned-chat" });
  });
  it("maps the genuine chat ownership refusal to Next notFound before message access", async () => {
    state.chat.mockRejectedValue(new ChatSDKError("not_found:chat"));
    await expect(render()).rejects.toBe(missing);
    expect(state.notFound).toHaveBeenCalledOnce();
    expect(state.messages).not.toHaveBeenCalled();
  });
  it("maps a missing chat to notFound", async () => {
    state.chat.mockResolvedValue(null);
    await expect(render()).rejects.toBe(missing);
    expect(state.messages).not.toHaveBeenCalled();
  });
  it("keeps the returned foreign-owner refusal", async () => {
    state.chat.mockResolvedValue({ userId: "foreign" });
    await expect(render()).rejects.toBe(missing);
    expect(state.messages).not.toHaveBeenCalled();
  });
  it("redirects absent sessions before any protected query", async () => {
    state.auth.mockResolvedValue(null);
    await expect(render()).rejects.toBe(login);
    expect(state.chat).not.toHaveBeenCalled();
  });
  for (const error of [
    new ChatSDKError("not_found:document"),
    new ChatSDKError("offline:chat"),
    new Error(
      "The requested chat was not found. Please check the chat ID and try again."
    ),
    { type: "not_found", surface: "chat" },
  ]) {
    it("rethrows another surface/type/class error without treating it as absence", async () => {
      state.chat.mockRejectedValue(error);
      await expect(render()).rejects.toBe(error);
      expect(state.notFound).not.toHaveBeenCalled();
      expect(state.messages).not.toHaveBeenCalled();
    });
  }
});
