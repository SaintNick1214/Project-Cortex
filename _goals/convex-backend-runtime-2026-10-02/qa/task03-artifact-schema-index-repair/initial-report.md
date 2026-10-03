# Task Completion Report

## Status: PARTIAL

Three exact production edits repair the observed IndexNotUnique deployment blocker: schema.ts removes the artifact by_runtime_scope duplicate; runtimeArtifactAuth.ts candidates and artifacts.ts internal purgeAll reuse original by_tenant_space with identical tenantId/memorySpaceId bounds. No other production edits.

Before edits, exact three sources, all existing artifact fixtures/tests, accepted FINAL4.2 review and actual deploy diagnostics were archived and SHA256 frozen. pre-edit-native.json proves the only duplicate among26 actual exported native tables/174 indexes. post-edit-native.json proves zero duplicates across26/173; direct main source index chains162→161. Native document validators, all other fields/indexes/search/vector definitions, fragment definitions, and all27 artifact registrations' args/returns/visibility are preserved. preservation.json has18 successful exact comparisons.

The new native schema regression executes five outcomes: detector recognizes actual rejected differently named indexes; all exported tables have unique field sequences; the original artifact index is present; actual native count and internal purgeAll select it with exact tenant/space bounds, exclude foreign same-ID tenant/space rows and preserve foreign rows. Original356 assertions/tests and fixtures remain byte-identical.

Discovery finds four suites. All361 tests execute, zero pending:360 pass/1 fails. The unchanged inventory test's frozen catalog composer compares purgeAll's entire declaration to accepted historical source, including by_runtime_scope. Its strict source assertion rejects the required index substitution. Original failure stdout/stderr/JSON/receipt retained. Existing composer/test/fixtures were not modified within this bounded authority. This check remains incomplete until a separately authorized/reviewed preservation composition reconciles only the exact approved substitution.

Root types, backend types, lint types, scoped ESLint --max-warnings0 all exit0. Every command/cwd/exit status is in the individual receipts. No live target/deployment/codegen/services/key/JWT/credentials/Git operation or child work occurred. The actual failed deployment and accepted history remain retained. Task03 and live foundation incomplete; Task04 held; independent repair review pending.

Files modified: convex-dev/schema.ts, convex-dev/runtimeArtifactAuth.ts, convex-dev/artifacts.ts. New test: tests/unit/runtimeArtifactAuth/schema-indexes.test.ts. Scratch only work/resume/artifact-schema-index-repair; receipts only this directory.

final-hashes.json contains exact candidate SHA256; source/ contains reviewable source copies. remaining-runtime-scope-references.txt records current references, all belonging to other tables; no artifact caller retains the removed index.
