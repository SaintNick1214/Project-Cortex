# Task09 terminal observer repair

A Core run can fail a bounded claim or be cancelled before an Agent execution exists. `runtimeAgent.observe` now returns that real terminal state, with empty parts/approvals and the unchanged cursor. Queued unowned runs remain `not_started`; current reader and source-witness fences are preserved.

The affected registered-handler suite passed 59/59 tests, including three new cases. SDK/backend types and scoped lint passed. The first Jest launch exited in global environment setup before discovery because no URL was configured; its log is preserved. The offline successor used an explicit unreachable loopback URL and controlled handlers.

No run was retried or model called. The separate native D continuation exceeded its unchanged input bound and remains denied. Actual installed readback and whole Task09 acceptance remain separate. Source/report writers are stopped.
