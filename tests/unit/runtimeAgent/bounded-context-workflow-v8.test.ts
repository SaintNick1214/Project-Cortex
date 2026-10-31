/** Installed Workflow interpreter: V8 preserves approval and tool steps; historical V7
 * journals retain their original identity and replay. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { BaseChannel, ChannelClosedError } from "async-channel";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { createWorkflowCtx } from "../../../node_modules/@convex-dev/workflow/dist/client/workflowContext.js";
import { StepExecutor } from "../../../node_modules/@convex-dev/workflow/dist/client/step.js";
import { canonicalModelJson } from "../../../src/domain/model-policy";
type Request = Parameters<typeof createWorkflowCtx>[1] extends BaseChannel<infer T> ? T : never;
type Entry = ConstructorParameters<typeof StepExecutor>[4][number];
const host = globalThis as typeof globalThis & { Convex?: unknown }, originalHost = host.Convex;
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class { define(value: { handler: unknown }) { return { _handler: value.handler }; } } }));
const runtime = await import("../../../convex-dev/runtimeAgent");
const args = { runId: "run:controlled", attemptNumber: 1, leaseVersion: 1, reference: { tenantId: "tenant", memorySpaceId: "space", principalId: "owner" } };
beforeEach(() => { host.Convex = { asyncSyscall: async (name: string, input: string) => {
  if (name !== "1.0/createFunctionHandle") throw Error("Unexpected syscall"); return JSON.stringify(`function://${(JSON.parse(input) as { name: string }).name}`);
} }; });
afterEach(() => { host.Convex = originalHost; jest.restoreAllMocks(); });
async function drive(version: "executeToolsV7" | "executeToolsV8", prior: Entry[] = []) {
  const entries: Entry[] = structuredClone(prior), channel = new BaseChannel<Request>(), retries: unknown[] = [];
  const journal = makeFunctionReference<"mutation">("test:journal"), suspended = Error("CONTROLLED_DURABLE_SUSPENSION");
  const ctx = { runMutation: async (ref: unknown, input: unknown) => {
    if (getFunctionName(ref as never) !== "test:journal") throw Error("Unexpected inline native execution");
    const added = (input as { steps: { retry?: unknown; step: Entry["step"] }[] }).steps.map(({ retry, step }, index) => {
      retries.push(retry); return { _id: `steps:${entries.length + index}`, _creationTime: 1000, workflowId: "workflow:preflight", stepNumber: entries.length + index, step } as Entry;
    }); entries.push(...added); return added;
  } };
  const executor = new StepExecutor("workflow:preflight", 0, ctx as never, { journal: { startSteps: journal } } as never,
    structuredClone(prior), channel, 1000, undefined), worker = executor.run(); void worker.catch(() => {});
  const workflow = createWorkflowCtx("workflow:preflight" as never, channel);
  const task = (runtime[version] as unknown as { _handler(ctx: unknown, args: unknown): Promise<null> })._handler(workflow, args); void task.catch(() => {});
  let value: unknown, error: unknown;
  try { value = await Promise.race([task, worker.then(() => { throw suspended; })]); } catch (caught) { error = caught; }
  channel.close(); try { await worker; } catch (caught) { if (!(caught instanceof ChannelClosedError) && caught !== error) throw caught; }
  return { entries, retries, value, error, suspended };
}
function complete(entries: Entry[], value: unknown, failure = false) {
  const result = structuredClone(entries), entry = result[result.length - 1]; entry.step.inProgress = false; entry.step.completedAt = 1000;
  entry.step.runResult = failure ? { kind: "failed", error: String(value) } : { kind: "success", returnValue: value as never }; return result;
}
async function approvalPrefix(version: "executeToolsV7" | "executeToolsV8") {
  const first = await drive(version);
  const canonical = canonicalModelJson({ savedMessageIds: ["first-model"], final: false, calls: [{ toolCallId: "call", toolName: "memory_remember", inputCanonical: canonicalModelJson({ text: "explicit fact" }) }] });
  const begin = await drive(version, complete(first.entries, canonical));
  const wait = await drive(version, complete(begin.entries, { operationId: "approved-tool", state: "waiting_approval" }));
  const event = await drive(version, complete(wait.entries, null));
  expect(event.entries[event.entries.length - 1].step).toMatchObject({ kind: "event", name: "approved-tool" });
  const tool = await drive(version, complete(event.entries, "approved"));
  expect(tool.entries[tool.entries.length - 1].step).toMatchObject({ functionType: "action", handle: "function://runtimeAgent:toolStep" });
  expect(tool.retries).toEqual([false]);
  return await drive(version, complete(tool.entries, null));
}
it("fresh V8 keeps every approval/tool step and routes the bounded later turn with retry:false",async()=>{
 const old=await approvalPrefix("executeToolsV7"),fresh=await approvalPrefix("executeToolsV8");
 expect(fresh.entries.slice(0,-1)).toEqual(old.entries.slice(0,-1));
 expect(old.entries.at(-1)!.step).toMatchObject({handle:"function://runtimeAgent:turnStepV7",args:{...args,ordinal:1}});
 expect(fresh.entries.at(-1)!.step).toMatchObject({handle:"function://runtimeAgent:turnStepV8",args:{...args,ordinal:1}});
 expect(fresh.retries).toEqual([false]);
 expect((await drive("executeToolsV8",complete(fresh.entries,{savedMessageIds:["final"],final:true,calls:[]}))).value).toBeNull();
});
it("failed V8 later turn replays without dispatch or journal reinterpretation",async()=>{
 const prefix=await approvalPrefix("executeToolsV8"),failed=complete(prefix.entries,"CONTEXT_LIMIT_EXCEEDED",true),replay=await drive("executeToolsV8",failed);
 expect(String(replay.error)).toContain("CONTEXT_LIMIT_EXCEEDED");expect(replay.entries).toEqual(failed);expect(replay.retries).toEqual([]);
});
