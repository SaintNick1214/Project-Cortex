import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { verifyDisposableCiTargets } from "./verify-disposable-targets.mjs";

const execute = promisify(execFile);
const fail = code => { throw new Error(code); };
const capabilities = ["read", "write", "run", "admin", "tool", "storage:read", "storage:write"];

/** Public selectors are deterministic per attempt; caller labels never provision authority. */
export function fixturePlan(env, kind) {
  if (kind !== "sdk" && kind !== "cli") fail("CI_FIXTURE_KIND_INVALID");
  const runId = env.CORTEX_CI_RUN_ID;
  if (typeof runId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/.test(runId)) fail("CI_FIXTURE_RUN_ID_REQUIRED");
  let issuer;
  try { issuer = new URL(env.CORTEX_CI_AUTH_ISSUER); } catch { fail("CI_FIXTURE_ISSUER_REQUIRED"); }
  if (issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.search || issuer.hash
    || issuer.href !== env.CORTEX_CI_AUTH_ISSUER) fail("CI_FIXTURE_ISSUER_INVALID");
  const audience = env.CORTEX_CI_AUTH_AUDIENCE;
  if (typeof audience !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(audience)) fail("CI_FIXTURE_AUDIENCE_REQUIRED");
  const tenantId = `cortex-ci-${runId}-${kind}`;
  const memorySpaceId = `${tenantId}-space`;
  const identity = (role, tenant = tenantId, space = memorySpaceId) => ({
    issuer: issuer.href, subject: `${tenantId}-${role}`, actorKind: "user", metadataUserId: `${tenantId}-${role}`,
    tenantId: tenant, memorySpaceId: space, capabilities: role === "reader" ? ["read"] : capabilities,
    resourceAccess: "space",
  });
  return { version: 1, kind, runId, issuer: issuer.href, audience, tenantId, memorySpaceId,
    identities: { owner: identity("owner"), reader: identity("reader"),
      outsider: identity("outsider", `${tenantId}-other`, `${tenantId}-other-space`) } };
}

function signingKey(env) {
  let key;
  try { key = createPrivateKey(env.CORTEX_CI_AUTH_PRIVATE_KEY); } catch { fail("CI_FIXTURE_RSA_PRIVATE_KEY_REQUIRED"); }
  if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails?.modulusLength < 2048) fail("CI_FIXTURE_RSA_KEY_INVALID");
  return key;
}

export function publicJwks(env) {
  const publicKey = createPublicKey(signingKey(env)).export({ format: "jwk" });
  const kid = createHash("sha256").update(JSON.stringify({ e: publicKey.e, kty: publicKey.kty, n: publicKey.n })).digest("base64url");
  return { keys: [{ ...publicKey, kid, alg: "RS256", use: "sig" }] };
}

/** Real RS256 token; verification remains the deployed customJwt/Convex boundary. */
export function issueFixtureToken(env, kind, role, nowSeconds = Math.floor(Date.now() / 1000)) {
  const plan = fixturePlan(env, kind);
  if (!Object.hasOwn(plan.identities, role)) fail("CI_FIXTURE_ROLE_INVALID");
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 1) fail("CI_FIXTURE_TOKEN_TIME_INVALID");
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: publicJwks(env).keys[0].kid })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: plan.issuer, aud: plan.audience, sub: plan.identities[role].subject,
    iat: nowSeconds, nbf: nowSeconds - 5, exp: nowSeconds + 3600 })).toString("base64url");
  const input = `${header}.${claims}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), signingKey(env)).toString("base64url")}`;
}

export function authConfigSource(env) {
  const plan = fixturePlan(env, "sdk");
  const jwks = `data:application/json;base64,${Buffer.from(JSON.stringify(publicJwks(env))).toString("base64")}`;
  return `// Generated only for explicitly disposable CI deployments. Public verification material only.\nexport default { providers: [{ type: "customJwt", issuer: ${JSON.stringify(plan.issuer)}, applicationID: ${JSON.stringify(plan.audience)}, algorithm: "RS256", jwks: ${JSON.stringify(jwks)} }] };\n`;
}

/** Refuse to overwrite host auth, even when the file looks similar to CI output. */
export function writeCiAuthConfig(env, cwd = process.cwd()) {
  verifyDisposableCiTargets(env);
  const config = JSON.parse(readFileSync(resolve(cwd, "convex.json"), "utf8"));
  if (config.functions !== "convex-dev/") fail("CI_FIXTURE_FUNCTIONS_DIRECTORY_UNEXPECTED");
  const path = resolve(cwd, config.functions, "auth.config.ts");
  try { writeFileSync(path, authConfigSource(env), { flag: "wx", mode: 0o600 }); }
  catch (error) { if (error.code === "EEXIST") fail("CI_FIXTURE_HOST_AUTH_EXISTS"); throw error; }
  return { status: "CI_PUBLIC_AUTH_CONFIG_WRITTEN", path };
}

/** Convex's pinned operator CLI supports internal functions without a public maintenance endpoint. */
export function operator(env, kind, cwd = process.cwd(), run = execute) {
  const targets = verifyDisposableCiTargets(env);
  const target = targets.find(value => value.kind === kind);
  if (!target) fail("CI_FIXTURE_KIND_INVALID");
  const suffix = kind === "cli" ? "_CLI" : "";
  const deploymentUrl = env[`CONVEX_URL${suffix}`];
  const key = env[`CONVEX_DEPLOY_KEY${suffix}`];
  return async (name, args) => {
    if (!["runtimeAuth:provision", "runtimeAuth:deleteScope", "runtimeAuth:recheck", "runtimeModelPolicy:installDeploymentPolicy"].includes(name)) fail("CI_FIXTURE_OPERATOR_FUNCTION_DENIED");
    verifyDisposableCiTargets(env);
    if (env[`CONVEX_URL${suffix}`] !== deploymentUrl || env[`CONVEX_DEPLOY_KEY${suffix}`] !== key) fail("CI_FIXTURE_TARGET_CHANGED");
    let result;
    try {
      result = await run(process.execPath, [resolve(cwd, "node_modules/convex/bin/main.js"), "run", name, JSON.stringify(args), "--url", deploymentUrl], {
        cwd, timeout: 60000, maxBuffer: 1024 * 1024,
        // Operator subprocesses never receive the issuer private key, JWTs or provider credentials.
        env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: "true", CONVEX_URL: deploymentUrl,
          CONVEX_DEPLOY_KEY: key, CONVEX_DEPLOYMENT: `dev:${target.deploymentName}` },
      });
    } catch { fail("CI_FIXTURE_OPERATOR_CALL_FAILED"); }
    // Convex prints nothing for a successful null result. Only this known
    // null-returning lifecycle mutation may use that representation.
    if (name === "runtimeAuth:deleteScope" && result.stdout.trim() === "") return null;
    try { return JSON.parse(result.stdout.trim()); } catch { fail("CI_FIXTURE_OPERATOR_RESULT_INVALID"); }
  };
}

function reference(authority, expected) {
  const keys = ["principalId", "principalVersion", "membershipId", "membershipVersion", "grantId", "grantVersion",
    "tenantId", "tenantEpoch", "memorySpaceId", "memorySpaceEpoch"];
  if (!authority || authority.tenantId !== expected.tenantId || authority.memorySpaceId !== expected.memorySpaceId
    || authority.userId !== expected.metadataUserId || authority.resourceAccess !== "space" || !Array.isArray(authority.capabilities)
    || JSON.stringify([...authority.capabilities].sort()) !== JSON.stringify([...expected.capabilities].sort())
    || keys.some(key => key.endsWith("Id") ? typeof authority[key] !== "string" || !authority[key]
      : !Number.isSafeInteger(authority[key]) || authority[key] < 1)) fail("CI_FIXTURE_PROVISION_RESULT_INVALID");
  return Object.fromEntries(keys.map(key => [key, authority[key]]));
}

export async function provisionFixtures(env, kind, call = operator(env, kind)) {
  const plan = fixturePlan(env, kind);
  const references = {};
  const expiresAt = Date.now() + 6 * 3600 * 1000;
  for (const [role, identity] of Object.entries(plan.identities)) {
    const authority = await call("runtimeAuth:provision", { ...identity, expiresAt });
    references[role] = reference(authority, identity);
  }
  return { status: "PROVISIONED_SCOPED_FIXTURES", plan, references, expiresAt };
}

/** Only a compiled, current reviewed manifest can install policy. No fixture can invent qualifications. */
export async function installFixturePolicy(env, kind, call = operator(env, kind)) {
  const manifestId = env.CORTEX_CI_MODEL_MANIFEST_ID;
  const revision = env.CORTEX_CI_MODEL_MANIFEST_REVISION;
  if (typeof manifestId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,127}$/.test(manifestId)
    || typeof revision !== "string" || !/^[1-9][0-9]{0,5}$/.test(revision)) fail("CI_FIXTURE_QUALIFIED_MANIFEST_REQUIRED");
  const result = await call("runtimeModelPolicy:installDeploymentPolicy", { manifestId, expectedRevision: Number(revision) });
  if (!result || result.manifestId !== manifestId || result.revision !== Number(revision)) fail("CI_FIXTURE_POLICY_RESULT_INVALID");
  return { status: "COMPILED_MANIFEST_INSTALLED", kind, manifestId, revision: Number(revision), freshNativeQualification: false };
}

/** Retirement fences background effects; it deliberately preserves tombstones/history. */
export async function retireFixtures(env, kind, call = operator(env, kind)) {
  const plan = fixturePlan(env, kind);
  const retired = [];
  for (const tenantId of [plan.tenantId, plan.identities.outsider.tenantId]) {
    const result = await call("runtimeAuth:deleteScope", { tenantId });
    if (result !== null) fail("CI_FIXTURE_RETIREMENT_RESULT_INVALID");
    retired.push(tenantId);
  }
  return { status: "RETIRED_FIXTURE_AUTHORITY", kind, retired, globalPurge: false, physicalRowDeletion: false };
}

/** A successful internal mutation alone is insufficient: current public reads must be denied. */
export async function verifyRetiredFixtures(env, kind, createClient = url => new ConvexHttpClient(url)) {
  verifyDisposableCiTargets(env);
  const plan = fixturePlan(env, kind);
  const url = env[kind === "cli" ? "CONVEX_URL_CLI" : "CONVEX_URL"];
  const session = makeFunctionReference("runtimeClient:session");
  for (const [role, identity] of Object.entries(plan.identities)) {
    verifyDisposableCiTargets(env);
    if (url !== env[kind === "cli" ? "CONVEX_URL_CLI" : "CONVEX_URL"]) fail("CI_FIXTURE_TARGET_CHANGED");
    const client = createClient(url);
    client.setAuth(issueFixtureToken(env, kind, role));
    let denied = false;
    try { await client.mutation(session, { tenantId: identity.tenantId, memorySpaceId: identity.memorySpaceId }); }
    catch (error) { denied = error instanceof ConvexError && error.data?.code === "FORBIDDEN"; }
    if (!denied) fail("CI_FIXTURE_RETIREMENT_VERIFICATION_FAILED");
  }
  return { status: "RETIRED_FIXTURE_READS_DENIED", kind, verifiedRoles: Object.keys(plan.identities) };
}

export function fixtureEnvironment(env, kind) {
  const plan = fixturePlan(env, kind);
  const suffix = kind === "cli" ? "_CLI" : "";
  const url = env[`CONVEX_URL${suffix}`];
  let approved;
  try { approved = JSON.parse(env.CORTEX_CI_DISPOSABLE_DEPLOYMENTS); } catch { fail("CI_DISPOSABLE_TARGET_ALLOWLIST_REQUIRED"); }
  if (!Array.isArray(approved) || !approved.some(name => url === `https://${name}.convex.cloud`)) fail("CI_TARGET_NOT_APPROVED_DISPOSABLE");
  return { CORTEX_TEST_ENV_MODE: "explicit", CONVEX_URL: url,
    CORTEX_TEST_FIXTURE: JSON.stringify({ ...plan, deploymentUrl: url }),
    CORTEX_TEST_AUTH_TOKEN: issueFixtureToken(env, kind, "owner"),
    CORTEX_TEST_READER_TOKEN: issueFixtureToken(env, kind, "reader"),
    CORTEX_TEST_OUTSIDER_TOKEN: issueFixtureToken(env, kind, "outsider") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, kind] = process.argv.slice(2);
    if (mode === "auth-config") console.log(JSON.stringify(writeCiAuthConfig(process.env)));
    else if (mode === "install-policy") console.log(JSON.stringify(await installFixturePolicy(process.env, kind)));
    else if (mode === "provision") console.log(JSON.stringify(await provisionFixtures(process.env, kind)));
    else if (mode === "retire") console.log(JSON.stringify({ retirement: await retireFixtures(process.env, kind), verification: await verifyRetiredFixtures(process.env, kind) }));
    else if (mode === "tokens") {
      if (!process.env.GITHUB_ENV) fail("CI_FIXTURE_PRIVATE_ENV_FILE_REQUIRED");
      const values = fixtureEnvironment(process.env, kind);
      for (const [key, value] of Object.entries(values)) {
        if (key.endsWith("TOKEN")) console.log(`::add-mask::${value}`);
        appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`, { mode: 0o600 });
      }
      console.log(JSON.stringify({ status: "PRIVATE_FIXTURE_ENV_WRITTEN", kind }));
    } else fail("CI_FIXTURE_COMMAND_INVALID");
  } catch (error) {
    console.error(error.message?.startsWith("CI_") ? error.message : "CI_FIXTURE_SETUP_FAILED");
    process.exitCode = 1;
  }
}
