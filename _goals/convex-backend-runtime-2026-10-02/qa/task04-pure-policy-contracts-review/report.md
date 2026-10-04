# Task Judgment: Task04 bounded pure policy contracts

## Verdict: NEEDS REVISION

The pure packet cannot pass on the exact candidate reviewed. Independent checks pass, but fresh outcome probes establish two request/input contract gaps. This verdict covers only the three pure files, not whole Task04, accounting, Gateway dispatch or live inference. Judges inspected without editing product, previous QA, Git, services or credentials.

Applied AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task and feature-orchestrator; consulted the original implementation prompt, decision register, architecture, goal/task requirements, Task01 contracts and Task04 preparation/consumer allocations. Accepted C11 foundation report SHA256 is `1a932577bb99317891942d44f80756b9270d086f1cbc0c6ad45f8416c28fb274`. Its old operational/dist acceptance is not a check of newly changed Task04 exports. Full03-final and every original functional/restoration/final-goal criterion remain pending.

## Issues found

1. **Must fix: nested request data is retained and caller objects are frozen.** `src/domain/model-policy.ts:272`, `:273`, `:282`, `:283` use `z.unknown()` leaves. `validateModelRequest` parses these at `:306`, then recursively freezes the returned graph at `:347`. Nested tool definitions, structured output schemas, tool-call inputs and tool-result outputs retain the exact original object references. The independent probe observed `sameReference:true` and `callerFrozen:true` for all four families. This contradicts the producer's detached-request assertion and creates an observable mutation of caller-owned data. Detach the complete validated JSON graph before freezing it; add outcome tests proving original nested objects remain mutable while admitted data stays frozen and unchanged after caller mutation.

2. **Must fix: fallback evidence accepts and executes accessors.** `canFallbackModel` at `src/domain/model-policy.ts:369` invokes `safeParse(input)` directly without the descriptor-safe JSON preflight used by resolution/request validation. A synthetic `outcome` getter executes once and the function returns `true`. This is an input-side effect and inconsistent fail-closed handling of unknown evidence. Reject noncanonical objects/accessors without evaluation, preserving the boolean false contract for invalid fallback evidence; test a counter and a throwing getter. This is a pure validation defect, not a demonstrated provider execution or authentication bypass.

No product fix was made by this judge. `fresh-probes.stdout` retains all observed values, `fresh-probes.stderr` retains the intentional failed assertion, and its receipt records exit 1. No failing probe was weakened or retried away.

## Requirements review

| Bounded requirement | Result and evidence |
| --- | --- |
| All 13 approved operations; exclusions; media unavailable | Met. Registry plus unit outcomes; Decisions/image understanding absent; synthetic media receipts cannot establish readiness. |
| Default qualified Chat, explicit Responses/store:false, Messages unavailable | Met. Unit outcomes, strict options/native-interface selection. |
| Trusted deterministic deployment/tenant/versioned-agent/operation precedence; ordinary intersection; authorized override within deployment hard constraints | Met in pure resolution. Exact scope/version/override matching, ambiguous records rejected; scalar precedence/order and specialized hard caps reviewed. Authentication remains a required backend lookup. |
| Immutable model/interface/prompt/schema/tool/price/bound/profile/authority pins and complete provider-charge ceiling | Met for resolver snapshots. Qualification requires positive integer ceiling, provenance and coversAllProviderCharges:true. No actual price knowledge is established by synthetic records. |
| Exact normalized ordered message roles/parts/tool IDs/options/definitions/schema; canonical identity and collision rejection | Met for identity binding, subject to request detachment defect. Fresh role/run/parent/authority-generation changes alter hash; equal hash with changed canonical conflicts. |
| Strict JSON arrays/accessors/iterators without effects | Met for canonical serializer/request array preflight; not met consistently by fallback evidence. Fresh accessor array rejects with zero effects; fallback getter executes and is accepted. |
| Fully detached frozen requests | Not met. Four independent nested families retain references/freeze input. |
| Safe integer bounds, combined context, monetary ordering and qualified reserve | Met. Existing outcome tests and fresh unsafe-integer/ceiling probes pass. Token declarations themselves are not independent provider bounds. |
| Fixed full DEFAULT_EMBEDDING_PROFILE, stable batch identity, no profile-changing fallback | Met in pure checks. Managed inference/index qualification remains required before text acceptance; none installed here. |
| Conservative fallback after accounted safe proof/current checks; no visible output/tools/uncertain paid/cancel replay | Met for ordinary JSON evidence; malformed accessor evidence remains a fix. Eligibility alone grants no dispatch/accounting authority. |
| Browser/default-Convex domain seam and exports | Met. Independent browser bundle:60 exports/106 inputs; no provider/credential/legacy config/root constructor/graph modules. Separate VM execution has no process/require and WebCrypto hashing works. Packed existing root public contracts pass; this does not add a package domain subpath. |
| No model/budget/auth rights from caller records | Met as a pure API limitation. These helpers have no storage, token mint, provider constructor or dispatch. Backend must supply trusted records and independently enforce current authority, accounts and low-level parameters. |
| Full04 actual model/accounting/Gateway/native outcomes | Outside this packet and incomplete; not accepted by this verdict. |

The consumed contract is appropriately explicit: ledger reservations must derive from the immutable trusted qualification ceiling and be atomic against trusted tenant/run/concurrency accounts. The final Gateway wrapper must compare/whitelist actual params, dispatch exact normalized messages/texts and independently enforce conservative token/output/tool/time bounds. A caller's declared count/reservation, fabricated qualification or policy record never proves authority or actual price knowledge. Distinct synthetic fixture models do not establish a second actual qualified model. Later SDK/provider/template title/artifact/suggestion/embedding conversions retain their mapped Task09/14/15 gates; pure registration does not govern those existing paths.

## Independent execution

Existing Node24.19.0/npm12.2.0/local dependencies only. Source copies under `work/resume/task04-pure-policy-review/mirror` isolate all output. No dotenv/setup loaders, install, network, signing, credential access or service call. npm packing used offline mode and ignored scripts. Source hashes matched the producer's final manifest and remained stable at the final check.

| Check | Observed result |
| --- | --- |
| Scoped TypeScript | exit0 |
| Scoped ESLint, exact three files, max-warnings0 | exit0 |
| Jest discovery | exactly one mirrored model-policy suite |
| Jest unit outcomes |1 suite/24 passed,0failed/0pending/0todo |
| Existing packed ESM/CJS/declarations/browser public contracts | exit0 in isolated mirror |
| Fresh browser/identity/strictness/detachment probes | browser/identity/bounds controls pass; four defect observations; exit1 |

Every execution has its own `*.receipt.json` exact argv/cwd/start/endUTC/exit, raw safe `*.stdout` and `*.stderr`. `unit.result.json` supplies assertion outcomes/discovery totals. Reproduction: from repository root run `python3 work/resume/task04-pure-policy-review/setup.py`, then `python3 work/resume/task04-pure-policy-review/checks.py` and `python3 work/resume/task04-pure-policy-review/probe-run.py` in a fresh directory to avoid overwriting these historical receipts. Inert copies of all runners/configs/probe/public-contract script are saved here as `.text`. The public script differs only by redirecting its temporary pack directory into permitted scratch. Root production dist/build was not rewritten; producer's build receipt was inspected, while public contracts were independently rerun against copied current dist. Actual inference/accounting/UI checks were NOT_RUN and are not represented as skipped successes.

## Evidence history limitation

The parent separately identified that the producer's initial broad-fixture collision/14foreign-realm failures and preliminary22PASS did not survive as disk-backed raw streams/preimages. Historical tool observations must not be presented as preserved/reproducible receipts or reconstructed retroactively. Current final24 test/source receipts remain intact. This review certifies only its fresh exact-candidate executions, and preserves its own failed probe. The history gap is separate from the two demonstrated product defects and does not waive any acceptance gate; a new immutable parent limitation record may document it without changing old evidence.

## Exact candidate SHA256

| File | SHA256 |
| --- | --- |
|src/domain/model-policy.ts|`5a99350f839a414f530b6f447dcdb022504599db841490371603ac26f3c63d97`|
|src/domain/index.ts|`b1bb56d6df91596512f9c1e35b48f8942207bf9651739885eb81f7755d834648`|
|tests/unit/domain/model-policy.test.ts|`da443be790853c4785a65d257bccf25fecd336224df2ceaa4684b93f3cca28a1`|

`source-evidence.json` binds candidate/report/tooling hashes and byte counts; `domain-source-mirror.json` binds the pure import source closure. `evidence-manifest.json` binds every saved review receipt/output/script/report.

## Dimension scores

| Dimension | Score | Evidence |
| --- | ---: | --- |
|Requirement fulfillment|3/5|Most pure criteria met; detached requests and consistent descriptor-safe evidence remain unmet.|
|Code quality|3/5|Strict resolver/canonical checks and no provider dependency; nested unknown leaves and unguarded fallback parse need correction.|
|Test quality|4/5|24 meaningful outcomes, no skips; independent probes expose missing detachment/accessor coverage.|
|Pattern adherence|4/5|Pure/browser seam and bounded independent receipts follow project patterns.|
|Completeness|3/5|Exports/checks reachable; two pure contract fixes remain.|

**Average:3.4/5.** NEEDS REVISION corresponds to judge-task's NEEDS FIXES: no security bypass or fundamental architecture rejection established, but requirement fulfillment is below5 and several dimensions below4. Fix both defects through the executor, add meaningful outcome coverage, preserve this packet, and obtain fresh independent judgment. Whole04/03-final/goal remain incomplete.
