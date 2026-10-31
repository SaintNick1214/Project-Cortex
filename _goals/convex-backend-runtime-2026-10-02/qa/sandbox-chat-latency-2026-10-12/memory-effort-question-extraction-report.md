# Task completion report

Status: source implementation complete and frozen; independent review and genuine next-candidate qualification remain pending.

The current strict-schema policy selects `memory-extraction-assertions-prompt-v6`; the explicit legacy schema-v5 contract and JSON-object-v5 contract remain available. Legacy V4 framing and the original body/contract golden hashes are unchanged. Only the exact current schema-v6 pin selects the new production framer, which also frames the fixed commissioning source. The commissioning policy version advances to2; its official native schema/name and 8192/16384/512/100000 limits, eight calls/2.7M startup UNKNOWN and zero retries remain unchanged.

V6 distinguishes unsupported question/request activity from supported factual content. Supported explicit or strongly implied information, factual remember requests, mixed assertion/question sources and implied relations retain coverage. V6 removes only the trusted duplicate textual validation-schema suffix, retaining the actual native strict schema and all nine-field instructions; a concise clarification replaces the removed duplication. Evidence and returned output remain unmodified. The actual question-derived observation stays visible to the controlled probe and still fails the unchanged exact `{facts:[]}` / `parsedFacts:[]` gate.

Actual conservative serialized-body bounds (UTF8 bytes+9) for controlled identical lineage:

| Source | Legacy v5 | Current v6 |
| --- | ---: | ---: |
| Fixed29-codepoint question |6477|5429|
|1600-ASCII-codepoint asserted source|8048|7000|

Both current bounds are1048 lower, with the same native strict schema and caps. This is request-headroom evidence, not a hosted latency or model-correctness result.

Validation: the final two repaired suites passed151/151 with zero skips and natural exit0. The other two unchanged suites had already passed198+49 tests; latest per-suite union is398 distinct tests across four scopes, not a single four-suite PASS. P probe/qualification passed54/54; after the final concise framer, the framing file passed42/42, retaining the prior12 qualification cases without rerun. Affected TypeScript lint-project and ESLint checks passed naturally. Earlier core attempts remain failed: first exited before recorded suites with its explicit offline environment omitted; the next run had395/397 passes and two newly written assertion errors. The repaired assertions distinguish body serialization order from the old projection hash and include snapshot+request in the validator canonical identity. Raw logs/receipts remain intact.

Owned files: four R core files (`model-policy.ts`, `runtimeMemoryGateway.ts`, `runtimeGateway.ts`, `runtimeModelPolicy.ts`), two existing R unit files, and three P files (fixed probe, default envelope and framing test). Exact before/after hashes are in the paired source-hash JSON; the owned diff reconstructs each pre-edit file and verifies its recorded before hash. P `runtime.mjs`, qualification evaluator and qualification tests are byte-unchanged. No catalog/Chat payload, approval, credential, service or Docker-source pin changed.

No builds, packs, deployments, service/model calls or Git mutations ran. Controlled/mock outputs do not predict native model behavior. Root retains the original739 startup failure/100000 UNKNOWN and owns the one independent source/config review, build/contracts and fresh installed qualification.
