# CLI host authentication and operator repair

Source ready; installed/native verification remains pending. The 12-path candidate is bound by source-manifest1.json (a1177c7382995aefbbe1af9f5502489c2fc82460d1b640c0c26a8c4e1f478f8f).

85 distinct current assertions across seven suites pass with zero failures/skips. checks1.json selects the latest result per suite rather than adding overlapping reruns. CLI TypeScript, affected scoped lint and tracked diff checks exit 0; Jest forceExit is false and owned children have closed. Prior runner, fixture, compatibility-oracle and lint failures remain unchanged in their original receipts.

Public flags: --token-env <name> (default CORTEX_AUTH_TOKEN) OR --token-file <private owned nonsymlink file>, plus --tenant-id and --memory-space-id selectors. Programmatic GlobalOptions.fetchAuthToken({forceRefreshToken}) is exclusive with env/file. Config token-env/token-file keys save only locations; tenant-id/memory-space-id save selectors. The server verifies authority. JWT/provider/deploy keys are not printed or persisted as public-auth settings.

Each SDK query, mutation and action verifies the current server session before dispatch and again before returning data to command code, then checks supplied server delivery deadlines. Same-URL principals never share clients. withClient closes the exact owned client on success/failure. Token rotations are reread; changed verified identity or scope denies stale delivery.

Operator commands:

- db stats --target target.json --project host [--management-token-env CONVEX_ACCESS_TOKEN] [--deploy-key-env CONVEX_DEPLOY_KEY] [-f json|table] preserves actual count/truncated values.
- db clear --target target.json --project host --tenant-id owned-tenant --memory-space-id owned-space --yes performs only scoped lifecycle retirement on a freshly verified disposable development target.
- db restore rejects honestly before reads/effects. backup/export declares restorable:false, bounds authorized metadata and creates a new private file; --include-all rejects.

The operator uses the existing exact-target management verifier twice, a target-bound dev key, pinned host Convex CLI and only two allowlisted internal methods. No public admin restoration, global purge, financial reset, fallback zero or blind mutation retry is present.

Known limits:

- This source successor is ready for installed CLI/native verification; it does not claim full Task15 or Task16 acceptance.
- No build/prebuild, mirror sync, install, service/admin operation, deployment, Git mutation or paid inference was performed by this lane.
- Raw CLI delivery honors returned server deliveryExpiresAt and verified session deadlines; it does not invent unreturned resource deadlines or decode JWT claims as authority.
- Legacy deployment-key configuration remains historical metadata/operator compatibility; it does not authenticate the public SDK. New auth settings store only environment names/private file locations.
- Generic restore and full database purge are unsupported. Backup/export is explicitly bounded authorized space/user metadata with restorable:false.
- Operator counts are the exact existing internal fourteen-table response, including truncation; they do not claim a complete runtime-table inventory.
