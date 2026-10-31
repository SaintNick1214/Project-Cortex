#!/usr/bin/env tsx
/** Cleanup is explicit by target class: shared runtime scopes retain lifecycle
 * fences; physical native reset is only for a separate job-owned container. */
import { retireFixtures, verifyRetiredFixtures } from "./ci/runtime-fixtures.mjs";
import { resetCiDeployment } from "./lib/ci-cleanup";
import { prepareCiReferences } from "./lib/ci-reference-preparation";

const kind = process.argv[2];
try {
  if (kind === "sdk" || kind === "cli") {
    const retirement = await retireFixtures(process.env, kind);
    const verification = await verifyRetiredFixtures(process.env, kind);
    console.log(JSON.stringify({ retirement, verification }));
  } else if (kind === "native") {
    const result = resetCiDeployment(process.env);
    const preparation = await prepareCiReferences(process.env);
    console.log(JSON.stringify({ targetClass: "isolated-native", emptyTables: result.tables, referencePreparationCalls: preparation.calls }));
  } else {
    throw new Error("CI_FIXTURE_KIND_REQUIRED: usage: tsx scripts/cleanup-test-data.ts sdk|cli|native");
  }
} catch (error) {
  // Do not forward native tools or authenticated transport diagnostics.
  const message = error instanceof Error ? error.message : "CI_FIXTURE_CLEANUP_FAILED";
  console.error(message.startsWith("CI_") || message.startsWith("Native ") ? message : "CI_FIXTURE_CLEANUP_FAILED");
  process.exitCode = 1;
}
