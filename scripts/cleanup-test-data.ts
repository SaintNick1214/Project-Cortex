#!/usr/bin/env tsx
/** Native CI reset only. Expected URL must come from the dedicated CI allowlist. */
import { resetCiDeployment } from "./lib/ci-cleanup";
import { prepareCiReferences } from "./lib/ci-reference-preparation";

try {
  const result = resetCiDeployment(process.env);
  const preparation = await prepareCiReferences(process.env);
  console.log(`Native CI reset verified: ${result.tables} data tables and file storage were empty; canonical references are ready after ${preparation.calls} bounded native calls.`);
} catch (error) {
  // Native tools receive a deployment key; never forward their raw diagnostics.
  console.error(error instanceof Error ? error.message : "Native CI reset failed.");
  process.exitCode = 1;
}
