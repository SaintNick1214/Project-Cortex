import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const [file, cli] of [["tests/env.ts", false], ["packages/cortex-cli/tests/env.ts", true]]) {
  test(`${file} keeps explicit qualified targets despite local/cloud dotenv substitutions`, () => {
    const cwd = mkdtempSync(join(tmpdir(), "cortex-ci-env-"));
    try {
      writeFileSync(join(cwd, ".env.local"), "CONVEX_URL=https://foreign.convex.cloud\nCONVEX_URL_CLI=https://foreign-cli.convex.cloud\n");
      const code = `await import(${JSON.stringify(pathToFileURL(join(root, file)).href)}); console.log(JSON.stringify({url:process.env.CONVEX_URL}));`;
      const expected = cli ? "https://owned-cli-456.convex.cloud" : "https://owned-sdk-123.convex.cloud";
      const result = execFileSync(process.execPath, ["--import", pathToFileURL(join(root, "node_modules/tsx/dist/loader.mjs")).href, "--input-type=module", "-e", code], {
        cwd, encoding: "utf8", timeout: 15000,
        env: { ...process.env, CI: "true", CORTEX_TEST_ENV_MODE: "explicit", CONVEX_TEST_MODE: "managed",
          CONVEX_URL: "https://owned-sdk-123.convex.cloud", CONVEX_URL_CLI: cli ? expected : "",
          CLOUD_CONVEX_URL: "https://foreign-cloud.convex.cloud", LOCAL_CONVEX_URL: "http://127.0.0.1:3210",
          // The CLI now deliberately clears offline ambient deployment values.
          // An explicit runtime consumer must select its exact scoped fixture.
          ...(cli ? { CORTEX_TEST_FIXTURE: JSON.stringify({ version: 1, kind: "cli", deploymentUrl: expected }),
            CORTEX_TEST_AUTH_TOKEN: "shape-only-offline-fixture-token" } : { CORTEX_TEST_FIXTURE: "" }),
          NEO4J_URI: "", MEMGRAPH_URI: "", GRAPH_TESTING_ENABLED: "false" },
      });
      assert.deepEqual(JSON.parse(result.trim().split("\n").at(-1)), { url: expected });
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
}
