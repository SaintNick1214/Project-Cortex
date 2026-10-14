# K20 public recall probe prepared

No service call, SDK connection or model request has run. `k20-public-recall-pins.mjs` remains `ready:false` with UNREADY target/artifact pins. The probe refuses native setup until root supplies the accepted fresh source/image/archive/backend-manifest/session/name/ID/expiry, marks these pins ready, and explicitly authorizes one call with `CORTEX_K20_PUBLIC_RECALL_GO=1`.

The probe reuses `createK20DiagnosticContext`, a single explicitly authorized exported alias of the original exact-target management GET/source/image/SDK archive-member guard. It checks actual installed SDK bytes against the immutable archive member, not staging. The alias changed no4000ms authentication cases or assertions; the prior helper SHA80cd9c0728fc9448590516163b1200959ef46f492388ed6c63b32ab11a68d9d6 is retained in the original prepared receipt's priorSharedGuardExport metadata. The current alias/helper SHA and preparation hashes are recorded in the accompanying JSON. The unchanged12privacy tests were not repeated.

One official public `CortexRuntimeClient.recall` receives a new UUID semantic request, synthetic query `What is my favorite color?`, limit10 and the original scoped public API funding behavior. No custom run budget, retries, Agent-private path, model selector, cap or deadline change is introduced. The supplied official ConvexClient allows only original session/defaultProfile read-only mutations and exactly one recall Action, then closes both SDK and borrowed official port in finally. Authentication remains4000ms, each SDK RPC12000ms, the whole guarded probe30000ms. A local timeout never resubmits or asserts server rollback; the original Action may finish later.

API monotonic elapsed brackets only the public recall call, including its original native pre/post-session fences. Owner/auth bootstrap, current default profile and management target checks are timed or identified separately. Named official-port durations and SDK onLatencyEvent phases are bounded scalar metadata; nested intervals must not be added. The result stays private in memory: current default small1536 profile, live delivery deadline, tenant/space/owner attribution, user/tool lineage and the expected existing coral user fact must validate. Saved output contains only booleans, counts, byte counts, revisions and hashed opaque provenance identities. No prompts, result/context/fact strings, vectors, JWTs, credentials or raw errors are retained.

Syntax checks and offline helper tests pass8/8, zero skips; UNREADY refusal, foreign scope/owner, assistant attribution, stale deadline, wrong profile, missing expected preference and extra secret timing fields are covered. The report is preparation evidence, not native recall performance/provenance acceptance.

Once root fills the exact pins and gives GO, invoke once with pinned Node24.15:

```text
CORTEX_K20_PUBLIC_RECALL_GO=1 /Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node Q/k20-public-recall-probe.mjs --session UUID --name NAME --id ID --expires-at EPOCH_MS --source-commit SHA40 --manifest-sha256 ARCHIVE_MANIFEST_SHA64 --sdk-archive-sha256 SDK_SHA64 --image-id sha256:IMAGE_SHA64
```

`--manifest-sha256` is the separate archive/artifact manifest. The backend manifest is pinned independently in `k20-public-recall-pins.mjs`. Run after the fixed four-turn proof/quiet window as root directs. One uniquely named receipt records actual PASS/FAIL, elapsed boundaries, single Action count and client closure; no retry on failure.
