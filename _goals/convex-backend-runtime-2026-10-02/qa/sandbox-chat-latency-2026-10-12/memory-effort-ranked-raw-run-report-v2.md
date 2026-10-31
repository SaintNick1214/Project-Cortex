# Raw run reuse: final focused supplement

Four owned files are frozen for combined review. The product diff remains only the `runById` raw-reader call in `runs.ts`.

The deadline author's original307-test red is preserved. Its single failure was the whole-recall test's exact query sequence expecting five now-reused raw run reads. The narrow correction permits only `runtimeRuns/by_scoped_id`; every other mutable/auth/source order and state assertion remains. Exact query keys/limit identity and reduced initial run-read counts are now explicit assertions.

The entire whole-recall suite passed108/108 with zero skips and natural exit0 in37.16s. True full root `tsc --noEmit` exited0 in42.64s; strict lint of all four owned files exited0/zero warnings in15.30s. Raw commands/exits/logs are linked in the JSON companion. Latest owned coverage composes289 tests across7 suites; prior red outcomes remain unchanged.

No additional product logic, service, inference, build or package effect. Hashes are in `memory-effort-ranked-raw-run-hashes-v2.json`; the complete diff including the new test is `memory-effort-ranked-raw-run-source-v2.patch`. Speed remains unmeasured.
