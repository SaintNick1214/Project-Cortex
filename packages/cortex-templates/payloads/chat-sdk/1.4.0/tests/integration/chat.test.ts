// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  allocated: 0,
  applyContentSuggestion: vi.fn(),
  attach: vi.fn(),
  cancel: vi.fn(),
  cancelContentJob: vi.fn(),
  close: vi.fn(),
  getContentJob: vi.fn(),
  listContentJobs: vi.fn(),
  observe: vi.fn(),
  reconcileContentJob: vi.fn(),
  session: vi.fn(),
  start: vi.fn(),
  submit: vi.fn(),
  submitContentJob: vi.fn(),
}));
vi.mock("@cortexmemory/sdk/runtime", () => ({
  CortexRuntimeClient: class {
    constructor() {
      state.allocated++;
    }
    session = state.session;
    submit = state.submit;
    start = state.start;
    attach = state.attach;
    observe = state.observe;
    cancel = state.cancel;
    submitContentJob = state.submitContentJob;
    getContentJob = state.getContentJob;
    listContentJobs = state.listContentJobs;
    cancelContentJob = state.cancelContentJob;
    reconcileContentJob = state.reconcileContentJob;
    applyContentSuggestion = state.applyContentSuggestion;
    close = state.close;
  },
  CortexRuntimeError: class extends Error {
    code = "FORBIDDEN";
  },
}));

import { POST as chat, DELETE as stop } from "@/app/(chat)/api/chat/route";
import {
  POST as document,
  GET as getDocument,
} from "@/app/(chat)/api/document/route";
import { POST as suggestion } from "@/app/(chat)/api/suggestions/route";

const request = (body: unknown, token = "valid.jwt.sig", path = "/api/chat") =>
  new Request(`http://localhost${path}`, {
    body: JSON.stringify(body),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    method: "POST",
  });
beforeEach(() => {
  state.allocated = 0;
  vi.clearAllMocks();
  state.session.mockResolvedValue({ principalId: "verified" });
  state.submit.mockResolvedValue({
    conversationId: "conversation",
    runId: "run",
  });
  state.start.mockResolvedValue({ started: true });
  state.close.mockResolvedValue(undefined);
  state.submitContentJob.mockResolvedValue({
    jobId: "job",
    state: "pending",
    version: 1,
  });
});
describe("canonical HTTP delegation", () => {
  it("denies missing JWT before allocating a transport", async () => {
    expect(
      (await chat(request({ requestId: "key", text: "hello" }, ""))).status
    ).toBe(401);
    expect(state.allocated).toBe(0);
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("requires a client request ID before paid effects", async () => {
    expect(
      (await chat(request({ agentId: "agent", text: "hello" }))).status
    ).toBe(400);
    expect(state.submit).not.toHaveBeenCalled();
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("submits only the new message and starts the same pinned handle", async () => {
    expect(
      (
        await chat(
          request({
            agentId: "agent",
            agentVersion: 2,
            requestId: "stable",
            text: "hello",
          })
        )
      ).status
    ).toBe(200);
    expect(state.submit).toHaveBeenCalledWith({
      agentId: "agent",
      agentVersion: 2,
      clientRequestId: "stable",
      parts: [{ text: "hello", type: "text" }],
      version: 1,
    });
    expect(state.start).toHaveBeenCalledWith(
      { conversationId: "conversation", runId: "run" },
      { streaming: true }
    );
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("rejects history and model injection before submit", async () => {
    const result = await chat(
      request({
        agentId: "agent",
        messages: [],
        modelId: "invented",
        requestId: "key",
        text: "hello",
      })
    );
    expect(result.status).toBe(400);
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("preserves verified auth rejection without private diagnostics", async () => {
    state.session.mockRejectedValue(new Error("private-provider-secret"));
    const result = await chat(request({ requestId: "key", text: "hello" }));
    expect(await result.text()).not.toContain("private-provider-secret");
    expect(state.submit).not.toHaveBeenCalled();
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("creates backend code job with bounded intent, no app execution", async () => {
    const input = {
      intent: "code",
      prompt: "Produce a function",
      requestId: "code-key",
      version: 1,
    };
    expect((await document(request(input))).status).toBe(200);
    expect(state.submitContentJob).toHaveBeenCalledWith(input);
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("pins a selected source artifact version for update", async () => {
    const input = {
      artifact: { artifactId: "document", version: 3 },
      intent: "text",
      prompt: "Correct this",
      requestId: "edit-key",
      version: 1,
    };
    await document(request(input));
    expect(state.submitContentJob).toHaveBeenCalledWith(input);
  });
  it("rejects authority and budget extras on content", async () => {
    expect(
      (
        await document(
          request({
            authority: "claimed",
            intent: "text",
            prompt: "draft",
            requestId: "x",
            runBudgetId: "fake",
            version: 1,
          })
        )
      ).status
    ).toBe(400);
    expect(state.submitContentJob).not.toHaveBeenCalled();
  });
  it("reconnect gets the existing job without submit", async () => {
    state.getContentJob.mockResolvedValue({ jobId: "job", state: "ready" });
    const result = await getDocument(
      new Request("http://localhost/api/document?jobId=job", {
        headers: { Authorization: "Bearer valid.jwt.sig" },
      })
    );
    expect(result.status).toBe(200);
    expect(state.getContentJob).toHaveBeenCalledWith("job");
    expect(state.submitContentJob).not.toHaveBeenCalled();
  });
  it("applies exactly one chosen suggestion to the selected version", async () => {
    state.applyContentSuggestion.mockResolvedValue({
      artifactVersion: 4,
      jobId: "job",
    });
    const input = { artifactVersion: 3, jobId: "job", suggestionId: "one" };
    expect((await suggestion(request(input))).status).toBe(200);
    expect(state.applyContentSuggestion).toHaveBeenCalledWith(input);
  });
  it("cancellation verifies the existing handle", async () => {
    state.attach.mockResolvedValue({ runId: "run" });
    state.cancel.mockResolvedValue({ cancelled: true });
    await stop(
      new Request("http://localhost/api/chat?runId=run", {
        headers: { Authorization: "Bearer valid.jwt.sig" },
        method: "DELETE",
      })
    );
    expect(state.attach).toHaveBeenCalledWith("run");
    expect(state.cancel).toHaveBeenCalledWith({ runId: "run" });
  });
  it("history preserves no-store and fresh request-local close", async () => {
    state.listContentJobs.mockResolvedValue([]);
    const result = await getDocument(
      new Request("http://localhost/api/document", {
        headers: { Authorization: "Bearer valid.jwt.sig" },
      })
    );
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("suppresses a response when verified identity changes during its awaits", async () => {
    state.session
      .mockResolvedValueOnce({
        memorySpaceId: "space",
        principalId: "a",
        tenantId: "tenant",
      })
      .mockResolvedValueOnce({
        memorySpaceId: "space",
        principalId: "b",
        tenantId: "tenant",
      });
    state.getContentJob.mockResolvedValue({
      content: "PRIVATE_CONTENT",
      jobId: "job",
    });
    const result = await getDocument(
      new Request("http://localhost/api/document?jobId=job", {
        headers: { Authorization: "Bearer valid.jwt.sig" },
      })
    );
    expect(result.status).toBe(403);
    expect(await result.text()).not.toContain("PRIVATE_CONTENT");
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("honors a consumed resource deadline before serializing its protected DTO", async () => {
    state.getContentJob.mockResolvedValue({
      content: "EXPIRED_CONTENT",
      deliveryExpiresAt: Date.now() - 1,
      jobId: "job",
    });
    const result = await getDocument(
      new Request("http://localhost/api/document?jobId=job", {
        headers: { Authorization: "Bearer valid.jwt.sig" },
      })
    );
    expect(result.status).toBe(403);
    expect(await result.text()).not.toContain("EXPIRED_CONTENT");
    expect(state.close).toHaveBeenCalledOnce();
  });
  it("closes an aborted request without waiting for a blocked remote read or publishing its late value", async () => {
    let resolve: ((value: unknown) => void) | undefined;
    state.getContentJob.mockImplementation(
      () =>
        new Promise((value) => {
          resolve = value;
        })
    );
    const controller = new AbortController(),
      pending = getDocument(
        new Request("http://localhost/api/document?jobId=job", {
          headers: { Authorization: "Bearer valid.jwt.sig" },
          signal: controller.signal,
        })
      );
    await vi.waitFor(() => expect(state.getContentJob).toHaveBeenCalled());
    controller.abort();
    const result = await pending;
    expect(result.status).toBe(408);
    expect(state.close).toHaveBeenCalledOnce();
    resolve?.({ content: "LATE_PRIVATE_CONTENT" });
    expect(await result.text()).not.toContain("LATE_PRIVATE_CONTENT");
  });
});
