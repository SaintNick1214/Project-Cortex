import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { fixturePlan } from "./runtime-fixtures.mjs";

const fail = code => { throw new Error(code); };
const registryHash = "975b0d6ba749d0198c10af7e0457e57f54bbb79a55c5c0f64b11592c0e982631";

/** The observed V2 registry and Agent bound; setup never attests a qualification. */
export function remoteAgentDefinition() {
  return {
    instructions: { text: "Acknowledge the user's validation marker in one short sentence. Do not call tools.", promptVersion: "ci-remote-agent-v2" },
    tools: ["memory.remember", "memory.recall", "media.image.generate", "media.video.generate", "artifact.read"]
      .map(toolId => ({ toolId, toolVersion: 1, registryHash,
        requiredCapability: "tool", approval: toolId.startsWith("media.") ? "explicit" : "none" })),
    context: { handlerId: "cortex.transcript", handlerVersion: 1, registryHash,
      memoryMode: "indexed-plus-pending", requiredStages: [], maxContextTokens: 4096 },
    policies: [{ policyId: "ci-remote-agent-only", version: 2, operationKey: "agent.respond", rules: {
      pins: { boundRevision: "agent-tools-v2-32768-256-shared3m-v1", toolRegistryVersion: "cortex-media-tools-v2" },
      allowedTools: ["memory_recall", "memory_remember", "media_image_generate", "media_video_generate", "artifact_read"],
      limits: { outputTokens: 128, toolSteps: 1 },
    } }],
  };
}

/** Claim parsing is fixture preflight only. Session/publish/get all verify the JWT at Convex. */
export function remoteAgentConfiguration(env) {
  if (env.CI !== "true" && env.CORTEX_TEST_ENV_MODE !== "explicit") fail("CI_REMOTE_EXPLICIT_ENVIRONMENT_REQUIRED");
  const plan = fixturePlan(env, "sdk");
  let allowed, fixture, claims;
  const token = env.CORTEX_TEST_AUTH_TOKEN;
  try {
    allowed = JSON.parse(env.CORTEX_CI_DISPOSABLE_DEPLOYMENTS);
    fixture = JSON.parse(env.CORTEX_TEST_FIXTURE);
    claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
  } catch { fail("CI_REMOTE_FIXTURE_REQUIRED"); }
  const url = env.CONVEX_URL;
  if (!Array.isArray(allowed) || !allowed.some(name => typeof name === "string" && /^[a-z][a-z0-9-]{2,80}$/.test(name)
    && url === `https://${name}.convex.cloud`)) fail("CI_REMOTE_TARGET_NOT_APPROVED");
  if (fixture.version !== 1 || fixture.kind !== "sdk" || fixture.runId !== plan.runId
    || fixture.tenantId !== plan.tenantId || fixture.memorySpaceId !== plan.memorySpaceId || fixture.deploymentUrl !== url
    || fixture.issuer !== plan.issuer || fixture.audience !== plan.audience
    || fixture.identities?.owner?.subject !== plan.identities.owner.subject
    || token.split(".").length !== 3 || claims.iss !== plan.issuer || claims.aud !== plan.audience
    || claims.sub !== plan.identities.owner.subject || !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() / 1000) {
    fail("CI_REMOTE_FIXTURE_MISMATCH");
  }
  return { plan, url, token };
}

export async function publishRemoteAgent(env, createClient = (url, signal) => new ConvexHttpClient(url, {
  logger: false, fetch: (input, init) => fetch(input, { ...init, signal }),
})) {
  const config = remoteAgentConfiguration(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const client = createClient(config.url, controller.signal);
    client.setAuth(config.token);
    const session = await client.mutation(makeFunctionReference("runtimeClient:session"), {
      tenantId: config.plan.tenantId, memorySpaceId: config.plan.memorySpaceId,
    });
    if (session?.version !== 1 || session.tenantId !== config.plan.tenantId || session.memorySpaceId !== config.plan.memorySpaceId
      || session.userId !== config.plan.identities.owner.metadataUserId) fail("CI_REMOTE_SESSION_MISMATCH");
    const published = await client.mutation(makeFunctionReference("agentDefinitions:publishVersion"), {
      memorySpaceId: config.plan.memorySpaceId, clientMutationId: `ci-remote-agent-${config.plan.runId}`,
      expectedPreviousVersion: 0, definitionInput: remoteAgentDefinition(),
    });
    if (!published || typeof published.agentId !== "string" || !/^agent:[a-f0-9]{64}$/.test(published.agentId)
      || published.version !== 1 || !/^[a-f0-9]{64}$/.test(published.definitionHash)) fail("CI_REMOTE_PUBLICATION_INVALID");
    const current = await client.mutation(makeFunctionReference("agentDefinitions:get"), {
      tenantId: config.plan.tenantId, memorySpaceId: config.plan.memorySpaceId,
      agentId: published.agentId, version: published.version,
    });
    if (current?.agentId !== published.agentId || current.version !== published.version
      || current.definitionHash !== published.definitionHash || current.memoryMode !== "indexed-plus-pending"
      || JSON.stringify(current.tools) !== JSON.stringify(remoteAgentDefinition().tools.map(({ toolId, toolVersion }) => ({ toolId, toolVersion })))) {
      fail("CI_REMOTE_CURRENT_DEFINITION_MISMATCH");
    }
    return { status: "CURRENT_QUALIFIED_REMOTE_AGENT_PUBLISHED", tenantId: config.plan.tenantId,
      memorySpaceId: config.plan.memorySpaceId, ...published, freshNativeQualification: false, modelCalls: 0 };
  } finally { clearTimeout(timer); controller.abort(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.GITHUB_ENV) fail("CI_REMOTE_ENV_FILE_REQUIRED");
    const result = await publishRemoteAgent(process.env);
    for (const [key, value] of Object.entries({ CORTEX_TEST_REMOTE_AGENT_ID: result.agentId,
      CORTEX_TEST_REMOTE_AGENT_VERSION: result.version, CORTEX_TEST_REMOTE_AGENT_DEFINITION_HASH: result.definitionHash })) {
      appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`, { mode: 0o600 });
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message?.startsWith("CI_REMOTE_") ? error.message : "CI_REMOTE_PUBLICATION_FAILED");
    process.exitCode = 1;
  }
}
