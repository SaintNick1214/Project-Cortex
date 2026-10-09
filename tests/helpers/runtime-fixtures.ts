import { ConvexHttpClient } from "convex/browser";
import { CortexRuntimeClient } from "../../src/client-runtime/client";

export type FixtureRole = "owner" | "reader" | "outsider";
export interface ActualRuntimeFixture {
  version: 1; kind: "sdk" | "cli"; runId: string; issuer: string; audience: string;
  deploymentUrl: string; tenantId: string; memorySpaceId: string;
  identities: Record<FixtureRole, { subject: string; tenantId: string; memorySpaceId: string }>;
}
const fail = (): never => { throw new Error("ACTUAL_RUNTIME_FIXTURE_REQUIRED: provision scoped dev fixtures and issue verified-host JWTs before this suite"); };
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** Selectors and tokens must come from privileged setup. Local claims are not authorization. */
export function actualRuntimeFixture(env: NodeJS.ProcessEnv = process.env): ActualRuntimeFixture {
  let parsed: unknown;
  try { parsed = JSON.parse(env.CORTEX_TEST_FIXTURE ?? "") as unknown; } catch { return fail(); }
  const value = record(parsed);
  if (!value || typeof value.runId !== "string" || typeof value.deploymentUrl !== "string") return fail();
  const root = `cortex-ci-${value.runId}-${value.kind}`;
  if (value.version !== 1 || (value.kind !== "sdk" && value.kind !== "cli")
    || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/.test(value.runId)
    || value.tenantId !== root || value.memorySpaceId !== `${root}-space`
    || value.deploymentUrl !== env.CONVEX_URL || !/^https:\/\/[a-z][a-z0-9-]{2,80}\.convex\.cloud$/.test(value.deploymentUrl)
    || typeof value.issuer !== "string" || typeof value.audience !== "string") return fail();
  const identities = record(value.identities);
  if (!identities) return fail();
  for (const role of ["owner", "reader", "outsider"] as const) {
    const identity = record(identities[role]);
    const tenant = role === "outsider" ? `${root}-other` : root;
    if (!identity || identity.subject !== `${root}-${role}` || identity.tenantId !== tenant || identity.memorySpaceId !== `${tenant}-space`) return fail();
  }
  return value as unknown as ActualRuntimeFixture;
}

export function fixtureToken(role: FixtureRole, env: NodeJS.ProcessEnv = process.env): string {
  const fixture = actualRuntimeFixture(env);
  const key = role === "owner" ? "CORTEX_TEST_AUTH_TOKEN" : role === "reader" ? "CORTEX_TEST_READER_TOKEN" : "CORTEX_TEST_OUTSIDER_TOKEN";
  const token = env[key];
  if (!token || token.split(".").length !== 3) return fail();
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as unknown; } catch { return fail(); }
  const claims = record(parsed);
  if (!claims) return fail();
  if (claims.iss !== fixture.issuer || claims.aud !== fixture.audience || claims.sub !== fixture.identities[role].subject
    || typeof claims.exp !== "number" || !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() / 1000) return fail();
  // This preflight only catches fixture mistakes. Convex verifies RS256/issuer/audience on every actual transport.
  return token;
}

export function actualHttpClient(role: FixtureRole, env: NodeJS.ProcessEnv = process.env): ConvexHttpClient {
  const client = new ConvexHttpClient(actualRuntimeFixture(env).deploymentUrl);
  client.setAuth(fixtureToken(role, env));
  return client;
}

export function actualRuntimeClient(role: FixtureRole, env: NodeJS.ProcessEnv = process.env): CortexRuntimeClient {
  const fixture = actualRuntimeFixture(env), identity = fixture.identities[role];
  return new CortexRuntimeClient({ deploymentUrl: fixture.deploymentUrl,
    scope: { tenantId: identity.tenantId, memorySpaceId: identity.memorySpaceId }, fetchToken: async () => fixtureToken(role, env) });
}
