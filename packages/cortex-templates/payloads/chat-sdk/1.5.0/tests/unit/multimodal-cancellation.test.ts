import { act, type ComponentProps, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";

const hooks = vi.hoisted(() => ({ setLocalInput: vi.fn() }));
vi.mock("usehooks-ts", () => ({
  useLocalStorage: () => ["", hooks.setLocalInput],
  useWindowSize: () => ({ width: undefined }),
}));
vi.mock("@/components/ai-elements/model-selector", () => ({
  ModelSelector: () => null,
  ModelSelectorContent: () => null,
  ModelSelectorGroup: () => null,
  ModelSelectorInput: () => null,
  ModelSelectorItem: () => null,
  ModelSelectorList: () => null,
  ModelSelectorLogo: () => null,
  ModelSelectorName: () => null,
  ModelSelectorTrigger: () => null,
}));
vi.mock("@/components/suggested-actions", () => ({
  SuggestedActions: () => null,
}));
vi.mock("@/components/preview-attachment", () => ({
  PreviewAttachment: () => null,
}));

import { MultimodalInput } from "@/components/multimodal-input";

type Props = ComponentProps<typeof MultimodalInput>;
let root: Root;
let container: HTMLDivElement;
let props: Props;
let messages: ChatMessage[];

beforeEach(() => {
  vi.clearAllMocks();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  messages = [
    {
      id: "partial",
      role: "assistant",
      parts: [{ type: "text", text: "Partial response" }],
    },
  ];
  props = {
    chatId: "cancel-test",
    input: "next message",
    setInput: vi.fn(),
    status: "ready",
    stop: vi.fn(),
    attachments: [],
    setAttachments: vi.fn(),
    messages,
    setMessages: vi.fn(),
    sendMessage: vi.fn(async () => undefined),
    selectedVisibilityType: "private",
    selectedModelId: "openai/gpt-5-mini",
  };
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

async function render(status: Props["status"]) {
  props = { ...props, status };
  await act(() => root.render(createElement(MultimodalInput, props)));
}

function button(id: string) {
  return container.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
}

describe("multimodal input cancellation", () => {
  for (const status of ["submitted", "streaming"] as const) {
    it(`keeps an enabled Stop during ${status} and calls cancellation without sending or discarding messages`, async () => {
      await render(status);
      const stopButton = button("stop-button");
      expect(stopButton).not.toBeNull();
      expect(stopButton?.disabled).toBe(false);
      expect(button("send-button")).toBeNull();
      await act(() => stopButton?.click());
      expect(props.stop).toHaveBeenCalledOnce();
      expect(props.setMessages).toHaveBeenCalledOnce();
      const updater = vi.mocked(props.setMessages).mock.calls[0][0];
      expect(typeof updater).toBe("function");
      if (typeof updater === "function") {
        expect(updater(messages)).toBe(messages);
      }
      expect(props.sendMessage).not.toHaveBeenCalled();
      expect(props.setAttachments).not.toHaveBeenCalled();
    });
  }

  it("retains Stop across submitted to streaming and returns to Send after cancellation becomes ready", async () => {
    await render("submitted");
    expect(button("stop-button")).not.toBeNull();
    await render("streaming");
    expect(button("stop-button")).not.toBeNull();
    await act(() => button("stop-button")?.click());
    expect(props.stop).toHaveBeenCalledOnce();
    await render("ready");
    expect(button("stop-button")).toBeNull();
    expect(button("send-button")?.disabled).toBe(false);
    expect(props.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps normal ready submission and message arguments", async () => {
    await render("ready");
    expect(button("stop-button")).toBeNull();
    expect(button("send-button")?.disabled).toBe(false);
    await act(() => button("send-button")?.click());
    expect(props.sendMessage).toHaveBeenCalledExactlyOnceWith({
      role: "user",
      parts: [{ type: "text", text: "next message" }],
    });
    expect(props.stop).not.toHaveBeenCalled();
    expect(props.setAttachments).toHaveBeenCalledExactlyOnceWith([]);
    expect(props.setInput).toHaveBeenLastCalledWith("");
  });

  it("keeps empty ready Send disabled", async () => {
    props = { ...props, input: "  " };
    await render("ready");
    expect(button("stop-button")).toBeNull();
    expect(button("send-button")?.disabled).toBe(true);
    await act(() => button("send-button")?.click());
    expect(props.sendMessage).not.toHaveBeenCalled();
    expect(props.stop).not.toHaveBeenCalled();
  });
});
