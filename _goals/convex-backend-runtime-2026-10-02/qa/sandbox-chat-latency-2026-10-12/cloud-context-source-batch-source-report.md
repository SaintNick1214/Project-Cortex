# Ordered Agent context-source batch

Implementation/check milestone: 100%. Repository SaintNick1214/Project-Cortex; baseline `2dd1c8474392322b71606a8dd8ee2df64b9fe0c5`. Frozen for one combined independent review with the separately owned ingestion repair. This is source and controlled-handler evidence, not hosted speed or service acceptance.

The new internal query runs one ordered branch of at most 100 items. Each item invokes the byte-identical original contextSourceHandler, then immediately performs the original witness/provenance merge. Missing/excluded items, duplicates, expected event/revision/hash, cutoff/boundary, owner/share/tombstone/currentness checks and first-failure ordering remain. Prior witnesses are conflict bookkeeping, never authority. No source/authorization cache, deduplication, parallel guard loop, financial mutation or table was added.

prepareContext sends one query per nonempty branch and zero for empty branches. Facts still wait for vectors and use their prior witnesses; staged commit preserves vector-first binding/witness/provenance order. The existing single-source endpoint remains. Exact native argument projection preserves optional hashes. Returned selection indexes and witness/provenance metadata avoid sending source content again. Input caps are 100 items, 200 existing witnesses and 100 prior vector witnesses. The original final 32-witness and 16,384-byte context overflow checks remain in place. Fresh finalDelivery, action-clock delivery expiry, saveContext and later model/source checks remain.

Real original single-source handlers and the new registered batch agree at 0/1/3/33/100 items, with identical getter order and no writes. Direct negatives exercise event/revision/hash/missing sources, foreign scope/principal, revocation/expiry, tombstones, duplicate stored rows and native argument overflow/extra fields. Other cases cover current/prior state, null filters, duplicate selection, permission unions and early witness conflict before a late source failure. Both original getters and later-item authority checks still run.

Existing Action regressions preserve exact context bytes, source order, delivery bindings, witness permissions, asynchronous branch settlement, error priority and failures without delivery/save. Post-batch finalDelivery/save refusals remain tested. Physical transport assertions now require two batches instead of four individual RPCs; old fault hooks now reach the actual batch/native getter boundary. No functional, output or final-fence assertion was dropped.

Verification: 1247 tests across 44 suites; zero failures/skips/todos. Focused files: tests/unit/runtimeAgent/context-source-composition.test.ts (56 passing), tests/unit/runtimeAgent/context-source-batch.test.ts (25 passing). Root/backend types, scoped lint, root lint, build and public contracts exited 0 under Node 24.15.0/npm 12.2.0. Root lint retains 237 existing warnings; scoped lint has none. Build remains 157 backend files, 72 tables and two components. DB/component/embedding ports are controlled; graph services are outside this selected unit gate.

Original v1 failures remain: the new zero-old-endpoint assertion accidentally used the batch name (77/78 passed), and a new afterEach callback returned Jest instead of void. Corrected without removing assertions or guards. A QA report-formatting TypeError after freeze creation is separately retained in cloud-context-source-batch-report-observer-v1.json; only report formatting was corrected, with no build/test repetition. No service, inference, deployment, packaging/Proofs, website, Git or Union Arena action occurred.

AST comparison preserves contextSourceHandler/endpoint, all V1–V5 Workflows/callbacks and final save/empty/routed/model parents byte-for-byte. Existing declarations changed only refs and prepareContextHandler; new declarations are the batch type/helper/query. The ingestion owner's frozen product/test bytes are unchanged; complete protected hashes are in the equivalence receipt.

Frozen files:

- convex-dev/runtimeAgent.ts: 1951ca05914bc4f275d4dc9c8f00f26160046c199bb66f1e65cdab06ac95aed0
- tests/unit/runtimeAgent/context-source-batch.test.ts: 9f3f4ce30d7859b6e29c55a4cb91c5c6a7509c3745c69e90900e3b03a3cea3da
- tests/unit/runtimeAgent/context-source-composition.test.ts: fbe3961f62cd3c80c89bec00156e5eed44575eaea96bf4afa0e83622327ba1d7

Receipts: cloud-context-source-batch-freeze.json, cloud-context-source-batch-equivalence.json and original/v2 raw checks. Observed K16 six/nine source handoffs can become at most two; all source work remains. No elapsed-time saving or subsecond result is claimed. Root owns combined independent review and one fresh installed hosted qualification.
