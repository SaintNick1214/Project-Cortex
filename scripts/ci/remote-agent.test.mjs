import assert from "node:assert/strict";
import { test } from "node:test";
import { getFunctionName } from "convex/server";
import { fixturePlan } from "./runtime-fixtures.mjs";
import { publishRemoteAgent, remoteAgentConfiguration, remoteAgentDefinition } from "./remote-agent.mjs";

function environment() {
  const env = { CI: "true", CORTEX_CI_RUN_ID: "123-1", CORTEX_CI_AUTH_ISSUER: "https://cortex-ci-runtime.example/",
    CORTEX_CI_AUTH_AUDIENCE: "cortex-ci-runtime", CONVEX_URL: "https://owned-sdk.convex.cloud",
    CORTEX_CI_DISPOSABLE_DEPLOYMENTS: '["owned-sdk","owned-cli"]' };
  const plan = fixturePlan(env, "sdk");
  return { ...env, CORTEX_TEST_FIXTURE: JSON.stringify({ ...plan, deploymentUrl: env.CONVEX_URL }),
    CORTEX_TEST_AUTH_TOKEN: `header.${Buffer.from(JSON.stringify({ iss: plan.issuer, aud: plan.audience,
      sub: plan.identities.owner.subject, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.signature` };
}
const agentId = `agent:${"a".repeat(64)}`, definitionHash = "b".repeat(64);
function client(env, change) {
  const calls = [], plan = fixturePlan(env, "sdk");
  return { calls, value: { setAuth: value => assert.equal(value, env.CORTEX_TEST_AUTH_TOKEN), mutation: async (ref, args) => {
    const name = getFunctionName(ref); calls.push({ name, args });
    const result = name === "runtimeClient:session" ? { version: 1, tenantId: plan.tenantId, memorySpaceId: plan.memorySpaceId, userId: plan.identities.owner.metadataUserId }
      : name === "agentDefinitions:publishVersion" ? { agentId, version: 1, definitionHash }
        : { agentId, version: 1, definitionHash, memoryMode: "indexed-plus-pending", inputSelectionVersion:2,memoryEffortPolicyVersion:1,tools: remoteAgentDefinition().tools.map(({ toolId, toolVersion }) => ({ toolId, toolVersion })) };
    return change?.(name, result) ?? result;
  } } };
}

test("remote Agent setup refuses wrong target, foreign claims and missing explicit fixture before any RPC", async () => {
  const env = environment();
  const foreign = `header.${Buffer.from(JSON.stringify({ iss: env.CORTEX_CI_AUTH_ISSUER, aud: env.CORTEX_CI_AUTH_AUDIENCE,
    sub: "foreign", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.signature`;
  for (const mutation of [{ CONVEX_URL: "https://foreign.convex.cloud" }, { CORTEX_TEST_FIXTURE: "{}" },
    { CI: "", CORTEX_TEST_ENV_MODE: "" }, { CORTEX_TEST_AUTH_TOKEN: "malformed" }, { CORTEX_TEST_AUTH_TOKEN: foreign }]) {
    let created = false;
    await assert.rejects(publishRemoteAgent({ ...env, ...mutation }, () => { created = true; }));
    assert.equal(created, false);
  }
  const value = remoteAgentConfiguration(env); assert.equal(value.plan.kind, "sdk");
});

test("unpaid setup verifies current owner, publishes one immutable current V4 definition and exports only returned pins", async () => {
  const env = environment(), fake = client(env);
  let signal;
  const result = await publishRemoteAgent(env, (url, current) => { assert.equal(url, env.CONVEX_URL); signal = current; return fake.value; });
  assert.equal(signal.aborted, true);
  assert.deepEqual(fake.calls.map(call => call.name), ["runtimeClient:session", "agentDefinitions:publishVersion", "agentDefinitions:get"]);
  const publication = fake.calls[1].args;
  assert.equal(publication.agentId, undefined); assert.equal(publication.expectedPreviousVersion, 0);
  assert.equal(publication.clientMutationId, "ci-remote-agent-123-1");
  assert.equal(publication.definitionInput.context.registryHash, "5152bd0c3f8e35907c2d57c0a3467e2450e8db0dfb5174c552024c954554a515");
  assert.equal(publication.definitionInput.policies[0].rules.pins.boundRevision, "agent-tools-v2-32768-256-shared3m-v1");
  assert.deepEqual(publication.definitionInput.tools.map(tool => tool.toolId),
    ["memory.remember", "memory.recall", "media.image.generate", "media.video.generate", "artifact.read"]);
  assert.ok(publication.definitionInput.tools.filter(tool => tool.toolId.startsWith("media.")).every(tool => tool.approval === "explicit"));
  assert.equal(result.agentId, agentId); assert.equal(result.definitionHash, definitionHash);
  assert.equal(result.modelCalls, 0); assert.equal(result.freshNativeQualification, false);
  assert.equal(JSON.stringify(result).includes(env.CORTEX_TEST_AUTH_TOKEN), false);
});

test("current-authority and exact publication failures stop setup without retries or model execution", async () => {
  const env = environment();
  for (const [at, expectedCount, change] of [["runtimeClient:session", 1, { userId: "foreign" }],
    ["agentDefinitions:publishVersion", 2, { version: 2 }], ["agentDefinitions:get", 3, { definitionHash: "c".repeat(64) }]]) {
    const fake = client(env, (name, result) => name === at ? { ...result, ...change } : result);
    await assert.rejects(publishRemoteAgent(env, () => fake.value)); assert.equal(fake.calls.length, expectedCount);
  }
  const fake = client(env); fake.value.mutation = async () => { throw new Error("FORBIDDEN"); };
  await assert.rejects(publishRemoteAgent(env, () => fake.value), /FORBIDDEN/);
});


test("the canonical CI publisher selects the current effort-aware V8 handler and refuses legacy readback", async()=>{
 const definition=remoteAgentDefinition();
 assert.deepEqual(definition.context,{handlerId:"cortex.transcript.relevant",handlerVersion:2,registryHash:"5152bd0c3f8e35907c2d57c0a3467e2450e8db0dfb5174c552024c954554a515",memoryMode:"indexed-plus-pending",requiredStages:[],maxContextTokens:4096,inputSelection:{version:2}});
 const env=environment(),fake=client(env,(name,result)=>name==="agentDefinitions:get"?{...result,inputSelectionVersion:undefined,memoryEffortPolicyVersion:undefined}:result);
 await assert.rejects(publishRemoteAgent(env,()=>fake.value),/CURRENT_DEFINITION_MISMATCH/);
 assert.equal(fake.calls.length,3);
});
