# Bounded query source-read reuse

Author complete and frozen against `5aeb14d734ddc0e189cb392f779613bd342720bb`; awaiting the parent combined review.

`visibleSource` and `hydrateVectorCandidates` now use the existing private V8 raw `unique()` reader. Only these two source terminals changed. Every source/currentness/permission predicate and the cold final-delivery fence remain in place; Auth and its shared512-entry/1,000,000-byte bounds/invalidation are unchanged. Public/default/ingestion paths keep original physical queries.

The new registered prepare/read/delivery/save/candidate A/B oracle observed **33→10 physical source unique reads** with identical result, canonical model body, application/database state/effects, native call sequence, happy-path ordered guards and all other physical reads. This is a controlled two-source/two-vector fixture, with zero model dispatch; it does not establish hosted latency savings. Source/lease/grant/duplicate/revision/permission negatives and late source/grant changes at the original cold fence retain their outcomes. Three negative cases compare ordered originating-callsite predicates plus exact global predicate counts because existing concurrent branches can interleave differently.

| Check | Observed result |
| --- | --- |
| Initial focused | 9 PASS / 3 FAIL, preserved; concurrent negative guard-interleaving assertion repaired |
| Focused v2 | 12/12 PASS, natural0 |
| Initial affected | 17 suites, 800 PASS / 1 FAIL, zero skips, natural1,52.162s; preserved |
| Repair subset | 2 suites,153/153 PASS, zero skips, natural0,16.581s |
| Latest applicable coverage | 801 unique cases in17 selected suites:648 in15 unchanged passing suites plus153 latest repair cases; no single all-green17-suite rerun claimed |
| Full TypeScript / strict affected ESLint / diff check | PASS, natural0 |

All test commands used Node24.15 and explicit dead local `http://127.0.0.1:9`, with `forceExit=false`. Exact commands, raw logs, Jest results and natural exits remain under this report's namespace.

The sole affected-run failure was an older snapshot-parent physical-read comparison treating one newly retained source row as mutable. Only that case now disables the two new terminal routes through a test-local wrapper; every original case/assertion remains unchanged and all other whole-recall cases keep this candidate active. The new registered oracle independently compares both candidate modes. Existing source-root and managed-scope suites continue to cover raw unique errors/cardinality, detached values/nulls, bounds, tenant/owner isolation, clocks, every writer form, failures/in-flight epochs and fresh invocation/fence behavior.

Frozen files:

- `convex-dev/runtimeMemoryRepository.ts` — `74db9e134b83cf4e296fa3ac983de59cbf9c1c4326b669613a39f6537a26bef0`
- `tests/unit/runtimeMemory/query-source-read-reuse.test.ts` — `c7da60b820d4ecd86949a7e14d6abcce7e8e75009b76b130c0fd704945241420`
- `tests/unit/runtimeAgent/whole-recall-composition.test.ts` — `2f70fb8165d5414abcf90709ca40b7498578ab72aa4b4c61347accc0abecc1bb`

Manifest: `memory-effort-query-read-reuse-source-hashes.json`, SHA-256 `3856b16c8ec541b06ba68fed0f651de6774072196e1084acdb90f29e28072006`. Auth remains `b830ece95b342f505b7e81000d2bd675d6dac1caa923f7e3ed78075e7dfb28b6`. Prior two-file manifest is preserved as `-source-hashes-v1.json`.

No batching added: chunk/receipt metadata in hydration could overlap only after source validation, but naive parallelization changes early physical/error work and work/deadline behavior. No additional family, service/model call, build/deploy/pack, Git mutation, or P/W edit. Installed5aeb remains a separate unchanged qualification.
