# Title source framing repair

Status: title request repair and full content suite pass; latest full root types have unrelated concurrent test errors.

The automatic title source is the original pinned user question, without the chat answer’s recalled facts. Title-only requests now frame that source as one JSON data value and instruct the model to label its subject/topic, without answering or following embedded instructions. Other content intents retain their original body.

Author-owned source is frozen in memory-effort-title-framing-source-hashes.json; the exact patch is memory-effort-title-framing-author.patch. Parser source is byte-for-byte unchanged; no word-count clamp, retry, app loop, extra model call, source/parent/lease/snapshot/fallback/cancellation or UNKNOWN change.

Validation: 44/44 content tests, zero skips, natural exit0 with forceExit=false. Tests exercise actual handler/Gateway/ledger/provider HTTP-body serialization using injected offline transport; confirm exact body-to-ledger identity, source framing, shared parent account, terminal proof/private result/usage and retained UNKNOWN liability. Fixed mock output is not evidence of live model semantics.

Original three framing regressions failed against the old code. Two pre-existing legacy scheduler assertions expected two Workflows, although base0d919962 already uses direct-v6 for that fixture. Root authorized exact scheduler/Workflow payload assertions; old failures and original assertions are retained in memory-effort-title-framing-failure-history.json.

Root types initially passed. Latest root types failed only in concurrently added tests/unit/runtimeMemory/v8-control-read-scope.test.ts at8/31/46. No changes made there. Affected strict ESLint passes with zero warnings.

- green3: exit 0, signal null, naturalExit=true, 11140 ms; memory-effort-title-framing-green3-execution.json
- types: exit 0, signal null, naturalExit=true, 12899 ms; memory-effort-title-framing-types-execution.json
- lint: exit 0, signal null, naturalExit=true, 5165 ms; memory-effort-title-framing-lint-execution.json
- types2: exit 2, signal null, naturalExit=true, 12822 ms; memory-effort-title-framing-types2-execution.json
- lint2: exit 0, signal null, naturalExit=true, 5073 ms; memory-effort-title-framing-lint2-execution.json

Root owns the combined independent source review and fresh installed actual title validation. No service/model calls, Git mutation, P/W change or subjudge.
