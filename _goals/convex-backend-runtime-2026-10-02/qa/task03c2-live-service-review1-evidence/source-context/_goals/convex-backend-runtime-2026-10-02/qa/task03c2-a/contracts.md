# Task03C2-A metadata SDK consumer boundary

Authority is the original Task03 verified-identity/alternate-endpoint closure and
Task09 browser-safe modern TypeScript facade requirements, narrowed by the
parent's explicitly delegated metadata consumer correction. User execution of
all17 tasks is already authorized; planning-only cautions in original task files
do not override that authorization. No deployment, live service mutation, paid
inference, staging, commit or push is part of this substep.

Accepted prerequisites: frozen03A inventory/authority, accepted03C1 client auth,
Task03B2A final independent third-cycle PASS4.2 and parent source/schema integration,
and Task03C2-D governance consumer PASS4.4. The complete offline verification base
is signed reviewed MAIN `c92d548368791386c62f39895e381ef6bde2dc86`, containing the
accepted metadata and governance sources. Unreviewed MAIN memory/fact/schema work
is excluded from the isolated declaration/build/browser certification.

## Requirement mapping

| Original requirement / bounded contract | Implementation / outcome evidence |
|---|---|
| Task03 internal helpers stay internal; browser clients cannot invoke maintenance workers | Sessions.expireIdle removes the removed public API reference and returns SessionCapabilityError with zero query/mutation/action/resilience attempts. No worker reference, credential, generated binding, schema or backend visibility change. |
| Task03 scope validation remains meaningful | The unchanged resolveTenantId check executes first. Tenant mismatch keeps AuthValidationError/TENANT_SCOPE_MISMATCH and does not evaluate idleTimeout or dispatch. |
| Keep modern public session method signature/defaults | expireIdle remains Promise<{expired:number}>, reads the existing timeout/default before the capability error, and documents that it does not perform or schedule automatic maintenance. There was no idle-timeout validator in the reviewed source; this patch adds none. |
| Task03 authorization-safe response does not reveal private profile data | Users.update narrows the actual generated immutable.store union via its safe receipt marker. UserProfileWriteReceiptError includes only explicitly copied server receipt fields; no fabricated profile/version/timestamps, caller data, private payload or forwarded cause. |
| Preserve a truthful committed outcome without replay | Error literals are PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE, retryable:false, outcome:committed, requiredCapability:read. Receipt translation occurs after the real resilience operation resolves; exactly one mutation and no post-commit query/retry. |
| Preserve normal hydrated profiles and merge behavior | Hydrated mapping is byte-unchanged. Deep merge/defaults/tenant injection and actual server canonical fields have positive outcomes. Initial read failures remain initial read failures; no blind merge/write is introduced. |
| Nested consumers do not misreport committed writes | getOrCreate and merge source stays byte-unchanged and propagates the error. updateMany rethrows this explicit committed error, including its safe receipt, rather than returning a false zero/unsuccessful count. Earlier items may already have committed; later items are not attempted. Ordinary bulk failures keep existing handling. |
| Task09 modern/browser-safe package boundary and public errors | Both errors are exported from their module and root. Packed ESM/CJS and strict DOM/types[] consumer declarations preserve method return types and literal error contracts. Actual packed Cortex.users and Cortex.sessions run in a browser VM with actual enabled resilience, scoped public-client transport fixtures, no Node globals, no provider keys, no model call and zero network sends/fetches. |
| Preserve accepted work and unrelated source | Only the five delegated source/test files changed. Exact unchanged method, original governance28-test source/QA, accepted metadata source/QA and unchanged reviewed archive file controls are retained in source-boundary.json and snapshot-provenance.json. |

The receipt's `memorySpaceId` is `string | undefined`, matching the actual backend
union for tenant-wide grants. Optional `createdId` is retained only when the server
provides it. The error stores a frozen copy and does not retain the backend object.
The public UserProfile-returning signatures are unchanged. This is a small boundary
correction, not the full Task03C2/Task09 thin facade. In particular, an initial
read-unavailable operation still fails before update; write-only/no-row paths have
not acquired blind writes.

The existing root exports include browser-compatible provider and graph libraries.
Their exact input graph is compared against the reviewed baseline; this patch adds
no inputs. Platform:browser bundling excludes Node builtins and backend implementations.
This bounded task does not redesign pre-existing package exports.
