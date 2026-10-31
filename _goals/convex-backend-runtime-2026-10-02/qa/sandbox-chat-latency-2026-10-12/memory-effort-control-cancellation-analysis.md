# Cancellation latency correlation

Offline analysis of the one original unapproved `memory_remember` run `run:cea154028760db96676a614d9beebc947499c9da6306d4fc4c9c11afb6e8691e`. Source `ef094fc5f724a25470d5da0d74f287b638e83bf0`; target `calm-snake-661` (`6192965`). No service/model calls, source or docs edits, or tests were performed. Exact inputs and hashes are retained in the companion JSON.

The largest exact-run measured region is main model execution at **13.634s**, including **14 serial visibility checkpoints spanning 7.168s**. Recall spans **2.703s** within **3.977s** preparation. The first stream part arrives after **628ms**; it is not a first-text observation. The stream envelope includes awaited visibility and cannot be assigned entirely to provider generation.

| Exact Action measurement | Duration |
| --- | ---: |
| Preparation through `turn.prepare.end` | 3977ms |
| Recall bracket, nested in preparation | 2703ms |
| Main model region | 13634ms |
| First to last visibility checkpoint, nested in main | 7168ms |
| Individual visibility checkpoint reported range | 322–1120ms |
| Main admit/checkpoint | 1121ms |
| Main terminal-evidence capture | 2032ms |
| Main result attachment | 1464ms |
| Official `executeDirectV8` executionTime, enclosing the above | 18710.967ms |

These intervals are nested; they must not be summed. The direct Action joins by run-tagged executionId `5b37fe31-d140-439f-bd73-87a708f97d0b` to request `b966229922f8f227`. It has exactly two unique tagged model traces: `embedding.query` and `agent.respond`, each with one construct event. Three other distinct tagged ingestion traces (`memory.extract`, `facts.resolve`, `embedding.memory`) occur in the snapshot under a different budget; the analyzed evidence does not join them to this cancellation run/source. Preflight bound records are not additional dispatches.

Two actual OCC retries of `captureTerminalEvidenceV8` occur within the 2032ms capture bracket: one conflicts with `runtimeAgent.js:recordOutput` on `runtimeAgentExecutions`; one with `runtimeModelPolicy.js:captureTerminalEvidence` on `runtimeBudgetAccounts`. Four observer retries conflict on the same execution-document hash, with writers `recordOutput`, `finishOperation`, `attachDirectContinuationV8` and a workpool mutation wrapper. These are backend OCC retries, not paid model retries. They cannot be summed with the parent intervals or mapped one-to-one to client observation ordinals.

On the **separate client monotonic clock**, approval first appears at 29268.266ms after 28 observations. Those awaited observe calls total 24886.577ms; 27 explicit collector pauses total 2750.844ms. This collector pause behavior says nothing about browser reactive polling. Before cancellation, the identity check takes 206.162ms; cancellation begins at 29474.478ms and takes 526.092ms, ending at 30000.570ms against the 30000ms original deadline. There is no approval submission and one cancellation submission. The original `ORIGINAL_DEADLINE` failure remains failed; no ACK or cancellation success is inferred.

Later native metadata includes a 2161.211ms `completedModelStep` query inside the same request as a 3428.029ms workpool Action and six generic mutation wrappers. These rows have no exact run/argument join in this snapshot. One wrapper timestamp matches the target execution row's durable `updatedAt`, which is a timing correlation only. Do not subtract 18.711s backend execution from 29.268s client time, infer clock offsets, or claim that these unjoined rows fully explain the remaining delay.

Final readback `memory-effort-control-runtime-readback-1792065768689.json` has 318 checks and 2 unmet verifier expectations. The write run remains `waiting_approval`; zero approvals, results, native tool messages or owned tool effects exist. Its ordinary approved-input memory is complete, and only model 0 exists with no final assistant output. Cancellation ACK remains uncertain; Root owns disposal cleanup. The separate readonly run completed correctly later, while both original tool collectors remain deadline failures.

The next bounded product investigation should inspect the per-part visibility path, observer contention on the execution row, and the post-direct workflow handoff. The measured evidence does not support blaming memory recall or provider generation for the full 29s or promising a specific saving.
