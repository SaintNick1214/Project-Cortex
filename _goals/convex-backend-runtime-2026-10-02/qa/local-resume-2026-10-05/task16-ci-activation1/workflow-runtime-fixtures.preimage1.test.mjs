import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import yaml from "js-yaml";

const source = readFileSync(new URL("../../.github/workflows/pr-checks.yml", import.meta.url), "utf8");
const workflow = yaml.load(source), jobs = workflow.jobs;

test("workflow parses and guards both development targets before auth writes or service effects", () => {
  const steps = jobs["setup-and-purge"].steps;
  const guard = steps.findIndex(step => step.run === "node scripts/ci/verify-disposable-targets.mjs");
  assert.ok(guard >= 0);
  for (const step of steps.filter(step => /auth-config|convex deploy|runtime-fixtures.mjs provision/.test(step.run ?? ""))) {
    assert.ok(steps.indexOf(step) > guard);
  }
  assert.equal(source.includes("secrets.CONVEX_URL"), false);
  assert.equal(source.includes("secrets.CONVEX_DEPLOY_KEY"), false);
  assert.equal(source.includes("admin:clearTable"), false);
  assert.equal(jobs["setup-and-purge"].env.CONVEX_DEPLOY_KEY, "${{ secrets.CORTEX_CI_CONVEX_DEPLOY_KEY }}");
  assert.equal(jobs["setup-and-purge"].env.CONVEX_DEPLOY_KEY_CLI, "${{ secrets.CORTEX_CI_CONVEX_DEPLOY_KEY_CLI }}");
});

test("consumer jobs issue scoped JWTs without deployment operator keys and retain required suite discovery", () => {
  for (const job of ["test-typescript", "test-cli", "test-vercel-ai-provider"]) {
    const value = jobs[job];
    assert.equal(Object.hasOwn(value.env, "CONVEX_DEPLOY_KEY"), false);
    assert.equal(value.steps.some(step => /runtime-fixtures.mjs tokens/.test(step.run ?? "")), true);
    assert.equal(value.steps.some(step => /testPathPattern|runTestsByPath|passWithNoTests/.test(step.run ?? "")), false);
  }
  assert.equal(jobs["test-typescript"].steps.some(step => /--shard=/.test(step.run ?? "")), true);
  assert.equal(jobs["test-cli"].steps.some(step => step.run === "npm run test:e2e --workspace=@cortexmemory/cli"), true);
});

test("cleanup waits for every consumer, runs after failure, and is a required final result", () => {
  const cleanup = jobs["cleanup-runtime-fixtures"];
  for (const job of ["test-typescript", "test-cli", "test-vercel-ai-provider", "code-quality"]) assert.equal(cleanup.needs.includes(job), true);
  assert.equal(cleanup.if.includes("always()"), true);
  assert.equal(cleanup.if.includes("'failure'"), true);
  assert.equal(jobs["all-checks-passed"].needs.includes("cleanup-runtime-fixtures"), true);
  assert.equal(jobs["all-checks-passed"].steps[0].run.includes('test "${{ needs.cleanup-runtime-fixtures.result }}" = "success"'), true);
});

test("each target cleanup still runs when the other cleanup fails", () => {
  const steps = jobs["cleanup-runtime-fixtures"].steps;
  const sdk = steps.filter(step => /cleanup-test-data\.ts sdk/.test(step.run ?? ""));
  const cli = steps.filter(step => /cleanup-test-data\.ts cli/.test(step.run ?? ""));
  assert.equal(sdk.length, 1);
  assert.equal(cli.length, 1);
  assert.notEqual(sdk[0], cli[0], "one fail-fast shell must not own both retirements");
  assert.equal(sdk[0].if, "always()");
  assert.equal(cli[0].if, "always()");
  for (const step of [...sdk, ...cli]) assert.notEqual(step["continue-on-error"], true);
});
