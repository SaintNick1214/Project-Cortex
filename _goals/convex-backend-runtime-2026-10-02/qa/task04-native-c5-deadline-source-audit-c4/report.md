# Original deadline allocation implementation aid

Read-only source interpretation, **not a readiness verdict**. No original122 command, child/compiler/service/native/paid call, Git operation, private actual input or original-source write occurred. Existing C4 launcher files were inspected read-only to identify its allocation; they are not sealed or approved. The prior finite audit remains untouched.

## Exact allocations

| Original location | Allocation and ownership |
|---|---|
| All three `scripts/guard.mjs:9` | qualifierMs=1200000; driverMs=1440000; concurrency=4; rpcMs=12000; nativeClientRpc=2963; processes=6; groups=2. cleanupRpc=256 for extension/regression, 40 for extra. |
| guard reserveTicket, extension/regression:55–56, extra:56–57 | Budget lock waits at most 12000ms. First native ticket creates `scratch/qualifier-window.json` only if absent with startedAt=now and deadlineMs=1200000. Later native tickets read the existing window and reject expired or incorrect limits. Count threshold retains 12 native tickets for cleanup. No window reset occurs. |
| guard qualifierDeadline, extension/regression:36, extra:37 | Validates finite original start and exact limit, returns start+1200000, and throws at `Date.now()>=end`. This absolute end is shared by operations using the same owned native scratch. |
| `qualify-owned.mjs:4` | Synthetic phase launches exact driver through `owner.run(...,limits.driverMs)`. Empty phase imports driver and qualifies in-process. The 24m value is the synthetic **driver-child timeout**, not the qualifier window or a 122-command batch deadline. |
| `process-owner.mjs:47–63` | run calls spawn first, attaches bounded stdout/stderr collection, then installs its timeout timer using passed timeoutMs. Overflow/timer reap the owned group; returned timedOut/overflow remain explicit failures. Final reap is awaited. |
| `driver.mjs:21–24` | session start is another elapsed-time bound. RPC entry increments rpc/active and checks elapsed qualifierMs and active concurrency4. Actual callback uses min(fresh qualifier absolute deadline,lane begun+rpcMs). Result/custody also check that minimum. Active decrements in finally after the admitted RPC path; do not replace with launcher process concurrency. |
| `driver.mjs:37–41` | Scenario scheduling consumes the original qualifier window; per-case cleanup and final two-attempt cleanup run through the same RPC/ticket/deadline machinery. Finally enables cleanupMode; this releases the reserved native-ticket allowance, not a fresh deadline. Primary failure retains secondary cleanup/close failures. |
| `cleanup.mjs:3` | Two-attempt owned cleanup uses a driver session and existing guard/native window. It does not mint extra 20m time. |
| `current-inputs.mjs:11,19–28` | Parent watcher has its own local now+120000ms total deadline. It reads an existing qualifier-window, requires exact deadlineMs1200000, checks now>=start and now<end and unchanged window bytes, and restricts creation receipt timestamps to that same window. Its outputs and repeated source/identity checks consume its own 2m budget. |
| `parent-inputs.mjs:50` | Parent preparation has its own now+120000ms budget; signing/configuration/body/output steps stay within it. This is separate from the qualifier first-native-ticket start. |

`ProcessOwner` separately enforces spawned<=6 and live groups<=2. Reap performs SIGTERM with a 100ms wait, SIGKILL with a 2000ms wait, then a new 2000ms group-verification deadline and two terminal observations. Those bounded shutdown steps are not an allowance for extra qualifier RPCs. Qualifier diagnostics capture bounded child output and cleanup journal evidence, and qualifier finally requires no remaining owned records.

## Launcher implications

A fixed-command launcher must retain each original recipe's clocks, DUMMY clock overrides, exact limit values, shared owned native window bytes, no-reset behavior, callback deadlines, ticket reservations, process ownership and failure identities. Its operational child/compiler timeout is an additional adapter resource bound; using the number 1440000 on every offline entry does not turn it into the original synthetic driver's timing contract.

There is **no original source contract for a single 20m or 24m aggregate offline122 cohort wall clock**. Offline controls create separate DUMMY namespaces, set fake deadlines or test DUMMY ProcessOwner ports. Compiler graph generation does not launch the actual qualifier/driver. Creating a new cohort qualifier-window for them would add a requirement that the originals do not impose.

For future authorized native qualification, the outer ROOT orchestration must coordinate the owned target, first-ticket native qualifier window, synthetic driver, parent preparation/watcher and terminal cleanup. Parent watcher validity is attached to the native owned scratch window; it is not attached to the offline launcher's source-pin cohort. Source-pin cohort binding remains a separate authorization/integrity concern. No ROOT receipt/window is minted by this audit.

Read-only observation: C4 `root-launcher.mjs:8` currently computes each dispatch's `parentAbsoluteDeadline=Date.now()+(own?120000:1440000)`. That is a per-dispatch adapter deadline; this report neither approves its implementation nor requires changing it to an invented offline aggregate window. The exact original distinctions were sent to ROOT/executor, and ROOT explicitly withdrew the earlier proposed offline aggregate constraint.

## Source evidence

`source-evidence.json` contains exact archived lines and fingerprints for all three profiles; `sourcepins.json` lists their original module byte hashes. Key guard pins: extension `2e6f01de9c6337a7490a9c737838468a35b01bedcbcadc8022b9db44425ecb86`; regression `c57909ed570d7e5f462f8e0f03c4908ed51ae22c98b9cfe4c5f06dabc9830960`; extra `fd14dfaf0fa205d62db37617eaf358195a0eb2c28206946cc3d2f5a270ba726f`. Extension qualify-owned `095e7c55803bc4d41b8961cbba65baff83bbb0d1c0d65a326f94259be75b7d49`, driver `8982de1bb9ef59780d6bdf87ef74a8a97f0dee9840a5b350bb423cbf1e427829`, current-inputs `8c227ae78f3b36136ae7d1695c7e2154ef98017e0b0de19693804c05528f0071`, parent-inputs `425d3d17fec02d2d8c88971d6eba2a80ba1ee60260a902fa25e0f5ca509503f5`, ProcessOwner `539df18b7192532513212738f2244a335c12316e394715594685c047c23ef624`.

This corrects the prior aid's generalized cleanupRpc40 sentence: **40 is extra only; extension/regression remain256**. The prior sealed report is not altered. No caps, clocks or source assertions are changed here. Selfseal covers only this audit's deliverables and owned collection script, not mutable C4 or original command readiness.
