# Recall regression: current diagnosis

Repository: **SaintNick1214/Project-Cortex**. The separate website repository is **SaintNick1214/cortexmemory.dev**. No GitHub requests were made; this diagnosis uses local source history and retained disposable hosted measurements.

The new backend runtime changed the work surrounding retrieval substantially. Previously the published SDK recalled memory with parallel vector/fact reads and attached it to an application-owned model call. The current remote-run path adds canonical run ownership, durable dispatch, governed query embedding, profile/readiness checks, model admission and accounting, repeated transcript/source checks, and protected reactive output delivery. In the measured samples, that added path dominates latency. These seconds are not explained by a slow OpenAI answer alone.

The exact locally available source transitions are:

- `6939678976fbc6f309fe34374930bdf404e8152f` (October 3): scoped backend memory repositories and remember/recall services.
- `8143c2a767422757662abf8a7f417ecccf82a11c` (October 8): governed memory and model admission, introducing `runtimeMemoryGateway.ts`.
- `2bc678047e9d5aacfb20440e1f51f7c462b7a3cf` (October 8): governed embedding profiles.
- `d872f768548be3da1783ac9ee613baa187cbd7d3` (October 8): remote Basic template and governed media/private delivery.

The preserved published-source comparison establishes that 0.35 and 0.37 legacy recall retain the same four awaited expressions, including parallel vector/fact reads. Their full sources differ. The currently tested runtime is the unreleased 0.39 continuation introduced after those releases. This identifies the architecture change associated with the new measured path; it does not dismiss the user's near-instant historical experience or assign an exact same-workload version ratio without its original timing/environment.

Latest installed product baseline: `f7c906b2888a410deb81c6a181e4863ca148e43c`, K18, exact disposable target `tidy-emu-328`, now verified ABSENT. First/warm CLI populated recall partitions are disjoint:

| Boundary | First | Warm |
| --- | ---: | ---: |
| Checks and preparation before embedding | 1,056 ms | 1,585 ms |
| Native query embedding | 326 ms | 413 ms |
| Embedding result through governed attachment | 716 ms | 575 ms |
| Remaining retrieval, source witnesses and final delivery | 1,486 ms | 1,486 ms |
| Total recall | **3,584 ms** | **4,059 ms** |

Workflow startup additionally took 825/591 ms in CLI and 935/461 ms in browser. Those inclusive admission spans must not be added to their containing start spans again. Answer inference did not begin until 7,596/7,359 ms after committed CLI run creation, or 3,885/3,060 ms in browser. Processed first answer text took 525/525 ms in CLI and 688/474 ms in browser after dispatch. That includes Gateway/network/provider/processing; internal Gateway-to-provider routing and raw first-byte timing remain unavailable. Protected visibility/output and client transport add further time. All four measured submission-to-visible-text samples fail the 1,000 ms target.

Native conflict records also identify retries on conversation and budget-account rows, including admission/capture writers; background ingestion is a real source of contention. Missing conflict metadata is not proof of no contention. Native engine/user/child timings overlap and cannot be summed into a causal percentage.

The coherent V6 repair addresses direct ordinary scheduling, composed Agent query-embedding controls and native initial-session/admission composition together. Fresh source/authentication/transcript/budget fences remain. A prepared-context shortcut was rejected because installed Agent ordering could write a pending message after revocation before its model checkpoint; the original fresh context handler remains. Source/component checks are not a latency result. New hosted qualification, original deadline outcomes, cleanup and independent acceptance remain required.

Raw supporting joins: `cloud-k18-four-run-delay-chain.md` and `.json`; strict native eight-event proof and finance/cleanup references remain in `k18-native-controls-report.md`. Historical version comparison and Battle receipts remain unchanged in `version-latency-regression-035-037-current.md` and its source receipt.
