# Task Judgment: terminal capture parent inputs C8 preparation

## Verdict: REJECT

Fresh independent read-only PREPARATION review. Average **2.4/5**. No actual parent/native invocation is accepted. Both extension and regression have two demonstrated blocking defects at the imported exclusive-output boundary. Numeric cycle limits are waived; scope, caps, assertions and independent gates remain operative.

## Evidence Review

Read AGENTS.md, runtime/profile, pessimistic-judge role, judge-task criteria, goal, Task04, decisions, architecture, full C8 report, four public helpers, exact C3 exclusive implementation, and producer effect harness. Independently verified all168 subject-manifest rows against bytes/SHA256 and exact actual file closure, excluding only the subject's own manifest. Final report SHA256 remains `06244b2d2448879187ba697f8fbb6c41f8cd007eed583800dad9925591358895`; subject manifest SHA256 remains `16549dddb8ed7dd4f3da8b3405c438720fa10f7cc575e62aba589c5f98bbdfd7`. Zero changed/missing/extra subject files.

Executed original producer effect matrices unchanged in expectations, with only scratch/result destinations relocated: extension38/38 and regression38/38, zero skips. Four initial counterexamples, twenty expanded counterexamples and twenty final same-expectation original-error-identity counterexamples also passed their explicit violation assertions. These executions prove defects, never compliance. Node24.19.0; no npm or service check required. Actual argv/cwd/UTC/source hashes/raw stdout+stderr and subject pre/post evidence are saved. Final hostile-identity raw streams also assert strict original fsync error object identity, all persisted-byte/mode witnesses and identical expected outcomes. No setup failures occurred in this review. Expanded records repeat the unchanged pre/post snapshot; final-verification.json independently rehashes the full subject after every completed execution. No private payloads were read.

Hostile harnesses execute exact current parent main and exact imported C3 exclusive function body, using DUMMY-only key/crypto/network/history and source-constant substitutions disclosed in captured scripts and DUMMY source preimages. Every native-looking ID here is DUMMY. Canonical scanning uses actual filesystem logic in owned scratch and an injected clock advance after it completes; open/write/fsync/close operate only on DUMMY VM outputs. The fsync failure is injected after real scratch writeSync succeeds. Real runtime sources are unchanged. The source wrappers/relocation are public and hashed.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Frozen final subject integrity and complete168 closure | Yes | subject-pre/post and final-verification, exact final hashes |
| C3 static source/request/profile and accepted8 source bindings | Observed in sources and rerun healthy path | four helpers/public-source-bindings and original38 matrices |
| Eight successful signs, one secret/config, five outputs in healthy DUMMY main; no reset/reissue | Yes in bounded mock evidence | original-effect-extension/regression outputs; unchanged38 assertions |
| Immediate deadline before each actual exclusive creation, including scanner time crossing | **No** | expanded hostile cases expireWithinExclusive1..5 per profile |
| Honest retained successful private-effect names on mid-effect exceptions | **No** | failFsync1..5 per profile; fully written0600 file omitted |
| All inherited original262 controls and full final source preservation independently rerun here | Not claimed | review reran meaningful76 effect controls; producer evidence exists but blockers prevent acceptance |
| Real signing/private matching/native IDs/target/publication/paid/UI/full04/full03/goal | NOT_RUN | outside this preparation review and not converted into PASS |

## Issues Found

### Critical: deadline checked before imported scanner/encoding, rather than actual file creation

Both `parent-inputs-extension.mjs:44` and `parent-inputs-regression.mjs:44` call parentDeadline, then exclusive. The exact imported extension/regression C3 `scripts/guard.mjs:14` calls canonical(dirname(path),repo), JSON.stringify and Buffer.byteLength before openSync(path,'wx'), with no deadline check between those operations and creation. A synchronous filesystem scanner can cross the fixed deadline. The parent gate therefore does not enforce the requested effect boundary.

`hostile-expanded-extension.stdout` and `hostile-expanded-regression.stdout` prove this separately at ALL five outputs. After expiration inside exact exclusive's canonical scan, the named file is nevertheless created and fully written. Cases1..4 eventually throw at the next parent gate, after the unauthorized late output. Case5 writes the final receipt and emits `status:PASS` after the deadline, with all8 signatures/1secret/1config/5 outputs; no later gate catches it. These are observed violations of the fixed120s preparation budget, not hypothetical scheduler gaps.

The same imported exclusive boundary is used by the three watcher outputs. Those call-site gates also precede exclusive's scanner/encoding. This broader static exposure is not counted as an additional executed counterexample.

Fix by arranging all canonical checks/serialization/byte limits before a deadline gate directly adjacent to openSync, while preserving exact private exclusive flags/modes and one fixed deadline. A guarded exclusive primitive can accept a bound pre-open callback; do not weaken canonical fences or frozen-source claims. Re-freeze changed public source bindings and re-review both profiles.

### Critical: committed private outputs omitted when fsync/close throws

The output closure at line44 appends an output name only after exclusive returns. Imported exclusive opens the file, writes the complete bytes, then fsyncs and closes. If fsync (or close) throws, the private file remains created with bytes but effects.privateOutputs omits its name. The catch at lines82..85 rethrows the original error with this inaccurate partial-effect list.

The ten `failFsync1..5` cases prove the omission independently for every output in both profiles. First proof has5129 bytes and mode0600, yet original DUMMY_FSYNC_FAILURE retains `privateOutputs:[]`. Last receipt has complete bytes, while privateOutputs contains only the first four names. No rollback occurs, and those retained files continue to fence restart, so dropping them from the failure metadata hides actual effects. The defect reproduces with exact exclusive function body; existing matrices replace it with writeFileSync and only simulate errors outside its internal stages.

Track successful exclusive creation separately from durable completion and retain truthful nonsecret names/states even if write/fsync/close fails. Preserve original error identity and avoid extra private files, retry, rollback or fabricated PASS. Add hostile open/write/fsync/close failures, asserting actual partial filesystem state, counts, no later effects and once denial.

### Important

The38-per-profile matrix proves its mocked exclusive boundary; it cannot establish actual exclusive behavior. Retain all existing expectations and add exact shared-function fault/time crossing probes. No old C7 assertions, historical manifests or reports should be altered. Historical C7 REJECT and missing raw evidence remain historical failures; this review does not grant retrospective acceptance.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 2/5 | deadline and truthful retained effects fail in both profiles |
| Code Quality | 2/5 | gate placement and post-return-only accounting miss internal failures |
| Test Quality | 2/5 | all76 meaningful controls pass while exact dependency exposes20 counterexamples |
| Pattern Adherence | 4/5 | confined artifacts, source integrity, DUMMY-only mocks, no actual effects |
| Completeness | 2/5 | final PASS can be emitted after deadline; preparation acceptance blocked |

**Average:2.4/5.**

## Recommendation

Repair only newly authorized producer/native source packets, preserving old packets and all passing requirements. Make creation deadline enforcement and partial-output accounting cover actual exclusive internals; re-freeze/hash actual changed guard/helper bytes. Require fresh original and exact-boundary regression execution plus fresh independent preparation judgments. Root retains custody of all real private/effect invocations. C3 fixture/native qualification is separately judged; no missing native evidence is invented here. This REJECT alone blocks parent preparation acceptance and subsequent real parent execution.
