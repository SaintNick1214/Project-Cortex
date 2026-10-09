import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import yaml from "js-yaml";
import cliJestConfig from "../../packages/cortex-cli/jest.config.js";

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

test("consumer jobs issue scoped JWTs without operator keys and preserve honest complete discovery", () => {
  for (const job of ["test-typescript", "test-cli", "test-vercel-ai-provider"]) {
    const value = jobs[job];
    assert.equal(Object.hasOwn(value.env, "CONVEX_DEPLOY_KEY"), false);
    assert.equal(value.steps.some(step => /runtime-fixtures.mjs tokens/.test(step.run ?? "")), true);
    assert.equal(value.steps.some(step => /--listTests/.test(step.run ?? "")), true);
    assert.equal(value.steps.some(step => /passWithNoTests/.test(step.run ?? "")), false);
  }
  assert.equal(jobs["test-typescript"].steps.some(step => /--shard=/.test(step.run ?? "")), true);
  for (const job of ["test-typescript", "test-cli"]) {
    assert.equal(jobs[job].steps.filter(step => /--runTestsByPath tests\/integration\/runtime-ci\.test\.ts/.test(step.run ?? "")).length, 1);
  }
});

test("only SDK shard1 invokes the actual suite; other shards still cover every current unit", () => {
  const steps = jobs["test-typescript"].steps;
  const units = steps.find(step => /--shard=/.test(step.run ?? ""));
  assert.ok(units.run.includes("--testPathPatterns=tests/unit/"));
  const distribution = steps.findIndex(step => step.run === "npm run build:backend");
  assert.ok(distribution >= 0 && distribution < steps.indexOf(units), "installed catalog units require the real current backend distribution");
  assert.equal(units.env.CONVEX_URL, "https://unit.invalid");
  const paid = steps.find(step => /--runTestsByPath/.test(step.run ?? ""));
  assert.equal(paid.if, "matrix.shard == 1");
  assert.ok(paid.run.includes("240s"));
  assert.ok(paid.run.includes("--kill-after=5s"));
});

test("legacy direct-provider and unauthenticated CLI loops cannot be activated by the new secrets", () => {
  assert.equal(source.includes("OPENAI_API_KEY"), false);
  assert.equal(jobs["test-vercel-ai-provider"].steps.some(step => /^npm test --workspace/.test(step.run ?? "")), false);
  assert.equal(jobs["test-cli"].steps.some(step => /npm run test:e2e/.test(step.run ?? "")), false);
  const provider = jobs["test-vercel-ai-provider"].steps.find(step => /Run provider unit/.test(step.name ?? ""));
  assert.ok(provider.run.includes("test:unit"));
  assert.ok(provider.run.includes("test:integration"));
  assert.equal(provider.env.CONVEX_URL, "https://unit.invalid");
  assert.equal(provider.env.CORTEX_TEST_AUTH_TOKEN, "");
  assert.equal(jobs["test-cli"].steps.some(step => /npm run test:fast/.test(step.run ?? "")), true);
});

test("selected Jest suites must close naturally rather than inherit forced exit", () => {
  const native = jobs["native-proof-contracts"].steps.find(step => /--runTestsByPath/.test(step.run ?? ""));
  assert.ok(native.run.includes("--forceExit=false"), "native privacy proofs must also close their clients naturally");
  const selected = ["test-typescript", "test-cli", "test-vercel-ai-provider"]
    .flatMap(name => jobs[name].steps)
    .flatMap(step => (step.run ?? "").split("\n"))
    .filter(line => /--runTestsByPath|--maxWorkers=|npm run test:(unit|integration|fast)/.test(line));
  assert.equal(selected.length, 7);
  for (const command of selected) {
    if (command.includes("npm run test:fast")) {
      // The canonical CLI runner rejects force-exit overrides and supplies its
      // own config. Passing even =false prevents the suite from starting.
      const manifest = JSON.parse(readFileSync(new URL("../../packages/cortex-cli/package.json", import.meta.url), "utf8"));
      assert.equal(manifest.scripts["test:fast"], "node scripts/test-runner.js fast");
      assert.equal(cliJestConfig.forceExit, false);
      assert.equal(/--force(?:Exit|-exit)(?:=|\s|$)/.test(command), false, command);
    } else assert.ok(command.includes("--forceExit=false"), command);
  }
});

test("CLI command fixtures consume the built executable and are cleaned before authenticated integration", () => {
  const publicSteps = jobs["public-contracts"].steps;
  const publicCli = publicSteps.findIndex(step => step.run === "npm run build --workspace=@cortexmemory/cli");
  const helperTests = publicSteps.findIndex(step => /node --test scripts\/ci\/\*.test.mjs/.test(step.run ?? ""));
  assert.ok(publicCli >= 0 && helperTests > publicCli, "offline helper contracts also consume the genuine built CLI");
  const steps = jobs["test-cli"].steps;
  const sdk = steps.findIndex(step => step.run === "npm run build");
  const cli = steps.findIndex(step => step.run === "npm run build --workspace=@cortexmemory/cli");
  const prepare = steps.findIndex(step => /command-fixtures.mjs prepare/.test(step.run ?? ""));
  const contracts = steps.findIndex(step => /npm run test:fast/.test(step.run ?? ""));
  const cleanup = steps.findIndex(step => /command-fixtures.mjs cleanup/.test(step.run ?? ""));
  const tokens = steps.findIndex(step => /runtime-fixtures.mjs tokens cli/.test(step.run ?? ""));
  assert.ok(sdk >= 0 && cli > sdk && prepare > cli && contracts > prepare && cleanup > contracts && tokens > cleanup);
  assert.ok(steps.some(step => /apt-get install --yes zsh fish/.test(step.run ?? "")));
  assert.equal(steps[prepare].env.CORTEX_CI_AUTH_PRIVATE_KEY, "");
  assert.equal(steps[cleanup].if, "always()");
  assert.equal(steps[cleanup].env.CORTEX_CI_AUTH_PRIVATE_KEY, "");
  assert.ok(steps[prepare].run.includes('"$RUNNER_TEMP/cortex-cli-command-fixtures"'));
  assert.ok(steps[cleanup].run.includes('"$RUNNER_TEMP/cortex-cli-command-fixtures"'));
});

test("provider actual path is isolated from old E2E and uses public scoped Agent publication before one bounded contract", () => {
  const steps = jobs["test-vercel-ai-provider"].steps;
  const publication = steps.findIndex(step => /remote-agent\.mjs/.test(step.run ?? ""));
  const actual = steps.findIndex(step => /--selectProjects e2e-remote/.test(step.run ?? ""));
  const built = steps.findIndex(step => step.run === "npm run build --workspace=@cortexmemory/vercel-ai-provider");
  assert.ok(publication >= 0 && actual > publication);
  assert.ok(built >= 0 && actual > built, "actual remote must consume declared built package exports");
  assert.ok(steps[actual].run.includes("--runTestsByPath tests/e2e/remote-runtime.test.ts"));
  assert.ok(steps[actual].run.includes("210s"));
  assert.equal(steps[actual].env.DEBUG, "true");
  for (const step of [steps[publication], steps[actual]]) {
    assert.equal(step.env.CORTEX_CI_AUTH_PRIVATE_KEY, "");
    assert.equal(Object.hasOwn(step.env, "CONVEX_DEPLOY_KEY"), false);
  }
  assert.ok(steps.some(step => (step.with?.path ?? "").includes("ci-provider-remote-results.json")));
});

test("bounded consumers preserve complete-run serialization and independent cleanup after cancellation", () => {
  assert.equal(workflow.concurrency.group, "cortex-shared-ci-backends");
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  for (const name of ["setup-and-purge", "test-typescript", "test-vercel-ai-provider", "test-cli", "cleanup-runtime-fixtures"]) {
    assert.ok(Number.isSafeInteger(jobs[name]["timeout-minutes"]));
    assert.ok(jobs[name]["timeout-minutes"] <= 15);
  }
  assert.ok(jobs["cleanup-runtime-fixtures"].if.includes("'cancelled'"));
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
