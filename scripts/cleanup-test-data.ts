#!/usr/bin/env tsx
/** Retired: deployment-wide sweeping through unauthenticated raw admin calls. */
console.error(
  "cleanup-test-data.ts is retired: raw admin operations are internal. " +
    "Use scoped SDK deletion for test-owned resources, or recreate a verified " +
    "disposable deployment. For intentional deployment maintenance, use native " +
    "authenticated Convex tools with an explicit verified target. " +
    "See Documentation/security/admin-operations.mdx. No cleanup was performed.",
);
process.exitCode = 1;
