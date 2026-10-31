import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  attach: vi.fn(),
  cancel: vi.fn(),
  close: vi.fn(),
  constructor: vi.fn(),
  session: vi.fn(),
  start: vi.fn(),
  submit: vi.fn(),
}));
vi.mock("@cortexmemory/sdk/runtime", () => ({
  CortexRuntimeClient: class {
    constructor(options: unknown) {
      state.constructor(options);
    }
    session = state.session;
    submit = state.submit;
    start = state.start;
    attach = state.attach;
    cancel = state.cancel;
    close = state.close;
  },
  CortexRuntimeError: class extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

import { CortexRuntimeError } from "@cortexmemory/sdk/runtime";
import { DELETE, POST } from "@/app/(chat)/api/chat/route";

const session = {
  memorySpaceId: "owned",
  principalId: "owner",
  tenantId: "tenant",
  userId: "owner",
  version: 1,
};
const handle = { conversationId: "owned-chat", runId: "retained-run" };
function request() {
  return new Request("http://localhost/api/chat", {
    body: JSON.stringify({
      agentId: "qualified-agent",
      agentVersion: 1,
      requestId: "same-request",
      text: "Owned response",
    }),
    headers: {
      authorization: "Bearer verified.jwt.fixture",
      "content-type": "application/json",
    },
    method: "POST",
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  process.env.CONVEX_URL = "https://unit.invalid";
  state.session.mockResolvedValue(session);
  state.submit.mockResolvedValue(handle);
  state.start.mockResolvedValue({ state: "running" });
});
describe("actual Chat handler remote admission and cleanup boundaries", () => {
  it("keeps a genuine verified-session refusal before submission and closes its owned client", async () => {
    state.session.mockRejectedValueOnce(new CortexRuntimeError("FORBIDDEN"));
    const result = await POST(request());
    expect(result.status).toBe(403);
    expect(await result.json()).toEqual({ code: "FORBIDDEN", version: 1 });
    expect(state.submit).not.toHaveBeenCalled();
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("does not redispatch an unknown start outcome under a fresh request identity", async () => {
    state.start.mockRejectedValueOnce(new Error("post-effect unknown outcome"));
    const result = await POST(request());
    expect(result.status).toBe(400);
    expect(await result.text()).not.toContain("post-effect");
    expect(state.submit).toHaveBeenCalledOnce();
    expect(state.start).toHaveBeenCalledExactlyOnceWith(handle, {
      streaming: true,
    });
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("withholds admission metadata after current authority changes", async () => {
    state.session
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ ...session, principalId: "foreign" });
    const result = await POST(request());
    expect(result.status).toBe(403);
    expect(await result.text()).not.toContain("retained-run");
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("waits for owned asynchronous cleanup before returning a response", async () => {
    let release!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.close.mockReturnValue(cleanup);
    let finished = false;
    const operation = POST(request()).then((value) => {
      finished = true;
      return value;
    });
    for (let index = 0; index < 20 && !state.close.mock.calls.length; index++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(state.close).toHaveBeenCalledOnce();
    expect(finished).toBe(false);
    release();
    expect((await operation).status).toBe(200);
  });
  it("submits only new canonical text once and returns the same backend handle without an app model or writer", async () => {
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ handle, version: 1 });
    expect(state.submit).toHaveBeenCalledExactlyOnceWith({
      agentId: "qualified-agent",
      agentVersion: 1,
      clientRequestId: "same-request",
      parts: [{ text: "Owned response", type: "text" }],
      version: 1,
    });
    expect(state.session).toHaveBeenCalledTimes(2);
    expect(state.start).toHaveBeenCalledOnce();
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("requires genuine attach authorization before cancellation of another handle", async () => {
    state.attach.mockRejectedValueOnce(new CortexRuntimeError("FORBIDDEN"));
    const result = await DELETE(
      new Request("http://localhost/api/chat?runId=foreign-run", {
        headers: { authorization: "Bearer verified.jwt.fixture" },
        method: "DELETE",
      })
    );
    expect(result.status).toBe(403);
    expect(state.cancel).not.toHaveBeenCalled();
    expect(state.close).toHaveBeenCalledOnce();
  });
});
