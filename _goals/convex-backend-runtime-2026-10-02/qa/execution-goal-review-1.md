# Independent goal review — cycle 1

Date: 2026-10-03. Reviewer: fresh read-only native agent `goal_review`.
Verdict: **NEEDS REVISION**. Average: **3.8/5**.

The reviewer read AGENTS, runtime/profile, pessimistic-judge and goal rubric,
decision register, architecture, goal, prompt and all 17 tasks, plus manifests,
backend config and relevant schema/auth surfaces. No files were edited or live
calls performed by the reviewer. The clean branch contains reconciled dev
`3341d64ddc06f1de26ed525312ef2c1b89b16952` as an ancestor.

| Dimension | Score | Evidence |
|---|---:|---|
| Layer coverage | 5 | Backend/domain, clients/provider/UI, installation, outcomes and docs covered. |
| Test coverage plan | 5 | Auth negatives, concurrency, failure boundaries, stale revisions, watermark holes, profile mismatches, graph fencing and media ownership/limits covered. |
| Task decomposition | 3 | Tasks 02/03/08 need narrower delegated packages and separate receipts. |
| Implementation readiness | 4 | Clear technical gates; default embedding ownership and Task 03 context need clarification. |
| Dependency ordering | 2 | Task 06's live acceptance occurs after dependent Task 07. |

## Findings and reconciliation

1. **Blocking:** Task 06 acceptance required execution after Task 07 while Task 07
   depends on Task 06. Move live execution proof into Task 07; Task 06 independently
   proves installed component/schema/auth/route contracts and host preservation.
2. Clarify fresh default embedding profile selection in Task 01, implementation
   ownership in Tasks 02/04/08 and actual managed retrieval before Task 09 PASS.
   Only additional-profile qualification waits until Task 10.
3. Bound Tasks 02/03/08 into substeps, without changing IDs or acceptance scope.
4. Add architecture/decision/schema/auth context links to Task 03.
5. Reconcile stale Task 17 no-commit wording with current execution authorization.

Parent applied all five corrections; a fresh cycle 2 judge must inspect them.
No failed gate is treated as PASS. Embedded outcome tests satisfy runtime guidance;
excluded Python/legacy migrations/external storage remain excluded.

The user explicitly authorized a fresh isolated instance and uncapped inference
when asked for disposable target/budget. Isolation, eligibility and compatibility
still require observed Task 01 evidence.
