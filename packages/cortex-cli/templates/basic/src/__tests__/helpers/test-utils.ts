import { vi } from "vitest";
import type { RuntimeRun, RuntimeRunHandle, RuntimeObservation, RuntimeSession } from "@cortexmemory/sdk/runtime";
import type { RuntimeClient, RuntimeConfig } from "../../cortex.js";
export const config: RuntimeConfig = { deploymentUrl: "https://test.convex.cloud", tenantId: "tenant", memorySpaceId: "space", agentId: "agent", agentVersion: 2, timeoutMs: 30000 };
export function runtimeMock(principalId = "owner") {
  const verified: RuntimeSession = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId, userId: principalId };
  const handle: RuntimeRunHandle = { ...verified, runId: "run-one", conversationId: "conversation-one", agentId: "agent", agentVersion: 2, definitionHash: "a".repeat(64) };
  const run: RuntimeRun = { version: 1, runId: handle.runId, conversationId: handle.conversationId, agentId: "agent", agentVersion: 2,
    scope: { tenantId: "tenant", memorySpaceId: "space" }, definitionHash: handle.definitionHash, queueSequence: 1, responseStatus: "queued", memoryStatus: "pending", graphStatus: "not_requested",
    attemptNumber: 0, cancellationRequested: false, inputMessageIds: ["input-one"], outputMessageIds: [], failureCode: null, contextCompleteness: null, contextFailureCode: null, createdAt: 1, updatedAt: 1 };
  const observation: RuntimeObservation = { run, state: "running", cursor: 1, approvals: [], parts: [{ sequence: 1, part: { type: "text", text: "server-owned response" } }] };
  const session = vi.fn<RuntimeClient["session"]>(async () => verified);
  const submit = vi.fn<RuntimeClient["submit"]>(async () => handle);
  const start = vi.fn<RuntimeClient["start"]>(async () => { run.responseStatus = "running"; return { runId: handle.runId, attemptNumber: 1, state: "running" }; });
  const attach = vi.fn<RuntimeClient["attach"]>(async () => handle);
  const get = vi.fn<RuntimeClient["get"]>(async () => run);
  const observe = vi.fn<RuntimeClient["observe"]>(async () => observation);
  const unsubscribe = vi.fn();
  const watchObservation = vi.fn<RuntimeClient["watchObservation"]>((_handle, update) => { update({ ...observation, run: { ...run, responseStatus: "complete" }, state: "complete" }); return unsubscribe; });
  const cancel = vi.fn<RuntimeClient["cancel"]>(async () => ({ cancelled: true }));
  const approveInput = vi.fn<RuntimeClient["approveInput"]>(async () => run);
  const approveTool = vi.fn<RuntimeClient["approveTool"]>(async () => ({ approved: true }));
  const messages = vi.fn<RuntimeClient["messages"]>(async () => ({ page: [{ id: "input-one", role: "user", parts: [{ type: "text", text: "stored source" }], order: 1, stepOrder: 0, status: "success", revision: 1 }], isDone: true, continueCursor: null }));
  const listConversations = vi.fn<RuntimeClient["listConversations"]>(async () => []);
  const getDefaultProfile = vi.fn<RuntimeClient["getDefaultProfile"]>(async () => ({ version: 1, profile: { profileId: "small", modelId: "model", dimensions: 1536, normalization: "v1", chunking: "v1", indexName: "small-index" } }));
  const memoryReadiness = vi.fn<RuntimeClient["memoryReadiness"]>(async () => ({ version: 1, cutoff: 1, graphCutoff: 0, profile: (await getDefaultProfile()).profile, stages: { facts: { cutoff: 1, indexedThrough: 0, complete: false, hole: { sequence: 1, state: "pending" } } }, strictStages: [] }));
  const recall = vi.fn<RuntimeClient["recall"]>(async () => ({ items: [{ type: "fact", id: "fact-one", content: "authorized recall", score: 1, source: "source-one" }], context: "authorized recall", profileId: "small" }));
  const close = vi.fn();
  const client = { session, submit, start, attach, get, observe, watchObservation, cancel, approveInput, approveTool, messages, listConversations, getDefaultProfile, memoryReadiness, recall, close } satisfies RuntimeClient;
  return { client, verified, run, handle, observation, unsubscribe };
}
