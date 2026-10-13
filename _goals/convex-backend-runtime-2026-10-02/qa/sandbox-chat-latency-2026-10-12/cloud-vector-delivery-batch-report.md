# Vector delivery initialization batch

Status: bounded source implementation and affected offline checks complete; independent review and fresh hosted outcomes pending. Implementation milestone **100%**. This does not advance the hosted under-one-second result: K7 first/warm stdout was 16.64 / 25.50 seconds and the warm command's original whole-command deadline remains FAIL.

Only `convex-dev/runtimeMemoryRepository.ts` changed product behavior. `checkDelivery` keeps vector iteration and canonical row lookup in their original order, then shares the current selected-profile/run-budget check only for an identical complete profile plus exact budget input in its invocation-local Set. Omitted budget and empty string stay separate groups even though the original profile-reader argument construction omits either falsy value. Initialization enters the Set only after current native policy/profile validation succeeds.

Per-vector authority is still read independently. The entire original hydration loop is byte-identical, fact/source loops and caps are byte-identical, and ordinary `hydrateVectors` still performs fresh profile and authority initialization on every invocation. A private helper contains the unchanged vector/source/chunk/receipt/resource checks. Missing or ambiguous canonical vector rows fail before any profile initialization, as before. Final authority and consumed source/share lifetimes remain after every vector hash. No cache crosses a mutation, query, action, or process invocation. No DB writer, billable call, model loop, retry, deadline extension or limit change was added.

`finalDelivery` remains an internal mutation with application-read-only behavior. A native query called from that transaction participates in its snapshot; repeated identical profile/budget reads establish the same dependencies. Controlled actual-handler tests compare query/index/filter/get read keys, not just table names, and keep every per-vector source/chunk/receipt read. Native OCC behavior on the new source is unexecuted and remains a separate hosted check.

The focused differential suite invokes the actual registered `finalDelivery` and native embedding-profile/ledger handlers with controlled persisted/component ports. Its reference uses the original 7fec delivery algorithm and unchanged hydration core; fixture aliases, frozen clock access and equivalent `at(0)` array lookup are the only baseline adaptations. It covers one/many/up to 100 vectors, interleaved exact budget groups, invalid full-profile and budget inputs, first/late source/hash/currentness/ownership failures, ambiguous duplicates, missing rows, data-share lifetime and permission, final post-hash authority, native Agent linkage and ingestion lease fencing, envelope caps and no partial return/data/financial effects. Positive same-group work scales 1 profile call for 1 / 3 / 10 / 100 vectors; interleaved 5 vectors across 3 exact groups makes 3 calls. Ordinary hydration and later delivery invocations initialize again.

| Check | Result |
|---|---|
| Affected memory/delivery/ingestion/Agent execution regression | 537 tests, 17 suites, 0 skips PASS |
| Final exact-file focused differential suite | 36 tests, 1 suite, 0 skips PASS |
| Root/backend/lint typechecks |PASS |
| Scoped ESLint, zero-warning gate |PASS |
| Byte comparison: hydration loop and source/fact/cap prefix |PASS |
| Independent source/test acceptance |Pending coordinator review |
| Fresh hosted latency and native OCC |Not executed |

All original failed receipts remain. The first fixture run requested 160,000 context tokens under a smaller policy; 16,384 is permitted and preserves production controls. Subsequent harness repairs captured actual `db.get` read keys, selected the exact last-chunk hash rather than assuming a digest count, and corrected strict function types. The final full regression and exact-file focused runs passed; no assertions were removed to hide a product failure.

Frozen files:

- `convex-dev/runtimeMemoryRepository.ts` — SHA-256 `3389b099333df9dbb7d53b88b1671ef2deac22a08d104f59c9b940b26e10ec47`
- `tests/unit/runtimeMemory/vector-delivery-batch.test.ts` — SHA-256 `7744b24a824d4a9656c9382d207bc6fa6dfda9d975d4ea4f6f1f707b7cbfcff1`

Commands, failures, counts and raw receipt hashes: [cloud-vector-delivery-batch-checks.json](cloud-vector-delivery-batch-checks.json). No service, Proofs, immutable kit, Git, other author files or credentials were changed. The next package/hosted candidate belongs to the coordinator.
