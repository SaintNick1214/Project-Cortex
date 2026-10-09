import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
  mutate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  settlement: Promise.resolve(),
}));
const history = [
  {
    hasMore: false,
    chats: [
      {
        id: "owned",
        title: "Owned",
        userId: "user",
        visibility: "private",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "other-owned",
        title: "Other owned",
        userId: "user",
        visibility: "private",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
];
vi.mock("next/navigation", () => ({
  useRouter: () => state.router,
  usePathname: () => "/chat/owned",
}));
vi.mock("swr/infinite", () => ({
  default: () => ({
    data: history,
    setSize: vi.fn(),
    isValidating: false,
    isLoading: false,
    mutate: state.mutate,
  }),
}));
vi.mock("sonner", () => ({
  toast: {
    promise: (
      promise: Promise<unknown>,
      options: { success: () => string; error: string }
    ) => {
      state.settlement = promise.then(
        () => {
          state.success(options.success());
        },
        () => {
          state.error(options.error);
        }
      );
    },
  },
}));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) =>
      createElement("div", null, children),
  },
}));
vi.mock("@/components/ui/sidebar", () => {
  const Box = ({ children }: { children: ReactNode }) =>
    createElement("div", null, children);
  return {
    SidebarGroup: Box,
    SidebarGroupContent: Box,
    SidebarMenu: Box,
    useSidebar: () => ({ setOpenMobile: vi.fn() }),
  };
});
vi.mock("@/components/sidebar-history-item", () => ({
  ChatItem: ({
    chat,
    onDelete,
  }: {
    chat: { id: string };
    onDelete: (id: string) => void;
  }) =>
    createElement(
      "button",
      { type: "button", onClick: () => onDelete(chat.id) },
      `Delete ${chat.id}`
    ),
}));
vi.mock("@/components/ui/alert-dialog", () => {
  const Box = ({ children }: { children: ReactNode }) =>
    createElement("div", null, children);
  return {
    AlertDialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: ReactNode;
    }) => (open ? createElement(Box, null, children) : null),
    AlertDialogAction: ({
      children,
      onClick,
    }: {
      children: ReactNode;
      onClick: () => void;
    }) => createElement("button", { onClick, type: "button" }, children),
    AlertDialogCancel: Box,
    AlertDialogContent: Box,
    AlertDialogDescription: Box,
    AlertDialogFooter: Box,
    AlertDialogHeader: Box,
    AlertDialogTitle: Box,
  };
});

import { SidebarHistory } from "@/components/sidebar-history";

let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(() =>
    root.render(
      createElement(SidebarHistory, { user: { id: "user", type: "regular" } })
    )
  );
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function remove(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const choose = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Delete owned"
  );
  if (!choose) {
    throw new Error("Actual owned delete missing");
  }
  await act(() => choose.click());
  const confirm = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Continue"
  );
  if (!confirm) {
    throw new Error("Actual confirmation missing");
  }
  await act(async () => {
    confirm.click();
    await state.settlement;
  });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/chat?id=owned", {
    method: "DELETE",
  });
}
it.each([
  Response.json({ code: "bad_request:chat" }, { status: 503 }),
  new Response("Unavailable", { status: 503 }),
])("actual single-delete callback rejects a503 without history/router success effects", async (response) => {
  await remove(response);
  expect(state.error).toHaveBeenCalledExactlyOnceWith("Failed to delete chat");
  expect(state.success).not.toHaveBeenCalled();
  expect(state.mutate).not.toHaveBeenCalled();
  expect(state.router.replace).not.toHaveBeenCalled();
  expect(state.router.refresh).not.toHaveBeenCalled();
});
it("actual single-delete callback removes only selected history row after200 ACK", async () => {
  await remove(Response.json({ id: "owned" }));
  expect(state.success).toHaveBeenCalledExactlyOnceWith(
    "Chat deleted successfully"
  );
  expect(state.error).not.toHaveBeenCalled();
  expect(state.mutate).toHaveBeenCalledOnce();
  const update = state.mutate.mock.calls[0][0];
  expect(
    update(history)[0].chats.map((chat: { id: string }) => chat.id)
  ).toEqual(["other-owned"]);
  expect(history[0].chats).toHaveLength(2);
  expect(state.router.replace).toHaveBeenCalledExactlyOnceWith("/");
  expect(state.router.refresh).toHaveBeenCalledOnce();
});
