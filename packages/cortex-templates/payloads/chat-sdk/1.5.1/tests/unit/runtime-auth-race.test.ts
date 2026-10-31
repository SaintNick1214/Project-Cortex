import type { RuntimeRunHandle } from "@cortexmemory/sdk/runtime";
import type { UIMessage } from "ai";
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
  messages: [] as UIMessage[],
  sendMessage: vi.fn(
    async (_message: unknown, _options?: unknown) => undefined
  ),
  transportOptions: [] as Array<{ onRun: (handle: RuntimeRunHandle) => void }>,
  transports: vi.fn(),
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: fixtures.messages,
    resumeStream: vi.fn(),
    sendMessage: fixtures.sendMessage,
    setMessages: vi.fn(),
    status: "ready",
  }),
}));
vi.mock("@cortexmemory/vercel-ai-provider/remote", () => ({
  CortexRemoteTransport: class {
    disconnect = vi.fn();
    constructor(options: { onRun: (handle: RuntimeRunHandle) => void }) {
      fixtures.transportOptions.push(options);
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
    watchRun = vi.fn(() => () => {
      /* The fixture owns no subscription. */
    });
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
  fixtures.messages = [];
  fixtures.transportOptions.length = 0;
  fixtures.clients.length = 0;
  fixtures.transports.mockClear();
  fixtures.sendMessage.mockClear();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://fixture.convex.cloud");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
  const rerender = () =>
    act(async () => root.render(createElement(RuntimeChatSDK)));
  return { button, close, element, rerender };
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

it("a superseded refresh cannot close the newer successful handshake", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const client = fixtures.clients[0]!;
    client.listContentJobs.mockResolvedValue([
      {
        intent: "text",
        jobId: "saved-job",
        state: "ready",
        title: "Retained private document",
      },
    ]);
    await act(async () => client.definition.resolve({ agentId: "current" }));
    const first = Promise.withResolvers<void>();
    const second = Promise.withResolvers<void>();
    client.refreshAuth
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => {
        first.reject(new Error("Cortex runtime: AUTH_REFRESHED"));
        return second.promise;
      });
    await act(async () => ui.button("Refresh token").click());
    await act(async () => ui.button("Refresh token").click());
    await act(async () => second.resolve());
    expect(client.close).not.toHaveBeenCalled();
    expect(ui.element.textContent).toContain("private-principal");
    expect(ui.element.textContent).toContain("Retained private document");
    expect(ui.element.textContent).not.toContain("AUTH_REFRESHED");
  } finally {
    await ui.close();
  }
});

it("runtime revocation clears retained history while the host token remains accepted", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const client = fixtures.clients[0]!;
    const listConversations = vi
      .fn()
      .mockResolvedValue([{ conversationId: "retained-private-history-id" }]);
    Object.assign(client, { listConversations });
    await act(async () => client.definition.resolve({ agentId: "current" }));
    await act(async () => ui.button("Load conversations").click());
    expect(ui.element.textContent).toContain("retained-private-history-id");
    listConversations.mockRejectedValueOnce(
      Object.assign(new Error("Cortex runtime: FORBIDDEN"), {
        code: "FORBIDDEN",
      })
    );
    await act(async () => ui.button("Load conversations").click());
    expect(ui.element.textContent).not.toContain("retained-private-history-id");
    expect(ui.element.textContent).not.toContain("private-principal");
    expect(ui.element.querySelector('[aria-label="Remote chat"]')).toBeNull();
    expect(client.close).toHaveBeenCalled();
  } finally {
    await ui.close();
  }
});

it("an obsolete protected read denial cannot disconnect the newer connection", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const previous = fixtures.clients[0]!;
    const read = Promise.withResolvers<unknown>();
    Object.assign(previous, { listConversations: vi.fn(() => read.promise) });
    await act(async () => previous.definition.resolve({ agentId: "previous" }));
    await act(async () => ui.button("Load conversations").click());
    await act(async () => ui.button("Connect").click());
    const current = fixtures.clients[1]!;
    await act(async () => current.definition.resolve({ agentId: "current" }));
    await act(async () =>
      read.reject(
        Object.assign(new Error("Cortex runtime: FORBIDDEN"), {
          code: "FORBIDDEN",
        })
      )
    );
    expect(current.close).not.toHaveBeenCalled();
    expect(ui.element.textContent).toContain("private-principal");
    expect(ui.element.textContent).not.toContain("FORBIDDEN");
  } finally {
    await ui.close();
  }
});

it("an ordinary operation error preserves the current authorized history", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    const client = fixtures.clients[0]!;
    const listConversations = vi
      .fn()
      .mockResolvedValue([{ conversationId: "retained-private-history-id" }]);
    Object.assign(client, { listConversations });
    await act(async () => client.definition.resolve({ agentId: "current" }));
    await act(async () => ui.button("Load conversations").click());
    listConversations.mockRejectedValueOnce(
      new Error("Network temporarily unavailable")
    );
    await act(async () => ui.button("Load conversations").click());
    expect(ui.element.textContent).toContain("retained-private-history-id");
    expect(ui.element.textContent).toContain("Network temporarily unavailable");
    expect(client.close).not.toHaveBeenCalled();
  } finally {
    await ui.close();
  }
});

it("effort-aware Chat control defaults Normal and captures the next request through the real component wiring", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    await act(async () =>
      fixtures.clients[0]!.definition.resolve({
        agentId: "current",
        inputSelectionVersion: 2,
        memoryEffortPolicyVersion: 1,
      })
    );
    const select = ui.element.querySelector<HTMLSelectElement>(
      'select[aria-label="Memory effort"]'
    )!;
    expect(select.value).toBe("normal");
    expect(select.disabled).toBe(false);
    const input = ui.element.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Message"]'
    )!;
    const write = async (text: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value"
        )!.set!.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () =>
        input
          .closest("form")!
          .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
          )
      );
    };
    await write("normal request");
    expect(fixtures.sendMessage.mock.calls[0]).toEqual([
      { text: "normal request" },
      { body: { memory: { effort: "normal" } } },
    ]);
    await act(async () => {
      select.value = "max";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await write("max request");
    expect(fixtures.sendMessage.mock.calls[1]).toEqual([
      { text: "max request" },
      { body: { memory: { effort: "max" } } },
    ]);
    expect(fixtures.sendMessage.mock.calls[0][1]).toEqual({
      body: { memory: { effort: "normal" } },
    });
  } finally {
    await ui.close();
  }
});
it("old Chat Agent definitions expose legacy selection and disable unsupported effort choices", async () => {
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    await act(async () =>
      fixtures.clients[0]!.definition.resolve({ agentId: "legacy" })
    );
    expect(
      ui.element.querySelector<HTMLSelectElement>(
        'select[aria-label="Memory effort"]'
      )!.disabled
    ).toBe(true);
    expect(ui.element.textContent).toContain(
      "This Agent version uses legacy memory selection"
    );
    expect(fixtures.sendMessage).not.toHaveBeenCalled();
  } finally {
    await ui.close();
  }
});

it("traces a real ChatPanel submit and committed answer, and fences paint after sign-out", async () => {
  vi.stubEnv("NEXT_PUBLIC_CORTEX_LATENCY_TRACE", "1");
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const output = vi.spyOn(console, "log").mockImplementation(() => {
    /* Capture diagnostics without printing private fixture text. */
  });
  const ui = await mount();
  try {
    await act(async () => ui.button("Connect").click());
    await act(async () =>
      fixtures.clients[0]!.definition.resolve({
        agentId: "current",
        inputSelectionVersion: 2,
        memoryEffortPolicyVersion: 1,
      })
    );
    const send = async (text: string) => {
      const input = ui.element.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Message"]'
      )!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value"
        )!.set!.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () =>
        input
          .closest("form")!
          .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
          )
      );
    };
    const runId = `run:${"c".repeat(64)}`;
    const handle: RuntimeRunHandle = {
      agentId: "current",
      agentVersion: 1,
      conversationId: "conversation",
      definitionHash: "d".repeat(64),
      memorySpaceId: "space",
      principalId: "private-principal",
      runId,
      tenantId: "tenant",
      version: 1,
    };
    await send("PRIVATE_PROMPT");
    await act(async () => fixtures.transportOptions[0]!.onRun(handle));
    fixtures.messages = [
      {
        id: "user",
        parts: [{ text: "PRIVATE_PROMPT", type: "text" }],
        role: "user",
      },
      {
        id: `cortex:${runId}:assistant`,
        parts: [{ text: "PRIVATE_REPLY", type: "text" }],
        role: "assistant",
      },
    ];
    await ui.rerender();
    const events = () =>
      output.mock.calls.map(
        ([value]) =>
          JSON.parse(String(value)) as {
            phase: string;
            elapsedMs: number;
            runId?: string;
          }
      );
    expect(ui.element.textContent).toContain("PRIVATE_REPLY");
    expect(events().map((event) => event.phase)).toEqual([
      "submit",
      "admission.delivered",
      "first-text.dom-commit",
    ]);
    frames[0]!(0);
    frames[1]!(0);
    expect(events().at(-1)).toMatchObject({
      phase: "first-text.after-paint",
      runId,
    });
    expect(events().at(-1)!.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(events())).not.toMatch(/PRIVATE_|private-principal/);
    await send("PRIVATE_SECOND_PROMPT");
    fixtures.messages = [
      ...fixtures.messages,
      {
        id: "next-user",
        parts: [{ text: "PRIVATE_SECOND_PROMPT", type: "text" }],
        role: "user",
      },
      {
        id: "next-assistant",
        parts: [{ text: "PRIVATE_SECOND_REPLY", type: "text" }],
        role: "assistant",
      },
    ];
    await ui.rerender();
    expect(frames).toHaveLength(3);
    await act(async () => ui.button("Sign out").click());
    frames[2]!(0);
    frames[3]!(0);
    expect(
      events().filter((event) => event.phase === "first-text.after-paint")
    ).toHaveLength(1);
    expect(ui.element.querySelector('[aria-label="Remote chat"]')).toBeNull();
  } finally {
    await ui.close();
  }
});
