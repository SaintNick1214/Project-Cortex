import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ConvexError } from "convex/values";
import { authConfigSource, fixtureEnvironment, fixturePlan, issueFixtureToken, installFixturePolicy, operator, provisionFixtures, publicJwks, retireFixtures, verifyRetiredFixtures, writeCiAuthConfig } from "./runtime-fixtures.mjs";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const valid = () => ({
  CORTEX_CI_RUN_ID: "123-1", CORTEX_CI_AUTH_ISSUER: "https://cortex-ci.example/", CORTEX_CI_AUTH_AUDIENCE: "cortex-ci",
  CORTEX_CI_AUTH_PRIVATE_KEY: keys.privateKey.export({ type: "pkcs8", format: "pem" }),
  CORTEX_CI_DISPOSABLE_DEPLOYMENTS: '["owned-sdk-123","owned-cli-456"]',
  CONVEX_URL: "https://owned-sdk-123.convex.cloud", CONVEX_DEPLOY_KEY: "dev:owned-sdk-123|synthetic-secret",
  CONVEX_URL_CLI: "https://owned-cli-456.convex.cloud", CONVEX_DEPLOY_KEY_CLI: "dev:owned-cli-456|synthetic-secret",
});
const authority = (identity) => ({ ...identity, userId: identity.metadataUserId, principalId: `${identity.subject}:principal`, principalVersion: 1,
  membershipId: `${identity.subject}:membership`, membershipVersion: 1, grantId: `${identity.subject}:grant`, grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 });

test("scopes each attempt and target independently with a read-only peer and a distinct outsider", () => {
  const sdk = fixturePlan(valid(), "sdk"), cli = fixturePlan(valid(), "cli");
  assert.notEqual(sdk.tenantId, cli.tenantId);
  assert.notEqual(sdk.identities.outsider.tenantId, sdk.tenantId);
  assert.deepEqual(sdk.identities.reader.capabilities, ["read"]);
  assert.equal(sdk.identities.owner.resourceAccess, "space");
  assert.notEqual(fixturePlan({ ...valid(), CORTEX_CI_RUN_ID: "123-2" }, "sdk").tenantId, sdk.tenantId);
});

test("rejects absent or unsafe auth selectors without exposing private material", () => {
  for (const patch of [{ CORTEX_CI_RUN_ID: "" }, { CORTEX_CI_RUN_ID: "../old-tenant" },
    { CORTEX_CI_AUTH_ISSUER: "https://secret@cortex-ci.example/" }, { CORTEX_CI_AUTH_ISSUER: "http://cortex-ci.example/" },
    { CORTEX_CI_AUTH_AUDIENCE: "" }]) assert.throws(() => fixturePlan({ ...valid(), ...patch }, "sdk"), /^Error: CI_FIXTURE_/);
  assert.throws(() => issueFixtureToken({ ...valid(), CORTEX_CI_AUTH_PRIVATE_KEY: "synthetic-secret" }, "sdk", "owner"), /CI_FIXTURE_RSA_PRIVATE_KEY_REQUIRED/);
  assert.throws(() => issueFixtureToken(valid(), "sdk", "admin"), /CI_FIXTURE_ROLE_INVALID/);
});

test("issued JWT has a verifiable RS256 signature and exact issuer/audience/subject/expiry", () => {
  const env = valid(), token = issueFixtureToken(env, "sdk", "owner", 1700000000);
  const [header, payload, signature] = token.split(".");
  const jwk = publicJwks(env).keys[0];
  assert.equal(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(signature, "base64url")), true);
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString()), { iss: env.CORTEX_CI_AUTH_ISSUER, aud: env.CORTEX_CI_AUTH_AUDIENCE,
    sub: fixturePlan(env, "sdk").identities.owner.subject, iat: 1700000000, nbf: 1699999995, exp: 1700003600 });
  assert.equal(JSON.parse(Buffer.from(header, "base64url").toString()).kid, jwk.kid);
  assert.equal(Object.hasOwn(jwk, "d"), false);
  assert.equal(authConfigSource(env).includes("PRIVATE KEY"), false);
});

test("refuses weak keys and invalid token clocks", () => {
  const weak = generateKeyPairSync("rsa", { modulusLength: 1024 });
  assert.throws(() => publicJwks({ ...valid(), CORTEX_CI_AUTH_PRIVATE_KEY: weak.privateKey.export({ type: "pkcs8", format: "pem" }) }), /CI_FIXTURE_RSA_KEY_INVALID/);
  assert.throws(() => issueFixtureToken(valid(), "sdk", "owner", NaN), /CI_FIXTURE_TOKEN_TIME_INVALID/);
});

test("writes only public auth into the exact functions directory and preserves preexisting host auth", () => {
  const dir = mkdtempSync(join(tmpdir(), "cortex-ci-fixture-"));
  try {
    mkdirSync(join(dir, "convex-dev")); writeFileSync(join(dir, "convex.json"), '{"functions":"convex-dev/"}');
    const result = writeCiAuthConfig(valid(), dir);
    assert.equal(result.status, "CI_PUBLIC_AUTH_CONFIG_WRITTEN");
    assert.equal(readFileSync(result.path, "utf8"), authConfigSource(valid()));
    assert.throws(() => writeCiAuthConfig(valid(), dir), /CI_FIXTURE_HOST_AUTH_EXISTS/);
    writeFileSync(join(dir, "convex.json"), '{"functions":"custom/"}');
    assert.throws(() => writeCiAuthConfig(valid(), dir), /CI_FIXTURE_FUNCTIONS_DIRECTORY_UNEXPECTED/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("operator rejects production before spawning and invokes only the pinned internal CLI endpoint", async () => {
  let calls = 0;
  const run = async (_node, args, options) => {
    calls++; assert.deepEqual(args.slice(1), ["run", "runtimeAuth:deleteScope", '{"tenantId":"owned"}', "--url", valid().CONVEX_URL]);
    assert.equal(options.timeout, 60000); assert.equal(options.env.CONVEX_DEPLOYMENT, "dev:owned-sdk-123");
    assert.equal(Object.hasOwn(options.env, "CORTEX_CI_AUTH_PRIVATE_KEY"), false);
    return { stdout: "null" };
  };
  assert.throws(() => operator({ ...valid(), CONVEX_DEPLOY_KEY_CLI: "prod:owned-cli-456|synthetic-secret" }, "sdk", "/repo", run), /CI_REQUIRES_DEVELOPMENT_DEPLOYMENT_KEY/);
  assert.equal(calls, 0);
  const call = operator(valid(), "sdk", "/repo", run);
  await assert.rejects(call("admin:clearTable", {}), /CI_FIXTURE_OPERATOR_FUNCTION_DENIED/);
  assert.equal(await call("runtimeAuth:deleteScope", { tenantId: "owned" }), null);
  assert.equal(calls, 1);
});

test("changed target selectors fail before dispatch", async () => {
  const env = valid(); let calls = 0;
  const call = operator(env, "sdk", "/repo", async () => { calls++; return { stdout: "null" }; });
  env.CORTEX_CI_DISPOSABLE_DEPLOYMENTS = '["changed-sdk-123","owned-cli-456"]';
  env.CONVEX_DEPLOY_KEY = "dev:changed-sdk-123|synthetic-secret"; env.CONVEX_URL = "https://changed-sdk-123.convex.cloud";
  await assert.rejects(call("runtimeAuth:deleteScope", {}), /CI_FIXTURE_TARGET_CHANGED/);
  assert.equal(calls, 0);
});

test("operator failures and invalid receipts remain failures without leaking child diagnostics", async () => {
  await assert.rejects(operator(valid(), "sdk", "/repo", async () => { throw new Error("synthetic-secret Server Error"); })("runtimeAuth:deleteScope", {}), error => error.message === "CI_FIXTURE_OPERATOR_CALL_FAILED");
  await assert.rejects(operator(valid(), "sdk", "/repo", async () => ({ stdout: "synthetic-secret" }))("runtimeAuth:deleteScope", {}), /CI_FIXTURE_OPERATOR_RESULT_INVALID/);
});

test("empty successful CLI output is null only for scoped retirement", async () => {
  const call = operator(valid(), "sdk", "/repo", async () => ({ stdout: "" }));
  assert.equal(await call("runtimeAuth:deleteScope", { tenantId: "owned" }), null);
  for (const name of ["runtimeAuth:provision", "runtimeAuth:recheck", "runtimeModelPolicy:installDeploymentPolicy"])
    await assert.rejects(call(name, {}), /CI_FIXTURE_OPERATOR_RESULT_INVALID/);
});

test("provisions exact scoped grants and checks returned authority instead of accepting arbitrary success", async () => {
  const calls = [];
  const result = await provisionFixtures(valid(), "sdk", async (name, args) => { calls.push({ name, args }); return authority(args); });
  assert.equal(calls.length, 3); assert.equal(calls.every(call => call.name === "runtimeAuth:provision"), true);
  assert.deepEqual(calls[1].args.capabilities, ["read"]);
  assert.equal(result.references.owner.tenantId, result.plan.tenantId);
  await assert.rejects(provisionFixtures(valid(), "sdk", async (_name, args) => ({ ...authority(args), tenantId: "wrong" })), /CI_FIXTURE_PROVISION_RESULT_INVALID/);
});

test("cleanup retires only declared CI tenants and preserves failure and lifecycle limits", async () => {
  const calls = [];
  const result = await retireFixtures(valid(), "cli", async (name, args) => { calls.push({ name, args }); return null; });
  assert.deepEqual(calls, [
    { name: "runtimeAuth:deleteScope", args: { tenantId: "cortex-ci-123-1-cli" } },
    { name: "runtimeAuth:deleteScope", args: { tenantId: "cortex-ci-123-1-cli-other" } },
  ]);
  assert.equal(result.globalPurge, false); assert.equal(result.physicalRowDeletion, false);
  await assert.rejects(retireFixtures(valid(), "cli", async () => { throw new Error("failure"); }), /failure/);
  await assert.rejects(retireFixtures(valid(), "cli", async () => ({ deleted: 0 })), /CI_FIXTURE_RETIREMENT_RESULT_INVALID/);
});

test("consumer environment contains JWTs and exact public scopes, never deploy or signing keys", () => {
  const result = fixtureEnvironment(valid(), "cli");
  assert.equal(result.CONVEX_URL, valid().CONVEX_URL_CLI);
  assert.equal(JSON.parse(result.CORTEX_TEST_FIXTURE).kind, "cli");
  assert.equal(JSON.stringify(result).includes("PRIVATE KEY"), false);
  assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
  assert.throws(() => fixtureEnvironment({ ...valid(), CONVEX_URL_CLI: valid().CONVEX_URL_CLI + "/" }, "cli"), /CI_TARGET_NOT_APPROVED_DISPOSABLE/);
});

test("retirement verification requires a real authorization denial for every role, not network/auth failures", async () => {
  const scopes = [];
  const client = code => ({ setAuth: token => assert.equal(token.split(".").length, 3), mutation: async (_ref, args) => {
    scopes.push(args); if (code === "network") throw new Error("offline"); if (code) throw new ConvexError({ code }); return { tenantId: args.tenantId };
  } });
  const result = await verifyRetiredFixtures(valid(), "sdk", () => client("FORBIDDEN"));
  assert.equal(result.verifiedRoles.length, 3); assert.equal(scopes.length, 3);
  for (const code of ["UNAUTHENTICATED", "network", null]) await assert.rejects(verifyRetiredFixtures(valid(), "sdk", () => client(code)), /CI_FIXTURE_RETIREMENT_VERIFICATION_FAILED/);
});

test("policy setup requires a pinned compiled manifest and exact installation receipt, never synthetic qualification", async () => {
  const env = { ...valid(), CORTEX_CI_MODEL_MANIFEST_ID: "reviewed-manifest", CORTEX_CI_MODEL_MANIFEST_REVISION: "9" };
  let calls = 0;
  const call = async (name, args) => { calls++; assert.equal(name, "runtimeModelPolicy:installDeploymentPolicy");
    assert.deepEqual(args, { manifestId: "reviewed-manifest", expectedRevision: 9 }); return { manifestId: "reviewed-manifest", revision: 9 }; };
  await assert.rejects(installFixturePolicy(valid(), "sdk", call), /CI_FIXTURE_QUALIFIED_MANIFEST_REQUIRED/);
  assert.equal(calls, 0);
  const result = await installFixturePolicy(env, "sdk", call);
  assert.equal(result.freshNativeQualification, false);
  await assert.rejects(installFixturePolicy(env, "sdk", async () => ({ manifestId: "other", revision: 9 })), /CI_FIXTURE_POLICY_RESULT_INVALID/);
  await assert.rejects(installFixturePolicy(env, "sdk", async () => { throw new Error("CAPABILITY_UNAVAILABLE"); }), /CAPABILITY_UNAVAILABLE/);
});
