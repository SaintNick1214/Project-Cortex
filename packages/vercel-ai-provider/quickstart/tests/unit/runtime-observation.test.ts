/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UIMessage } from "ai";
import type { RuntimeObservation, RuntimeRun, RuntimeRunHandle, RuntimeToolApproval } from "@cortexmemory/sdk/runtime";
import { RuntimeQuickstart } from "../../components/RuntimeQuickstart";

type Lane = { finalOnly: boolean; active: boolean; update: (value: RuntimeObservation) => void;
  deny: (error: { code: string }) => void; close: jest.Mock };
const mockLanes: Lane[] = [];
const mockScope = { tenantId: "tenant", memorySpaceId: "space" };
const mockHandle: RuntimeRunHandle = { version: 1, ...mockScope, principalId: "owner", runId: "run:" + "1".repeat(64),
  conversationId: "conversation", agentId: "agent", agentVersion: 1, definitionHash: "definition" };
const mockRun: RuntimeRun = { ...mockHandle, scope: mockScope, queueSequence: 1, responseStatus: "running",
  memoryStatus: "pending", graphStatus: "not_requested", attemptNumber: 1, cancellationRequested: false,
  inputMessageIds: ["user"], outputMessageIds: [], failureCode: null, contextCompleteness: "complete", contextFailureCode: null,
  createdAt: 1, updatedAt: 2 };
const mockApproveTool = jest.fn(async (_approval: RuntimeToolApproval) => {});
const mockCancel = jest.fn(async () => {});
const mockOptions: { onAuthChange?: (authenticated: boolean) => void } = {};
const mockClient = {
  session: jest.fn(async () => ({ version: 1, ...mockScope, principalId: "owner", userId: "owner" })),
  getDefinition: jest.fn(async () => ({ agentId: "agent", version: 1, definitionHash: "definition", tools: [], memoryMode: "indexed-plus-pending" })),
  getEmbeddingProfile: jest.fn(async () => ({ profile: { profileId: "profile", modelId: "model", dimensions: 1536,
    normalization: "none", chunking: "chunks", indexName: "index" } })),
  close: jest.fn(async () => {}),
  watchRun: jest.fn(() => jest.fn()),
  watchObservation: jest.fn((_handle: RuntimeRunHandle, update: Lane["update"], deny: Lane["deny"], options: { finalOnly?: boolean } = {}) => {
    const lane: Lane = { finalOnly: options.finalOnly ?? false, active: true, update, deny, close: jest.fn() };
    lane.close.mockImplementation(() => { lane.active = false; }); mockLanes.push(lane); return lane.close;
  }),
};
class MockTransport {
  private observationStop = () => {};
  constructor(private options: { onRun: (handle: RuntimeRunHandle) => void; onObservation: (value: RuntimeObservation) => void }) {}
  start() { this.options.onRun(mockHandle); this.observationStop();
    this.observationStop = mockClient.watchObservation(mockHandle, this.options.onObservation, () => {}, { finalOnly: false }); }
  disconnect() { this.observationStop(); }
  approveTool = mockApproveTool;
  stopRun = mockCancel;
  stop() { return mockCancel(); }
}
// The canonical app has a separate React install; use the renderer-owned singleton in this fixture.
jest.mock("react", () => jest.requireActual(require.resolve("react", { paths: [require.resolve("@testing-library/react")] })));
jest.mock("@cortexmemory/sdk/runtime", () => ({
  CortexRuntimeClient: class { constructor(options: typeof mockOptions) { Object.assign(mockOptions, options); return mockClient; } },
  runtimePublicPart: (part: unknown) => part,
}));
jest.mock("@cortexmemory/vercel-ai-provider/remote", () => ({ CortexRemoteTransport: class { constructor(options: ConstructorParameters<typeof MockTransport>[0]) { return new MockTransport(options); } } }));
jest.mock("../../components/RuntimeMediaPanel", () => ({ RuntimeMediaPanel: () => null }));
jest.mock("@ai-sdk/react", () => ({ useChat: function useMockChat({ transport }: { transport: MockTransport }) {
  const hooks: typeof React = jest.requireMock("react");
  const [messages, setMessages] = hooks.useState<UIMessage[]>([]);
  return { messages, setMessages, status: "ready", sendMessage: async () => {
    transport.start(); setMessages([{ id: "user", role: "user", parts: [{ type: "text", text: "fixture request" }] },
      { id: "assistant", role: "assistant", parts: [{ type: "text", text: "protected fixture reply" }] }]);
  }, resumeStream: async () => { transport.start(); } };
} }));
function observation(overrides: Partial<RuntimeRun> = {}, approvals: RuntimeToolApproval[] = []): RuntimeObservation {
  return { run: { ...mockRun, ...overrides }, state: "running", parts: [], cursor: 0, approvals };
}
function lane(finalOnly: boolean) { return mockLanes.findLast(value => value.active && value.finalOnly === finalOnly)!; }
function emit(finalOnly: boolean, value: RuntimeObservation) { const own = lane(finalOnly); expect(own).toBeDefined(); act(() => own.update(value)); }
async function connectAndSubmit() {
  const view = render(React.createElement(RuntimeQuickstart));
  fireEvent.change(screen.getByLabelText("Access token"), { target: { value: "fixture-token" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
  await screen.findByTestId("verified-scope");
  fireEvent.change(screen.getByLabelText("Message", { exact: true }), { target: { value: "fixture request" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("protected fixture reply");
  await waitFor(() => expect(mockLanes.filter(value => value.active)).toHaveLength(2));
  return view;
}
beforeEach(() => { mockLanes.length = 0; jest.clearAllMocks(); delete mockOptions.onAuthChange;
  process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:9"; process.env.NEXT_PUBLIC_CORTEX_AGENT_ID = "agent";
  process.env.NEXT_PUBLIC_CORTEX_AGENT_VERSION = "1"; delete process.env.NEXT_PUBLIC_CORTEX_LATENCY_TRACE;
});
afterEach(cleanup);

test("two observers retain empty-page status and post-response memory updates without watchRun", async () => {
  await connectAndSubmit(); expect(mockClient.watchRun).not.toHaveBeenCalled();
  expect(mockClient.watchObservation).toHaveBeenCalledTimes(2);
  expect(mockLanes.map(value => value.finalOnly).sort()).toEqual([false, true]);
  for (const responseStatus of ["queued", "running", "waiting_approval", "complete"] as const) {
    emit(true, observation({ responseStatus }));
    expect(screen.getByTestId("run-status").textContent).toContain("Response: " + responseStatus);
    expect(screen.getByTestId("run-status").textContent).toContain("Memory: pending");
  }
  emit(true, observation({ responseStatus: "complete", memoryStatus: "complete" }));
  expect(screen.getByTestId("run-status").textContent).toContain("Memory: complete");
  expect(lane(true).active).toBe(true); expect(mockClient.watchObservation).toHaveBeenCalledTimes(2);
});
test("transport approvals and cancel remain reachable while final observer updates run metadata", async () => {
  await connectAndSubmit(); const approval = { operationId: "operation", toolName: "remember", requestHash: "hash" };
  emit(false, observation({ responseStatus: "waiting_approval" }, [approval]));
  emit(true, observation({ responseStatus: "waiting_approval" }));
  fireEvent.click(screen.getByRole("button", { name: "Approve remember" }));
  await waitFor(() => expect(mockApproveTool).toHaveBeenCalledWith(approval));
  fireEvent.click(screen.getByRole("button", { name: "Cancel run" }));
  await waitFor(() => expect(mockCancel).toHaveBeenCalledTimes(1));
  emit(true, observation({ responseStatus: "cancelled", cancellationRequested: true }));
  expect(screen.getByTestId("run-status").textContent).toContain("Response: cancelled");
  expect((screen.getByRole("button", { name: "Cancel run" }) as HTMLButtonElement).disabled).toBe(true);
});
test.each(["FORBIDDEN", "AUTHORITY_EXPIRED", "SESSION_CHANGED"])("continuous final denial %s clears private UI after response completion", async code => {
  await connectAndSubmit(); emit(true, observation({ responseStatus: "complete" }));
  const guard = lane(true); expect(guard.active).toBe(true);
  act(() => guard.deny({ code }));
  await waitFor(() => expect(screen.queryByText("protected fixture reply")).toBeNull());
  expect(screen.queryByTestId("verified-scope")).toBeNull(); expect(screen.queryByTestId("run-status")).toBeNull();
  expect(screen.getByRole("alert").textContent).toBe(code); expect(mockClient.close).toHaveBeenCalledTimes(1);
  expect(mockLanes.every(value => !value.active)).toBe(true);
});
test("disconnect/reconnect and unmount release both owned observers", async () => {
  const view = await connectAndSubmit(); const first = [...mockLanes];
  fireEvent.click(screen.getByRole("button", { name: "Disconnect observer" }));
  await waitFor(() => expect(mockLanes.filter(value => value.active)).toHaveLength(0));
  expect(first.every(value => value.close.mock.calls.length === 1)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reconnect observer" }));
  await waitFor(() => expect(mockLanes.filter(value => value.active)).toHaveLength(2));
  expect(mockClient.watchRun).not.toHaveBeenCalled(); expect(mockClient.watchObservation).toHaveBeenCalledTimes(4);
  emit(true, observation({ responseStatus: "running" }));
  view.unmount(); expect(mockLanes.every(value => !value.active)).toBe(true);
  expect(mockClient.close).toHaveBeenCalledTimes(1);
});
test("signout and verified-auth denial remove the private projection and subscriptions", async () => {
  await connectAndSubmit(); fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(screen.queryByText("protected fixture reply")).toBeNull());
  expect(mockLanes.every(value => !value.active)).toBe(true); expect(mockClient.close).toHaveBeenCalledTimes(1);
});
test("SDK authentication loss keeps the original owner teardown", async () => {
  await connectAndSubmit(); act(() => mockOptions.onAuthChange?.(false));
  await waitFor(() => expect(screen.queryByText("protected fixture reply")).toBeNull());
  expect(screen.getByRole("alert").textContent).toBe("UNAUTHENTICATED");
  expect(mockLanes.every(value => !value.active)).toBe(true); expect(mockClient.close).toHaveBeenCalledTimes(1);
});
