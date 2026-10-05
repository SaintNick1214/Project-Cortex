# Task Judgment: C7 recorder v4 source-only subreview

## Verdict: REJECT

This is a fresh independent bounded STATIC ONLY review of the captured recorder, not full Task04 acceptance or authorization. No recorder, candidate, fixture, original, native, private, service or paid command was executed; no credentials or private targets were read. original122, whole120, native20, private, paid and ROOT approval remain HELD. Static confidence does not establish runtime coverage.

## Evidence Review

Read AGENTS.md, CODEX-RUNTIME.md, PROJECT-PROFILE.md, pessimistic-judge.md and judge-task/SKILL.md. Reviewed only own copies after full held-file-descriptor PRE/POST nine-field checks against the supplied capture, literal size and SHA checks, and matching pathname identity. Source and raw preimage each: 11234 bytes; SHA-256 `c2054d7931b414bb41c1317f20aa990349e6e95467e743372dda7d030377661d`. Exact source/backing identities and capture JSON hash are in own source-verification.json; final own membership/identities/hashes in own selfseal.json. Prior run-phase.py was read narrowly to compare unchanged argv/env/cwd and timing expressions only; it was not executed. Lines below reference own run-phase-v4.py, whose bytes match the captured original.

## Requirements Review

| Requirement | Static result | Source evidence |
|---|---|---|
| Fresh source held9, literal integer decimal strings, streamed full size/SHA | Satisfied on normal PRE/POST paths; failure completion missing | 7, 29-48, 88-91, 109-112 |
| Reuse immutable byte backing only; full encoded/decoded checks and gzip EOF every reuse | Satisfied on successful paths | 12-28, 34-35; loops read through EOF, identities compared to recorded baseline |
| No rounding or implicit source identity authority refresh | Satisfied in capture and POST comparisons | 7, 30-48, 91, 112 |
| Bounded stream memory, no entire large source copy | Satisfied for source/backing byte paths | 1 MiB chunks at 22, 26, 32, 40, 44, 90, 111; prior receipt JSON uses whole-document read and is not source streaming |
| Fixed argv/env/cwd and 120-second child wait | Expressions unchanged from prior recorder | 62-64, 99; cleanup may add 1+5 seconds, as before; no originals run |
| Initial actual PID/startTime/PGID/rawargv owner/child binding | Present on successful initial read, not exception-safe | 65-75, 95-98 |
| Signal/timeout/cleanup robust, final effectful census, no leaks | FAILED | Critical C1-C3 below |
| Resource gate before child: Python 134217728, Node 536870912 | Present and correct on numeric-cgroup ordinary path | 85-93, before 95 |
| Insufficient resource NO_CHILD with fresh heldPOST + evidence | Present on ordinary insufficient-resource path, incomplete if POST/resource read fails | 85-93 |
| Failure paths produce no misleading successful receipt | No explicit PASS label, but several failures produce no diagnostic/final source receipt and abandon cleanup | 95-108, critical C1-C2 |
| Originals and approval remain held | Recorded literal held/absent markers; no execution reviewed | 92, 118 |

## Issues Found

### Critical (must fix; blocks scoped PASS)

- **C1 — No exception/signal-safe child lifetime boundary (95-108).** Popen creates a session before initial process reads, argv assertions and group-PRE writing (96-98), all outside even the narrow timeout try. A /proc race, cmdline read/decode/assert failure, full output device, KeyboardInterrupt, SIGTERM or census error can exit while the created child/group remains effectful. The default SIGTERM action supplies no cleanup. Held source POST (109-112) is skipped on these paths. Wrap the entire post-Popen lifecycle in structured cleanup; handle authorized interrupt/termination paths, retain the actual binding, kill/reap as necessary, capture fresh source POST on handled failures and explicitly record cleanup/capture failures. Do not emit successful cleanup evidence when cleanup is unproved.
- **C2 — Census is before the final effectful cleanup, not after it (104-107, 118).** If effectful descendants remain after the leader exits, groupEmpty is computed false and SIGKILL is sent, but there is no subsequent bounded wait/census. The receipt carries only the pre-kill census. A child can remain effectful during source POST and output hashing; termination completion and no leaks are unproved. A timeout SIGTERM/KILL can also race ProcessLookupError and skip all POST evidence. Add bounded post-cleanup polling/census and explicit final failure evidence; handle disappearance races without treating an unobserved census as empty.
- **C3 — Process group identity sampling has a check/use race (80-81, 101-107).** Census reads /proc stat to filter pgid, then processRow rereads it without checking that the returned row still has the selected pgid or the same startTime. A disappearing/recycled PID can add an unrelated row. Final leader identity is checked only when present (105); signalling numeric pgid has no corresponding identity/ancestry check when the leader is absent. Stabilize each census row with matched held observations and validate group provenance before effectful signalling; fail explicitly on identity uncertainty. This is a static race finding, not an observed PID-reuse incident.

### Important

- Numeric-only memory.max parsing (85) fails for the valid cgroup `max` representation or missing cgroup evidence without an explicit NO_CHILD diagnostic/source POST. The intended current environment is numeric, so this is robustness coverage rather than a demonstrated current-environment failure. Preflight/source/backing assertions also abort without structured failure evidence and do not use finally to close held descriptors. Interpreter exit closes descriptors, but cannot supply the required evidence.
- No runtime synthetic boundary/signal/failure coverage was authorized or run. Existing static integrity checks are meaningful but cannot prove actual termination behavior. Any later execution scope needs explicit separate authorization from ROOT.

### Minor

- Source capture/reuse uses dense semicolon statements and assertions; structured helpers for verification/failure/cleanup would make control-flow obligations easier to audit.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 2/5 | Fresh streamed identities/backing checks improved; exception cleanup and final no-leak proof unmet |
| Code Quality | 2/5 | C1-C3 leave effectful lifetime/race paths unprotected |
| Pattern Adherence | 4/5 | Bounded own outputs, no secrets, literal schema and held authorization markers |
| Completeness | 2/5 | Required error/signal/final-cleanup paths incomplete |

Average: 2.5/5. Test Quality is not scored: this is an explicitly static source subreview, not a test task. No runtime check is claimed PASS. Fulfillment 5 and every applicable dimension >=4 would be required for scoped PASS.

## Recommendation

Fix lifecycle cleanup and post-cleanup census/provenance before another independent captured-source review. Preserve the approved argv/env/cwd/bounds and all original/ROOT holds. This verdict authorizes no execution and says nothing about full Task04 acceptance.
