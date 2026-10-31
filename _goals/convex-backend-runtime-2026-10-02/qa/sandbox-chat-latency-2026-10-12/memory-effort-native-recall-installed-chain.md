Installed d4ba passes both original30s tool cases: readonly completed in28.315882s after pending approval at11.681013s; the never-approved write was cancelled in18.119743s with zero result, owned tool effects, continuation or assistant output. Readonly has one exact requestHash approval, one durable native tool result, correct marker, model0/model1 complete and first attempts only. Prior374c's ORIGINAL_DEADLINE failure remains a failure.

The new private path actually ran, but this sample shows **no tool-action speed improvement**: native toolStep is6862.334ms versus6804.213ms (+58.122ms). Workload/history, evidence and platform/provider/network conditions differ; this is an observed comparison, not an isolated causal estimate.

| Native stage in new actual tool request | Execution ms | Read documents |
| --- | ---: | ---: |
| first full checkActiveTool |1100.300|232|
| prepareToolRecall |1313.108|138|
| admitToolRecall |465.189|133|
| terminal capture |875.752|333|
| result attachment |392.151|325|
| prepareToolReads |218.878|59|
| readToolMatches |277.138|96|
| deliverToolRecall |236.533|76|
| rememberToolSources |224.159|335|

These are nested inside the6.862s tool action and must not be added to it. Four other checkActiveTool records have distinct IDs, <=0.056ms execution and zero reads; their repeated userExecutionTime fields are not independent CPU durations. Embedding itself takes326ms; the action-side admit/checkpoint477ms, capture885ms and attach404ms are alternate views of the same chain.

All five new native refs ran exactly once on this actual tool request: runtimeMemoryQuery:prepareToolRecall/admitToolRecall/prepareToolReads/readToolMatches/deliverToolRecall. Separate generic embeddingProfile/checkProfileReady/resolve/admit/checkpoint/readSource/readFacts/finalDelivery outer refs are absent from it. Previously generic setup included profile337ms, readiness385ms, resolve369ms, admit418ms and checkpoint369ms. This proves composition use, not that every removed RPC became a measured saving. Native reservation+child-checkpoint and separate terminal capture/attachment boundaries remain.

Readonly server spans: initial preparation2535ms (recall1655ms), model0 2962ms, tool6862ms, continuation preparation426ms and model1 2702ms. Model0-end to first native approval invocation is4877ms, including collector/guard/polling/Workflow activity; it is not assigned solely to product work. The client28.315882s additionally spans delivery and memory completion. Clocks are uncalibrated and cannot form one exact partition. New initial context has3 entries/907bytes versus prior6 entries/1767bytes.

Production binds the approved tool operation/request, current attempt/lease, version8, exact run budget and completed agent.respond parent/reference/account. Actual readToolMatches/deliverToolRecall cover positive vector/fact/source binding and final delivery; rememberToolSources rechecks merged witnesses before native tool publication. Metadata do not expose exact witness cardinality or prove live adversarial mutation coverage. The run's initial-context and approved-tool query embeddings are distinct operations, not a retry; its later title is separate.

The four-receipt cursor chain is uncapped. Overlapping OCC metadata is merged by executionId, never counted twice. Unique retry metadata identifies observation conflicts with runtimeAgentExecutions writes by recordOutput/finishOperation; runtimeRuns conflicts from Workflow/finalize; approval conflicts with Workflow events; and ingestion scope/event conflicts. The toolStep request itself has no retrying child execution. These are native transaction replays, not paid model retries or an explanation of the full28s. Exact hot-table counts, execution IDs, source pins and limitations are in the paired JSON.

Native regression PASS671; final readback82 checks/0 unmet/stable. All-target finance35 unique operations/35 first attempts,5.4M UNKNOWN, zero reserved/active slots; mirrors excluded, cancellation is no refund. Browser Normal seed6260.1ms misses6000ms. Functional tool PASS does not qualify the browser/CLI SLO or full matrix. Root owns cleanup/status. No live calls, product/helper/P/W edits, tests, builds or Git operations occurred here.
