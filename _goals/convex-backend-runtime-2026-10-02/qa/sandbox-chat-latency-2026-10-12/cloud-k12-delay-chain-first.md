# K12 saved browser delay chain

Analysis milestone: 100%. Repository: private Project-Cortex continuation. Source `2a08b37c23dc4066634d2735da219cb5d09900df`; exact K12 nautical-ant-358/6148154. Saved receipts only: no source edit, service call or inference.

First browser after-paint **20515.600ms**, DOM 20489.400ms, admission 3637.500ms. Warm supplement **12415.300ms**, admission 2688.700ms. Both original one-second outcomes remain FAIL. K11 first/warm were 10364.400/11082.700ms; conditions differ, so no causal total-speed claim.

| Successive same-server-epoch interval | First ms | Warm ms |
|---|---:|---:|
| run-created → initial Workflow start | 2513.000 | 1636.000 |
| initial Workflow start → initial Workflow completion log | 1215.140 | 720.989 |
| initial Workflow completion log → separate routed context start | 463.860 | 249.011 |
| separate routed context start → separate routed context completion log | 2170.507 | 2281.950 |
| separate routed context completion log → resume Workflow start | 2111.493 | 873.050 |
| resume Workflow start → resume Workflow completion log | 605.667 | 267.959 |
| resume Workflow completion log → model Action entry | 494.286 | 566.727 |
| model Action entry → native stream dispatch | 4918.048 | 2099.314 |
| native stream dispatch → processed first native text | 626.000 | 530.000 |
| processed first native text → first public write stored/transaction stamp | 1539.000 | 627.000 |
| first public write stored/transaction stamp → first public write completion log | 674.648 | 356.975 |

The front prefix is **9573.952/6595.686ms**, versus K11 5724.407/4863.276ms. Protected model preparation is **4918.048/2099.314ms**, versus 2504.593/3461.724ms. Dispatch→processed first text is **626/530ms**. Orchestration dominates these samples; acquisition remains opaque provider/network/processing, not a universal provider floor.

These are disjoint timestamp boundaries through first public write Completion, not a sum of nested engine/user/child/Workflow metrics or browser-clock timing. Query/mutation transaction stamps are snapshot time; cached userExecution belongs to the original result. No native-write→pixels or unobserved network TTFB subtraction.

V4 actually schedules prepareRoutedContext. Both paths run the full indexed-empty proof after exclusions; no context Action/query embedding/contextSource retrieval is taken. This does not mean the source database was empty. The first context completion→resume handoff alone takes2111.493ms. Ingestion overlaps later model/output; its whole duration is not added to the serial prefix.

| Native root | K11→K12 first docs | K11→K12 warm docs | First engine ms K11→K12 | Warm engine ms K11→K12 |
|---|---:|---:|---:|---:|
| runtimeAgent:prepareModelOperation | 197→197 | 233→233 | 359.813→1067.949 | 1150.712→368.673 |
| runtimeAgent:resolveModelOperation | 146→68 | 164→86 | 582.167→641.889 | 747.167→358.152 |
| runtimeAgent:admitModelOperation | 369→175 | 414→220 | 577.964→1231.986 | 959.396→496.767 |
| runtimeModelPolicy:markVisible | 103→103 | 112→112 | 225.624→682.376 | 455.819→240.272 |
| routed/empty context wrapper | 654→301 | 769→391 | 1149.583→2146.522 | 761.762→2268.418 |

Scoped resolve native reads fell53.4%/47.6%, admission52.6%/46.9%, context54.0%/49.2%. Unscoped prepareModelOperation and markVisible read counts remain identical. This supports raw-scope reachability, with no native per-table hit counter or causal latency proof. First resolve engine582.167→641.889ms while own user177.548→128.556ms; native engine is not pure JavaScript/auth CPU.

Both K12 admission/checkpoint phases have one observed OCC retry: first engine1231.986+1173.028ms inside2437ms, warm496.767+478.648ms inside998ms. Both first markVisible calls have one retry: first682.376+741.421ms inside1528ms, warm240.272+248.047ms inside618ms. Warm terminal capture has three retries inside2309ms after first text. Exact conflicting rows are absent; observation is not proven the cause. Do not add nested attempts to phase envelopes again.

The actual demo has three owners: remote transport watchObservation for text/metadata; watchRun for setRun; finalOnly watchObservation with noop callback for continuous final authority and memory catch-up. Repeated triple acquisitions each retain an independent post-session RPC. Their cursor/page/finalOnly args differ, so exact-request in-flight coalescing cannot merge these measured lanes.

The conservative next change is remove watchRun and setRun(value.run) in the existing finalOnly callback. observeHandler computes publicRun(current.row), state and approvals independently of finalOnly; finalOnly changes rows/cursor only. watchObservation parses/pins run and invokes update even with empty parts, preserving fresh observeEnvelope, independent post-I/O session/principal/generation and all source/media/current-authority/deadline guards. The continuous final authorization observer, deny path, cleanup and transport stay in place. No cache, protocol change or lifecycle handoff is needed.

Checks should prove two owners, unchanged status/memory/approval/cancel updates, final authority revocation/expiry/signout, disconnect/reconnect/unmount and cursor/output/backend guards. Removing one measured duplicate acquisition needs a fresh hosted sample to quantify benefit; the larger Workflow/context prefix remains.

Snapshots retain 488/78 and 801/174 executions/phases, below1000cap. SDK lists remain bounded captures. First-private-text carrier payload/cursor ID is unavailable, so overlapping RPC times are not charged serially or attributed to invented carriers. Prior deadline/auth-code/UNKNOWN failures remain. The local KeyError and report-heredoc SyntaxError are preserved in JSON; no service/product retry occurred.

Exact request/execution joins, RPC counts, cache/OCC/read-byte/own-user metrics, source hashes and input hashes are in cloud-k12-delay-chain-first.json. This trace does not establish complete memory acceptance, account charges or SLO success.
