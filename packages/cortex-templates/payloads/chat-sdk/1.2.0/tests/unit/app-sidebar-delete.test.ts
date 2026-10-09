import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  mutate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  settlement: Promise.resolve(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => state.router }));
vi.mock("swr", () => ({ useSWRConfig: () => ({ mutate: state.mutate }) }));
vi.mock("swr/infinite", () => ({ unstable_serialize: () => "history" }));
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
vi.mock("@/components/sidebar-history", () => ({
  getChatHistoryPaginationKey: () => "history",
  SidebarHistory: () => null,
}));
vi.mock("@/components/sidebar-user-nav", () => ({
  SidebarUserNav: () => null,
}));
vi.mock("@/components/ui/sidebar", () => {
  const Box = ({ children }: { children: React.ReactNode }) =>
    createElement("div", null, children);
  return {
    Sidebar: Box,
    SidebarContent: Box,
    SidebarFooter: Box,
    SidebarHeader: Box,
    SidebarMenu: Box,
    useSidebar: () => ({ setOpenMobile: vi.fn() }),
  };
});
vi.mock("@/components/ui/tooltip", () => {
  const Box = ({ children }: { children: React.ReactNode }) =>
    createElement("div", null, children);
  return { Tooltip: Box, TooltipContent: Box, TooltipTrigger: Box };
});
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => createElement("button", { onClick, type: "button" }, children),
}));
vi.mock("@/components/ui/alert-dialog", () => {
  const Box = ({ children }: { children: React.ReactNode }) =>
    createElement("div", null, children);
  return {
    AlertDialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => (open ? createElement(Box, null, children) : null),
    AlertDialogAction: ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
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

import { AppSidebar } from "@/components/app-sidebar";

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
      createElement(AppSidebar, { user: { id: "owned", type: "regular" } })
    )
  );
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function deleteAll(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  await act(() =>
    (container.querySelector("button") as HTMLButtonElement).click()
  );
  const confirm = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Delete All"
  );
  if (!confirm) throw new Error("Actual bulk confirmation missing");
  await act(async () => {
    confirm.click();
    await state.settlement;
  });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/history", {
    method: "DELETE",
  });
}
it("actual bulk callback refuses503 without success/history/navigation effects", async () => {
  await deleteAll(Response.json({ code: "bad_request:chat" }, { status: 503 }));
  expect(state.error).toHaveBeenCalledExactlyOnceWith(
    "Failed to delete all chats"
  );
  expect(state.success).not.toHaveBeenCalled();
  expect(state.mutate).not.toHaveBeenCalled();
  expect(state.router.replace).not.toHaveBeenCalled();
  expect(state.router.refresh).not.toHaveBeenCalled();
});
it("actual bulk callback accepts200 and refreshes owned history only after ACK", async () => {
  await deleteAll(Response.json({ deletedCount: 2 }));
  expect(state.success).toHaveBeenCalledExactlyOnceWith(
    "All chats deleted successfully"
  );
  expect(state.error).not.toHaveBeenCalled();
  expect(state.mutate).toHaveBeenCalledExactlyOnceWith("history");
  expect(state.router.replace).toHaveBeenCalledExactlyOnceWith("/");
  expect(state.router.refresh).toHaveBeenCalledOnce();
});
