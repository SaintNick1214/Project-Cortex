# Transcript/A2A SAFETYONLY repair, cycle2

Status: repaired implementation awaiting fresh independent task judgment. The first independent REJECT3.2 remains unchanged in its original directory and is copied under `rejected/`; its two confidentiality failures are real rejected-history evidence. No original Task03 functional acceptance or currentguard live/aggregate gate is marked PASS; Task04 remains held.

## Confidentiality repair

The rejected guard inspected caller-selected conversation/fact/share/snapshot tombstones without knowing source ownership. An own-only caller could distinguish foreign source deletion through FORBIDDEN versus CAPABILITY_NOT_READY. The repair removes every caller-source-ID tombstone lookup and all41 source-list arguments from the public guard calls. No source label, presence, pending state, owner or deletion control contributes to admission or readiness. The unsupported stage cannot read/write/dispatch/resurrect a source, so no source-state lookup is necessary for its safety.

Only verified issuer/subject, trusted principal/membership/grant and concrete tenant/space currentness establish admission. Read and write capabilities retain their original separation. Current authority scope/tenant tombstones, epoch/generation/expiry/deletion/revocation and two matching bounded pinned-reference sweeps remain mandatory. The accepted pure `resolveAuthority/resolveAuthorityReference` policy and strict `operation` envelope classifier are reused through a narrow protected reader, rather than modifying shared auth. A final deadline check occurs after the last reference await.

The narrow reader copies returned control values by own data descriptors before policy can inspect them. Returned identity issuer/subject are captured by own data descriptors into a fresh ordinary object. Accessors are rejected without invocation; Proxy/descriptor/callback failures become a fixed opaque infrastructure error even if their thrown payload is an exact FORBIDDEN envelope. These failures never become candidate pruning, ordinary policy denial or authorized readiness. Ordinary missing/invalid authority retains its original error codes.

Every healthy authorized public path still rejects with fixed version1 CAPABILITY_NOT_READY/not_dispatched. All seven internal operators remain internal and uniformly unavailable. Original argument validators and original body statements remain byte-preserved; only the now-unnecessary source-list guard argument is removed. Promise<never> guards remain unconditional first statements; temporary dead legacy bodies still preserve inferred SDK return shapes and must be replaced by the proper functional adapters.

## Test/history reconciliation

Before repair, exact six rejected backend files plus the rejected native test source were copied and SHA256-frozen in `rejected/`, along with the837 outcomes/positive controls, full330 independent probes and both failure receipts/review. `test-changes.patch` explicitly records changes; no rejected outcome was relabeled.

The old source-deletion test's expectation changes from FORBIDDEN to complete envelope equality with healthy unavailable control. It now asserts that every observed tombstone read is solely a tenant or memorySpace authority fence, including initially/late injected scoped/tenant-wide source tombstones. Existing zero-private-read/output/write/effect assertions remain. The old source-read fault probe remains an opaque infrastructure-fault test at the authority fence; its former source read no longer exists. This strengthens foreign-source nondisclosure while preserving mandatory authority deletion checks. Canonical owned-source tombstones, single-Agent direct access, share redaction/locks/revisions, A2A routing, stale completion/invalidation and actual derived repair remain original mandatory Task05/07/08 gates.

New287 cases across all41 public handlers probe returned issuer/subject accessors, principal/membership/grant control accessors, identity descriptor Proxy faults and inherited identity accessors. Exact FORBIDDEN failures yield REGISTRY_OPERATION_FAILED with zero getters/private reads/effects. The full native suite now has1124 cases. The untouched independent330 probes replay against the repaired source, with both formerly failing foreign-source envelope-equality probes now passing. Executor replay is regression evidence; fresh independent judgment is still required.

## Observed affected checks

- Native registered-handler suite:1124/1124 PASS, no skips; actual48 healthy unavailable envelopes frozen in `positive-controls48.json`.
- Unmodified original independent probe suite replay:330/330 PASS, no skips; original328/330 rejected receipt preserved.
- Scoped backend/tests TypeScript and affected-file ESLint: PASS.
- Import-aware current259 inventory resolves every registration without unresolved exports; bounded48 unchanged registration/visibility counts. Separately owned asset changes affect the global visibility totals and are not this executor's edits.
- `git diff --check` on the bounded product/test paths: PASS.

Only the helper,41 guard call arguments, native tests, this new repair evidence and `work/resume/transcript-repair` were changed by this repair. No shared-auth/schema/SDK/assets/other backend changes, services, models, deploys, commits or children. Fresh candidate hashes and exact per-registration manifest identify the source to review; historical foundation hashes/receipts remain unchanged. The original251 source/validator freeze remains under the foundation directory.
