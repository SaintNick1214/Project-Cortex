# Task Judgment: Task04 bounded pure-policy C2

## Verdict: NEEDS REVISION — FINAL

**Average: 3.4/5.** Both C1 defects are fixed on this exact C2 candidate. Fresh independent outcome probes establish a further exact-JSON/identity defect across all four arbitrary record families. Dependent ledger implementation remains held pending a fresh pure PASS. Whole04, full03-final and the overall goal remain incomplete.

This verdict covers only `src/domain/model-policy.ts`, `src/domain/index.ts` and `tests/unit/domain/model-policy.test.ts`. It does not judge atomic accounting, protected backend provisioning, Gateway dispatch or actual model qualification as implemented. No product, candidate, previous QA, Git, credentials, signing keys, network or service writes were performed. All writes are confined to this new review packet and `work/resume/task04-pure-policy-c2-review`.

Applied AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task and feature-orchestrator; read the original approved implementation prompt, decision register, architecture, goal/Task04, frozen Task01 contracts, Task04 preparation/consumer allocations and accepted C11 report. C11 PASS4.6 accepts03-foundation after its actual current matrix, cleanup and retirement; its archived old build is historical and was not rerun as a current-export guard. All original functional03 obligations remain mandatory. Only numerical cycle caps were waived.

## Issue found — blocks pure PASS

`src/domain/model-policy.ts:272`, `:273`, `:282`, `:283` use `z.record(z.string(), z.unknown())` for tool-call input, tool-result output, tool definition and output schema. `validateModelRequest` at `:306` safely detaches JSON, but parsing at `:307` silently strips an own enumerable JSON key named `__proto__` from each record's root. Installed Zod's implementation explicitly skips that key (`node_modules/zod/v4/core/schemas.js:1784`). Nested unknown leaves preserve the same ordinary key, so behavior is inconsistent across depths.

The fresh payload is created by JSON.parse and has an ordinary own data property, with no accessor, iterator, custom prototype or pollution effect. All four families are accepted; each admitted record becomes `{}`. The changed request and the request containing `{}` produce equal canonical bytes and equal hashes; `assertModelRequestIdentity` accepts the pair. This is observable accepted data loss and canonical identity collapse, not a cryptographic digest collision. `run05-fresh.stdout` records all four complete outcomes and `run05-fresh.stderr` retains the failed assertion/exit1. `run03-fresh` independently exposes the tool-definition case.

Preserve every accepted JSON record key safely, or reject unsupported keys explicitly before admission. Never silently erase input. Add outcome regressions for all four families proving either lossless dispatch/canonical identity or deterministic fail-closed rejection; retain old assertions. No authentication bypass or actual provider effect is established by this pure defect.

## Requirements review

| Bounded pure requirement | Result and evidence |
| --- | --- |
|13 registered operations; Decisions/image understanding excluded; media unavailable|Met: source registry, original tests and fresh per-text-operation probes. Registration is not media qualification.|
|Qualified default Chat; explicit Responses/store:false; Messages unavailable|Met: source interface whitelist and unchanged outcome tests; no raw provider fallback.|
|Trusted deployment→tenant→agent→operation precedence; exact scope/version admin proof; hard deployment constraints|Met: unchanged tests and fresh all-six-rank/authorized-override probes. Ordinary rules intersect; specialization hard constraints survive override. Helpers authenticate nobody; trusted backend lookups remain required.|
|Detached immutable snapshot with model/interface/capability/price/full-call ceiling/source/run/parent/authority/profile pins|Met: original tests plus fresh recursive snapshot checks and exact identity pin changes. Synthetic records are not actual prices or authentication.|
|Complete ordered roles/parts/tool IDs/definitions/schema/options; exact canonical identity and collision rejection|Not fully met: normal ordered changes and forced unequal-canonical/same-hash controls pass; four accepted own-key losses collapse canonical/hash identity.|
|Strict canonical arrays/getters/iterators without effects|Met for stated descriptors: original controls, all fallback field getters and nested request getter/array iterator yield zero effects. Noncanonical graphs reject.|
|Fully detached admitted requests; no caller freezing/mutation/aliases|Met: unchanged original C1 probes now pass; C2 tests cover four full recursive families. Fresh shared aliases remain mutable without changing frozen admitted data or canonical identity; rejected inputs remain unfrozen.|
|Safe integer caps, combined context, monetary order and qualification ceiling|Met: original tests and independent ceiling/safe-integer controls. Adapter must independently bound actual tokens/options; ledger derives reserve from trusted complete cost ceiling.|
|Full fixed DEFAULT_EMBEDDING_PROFILE, stable batches and no profile-changing fallback|Met in pure tests/source: all six fields checked by assertProfileMatches; batch identities/ranges and output/tool restrictions. No actual managed index/vector readiness claimed.|
|Conservative compatible fallback, accounted attempt/current checks; visible output/tools/uncertainty/cancel prohibition|Met: original tests and fresh candidate ceiling/caps/options/capability/proof controls. Both C1 counting/throwing accessor defects fixed with zero effects. Eligibility grants no dispatch or accounting authority.|
|Browser/default-Convex pure exports and package public contracts|Met: separate browser bundle60exports/106inputs; no provider/legacy config/root client/graph inputs. VM has no process/require and WebCrypto works; root packed contracts and isolated fresh build pass. No new package domain subpath is claimed.|
|No fabricated second actual model/price/readiness or bypass-governance claim|Met as a limitation: fixtures are synthetic. Existing SDK/provider/template secondary-call conversions remain mandatory Task09/14/15 gates.|
|Whole04/native ledger/Gateway/actual distinct models/quota outcomes|Outside packet, incomplete. Atomic reserve/checkpoint/settlement/recovery and final dispatch whitelist/currentness/token enforcement require accepted later implementation and real receipts.|

## Independent execution

Only installed Node24.19.0/npm12.2.0/local dependencies were used, with prescribed npm CLI and no installation. Isolated source mirror excludes all dotenv/root test setup; subprocess environments carry only PATH, scratch TMPDIR, offline npm cache settings and NO_COLOR. Commands and exact cwd/start/endUTC/exit are saved in exclusive-created started/receipt files; raw streams and inert configs/scripts are retained. Current production hashes were stable throughout. Builds and package temporary files are confined to scratch.

| Check | Observed outcome |
| --- | --- |
|Standalone affected TypeScript|exit0|
|Exact-three-file ESLint, max-warnings0|exit0, empty stdout/stderr, zero warnings|
|Jest discovery|exactly one mirrored model-policy suite|
|Jest outcomes|1suite/30PASS/0FAIL/0pending/0todo; same30 assertion names as producer|
|Original C1 failed probes, unchanged source|exit0; four alias checks now detached/unfrozen and fallback getter effects0/false|
|Existing packed public contracts against copied current dist|exit0: ESM/CJS/declarations/URL/browser|
|Isolated current source root build and newly built packed public contracts|both exit0; production dist untouched|
|Fresh broad corner outcomes, run03|12PASS/1FAIL: exact root own-key preservation fails|
|Four-family own-key/identity probes, run05|exit1; all4 accepted records lose key and canonical/hash identity collapses|

The fresh corner checks include recursive snapshot detachment, shared nested request aliases, no-effect accessors/iterators, no caller mutation on failure, six-scope ordering, deployment specialization after authorized override, fallback qualification compatibility, complete ordered message/tool identity, authority/source/agent/receipt/cost provenance identity and every text operation's structured-schema invariant. Normal controls pass.

Every attempt stays preserved. run02's one setup failure lowered the primary ceiling below an unchanged fallback ceiling; product correctly denied it. run03 changes only that synthetic setup in a new scratch directory. run04 retains the same four observed defects; run05 corrects a probe pass-expression typo and independently reproduces them. `attempt-limitations.md` also records a rejected orchestration syntax input and a missing `.text` suffix in an ad hoc reconciliation read; neither executed product tests or changed source. No failed assertion or old output was overwritten.

The producer packet's complete manifest hashes/byte counts independently reconcile. C1 original test23,110bytes/SHA256 `da443be790853c4785a65d257bccf25fecd336224df2ceaa4684b93f3cca28a1` is an exact C2 byte prefix. Producer run01 preserves24PASS/6FAIL, run02 preserves30PASS/0FAIL. Fresh review independently reruns all30. `independent-producer-reconciliation.json`, source-before/source-after and domain-source-mirror bind these conclusions.

The initial producer14failure/preliminary22PASS disk-history gap remains honest: `task04-pure-policy-contracts-initial-history` archives only visible conversation fragments/config creation. Truncated or missing raw streams/preimages remain missing, and hashes establish only newly archived bytes. No new execution retroactively certifies that original history. Current C1/C2 disk packets and this review's failures remain intact.

## Exact candidate SHA256

| File | SHA256 |
| --- | --- |
|src/domain/model-policy.ts|`943d2e0ee2597ef0386321b50165601fdefceaffb5dbd4283a820967d73be1c4`|
|src/domain/index.ts|`b1bb56d6df91596512f9c1e35b48f8942207bf9651739885eb81f7755d834648`|
|tests/unit/domain/model-policy.test.ts|`1bfb874dc2fe4bac9900c2c699e2985c4925129f55aad03b2f84a1f738acf714`|

## Dimension scores

| Dimension | Score | Evidence |
| --- | ---: | --- |
|Requirement fulfillment|3/5|C1 corrections proven; accepted exact-JSON/identity contract remains unmet.|
|Code quality|3/5|Safe detached boundary and fallback preflight; record parsing silently drops admitted data.|
|Test quality|4/5|30 meaningful preserved outcomes/no skips; fresh own-key regression missing in product tests.|
|Pattern adherence|4/5|Pure seam, exports, isolated independent checks and source-bound history preserved.|
|Completeness|3/5|Bounded exports/reproduction work; further pure fix and independent acceptance required.|

**Average:3.4/5.** NEEDS REVISION corresponds to judge-task's NEEDS FIXES. Repair the exact-record boundary and obtain fresh independent judgment before ledger work. Whole04/full03-final/goal remain incomplete; unavailable or unexecuted live inference/accounting/UI/media coverage is NOT_RUN, never skipped success.
