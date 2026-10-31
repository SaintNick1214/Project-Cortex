import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyDisposableCiTargets } from "./verify-disposable-targets.mjs";

const valid = () => ({
  CORTEX_CI_DISPOSABLE_DEPLOYMENTS: JSON.stringify(["owned-sdk-123", "owned-cli-456"]),
  CONVEX_DEPLOY_KEY: "dev:owned-sdk-123|synthetic-secret",
  CONVEX_URL: "https://owned-sdk-123.convex.cloud",
  CONVEX_DEPLOY_KEY_CLI: "dev:owned-cli-456|synthetic-secret",
  CONVEX_URL_CLI: "https://owned-cli-456.convex.cloud",
});

test("accepts separately approved development selectors without returning keys", () => {
  const result = verifyDisposableCiTargets(valid());
  assert.equal(result.length, 2);
  assert.equal(result.every(target => target.deploymentType === "dev"), true);
  assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
});

for (const key of ["prod:owned-sdk-123|synthetic-secret", "preview:owned-sdk-123|synthetic-secret", "project:team:project|synthetic-secret", "untyped-legacy-secret", "dev:owned-sdk-123|", "dev:owned-sdk-123|one|two"]) {
  test(`rejects unsafe deployment key class ${key.split(":")[0]}`, () => {
    const env = valid(); env.CONVEX_DEPLOY_KEY = key;
    assert.throws(() => verifyDisposableCiTargets(env), error => error.message === "CI_REQUIRES_DEVELOPMENT_DEPLOYMENT_KEY" && !error.message.includes("synthetic-secret"));
  });
}

test("rejects either production target before any SDK deployment can begin", () => {
  const env = valid(); env.CONVEX_DEPLOY_KEY_CLI = "prod:owned-cli-456|synthetic-secret";
  assert.throws(() => verifyDisposableCiTargets(env), /CI_REQUIRES_DEVELOPMENT_DEPLOYMENT_KEY/);
});
test("requires an explicit administrator supplied disposable allowlist", () => {
  const env = valid(); delete env.CORTEX_CI_DISPOSABLE_DEPLOYMENTS;
  assert.throws(() => verifyDisposableCiTargets(env), /CI_DISPOSABLE_TARGET_ALLOWLIST_REQUIRED/);
});
test("rejects a valid dev key for another target", () => {
  const env = valid(); env.CONVEX_DEPLOY_KEY = "dev:another-project-789|synthetic-secret";
  assert.throws(() => verifyDisposableCiTargets(env), /CI_TARGET_NOT_APPROVED_DISPOSABLE/);
});
test("rejects target URL substitution", () => {
  const env = valid(); env.CONVEX_URL = "https://another-project-789.convex.cloud";
  assert.throws(() => verifyDisposableCiTargets(env), /CI_DEPLOYMENT_URL_MISMATCH/);
});
test("requires isolated SDK and CLI targets", () => {
  const env = valid(); env.CONVEX_DEPLOY_KEY_CLI = env.CONVEX_DEPLOY_KEY; env.CONVEX_URL_CLI = env.CONVEX_URL;
  assert.throws(() => verifyDisposableCiTargets(env), /CI_REQUIRES_ISOLATED_SDK_AND_CLI_TARGETS/);
});
