# K23 browser critical path (saved evidence only)

Repository: SaintNick1214/Project-Cortex. Actual installed source `efcc91d2317dadcb143c5cf1929504bd0cbee3a6`. Both replies completed; first visible paint was **3,927.2 / 8,495.3 ms**, so **0/2 meet 1,000 ms**. Browser admission delivery was 960.3 / 1,737.0 ms. No native calls, product changes, tests or retries were performed for this diagnosis.

The warm sample's largest measured pre-dispatch control region is the main V8 admission/checkpoint call: **2,355 ms**, with a real `runtimeBudgetAccounts` OCC retry. It is not private recall: both direct preparations produced **zero context bytes**, selecting 1 / 3 canonical messages and no memories, facts or pending entries.

| Disjoint owning Action/server epoch interval | First ms | Warm ms |
| --- | ---: | ---: |
| Fixed admission epoch → direct prepare entry | 755 | 799 |
| Direct preparation caller interval | 528 | 507 |
| Prepared candidate → main admission/checkpoint begin | 236 | 490 |
| Admission/checkpoint begin → main native stream dispatch | 636 | 2361 |
| Admission epoch → dispatch (sum of preceding four) | 2155 | 4157 |
| Dispatch → processed first text (Gateway + network + provider opaque) | 693 | 577 |
| Processed first text → first visibility acknowledgment | 216 | 358 |
| Processed first text → first recordOutput completion | 441.447 | 671.685 |

The last row includes visibility and durable output; it overlaps the previous row. None of these server intervals is added to browser monotonic paint timings. Native `executionTime` and timestamp differences are retained separately; they are not interchangeable.

## Actual registered parents and unchanged terminal ports

| Native completion | First engine ms / docs | Warm engine ms / docs |
| --- | --- | --- |
| submitAndStartEnvelope | 622.861 / 177 | 829.436 / 181 |
| prepareDirectTurnV8 | 515.700 / 276 | 484.926 / 422 |
| First fresh hydrateExecution | 143.425 / 23 | 367.726 / 30 |
| admitPreparedModelOperationV8: conflicted then successful | 255.269 + 304.716 / 107 each | 1165.921 + 1146.344 / 141 each |
| First markVisible | 202.402 / 38 | 345.907 / 45 |
| First recordOutput | 212.753 / 24 | 280.086 / 31 |
| captureTerminalEvidence: conflicted then successful | 238.232 + 239.555 / 118 each | 1466.225 + 747.456 / 127 each |
| attachTerminalResult | 207.433 / 110 | 411.238 / 119 |

Each row is joined by the exact owning Action request ID and native execution ID, with those identities and raw scalar timestamps retained in the JSON. The two native admission rows per run account for all four observed `admitPreparedModelOperationV8` completions. The failed OCC attempts wrote zero application documents. `willRetry:true` with retryCount 0 is an actual first conflicted execution, not evidence of zero retries or another paid inference.

Both main admission conflicts target the same hashed tenant budget-account document (`ada97d5e366f73a4df2c019424feccb11dee71b8d69898e5f6ca322bb9ebfbba`), writer `runtimeModelPolicy.js:admit`. Both terminal capture conflicts target their run's `runtimeAgentExecutions` row, writer `runtimeAgent.js:recordOutput`. First finalize also retries twice against `runtimeIngestionScopes`, writer `runtimeMemoryContext.js:refreshWatermarks`; that occurs after first text and is separate from admission.

## Why five new endpoint counts are zero

`runtimeAgent.ts:2048–2067` calls original routed preparation and candidate preparation directly inside `prepareDirectTurnV8`. `prepareRoutedContextV8Handler` (`1957–1977`) returns NEEDS_ACTION only for >1024 events or an eligible source not represented by selected transcript pins. Otherwise `prepareEmptyContextV8Handler` (`1935–1954`) repeats pending/profile/readiness/save/empty-proof checks and returns COMPLETE. `finishTurnV8` (`2008–2020`) invokes `recallAgentMemoryV8` only for NEEDS_ACTION.

The successful observed direct-parent return, zero context candidate trace, and absence of recall phases therefore establish that these two browser runs took local empty completion. The outer candidate/prepareTurn/save endpoints are composed bodies on this path; the private embedding prepare/admit and recall prepareReads/readMatches/finalDelivery endpoints are **not invoked**, rather than missing required qualifications. Their zero counts do not measure their speed or coverage.

`runtimeMemoryContext.ts:134–153` excludes selected canonical and pending source keys while scanning eligible events at the captured cutoff and conversation boundary. Indexed memory being COMPLETE does not itself require recalling data already represented by the selected canonical input. The saved native ingestion commit rows finish before warm admission, consistent with first-memory COMPLETE. However this collector intentionally omits event IDs/arguments, source keys and private rows; it cannot prove precisely which first-event keys were excluded, reconstruct authoritatively unrepresented candidates, or establish a stale-state bug. No indexed-scope-hint field is consulted to certify empty here. The first/warm selected-message counts are observed, but their exact source identities are not retained in this packet.

## Retention applicability and next concrete region

Installed official Convex **1.46.0** implements synchronous `normalizeId(tableName,id)` through `1.0/db/normalizeId` and accepts `patch(table,id,value)`, `replace(table,id,value)` and `delete(table,id)` (`node_modules/convex/src/server/impl/database_impl.ts:60–81,137–166`). The relevant original Agent/model-policy writes use those exact explicit signatures. `runtimeAuth.ts:194–208` classification is therefore not inherently inert due to native arity or async normalization. Actual per-family retention hit counts were not instrumented and remain unavailable; document counts alone cannot prove how many hits occurred.

The native **warm main admission** is the largest measured pre-dispatch region in this browser pair. Its account conflict and 1.15-second successful engine cost remain despite 141 document reads. Keeping the shared financial account's atomic ceilings/slots correct precludes promising that raw authority reuse removes this OCC. Account sharding/escrow would change the financial contract and is not proposed.

The original **captureTerminalEvidence / attachTerminalResult** ports still receive unscoped contexts (`runtimeModelPolicy.ts:1135,1179`; `runtimeGatewayBackend.ts:28–29,96–99`). A next private V8 invocation scope can target their repeated authority/policy/exact-message reads with all current run/source/lease/account predicates re-evaluated. These two mutations must remain separately durable: charge accounting survives attachment denial/revocation, and selecting a V8 producer must never add a pre-account authorization gate. Their measured browser costs are primarily terminal completion costs, not earlier first dispatch. Populated CLI recall is required to measure embedding terminal costs on the actual repaired branch. The protected first-output path additionally costs 441 / 672 ms to durable completion; no source/authority/expiry/visibility fence may be removed to reduce it.

Compared with K22, K23 browser has an explicitly different context condition: K22 recalled for 2,336 / 3,346 ms and used populated context; these two K23 runs did not recall. The smaller browser total is not causal evidence for the retention batch. The report makes no native acceptance or subsecond claim.

Saved-browser diagnosis milestone: **100%**. Overall latency follow-up: **50%**, unchanged.
