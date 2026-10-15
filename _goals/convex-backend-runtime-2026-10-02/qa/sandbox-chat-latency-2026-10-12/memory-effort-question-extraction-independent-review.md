# Independent review — question extraction v6

**PASS — source/test/config batch only.** Fresh independent non-author reviewer; acceptance-policy v2. All five dimensions score **4/5**, average **4.0/5**. Zero unresolved breaking findings.

Reviewed all six changed R files and actual three P changes against HEAD `73999057f6dc8541285a0440815848438ccc31fe`. Reversed the owned diff in memory and verified all nine baseline/final hashes. The 47-file coherent manifest matches before and after review (`269beee28ba475a5cc9e853dd7d99450bd3c0ed03b07b25ae42bdd6744d0af00`). Changed P3 and preserved P3 also match exactly. Exact base and final maps are in the paired JSON.

| Requirement | Evidence and result |
| --- | --- |
| Unsupported questions/requests add no facts; supported facts remain eligible | V6 trusted rule at `runtimeMemoryGateway.ts:65-72`; six controlled question/request/assertion/mixed/implied cases preserve evidence and outputs. |
| Historical request identity remains stable | V4 function equals base bytes; JSON-object-v5/schema-v5 golden hashes, historical native body, and version mismatch rejection pass. |
| Native strict schema and product controls remain | Exact v6 selection at `runtimeMemoryGateway.ts:177-178`; policy/domain/backend validate both supported pins while retaining model/schema/bounds/zero-retry controls. |
| Current probe uses production helper | Probe imports v6, envelope policy advances to2, AST/official-transform tests verify identical production framing. |
| Parser and qualification gates remain strict | Bad observed question-derived output remains visible and fails unchanged exact `{facts:[]}` / `parsedFacts:[]`; no filtering or paid retry. |
| Request headroom retained | Only trusted duplicate textual schema is removed; native schema/nine-field instructions remain. 1600-codepoint bound regression passes; recorded controlled bounds decrease1048. |

Independent execution used **Node24.15.0/npm12.2.0**, explicit offline environment, controlled ports/fetch, Watchman/cache/force-exit disabled:

- Core: **151/151**, two suites (130memory gateway+21strict schema), zero skipped/todo, natural exit0 in7.743s.
- Proofs framing+qualification: **54/54**, zero failed/cancelled/skipped/todo, natural exit0 in0.880s.
- Existing affected type/lint and Root build/contracts log hashes verified; passing checks were not repeated.

Earlier failures remain history: omitted explicit offline environment, then395/397 with two new assertion errors. Their fixes correctly use the legacy projection serialization order and the validator's snapshot+request identity. The398 distinct four-suite total is a per-suite union, not a single four-suite green run. Original739 startup failure and100000 UNKNOWN remain unchanged.

No source findings require revision. The tests establish framing, compatibility, strict schema, accounting/replay wiring and unchanged failure gates through controlled ports. They do not establish native model correctness or installed behavior. Fresh installed v6 qualification, actual3/6/8/30s outcomes, cleanup and final audit remain pending. Goal remains **4/6=66.7%**; video is deferred. This review makes no GitHub, service/model, install/build/pack, product/test/P/W/Git mutations.
