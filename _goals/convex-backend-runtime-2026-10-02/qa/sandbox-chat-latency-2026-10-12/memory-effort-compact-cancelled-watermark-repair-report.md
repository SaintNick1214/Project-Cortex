# Cancelled-input watermark repair — source frozen

**Source and focused checks pass; combined non-author review and fresh hosted qualification remain pending.** Original e9 native event15/14 watermarks remain failure evidence. This change makes no claim that the cleaned old target recovered.

Cancellation now uses the existing trusted `ineligible` disposition for an exact preapproval input whose run has been terminally cancelled at attempt0. The helper binds tenant/space/run/conversation/native message, owner, source event/revision/hash and authority to the current unapproved bridge. It refuses admitted work: all three stages must remain pristine and no ingestion job may exist. Stage attempts, pending states and absent receipts stay intact; no completed extraction, source or model result is fabricated. The existing readiness reducer can then cross that explicitly skipped event.

The canonical message remains present and unapproved. A tracked edit before or after cancellation preserves native row identity and canonical revision history; enqueue applies the same trusted disposition to a new still-unapproved revision of the same cancelled run. The retired run remains unapprovable. Legacy `conversations.approveMessage` does not support run-owned bridges. Independently approved input remains eligible, including an explicit tracked edit of previously approved/cancelled input. Existing running/approved ingestion jobs, accounts, leases, source effects and uncertain accounting are not retired by this helper. No schema/table/module/public endpoint was added.

Owned files (frozen):

| File | SHA-256 |
|---|---|
| `convex-dev/runs.ts` | `33b4c83820d9f4e01e80d959b1d2abd2ed68395ee748af3f72fd463dd836677e` |
| `convex-dev/runtimeIngestion.ts` | `f80946a304e88aa5d0f7fef4c3465faf0503260b0891c1b51c6e441ab5f55fe7` |
| `tests/unit/runtimeRuns/cancelled-input-readiness.test.ts` | `373ba9d41ea8f6ecdcfc43027f051c6412e84b3e83e01fb9d4ec2d1a9500c883` |

Final affected check executed all **62 tests in five suites**, with zero failures/skips and natural exit0 (`--forceExit=false`,10.855s). The new suite has16 tests: later approved ingestion/strict facts-vector cutoff completeness in same or different conversation; double cancel; late worker callbacks; tracked edits before/after cancellation; explicit previously approved edit; owner/scope/revocation negatives; approved/running non-interference; exact revision/owner/job/stage contradiction rollback; explicit message tombstone fencing. Existing admission, ingestion stage/context and strict timeout tests also passed. These are controlled registered-handler/component/model-port assertions, not live model or service qualification.

Default-root `tsc --noEmit` exited0 after the final change. Strict owned ESLint (`--max-warnings=0`) and tracked whitespace check exited0. Commands, absolute cwd, raw log paths/hashes and observed exits are in `memory-effort-compact-cancelled-watermark-repair-checks.json`; exact owned patch is `memory-effort-compact-cancelled-watermark-source.diff`. Pinned Node24.15.0 was used; no package install was needed.

Earlier failures remain: first test invocation failed existing environment setup before discovery; the explicit offline unit selector corrected that prerequisite. The next run passed11/13 but two positive fixtures lacked their extraction ledger parent; using the established ingestion extraction fixture corrected setup without loosening assertions. Initial typecheck also found one new callback typing issue, now fixed, plus concurrent ranking-owner narrowing errors, repaired by that owner. All raw red receipts are retained. The test URL is an inert local placeholder for global Jest setup; the selected controlled tests make no service request.

No historical migration/backfill is introduced: previously retained cancelled holes require explicit authorized retirement. Root owns combined review, commit/build and the fresh disposable native/UI window. This task made zero service/model calls, builds, deployments, commits, external-repo edits or new judges. All three owned files are frozen.
