import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishedControls, controlledCandidate, qualifyUpgrade, qualifyTableCollision, PUBLISHED_CONTROLS } from "./installer-controls.mjs";

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
test("published CLI0.39 preserves host ownership through a controlled upgrade, conflict and interrupted retry", { timeout: 180_000 }, async () => {
  const controls = await publishedControls(sourceRoot);
  try {
    assert.equal(controls.sdk.sha256, PUBLISHED_CONTROLS.sdk.sha256);
    assert.equal(controls.cli.sha256, PUBLISHED_CONTROLS.cli.sha256);
    const candidate = await controlledCandidate(controls.sdk.directory, path.join(controls.temporary, "immutable-control-sdk"));
    const report = await qualifyUpgrade({ cliDirectory: controls.cli.directory, oldSdk: controls.sdk.directory, candidateSdk: candidate, host: path.join(controls.temporary, "owned-host") });
    assert.equal(report.hostOwnedBytesPreserved, true);
    assert.equal(report.refusedBeforeBackendWrites, true);
    assert.deepEqual(report.reviewedManagedFiles, ["backend/runtimeClient.ts"]);
    assert.equal(report.idempotentRetry, true);
    const collision = await qualifyTableCollision({ cliDirectory: controls.cli.directory, sdk: candidate, host: path.join(controls.temporary, "table-collision-host") });
    assert.equal(collision.refusedBeforeBackendWrites, true);
    // This receipt concerns immutable controls only; the final candidate must be rerun separately.
    const receipt = { coverage: "offline-public-cli-immutable-controls", cli: { version: controls.cli.version, sha256: controls.cli.sha256 }, previousSdk: { version: controls.sdk.version, sha256: controls.sdk.sha256 }, report, collision, liveDeployment: false, actualCandidate: false };
    const output = process.env.CORTEX_EXTERNAL_CONTROL_RECEIPT;
    if (output) await fs.writeFile(output, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  } finally { await controls.cleanup(); }
});
