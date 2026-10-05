# Task03C2 registry/MF SDK maintenance bridge

Status: implemented; fresh independent review pending. This is a bounded offline SDK bridge, not full Task03 or live-runtime acceptance.

- Single register/update receipts raise exported browser-safe AgentRegistryWriteReceiptError only after transport/resilience returns. The error records the exact safe accepted/resourceType/resourceId receipt, committed outcome, read requirement and nonretryable state; receipt is frozen. No fabricated profile, graph sync, stats query or retry follows a receipt.
- Readable official rows retain existing mapping plus their actual tenant/space fields; registration/filter/get/exists/configure/update/unregister selectors carry caller scope, with configured tenant mismatch rejection. Cortex now passes its auth context to AgentsAPI. Scope metadata never substitutes for wire credentials or backend authority.
- Explicit unregisterMany IDs preserve actual disclosed server IDs. Unexpected absent result IDs raise exported nonretryable AgentRegistryCommittedResultError after commit, without inventing IDs or rerunning mutation.
- Client cascade=true fails AgentRegistryCapabilityError before lookup/effects. The old client helper could not prove complete authorized child cleanup against the newly guarded backend, so no old best-effort graph/rollback/cascade result is exposed as success. Durable authorized cascades remain downstream work.
- Global memories/facts/contexts/spaces purges and TestCleanup.purgeAll fail TestCleanupCapabilityError before transport. The interactive global purge also fails before deleting conversations or other stores. No internal reference, cast, makeFunctionReference or credential impersonation is introduced. Existing owned per-ID ScopedCleanup remains available and covered by an owned/foreign-space regression.

Observed final receipts: actual root noEmit, lint-config noEmit, scoped ESLint with zero warnings, npm12.2 root ESM/CJS/DTS build, standard packed/browser contracts all exit0. Focused test suite:39 passed,0 skipped/failed. All clients are disabled; example.convex.cloud is an inert environment bootstrap value, with no real network/service/model operations.

Backend ES2021 configuration was already checked by the coordinator against the merged schema, outside this executor's source ownership. Backend/stats/conversation/source-policy implementations were not edited. agents.computeStats remains the previously explicit separate pending2-path scope; readable SDK paths retain its existing use, and receipt paths never invoke it. The broader Task03 subscriptions/private-byte/callback/live negative gates remain pending; this bridge does not certify those surfaces. Auth refresh remains the accepted03C1 implementation.

Checks are captured in commands.json and raw/. sources.json freezes the six bridge-owned source files for independent review. Original46 registry and MF42 accepted backend receipts remain separate.
