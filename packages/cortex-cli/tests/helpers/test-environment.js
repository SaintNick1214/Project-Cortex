import { URL } from "node:url";

/** Explicit CLI target selection; this module never loads environment files. */
export function cliTestTarget(environment) {
  const value = environment.CONVEX_URL_CLI;
  const fail = () => {
    throw new Error(
      "Live CLI tests require explicit CONVEX_URL_CLI: an http(s) origin without credentials, path, query or fragment.",
    );
  };
  if (typeof value !== "string" || !value || /\s|[?#]/.test(value)) fail();
  let url;
  try {
    url = new URL(value);
  } catch {
    fail();
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    fail();
  return value;
}

/** Administrative live tests use only a separately qualified explicit key. */
export function cliTestCredentials(environment) {
  const url = cliTestTarget(environment);
  const key = environment.CONVEX_DEPLOY_KEY;
  if (environment.CORTEX_TEST_EXPECTED_CONVEX_URL !== url ||
      typeof key !== "string" || !key.trim() || /[\r\n\0]/.test(key))
    throw new Error("Live CLI tests require CONVEX_DEPLOY_KEY and an exact CORTEX_TEST_EXPECTED_CONVEX_URL match.");
  return { url, key };
}

export function configureCliTestEnvironment(environment, live = false) {
  const credentials = live ? cliTestCredentials(environment) : undefined;
  for (const name of Object.keys(environment)) {
    if (
      /^(?:CONVEX_|LOCAL_CONVEX_|CLOUD_CONVEX_|NEXT_PUBLIC_CONVEX_)/.test(name)
    )
      delete environment[name];
  }
  if (live) {
    const target = credentials.url;
    environment.CONVEX_URL_CLI = target;
    environment.CONVEX_URL = target;
    environment.CONVEX_DEPLOY_KEY = credentials.key;
    environment.CONVEX_DEPLOYMENT_TYPE = [
      "localhost",
      "127.0.0.1",
      "[::1]",
    ].includes(new URL(target).hostname)
      ? "local"
      : "managed";
  }
}

/** Runtime suites retain only the exact verified fixture endpoint; operator keys are excluded. */
export function configureCliRuntimeTestEnvironment(environment) {
  const target = cliTestTarget(environment);
  let fixture;
  try { fixture = JSON.parse(environment.CORTEX_TEST_FIXTURE); } catch { throw new Error("ACTUAL_RUNTIME_FIXTURE_REQUIRED"); }
  if (fixture?.version !== 1 || fixture.kind !== "cli" || fixture.deploymentUrl !== target || typeof environment.CORTEX_TEST_AUTH_TOKEN !== "string" || !environment.CORTEX_TEST_AUTH_TOKEN) throw new Error("ACTUAL_RUNTIME_FIXTURE_REQUIRED");
  configureCliTestEnvironment(environment);
  environment.CONVEX_URL_CLI = target;
  environment.CONVEX_URL = target;
}
