#!/usr/bin/env tsx
/**
 * Retire only the exact owned CI fixture tenants on the two approved dev targets.
 * Global table purges are unsupported by the current runtime lifecycle. Internal
 * deployment-operator calls preserve tombstones and fence pending effects.
 * Required: CORTEX_CI_RUN_ID/auth metadata and both guarded dev selectors.
 */
import { retireFixtures, verifyRetiredFixtures } from "./ci/runtime-fixtures.mjs";

const kind = process.argv[2];
if (kind !== "sdk" && kind !== "cli") {
  console.error("CI_FIXTURE_KIND_REQUIRED: usage: tsx scripts/cleanup-test-data.ts sdk|cli");
  process.exitCode = 1;
} else {
  try {
    const retirement = await retireFixtures(process.env, kind);
    const verification = await verifyRetiredFixtures(process.env, kind);
    console.log(JSON.stringify({ retirement, verification }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "CI_FIXTURE_RETIREMENT_FAILED";
    console.error(message.startsWith("CI_") ? message : "CI_FIXTURE_RETIREMENT_FAILED");
    process.exitCode = 1;
  }
}
