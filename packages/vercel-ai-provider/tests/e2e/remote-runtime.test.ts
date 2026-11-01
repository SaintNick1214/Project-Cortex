/** Actual backend-owned inference. This suite has no mocks and never provisions authority. */
import { expect, it } from "@jest/globals";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { readUIMessageStream } from "ai";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";
import type { RuntimeRunHandle } from "@cortexmemory/sdk/runtime";
import { actualRuntimeFixture, fixtureToken } from "../../../../tests/helpers/runtime-fixtures";
import { CortexRemoteTransport } from "@cortexmemory/vercel-ai-provider/remote";

function configuration() {
  if (process.env.CI !== "true" && process.env.CORTEX_TEST_ENV_MODE !== "explicit") {
    throw new Error("REMOTE_ACTUAL_EXPLICIT_ENVIRONMENT_REQUIRED");
  }
  for (const name of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "AI_GATEWAY_API_KEY", "CORTEX_CI_AUTH_PRIVATE_KEY",
    "CONVEX_DEPLOY_KEY", "CONVEX_DEPLOY_KEY_CLI", "CORTEX_CI_CONVEX_DEPLOY_KEY", "CORTEX_CI_CONVEX_DEPLOY_KEY_CLI"]) {
    if (process.env[name]) throw new Error("REMOTE_ACTUAL_CLIENT_CREDENTIALS_FORBIDDEN");
  }
  const fixture = actualRuntimeFixture();
  let allowed: unknown;
  try { allowed = JSON.parse(process.env.CORTEX_CI_DISPOSABLE_DEPLOYMENTS ?? ""); }
  catch { throw new Error("REMOTE_ACTUAL_DISPOSABLE_ALLOWLIST_REQUIRED"); }
  if (!Array.isArray(allowed) || !allowed.some(name => fixture.deploymentUrl === `https://${name}.convex.cloud`)) {
    throw new Error("REMOTE_ACTUAL_TARGET_NOT_ALLOWLISTED");
  }
  const agentId = process.env.CORTEX_TEST_REMOTE_AGENT_ID;
  const version = process.env.CORTEX_TEST_REMOTE_AGENT_VERSION;
  const definitionHash = process.env.CORTEX_TEST_REMOTE_AGENT_DEFINITION_HASH;
  if (!agentId || agentId.length > 512 || !version || !/^[1-9][0-9]{0,8}$/.test(version)
    || !definitionHash || !/^[a-f0-9]{64}$/.test(definitionHash)) {
    throw new Error("REMOTE_ACTUAL_PUBLISHED_AGENT_REQUIRED: Native must publish a currently qualified definition and supply its exact id/version/hash");
  }
  // These are fixture-shape checks only. The official Convex connection verifies the JWT.
  fixtureToken("owner"); fixtureToken("outsider");
  return { fixture, agentId, agentVersion: Number(version), definitionHash };
}

async function parsed(stream: ReadableStream<UIMessageChunk> | null) {
  if (!stream) throw new Error("REMOTE_ACTUAL_STREAM_REQUIRED");
  let final: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream, terminateOnError: true })) final = structuredClone(message);
  return final;
}
function text(message: UIMessage | undefined) {
  return message?.parts.filter(part => part.type === "text").map(part => part.text).join("") ?? "";
}

it("one verified remote request retains canonical AI SDK7 output, reconnects/replays its existing handle and denies a signed outsider", async () => {
  const config = configuration();
  const { fixture } = config;
  const owner = new CortexRuntimeClient({ deploymentUrl: fixture.deploymentUrl,
    scope: { tenantId: fixture.tenantId, memorySpaceId: fixture.memorySpaceId }, fetchToken: async () => fixtureToken("owner") });
  const outsider = new CortexRuntimeClient({ deploymentUrl: fixture.deploymentUrl,
    // Intentional substituted selector: a current signed foreign identity must not gain this scope.
    scope: { tenantId: fixture.tenantId, memorySpaceId: fixture.memorySpaceId }, fetchToken: async () => fixtureToken("outsider") });
  const observations: { response: string; memory: string; graph: string; cursor: number; attempt: number }[] = [];
  const transport = new CortexRemoteTransport({ client: owner, agentId: config.agentId, agentVersion: config.agentVersion,
    onObservation: value => { if (observations.length < 100) observations.push({ response: value.run.responseStatus,
      memory: value.run.memoryStatus, graph: value.run.graphStatus, cursor: value.cursor, attempt: value.run.attemptNumber }); } });
  let restored: CortexRemoteTransport | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = Date.now() + 150000;
  const requestId = `provider-remote-${fixture.runId}`;
  const prompt = `Acknowledge the validation marker ${requestId} in one short sentence. Do not call tools.`;
  const options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0] = {
    trigger: "submit-message", chatId: requestId, messageId: undefined,
    messages: [{ id: requestId, role: "user", parts: [{ type: "text", text: prompt }] }],
  };
  try {
    await Promise.race([
      (async () => {
        const session = await owner.session();
        expect(session.tenantId).toBe(fixture.tenantId); expect(session.memorySpaceId).toBe(fixture.memorySpaceId);
        const definition = await owner.getDefinition(config.agentId, config.agentVersion);
        expect(definition.definitionHash).toBe(config.definitionHash);
        const first = await transport.sendMessages(options);
        const handle = transport.run!;
        expect(handle.principalId).toBe(session.principalId); expect(handle.definitionHash).toBe(config.definitionHash);
        // Close only observation. The one existing Workflow continues; no cancel, retry or new request ID.
        transport.disconnect(); await parsed(first);
        const saved = transport.state!;
        expect(saved.handle.runId).toBe(handle.runId);
        restored = new CortexRemoteTransport({ client: owner, agentId: config.agentId, agentVersion: config.agentVersion, state: saved });
        const final = await parsed(await restored.reconnectToStream({ chatId: requestId }));
        expect(text(final).trim().length).toBeGreaterThan(0);
        expect(final?.id).toBe(`cortex:${handle.runId}:assistant`);
        expect(final?.metadata).toMatchObject({ version: 1, runId: handle.runId, conversationId: handle.conversationId,
          definitionHash: config.definitionHash, responseStatus: "complete" });
        expect(["pending", "complete"]).toContain((final?.metadata as { memoryStatus: string }).memoryStatus);
        let run = await owner.get(handle);
        // Response completion and asynchronous indexing are distinct. This fixture must actually complete memory too.
        while (run.memoryStatus === "pending" && Date.now() < deadline) { await delay(300); run = await owner.get(handle); }
        expect(run.responseStatus).toBe("complete"); expect(run.memoryStatus).toBe("complete");
        const retained = await owner.messages(handle.conversationId, { limit: 100 });
        expect(retained.isDone).toBe(true);
        const assistant = retained.page.find(message => message.id === run.outputMessageIds.at(-1));
        expect(assistant?.role).toBe("assistant"); expect(assistant?.status).toBe("success");
        const canonical = assistant?.parts.filter(part => part.type === "text").map(part => part.text).join("");
        expect(canonical).toBe(text(final));
        expect(retained.page.find(message => message.id === run.inputMessageIds[0])?.parts).toEqual([{ type: "text", text: prompt }]);
        // Same original transport retains the original create-selector/request identity.
        // Backend start is idempotent; Native also checks the exact model/financial ledger before and after this replay.
        const replay = await parsed(await transport.sendMessages(options));
        expect(transport.run).toEqual(handle); expect(text(replay)).toBe(canonical);
        const after = await owner.get(handle);
        expect(after.attemptNumber).toBe(run.attemptNumber); expect(after.outputMessageIds).toEqual(run.outputMessageIds);
        expect(await owner.messages(handle.conversationId, { limit: 100 })).toEqual(retained);
        await expect(outsider.attach(handle.runId)).rejects.toMatchObject({ code: "FORBIDDEN" });
        console.log(JSON.stringify({ status: "ACTUAL_PROVIDER_REMOTE_CONTRACT_PASS", requestId,
          handle: handle as RuntimeRunHandle, responseStatus: after.responseStatus, memoryStatus: after.memoryStatus,
          graphStatus: after.graphStatus, attemptNumber: after.attemptNumber, reconnectCursor: saved.cursor,
          canonicalTextSha256: createHash("sha256").update(canonical!).digest("hex"), transcriptMessageIds: retained.page.map(message => message.id),
          observations, replaySameHandleAndTranscript: true, outsiderForbidden: true, clientProviderCredentials: false }));
      })(),
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("REMOTE_ACTUAL_DEADLINE_EXCEEDED: outcome may be unknown; do not retry with a new request ID")), 150000); }),
    ]);
  } finally {
    clearTimeout(timeout); restored?.disconnect(); transport.disconnect();
    await Promise.all([owner.close(), outsider.close()]);
  }
}, 180000);
