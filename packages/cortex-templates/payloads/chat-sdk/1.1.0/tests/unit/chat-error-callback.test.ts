import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChatSDKError } from "@/lib/errors";

const state = vi.hoisted(() => ({
  error: undefined as undefined | ((error: Error) => void),
  automatically: undefined as undefined | ((input: { messages: any[] }) => boolean),
  toast: vi.fn(),
  router: { refresh: vi.fn(), push: vi.fn() },
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: (options: { onError: (error: Error) => void; sendAutomaticallyWhen: (input: { messages: any[] }) => boolean }) => {
    state.automatically = options.sendAutomaticallyWhen;
    state.error = options.onError;
    return {
      messages: [],
      status: "ready",
      setMessages: vi.fn(),
      sendMessage: vi.fn(),
      stop: vi.fn(),
      regenerate: vi.fn(),
      resumeStream: vi.fn(),
      addToolApprovalResponse: vi.fn(),
    };
  },
}));
vi.mock("@cortexmemory/vercel-ai-provider/react", () => ({
  useLayerTracking: () => ({ handleDataPart: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => state.router,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("swr", () => ({
  default: () => ({ data: undefined }),
  useSWRConfig: () => ({ mutate: vi.fn() }),
}));
vi.mock("swr/infinite", () => ({ unstable_serialize: () => "history" }));
vi.mock("@/components/chat-header", () => ({ ChatHeader: () => null }));
vi.mock("@/components/artifact", () => ({ Artifact: () => null }));
vi.mock("@/components/messages", () => ({ Messages: () => null }));
vi.mock("@/components/multimodal-input", () => ({
  MultimodalInput: () => null,
}));
vi.mock("@/components/sidebar-history", () => ({
  getChatHistoryPaginationKey: () => "history",
}));
vi.mock("@/components/data-stream-provider", () => ({
  useDataStream: () => ({ setDataStream: vi.fn() }),
}));
vi.mock("@/components/toast", () => ({ toast: state.toast }));
vi.mock("@/hooks/use-artifact", () => ({ useArtifactSelector: () => false }));
vi.mock("@/hooks/use-auto-resume", () => ({ useAutoResume: () => undefined }));
vi.mock("@/hooks/use-chat-visibility", () => ({
  useChatVisibility: () => ({ visibilityType: "private" }),
}));
vi.mock("@/components/ui/alert-dialog", () => {
  const Box = ({ children }: { children: unknown }) =>
    createElement("div", null, children as string);
  return {
    AlertDialog: ({ open, children }: { open: boolean; children: unknown }) =>
      open ? createElement(Box, null, children as string) : null,
    AlertDialogAction: Box,
    AlertDialogCancel: Box,
    AlertDialogContent: Box,
    AlertDialogDescription: Box,
    AlertDialogFooter: Box,
    AlertDialogHeader: Box,
    AlertDialogTitle: Box,
  };
});

import { Chat } from "@/components/chat";

let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  state.toast.mockClear();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(() =>
    root.render(
      createElement(Chat, {
        id: "owned",
        initialMessages: [],
        initialChatModel: "openai/gpt-4.1",
        initialVisibilityType: "private",
        isReadonly: true,
        autoResume: false,
      })
    )
  );
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
it("actual useChat callback shows fixed safe toast for generic streamed Error", async () => {
  expect(state.error).toBeTypeOf("function");
  await act(() => state.error?.(new Error("secret-message-canary")));
  expect(state.toast).toHaveBeenCalledExactlyOnceWith({
    type: "error",
    description: "We couldn't complete the response. Please try again.",
  });
  expect(JSON.stringify(state.toast.mock.calls)).not.toContain("canary");
});
it("keeps recognized ChatSDKError response text", async () => {
  const error = new ChatSDKError("unauthorized:chat");
  await act(() => state.error?.(error));
  expect(state.toast).toHaveBeenCalledExactlyOnceWith({
    type: "error",
    description: error.message,
  });
});
it("keeps the recognized gateway credit-card dialog instead of the fallback", async () => {
  await act(() =>
    state.error?.(new ChatSDKError("bad_request:activate_gateway"))
  );
  expect(state.toast).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Activate AI Gateway");
});

it.each([true, false])("actual useChat callback sends the exact approval decision %s", (approved) => {
  const messages = [{ id: "owned", role: "assistant", parts: [{ type: "tool-getWeather", state: "approval-responded", approval: { id: "fixed", approved } }] }];
  expect(state.automatically?.({ messages })).toBe(true);
  expect(messages[0].parts[0].approval.approved).toBe(approved);
});
it.each([undefined, "false", 0])("actual callback refuses malformed approval decision %s", (approved) => {
  expect(state.automatically?.({ messages: [{ role: "assistant", parts: [{ state: "approval-responded", approval: { approved } }] }] })).toBe(false);
});
it("pending approval and ordinary output do not submit again", () => {
  expect(state.automatically?.({ messages: [{ role: "assistant", parts: [{ state: "approval-requested", approval: { id: "fixed" } }] }] })).toBe(false);
  expect(state.automatically?.({ messages: [] })).toBe(false);
});
