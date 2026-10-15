# Fixed-method native SHA-256 experiment ready

The original first query failed `HASH_BENCHMARK_CLOCK_DID_NOT_ADVANCE`; raw receipt `memory-effort-control-hash-latency-first-1792066053757.json` remains unchanged. It was uncached requestd259c07626d43acf/execution661106ff-832a-4803-9be8-28f0b168b58d, official175.576227ms execution/31.973842ms reported user, zero DB reads/writes, one query, no reverse. Those totals include both algorithms and do not compare their native performance.

New fixture `memory-effort-control-hash-method-qualification.ts` (SHA `18b2dc9678cd4e80ac3ca88d5bdd3f53fdea8be94833184a08aee24b571e45b0`) exports a **different** internal function `hashLatencyQualification:fixedMethod`. Its method enum selects exactly100short115-byte plus10long32768-byte hashes, with every result checked against the same expected SHA256. No performance/Date clock exists in the fixture. Root compares official uncached per-execution metrics for each separate110-digest query. This is a distinct experiment, not a retry of the failed clock query.

Adapter `memory-effort-control-hash-method-adapter.mjs` (SHA `6f3a6b96e3109deceaec31b465cd2bec1440bbb5482f573f70c8033ab7ec88cc`) reuses the prior guarded adapter. Syntax, inert preflight, isolated strict fixture typing and local registered parity both methods110each pass naturally on Node24.15. Author made no live/service/model/Git/product/host/Proofs changes.

Use the current full native pins, readback and final quiet finance; inspect each mode's receipt before continuing. No automatic pair or retry:

```sh
CORTEX_MEMORY_EFFORT_CONTROL_READY_GO=1 CORTEX_MEMORY_EFFORT_CONTROL_HASH_METHOD_GO=deploy "$NODE" --import "$LOADER" "$Q/memory-effort-control-hash-method-adapter.mjs" --deploy --previous-first "$Q/memory-effort-control-hash-latency-first-1792066053757.json" --readback "$READBACK" --finance "$FINANCE" "${PINS[@]}"
```

This validates the prior actual error/request/oldSHA, verifies all original174installed and174host product files (qualified bootstrap exception unchanged), replaces **only** the exact-SHA existing QA file and issues one official guarded dev --once/typecheck/codegen deployment. The new QA addition is an intentional host change; no unchanged frozen backend closure claim.

```sh
CORTEX_MEMORY_EFFORT_CONTROL_READY_GO=1 CORTEX_MEMORY_EFFORT_CONTROL_HASH_METHOD_GO=webcrypto "$NODE" --import "$LOADER" "$Q/memory-effort-control-hash-method-adapter.mjs" --webcrypto --deploy-receipt "$METHOD_DEPLOY_RECEIPT" --readback "$READBACK" --finance "$FINANCE" "${PINS[@]}"
```

After inspecting COMPLETE/parity/110digests/one uncached official completion:

```sh
CORTEX_MEMORY_EFFORT_CONTROL_READY_GO=1 CORTEX_MEMORY_EFFORT_CONTROL_HASH_METHOD_GO=fast "$NODE" --import "$LOADER" "$Q/memory-effort-control-hash-method-adapter.mjs" --fast --webcrypto-receipt "$WEBCRYPTO_RECEIPT" --readback "$READBACK" --finance "$FINANCE" "${PINS[@]}"
```

Both modes have a30s client observation bound, one-query durable issue locks and no retry. Complete fixed results/API error plus exact official requestId/executionId/executionTime/userExecutionTime are retained; error paths still retain metadata. Native totals include fixed encode/hex/parity/handler work shared by both methods, with one measurement per method; no calibrated CPU/network split or hosted SLO claim follows.

```sh
CORTEX_MEMORY_EFFORT_CONTROL_READY_GO=1 CORTEX_MEMORY_EFFORT_CONTROL_HASH_METHOD_GO=remove-local "$NODE" --import "$LOADER" "$Q/memory-effort-control-hash-method-adapter.mjs" --remove-local --readback "$READBACK" --finance "$FINANCE" "${PINS[@]}"
```

Local cleanup deletes only the new exact-SHA QA fixture; no third redeploy. Deployed endpoint removal remains pending Root's verified immediate whole-target deletion. Current genuine readback's318passed checks/two unmet cancellation-verifier checks remain preserved; no paid retries or cancellation relabeling are introduced.
