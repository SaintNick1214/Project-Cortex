#!/usr/bin/env node
/** Retired: repeated tests must not deploy or sweep an implicitly selected backend. */
console.error(
  "test-memory-openai-20x.mjs is retired: raw admin operations are internal. " +
    "Run the memory-openai suite on a verified disposable managed deployment " +
    "with test-owned resources and scoped SDK cleanup. Provision and deploy " +
    "that target separately with native authenticated Convex tools; do not use " +
    "an existing production deployment. See Documentation/security/admin-operations.mdx. " +
    "No deployment, cleanup, or test run was performed.",
);
process.exitCode = 1;
