# K21 failed tool continuation: recovered leaf

Repository **SaintNick1214/Project-Cortex**, installed source `03256989da22bde35dff78023c1c3962391a68c6`, exact owned session `2d6e9566-0948-4dd7-8df5-5d7626598a60` / `next-turtle-281` / `6164369`. Run `666cc944a716d927af6103f027e850e16271ce7d25acba16c5f2dfe275b21def` remains **FAILED / INTERRUPTED_REQUIRES_RECONCILIATION**. Its approved `memory_remember` tool succeeded; the subsequent model continuation failed. The successful effect must not be retried merely because the answer failed.

The recovered official Agent failed message has a 45-byte error whose SHA256 is `4e0c6ab82aac20e0095f645c4439a446bd38fbf7c3485c7b1b46ec1dcfba52a1`. It exactly matches the existing source constant **`POLICY_DENIED: request exceeds bounded limits`**. Only its safe classification/hash was projected from the service; no raw canonical, tool or provider content was retained.

The saved supplemental native bounds event independently identifies the refused dimension for ordinal 1, semantic hash `c13081fe…dedfd0`, execution `8bc7ae54-efbb-46c0-abf7-12645f44b14a`, request `1bdcc913358f452a`:

| Dimension | Computed qualified bound | Current limit | Outcome |
| --- | ---: | ---: | --- |
| Input | **41,870** | **32,768** | exceeded |
| Context | 42,126 | 65,536 | within bound |
| Output | 256 | 256 | within bound |
| Tool steps | 1 | 1 | within bound |

This is a **pre-ledger native request-validation refusal**, not a provider response or an AI SDK missing-tool-result failure. `runtimeGateway.ts:412` traces bounds immediately before `validateModelRequest`; its `transformParams` at line 863 invokes this validation before `wrapStream` can admit or dispatch the model. Consequently, the absence of a new ordinal-1 model-policy operation/attempt is expected and does not exclude an input-bound failure. My initial interpretation from that absence was premature; this persisted error and native bounds event supersede it. No cap increase or timeout change follows from the finding.

The Workflow step's generic abort is secondary. The official Agent calls `call.fail(reason)` and `streamer.fail(reason)` from its AI SDK error callback (`@convex-dev/agent/src/vercel/client/streamText.ts:183`); the streamer abort then appears in the Workflow stack. The stored successful assistant tool-call and tool-result share the same hashed tool-call ID, at order 2 / step orders 1 and 2. The failed assistant is order 2 / step order 3, created at `1791978085074.318`. The observed leaf has no MissingToolResults, duplicate/order, invalid-prompt, timeout or budget-exceeded classification. This does not independently prove every serialized request property; it identifies the actual failure that was recorded.

The early-fit gap remains a source boundary to repair. `prepareResolvedModelCandidateV8Handler` calls `fitModelInput` and preflight before starting the operation (`runtimeAgent.ts:1959–1972`), and the fresh context handler repeats preflight (`runtimeAgent.ts:1024–1027`). But `fitModelInput` intentionally returns without dropping optional entries when the checker reports `supported:false` (`src/domain/model-input-selection.ts:90`). The closed preflight projector can return unsupported for message/part metadata or unsupported shapes before emitting a preflight bounds event (`runtimeGateway.ts:473–530`). The supplemental packet retains only the native ordinal-1 bounds event and no ordinal-1 preflight bounds. This is consistent with the existing unsupported-shape fallthrough. The precise property responsible was not projected and is **unavailable**; it must not be guessed as provider metadata, a duplicated message, or a mandatory-group overflow. No optional/mandatory assembled-byte breakdown was retained, so this packet does not establish whether the mandatory group alone fits.

The appropriate next source repair is to reconcile the supported preflight/fitting envelope with the actual official Agent request transformation, keeping the original qualified limits, fresh authority/transcript checks, complete mandatory tool group and native fail-closed validation. This diagnostic does not implement or accept that repair.

Collection completed once: two bounded private ownership lookups to derive the exact run's conversation/thread, then one official Agent `messages:listMessagesByThreadId` read on that thread. All original 256-row / 16 MiB / 30-second bounds held. There were zero mutations, paid calls or retries; **all reader ports closed**, so cleanup can proceed. No extra stream query was made; official aborted stream rows have a five-minute cleanup schedule, and their historical presence was not asserted.

Raw safe receipt: `k21-tool-leaf-native-1791979356110.json`; exit/log: `k21-tool-leaf-native-v1-exit.json` / `.log`. The earlier Workflow failure and supplemental snapshot remain unchanged. Root's finance is 39 attempts, all slots released, 5.8M UNKNOWN ceiling units; ceilings are not actual charges. Root owns cleanup. **Leaf diagnosis 100%; tool continuation remains failed; latency follow-up remains 50%.**
