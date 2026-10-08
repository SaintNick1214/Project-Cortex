# Independent architecture/plan review 1

**Date:** 2026-10-02
**Reviewer:** Native `provider_inventory` subagent, independent of the draft author; reused after a fresh-agent spawn hit the runtime thread limit.
**Verdict:** NEEDS REVISION
**Coverage:** Architecture, goal, all 15 original revision tasks, raw user requirements, runtime/profile/judge criteria and selected source evidence. No implementation/live compatibility certification.

The reviewer found the overall ownership design sound: Agent transcript/execution, Cortex context/memory/policy, Workflow checkpoints, Gateway transport, retained artifacts and explicit Decisions exclusion.

Scores: layer coverage 5/5; test plan 4/5; decomposition 3/5; readiness 3/5; dependencies 2/5; average 3.4/5.

Required revisions:

1. Trusted legacy data adoption was unspecified. Matching new authenticated subject/user rows cannot claim caller-supplied legacy tenant/user IDs. Require administrator-verified binding, quarantine, restartable import/cutover and receipts preventing duplicate memory ingestion.
2. Keeping old vector indexes alone did not preserve post-cutover inserts/corrections/deletes for rollback. Keep the old profile current or replay/rebuild to a verified rollback watermark; exercise all three cases.
3. Client/integration tasks waited on media/vector/graph, contradicting the promised text-first slice. Separate early additive installation and text clients/UI; defer extension-specific prerequisites to their task entry gates.

Additional refinements:

- Define memory watermarks as contiguous stage completion; later successful events cannot hide an earlier failed/pending hole.
- Fence/reconcile remote graph writes that arrive after a worker lease expires or deletion occurs; a local preflight tombstone check is insufficient.

References in the original review used pre-renumbering Tasks 03/05/07/08/09/12/13. The revised tree uses early installation 06, execution 07, memory 08, text slice 09, embedding 10, graph 11, assets 12, media 13, client extensions 14, full integration 15, outcomes 16 and audit 17.

The author revised these points and requested independent rereview. This initial verdict remains NEEDS REVISION; it is not converted to PASS by the author's edits.
