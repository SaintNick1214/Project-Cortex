import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RuntimeChatSDK } from "@/components/runtime-chat";

const fixtures = vi.hoisted(() => ({
  clients: [] as Array<{
    close: ReturnType<typeof vi.fn>;
    listContentJobs: ReturnType<typeof vi.fn>;
    refreshAuth: ReturnType<typeof vi.fn>;
    session: ReturnType<typeof vi.fn>;
    definition: {
      promise: Promise<unknown>;
      resolve: (value: unknown) => void;
    };
    onAuthChange: (authenticated: boolean) => void;
  }>,
  transports: vi.fn(),
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({ messages: [], status: "ready" }),
}));
vi.mock("@cortexmemory/vercel-ai-provider/remote", () => ({
  CortexRemoteTransport: class {
    disconnect = vi.fn();
    constructor() {
      fixtures.transports();
    }
  },
}));
vi.mock("@cortexmemory/sdk/runtime", () => ({
  CortexRuntimeClient: class {
    close = vi.fn().mockResolvedValue(undefined);
    definition = Promise.withResolvers<unknown>();
    getDefinition = vi.fn(() => this.definition.promise);
    listContentJobs = vi.fn().mockResolvedValue([]);
    refreshAuth = vi.fn().mockResolvedValue(undefined);
    session = vi.fn().mockResolvedValue({
      memorySpaceId: "space",
      principalId: "private-principal",
      tenantId: "tenant",
    });
    onAuthChange: (authenticated: boolean) => void;
    constructor(options: { onAuthChange: (authenticated: boolean) => void }) {
      this.onAuthChange = options.onAuthChange;
      fixtures.clients.push(this);
    }
  },
}));
beforeEach(() => {
  fixtures.clients.length = 0;
  fixtures.transports.mockClear();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://fixture.convex.cloud");
});
afterEach(() => vi.unstubAllEnvs());

async function mount() {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  await act(async () => root.render(createElement(RuntimeChatSDK)));
  const button = (text: string) =>
    [...element.querySelectorAll("button")].find(
      (value) => value.textContent === text
    )!;
  const close = async () => {
    await act(async () => root.unmount());
    element.remove();
  };
  return { button, close, element };
}

it("sign-out closes a pending connection and withholds its late protected definition", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const client = fixtures.clients[0]!;
    await act(async () => ui.button("Sign out").click());
    expect(client.close).toHaveBeenCalled();
    await act(async () => client.definition.resolve({ agentId: "private" }));
    expect(ui.element.textContent).toContain("Disconnected.");
    expect(ui.element.textContent).not.toContain("private-principal");
    expect(ui.element.querySelector('[aria-label="Remote chat"]')).toBeNull();
    expect(fixtures.transports).not.toHaveBeenCalled();
  } finally {
    await ui.close();
  }
});

it("a slower previous connection cannot replace the current attempt", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const previous = fixtures.clients[0]!;
    await act(async () => ui.button("Connect").click());
    const current = fixtures.clients[1]!;
    expect(previous.close).toHaveBeenCalled();
    await act(async () => current.definition.resolve({ agentId: "current" }));
    expect(ui.element.textContent).toContain("private-principal");
    expect(fixtures.transports).toHaveBeenCalledTimes(1);
    await act(async () => previous.definition.resolve({ agentId: "stale" }));
    expect(fixtures.transports).toHaveBeenCalledTimes(1);
    expect(current.close).not.toHaveBeenCalled();
  } finally {
    await ui.close();
  }
});

it("unmount closes a pending connection without installing a late transport", async () => {
  const ui = await mount();
  await act(async () => ui.button("Connect").click());
  const client = fixtures.clients[0]!;
  await ui.close();
  expect(client.close).toHaveBeenCalled();
  await act(async () => client.definition.resolve({ agentId: "private" }));
  expect(fixtures.transports).not.toHaveBeenCalled();
});

it("an authentication failure closes a pending client and fences its late completion", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const client = fixtures.clients[0]!;
    await act(async () => client.onAuthChange(false));
    expect(client.close).toHaveBeenCalled();
    await act(async () => client.definition.resolve({ agentId: "private" }));
    expect(ui.element.textContent).not.toContain("private-principal");
    expect(fixtures.transports).not.toHaveBeenCalled();
  } finally {
    await ui.close();
  }
});

it("same-principal refresh replaces an aborted content read with a fresh observation", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const client = fixtures.clients[0]!;
    const pending = Promise.withResolvers<unknown>();
    const saved = [
      {
        content: "Retained output",
        intent: "text",
        jobId: "saved-job",
        state: "ready",
        title: "Retained private document",
      },
    ];
    client.listContentJobs
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue(saved);
    client.refreshAuth.mockImplementation(async () => {
      pending.reject(new Error("Cortex runtime: SESSION_CHANGED"));
    });
    await act(async () => client.definition.resolve({ agentId: "current" }));
    await act(async () => ui.button("Refresh token").click());
    expect(client.listContentJobs).toHaveBeenCalledTimes(2);
    expect(ui.element.textContent).toContain("Retained private document");
    expect(ui.element.textContent).not.toContain("SESSION_CHANGED");
    expect(client.close).not.toHaveBeenCalled();
  } finally {
    await ui.close();
  }
});

it("a refreshed different principal clears protected output and closes the old connection", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const client = fixtures.clients[0]!;
    client.listContentJobs.mockResolvedValue([
      {
        content: "Retained output",
        intent: "text",
        jobId: "saved-job",
        state: "ready",
        title: "Retained private document",
      },
    ]);
    await act(async () => client.definition.resolve({ agentId: "current" }));
    expect(ui.element.textContent).toContain("Retained private document");
    client.session.mockResolvedValueOnce({
      memorySpaceId: "space",
      principalId: "other-principal",
      tenantId: "tenant",
    });
    await act(async () => ui.button("Refresh token").click());
    expect(client.close).toHaveBeenCalled();
    expect(ui.element.textContent).not.toContain("Retained private document");
    expect(ui.element.querySelector('[aria-label="Remote chat"]')).toBeNull();
  } finally {
    await ui.close();
  }
});


it("overlapping refresh ignores an obsolete AUTH_REFRESHED completion and retains the successful current connection", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const client = fixtures.clients[0]!;
    await act(async () => client.definition.resolve({ agentId: "current" }));
    const first = Promise.withResolvers<void>();
    const second = Promise.withResolvers<void>();
    client.refreshAuth.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => {
      first.reject(new Error("Cortex runtime: AUTH_REFRESHED"));
      return second.promise;
    });
    await act(async () => ui.button("Refresh token").click());
    await act(async () => {
      ui.button("Refresh token").click();
      second.resolve();
    });
    expect(client.close).not.toHaveBeenCalled();
    expect(ui.element.textContent).toContain("private-principal");
    expect(ui.element.textContent).not.toContain("AUTH_REFRESHED");
  } finally {
    await ui.close();
  }
});
