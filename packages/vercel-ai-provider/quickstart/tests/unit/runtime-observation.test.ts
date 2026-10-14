/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UIMessage } from "ai";
import type { RuntimeObservation, RuntimeRun, RuntimeRunHandle, RuntimeToolApproval, MemoryEffortTrace } from "@cortexmemory/sdk/runtime";
import { RuntimeQuickstart } from "../../components/RuntimeQuickstart";

type Lane = { finalOnly: boolean; active: boolean; update: (value: RuntimeObservation) => void;
  deny: (error: { code: string }) => void; close: jest.Mock };
const mockLanes: Lane[] = [];
const mockSendOptions:unknown[]=[];
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
  recall:jest.fn(async()=>({items:[],context:"",profileId:"profile"})),
  close: jest.fn(async () => {}),
  watchRun: jest.fn(() => jest.fn()),
  watchObservation: jest.fn((_handle: RuntimeRunHandle, update: Lane["update"], deny: Lane["deny"], options: { finalOnly?: boolean } = {}) => {
    const lane: Lane = { finalOnly: options.finalOnly ?? false, active: true, update, deny, close: jest.fn() };
    lane.close.mockImplementation(() => { lane.active = false; }); mockLanes.push(lane); return lane.close;
  }),
};
class MockTransport {
  private observationStop = () => {};
  onError = (_error: { code: string }) => {};
  get run() { return mockHandle; }
  constructor(private options: { onRun: (handle: RuntimeRunHandle) => void; onObservation: (value: RuntimeObservation) => void }) {}
  start() { this.options.onRun(mockHandle); this.observationStop();
    this.observationStop = mockClient.watchObservation(mockHandle, value => {
      this.options.onObservation(value);
      if (value.parts.length < 100 && ["complete", "failed", "cancelled"].includes(value.run.responseStatus)) this.observationStop();
    }, error => { this.observationStop(); this.onError(error); }, { finalOnly: false }); }
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
jest.mock("@ai-sdk/react", () => ({ useChat: function useMockChat({ transport, onError }: { transport: MockTransport; onError: (error: { code: string }) => void }) {
  transport.onError = onError;
  const hooks: typeof React = jest.requireMock("react");
  const [messages, setMessages] = hooks.useState<UIMessage[]>([]);
  return { messages, setMessages, status: "ready", sendMessage: async (_message:unknown,options?:unknown) => {
    mockSendOptions.push(options);
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
  await waitFor(() => expect(mockLanes.filter(value => value.active)).toHaveLength(1));
  return view;
}
beforeEach(() => { mockLanes.length = 0;mockSendOptions.length=0; jest.clearAllMocks(); delete mockOptions.onAuthChange;
  process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:9"; process.env.NEXT_PUBLIC_CORTEX_AGENT_ID = "agent";
  process.env.NEXT_PUBLIC_CORTEX_AGENT_VERSION = "1"; delete process.env.NEXT_PUBLIC_CORTEX_LATENCY_TRACE;
});
afterEach(cleanup);

test("one live observer hands off to a retained-response guard without losing empty-page status or later memory updates", async () => {
  await connectAndSubmit(); expect(mockClient.watchRun).not.toHaveBeenCalled();
  expect(mockClient.watchObservation).toHaveBeenCalledTimes(1);
  expect(lane(true)).toBeUndefined();
  for (const responseStatus of ["queued", "running", "waiting_approval", "complete"] as const) {
    emit(false, observation({ responseStatus }));
    expect(screen.getByTestId("run-status").textContent).toContain("Response: " + responseStatus);
    expect(screen.getByTestId("run-status").textContent).toContain("Memory: pending");
  }
  expect(lane(false)).toBeUndefined(); expect(lane(true).active).toBe(true);
  emit(true, observation({ responseStatus: "complete", memoryStatus: "complete" }));
  expect(screen.getByTestId("run-status").textContent).toContain("Memory: complete");
  expect(lane(true).active).toBe(true); expect(mockClient.watchObservation).toHaveBeenCalledTimes(2);
});
test("the live observer retains approvals, cancellation and run metadata before terminal handoff", async () => {
  await connectAndSubmit(); const approval = { operationId: "operation", toolName: "remember", requestHash: "hash" };
  emit(false, observation({ responseStatus: "waiting_approval" }, [approval]));
  expect(lane(true)).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Approve remember" }));
  await waitFor(() => expect(mockApproveTool).toHaveBeenCalledWith(approval));
  fireEvent.click(screen.getByRole("button", { name: "Cancel run" }));
  await waitFor(() => expect(mockCancel).toHaveBeenCalledTimes(1));
  emit(false, observation({ responseStatus: "cancelled", cancellationRequested: true }));
  expect(screen.getByTestId("run-status").textContent).toContain("Response: cancelled");
  expect((screen.getByRole("button", { name: "Cancel run" }) as HTMLButtonElement).disabled).toBe(true);
});
test.each(["FORBIDDEN", "AUTHORITY_EXPIRED", "SESSION_CHANGED"])("continuous final denial %s clears private UI after response completion", async code => {
  await connectAndSubmit(); emit(false, observation({ responseStatus: "complete" }));
  const guard = lane(true); expect(guard.active).toBe(true);
  act(() => guard.deny({ code }));
  await waitFor(() => expect(screen.queryByText("protected fixture reply")).toBeNull());
  expect(screen.queryByTestId("verified-scope")).toBeNull(); expect(screen.queryByTestId("run-status")).toBeNull();
  expect(screen.getByRole("alert").textContent).toBe(code); expect(mockClient.close).toHaveBeenCalledTimes(1);
  expect(mockLanes.every(value => !value.active)).toBe(true);
});
test("disconnect/reconnect and unmount release the current owned observer", async () => {
  const view = await connectAndSubmit(); const first = [...mockLanes];
  fireEvent.click(screen.getByRole("button", { name: "Disconnect observer" }));
  await waitFor(() => expect(mockLanes.filter(value => value.active)).toHaveLength(0));
  expect(first.every(value => value.close.mock.calls.length === 1)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reconnect observer" }));
  await waitFor(() => expect(mockLanes.filter(value => value.active)).toHaveLength(1));
  expect(mockClient.watchRun).not.toHaveBeenCalled(); expect(mockClient.watchObservation).toHaveBeenCalledTimes(2);
  emit(false, observation({ responseStatus: "running" }));
  view.unmount(); expect(mockLanes.every(value => !value.active)).toBe(true);
  expect(mockClient.close).toHaveBeenCalledTimes(1);
});
test.each(["FORBIDDEN", "AUTHORITY_EXPIRED", "SESSION_CHANGED"])("live delivery denial %s clears the private projection before any retained observer exists", async code => {
  await connectAndSubmit(); expect(lane(true)).toBeUndefined();
  act(() => lane(false).deny({ code }));
  await waitFor(() => expect(screen.queryByText("protected fixture reply")).toBeNull());
  expect(screen.queryByTestId("verified-scope")).toBeNull();
  expect(mockLanes.every(value => !value.active)).toBe(true); expect(mockClient.close).toHaveBeenCalledTimes(1);
});
test("a terminal full cursor page keeps live delivery until the transport has drained it", async () => {
  await connectAndSubmit();
  const full = observation({ responseStatus: "complete" });
  full.parts = Array.from({ length: 100 }, (_, index) => ({ sequence: index + 1, final: false, part: { type: "text-delta", text: "x" } }));
  emit(false, full); expect(lane(false).active).toBe(true); expect(lane(true)).toBeUndefined();
  emit(false, observation({ responseStatus: "complete" }));
  expect(lane(false)).toBeUndefined(); expect(lane(true).active).toBe(true);
});
test("a non-authority stream failure hands retained private text to a continuing guard", async () => {
  await connectAndSubmit(); act(() => lane(false).deny({ code: "TRANSPORT_ERROR" }));
  expect(lane(false)).toBeUndefined(); expect(lane(true).active).toBe(true);
  expect(screen.getByText("protected fixture reply")).toBeDefined();
  emit(true, observation({ responseStatus: "complete", memoryStatus: "complete" }));
  expect(screen.getByTestId("run-status").textContent).toContain("Memory: complete");
  act(() => lane(true).deny({ code: "FORBIDDEN" }));
  await waitFor(() => expect(screen.queryByText("protected fixture reply")).toBeNull());
});
test("the retained guard stays active if a later backend state moves beyond its terminal response", async () => {
  await connectAndSubmit(); emit(false, observation({ responseStatus: "complete" }));
  const retained = lane(true); emit(true, observation({ responseStatus: "running", attemptNumber: 2 }));
  expect(retained.active).toBe(true); expect(lane(true)).toBe(retained);
  expect(mockClient.watchObservation).toHaveBeenCalledTimes(2);
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


test("effort-aware UI starts Normal, captures each send choice and displays the server trace separately",async()=>{
 mockClient.getDefinition.mockResolvedValueOnce(Object.assign({agentId:"agent",version:1,definitionHash:"definition",tools:[],memoryMode:"indexed-plus-pending"},{inputSelectionVersion:2,memoryEffortPolicyVersion:1}));
 const view=await connectAndSubmit();const select=screen.getByRole("combobox",{name:"Memory effort"}) as HTMLSelectElement;
 expect(select.value).toBe("normal");expect(select.disabled).toBe(false);expect(mockSendOptions[0]).toEqual({body:{memory:{effort:"normal"}}});
 fireEvent.change(select,{target:{value:"max"}});fireEvent.change(screen.getByLabelText("Message",{exact:true}),{target:{value:"next request"}});fireEvent.click(screen.getByRole("button",{name:"Send"}));
 await waitFor(()=>expect(mockSendOptions).toHaveLength(2));expect(mockSendOptions[0]).toEqual({body:{memory:{effort:"normal"}}});expect(mockSendOptions[1]).toEqual({body:{memory:{effort:"max"}}});
 const trace:MemoryEffortTrace={version:1,policyVersion:"memory-effort-v1",requestedEffort:"normal",effectiveEffort:"normal",maxDepth:4,maxEntries:8,maxContextTokens:4096,targetFirstAnswerMs:6000,reachedDepth:3,visited:5,expanded:3,selected:4,deduplicated:1,entriesByKind:{memory:2,fact:2,pending:0,history:0},selectedInputUnits:100,durationMs:12,stopReasons:["work"],unavailableStages:["external_graph"]};
 emit(false,observation({memoryEffort:trace}));expect(screen.getByTestId("memory-effort-status").textContent).toContain("Server effort: normal");expect(screen.getByTestId("memory-effort-status").textContent).toContain("Reached depth 3");expect(select.value).toBe("max");
 view.unmount();
});
test("legacy Agent selection remains readable without claiming an effort was applied",async()=>{
 const view=await connectAndSubmit();expect((screen.getByRole("combobox",{name:"Memory effort"}) as HTMLSelectElement).disabled).toBe(true);
 expect(screen.getByText(/This Agent version uses legacy memory selection/)).toBeDefined();expect(mockSendOptions[0]).toBeUndefined();view.unmount();
});
