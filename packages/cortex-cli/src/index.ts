#!/usr/bin/env -S node --
import {
  isSupportedNodeVersion,
  unsupportedNodeDiagnostic,
} from "./utils/node-runtime.js";

// Keep application dependencies behind this check: ESM links static imports first.
if (!isSupportedNodeVersion(process.versions.node)) {
  process.stderr.write(`${unsupportedNodeDiagnostic(process.version)}\n`);
  process.exitCode = 1;
} else {
  void import("./cli-main.js")
    .then(({ main }) => main())
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unexpected CLI error";
      process.stderr.write(`Unable to start Cortex CLI: ${message}\n`);
      process.exitCode = 1;
    });
}
