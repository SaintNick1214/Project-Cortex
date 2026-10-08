import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  status: "idle",
  action: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  updateSession: vi.fn(async () => ({ user: { id: "signed-in-user" } })),
  toast: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: () => [{ status: state.status }, state.action, false],
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace, refresh: state.refresh }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ update: state.updateSession }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: ReactNode }) =>
    createElement("span", null, children),
}));
vi.mock("@/app/(auth)/actions", () => ({
  login: state.login,
  register: state.register,
}));
vi.mock("@/components/auth-form", () => ({
  AuthForm: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
}));
vi.mock("@/components/submit-button", () => ({
  SubmitButton: ({
    children,
    isSuccessful,
  }: {
    children: ReactNode;
    isSuccessful: boolean;
  }) =>
    createElement(
      "button",
      { type: "submit", disabled: isSuccessful },
      children
    ),
}));
vi.mock("@/components/toast", () => ({ toast: state.toast }));

import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  state.status = "idle";
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

for (const [name, Page] of [
  ["login", LoginPage],
  ["register", RegisterPage],
] as const) {
  describe(`${name} page authentication navigation`, () => {
    it("updates the session and replaces the auth route after successful authentication without another submission", async () => {
      await act(() => root.render(createElement(Page)));
      expect(container.querySelector("button")?.disabled).toBe(false);
      expect(state.replace).not.toHaveBeenCalled();
      state.status = "success";
      await act(() => root.render(createElement(Page)));
      expect(state.updateSession).toHaveBeenCalledOnce();
      expect(state.replace).toHaveBeenCalledExactlyOnceWith("/");
      expect(state.updateSession.mock.invocationCallOrder[0]).toBeLessThan(
        state.replace.mock.invocationCallOrder[0]
      );
      expect(state.refresh).not.toHaveBeenCalled();
      expect(container.querySelector("button")?.disabled).toBe(true);
      await act(() => root.render(createElement(Page)));
      expect(state.replace).toHaveBeenCalledOnce();
      expect(state.action).not.toHaveBeenCalled();
      expect(state.login).not.toHaveBeenCalled();
      expect(state.register).not.toHaveBeenCalled();
      if (name === "register") {
        expect(state.toast).toHaveBeenCalledWith({
          type: "success",
          description: "Account created successfully!",
        });
      } else {
        expect(state.toast).not.toHaveBeenCalled();
      }
    });
    for (const status of ["idle", "in_progress"]) {
      it(`does not navigate from ${status}`, async () => {
        state.status = status;
        await act(() => root.render(createElement(Page)));
        expect(state.replace).not.toHaveBeenCalled();
        expect(state.updateSession).not.toHaveBeenCalled();
        expect(state.toast).not.toHaveBeenCalled();
        expect(container.querySelector("button")?.disabled).toBe(false);
      });
    }
    for (const [status, description] of [
      ["invalid_data", "Failed validating your submission!"],
      [
        "failed",
        name === "login" ? "Invalid credentials!" : "Failed to create account!",
      ],
      ...(name === "register"
        ? [["user_exists", "Account already exists!"]]
        : []),
    ]) {
      it(`retains the ${status} error without navigation or session update`, async () => {
        state.status = status;
        await act(() => root.render(createElement(Page)));
        expect(state.toast).toHaveBeenCalledExactlyOnceWith({
          type: "error",
          description,
        });
        expect(state.replace).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
        expect(state.updateSession).not.toHaveBeenCalled();
        expect(container.querySelector("button")?.disabled).toBe(false);
      });
    }
  });
}
