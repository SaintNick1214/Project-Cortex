# First candidate review — REJECT

Fresh read-only judge `/root/registry_stats_closure/stats_judge` inspected the full-data candidate before the uniform pending closure. This is an actual rejected implementation review, retained as REJECT.

Critical findings:

- Scoped Boolean conversation/ownerless data probes exposed inaccessible same-space presence through successful counts versus `CAPABILITY_NOT_READY`.
- Direct test `registration.exportArgs` access produced introduced TS2339 in the observed root typecheck.

Scores: requirement fulfillment 2/5; code quality 3/5; test quality 3/5; pattern adherence 4/5; completeness 2/5. Average 2.8/5. Other original declarations independently byte-preserved. Native full-data candidate 27-test run passed but did not certify confidentiality or type safety.

Judge verified full collection/source witness design, relevant negative assertions, and identified pending SDK selector/type followup. The review requires fresh judgment after repair; it does not certify full Task03 or functional statistics completion.

Historical evidence limitation: the original two complete files/declarations were frozen before changes under `work/resume/stats`. The new full-data candidate and test source were not separately frozen before rewrite. The raw 27-test candidate receipt is retained in `rejected-candidate-unit-27.txt`. An earlier 23-test candidate run was observed successful in tool output, then its scratch receipt was overwritten by the 27-test run. It is not reconstructed or relabeled as an exact original source freeze. Source edits and first assertions remain available in session tool history.
