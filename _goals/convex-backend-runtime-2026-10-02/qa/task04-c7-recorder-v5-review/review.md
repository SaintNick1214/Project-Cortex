# Task Judgment: C7 recorder v5 static source subreview

## Verdict: REJECT

Fresh independent bounded STATIC ONLY review. This verdict applies only to recorder source fulfillment; it is not full Task04/model-gate judgment, runtime qualification, actual ROOT approval, or execution authorization. No recorder, candidate, fixture, original, native, private, service or paid command was executed. original122, original whole120, native20, private, paid and ROOT approval remain HELD. Uncatchable SIGKILL/OOM cannot provide cleanup proof; missing evidence remains unknown.

## Evidence Review

Read AGENTS.md, .agents/CODEX-RUNTIME.md, PROJECT-PROFILE.md, pessimistic-judge.md and judge-task/SKILL.md. Applied the judge-task rubric with the explicit static-only coverage boundary. First independently opened source and raw preimage, obtained held-FD PRE identity, read bounded bytes, computed full SHA/size, obtained held-FD POST identity, and matched every field against capture metadata before copying into the owned review root. Both files: 25652 bytes, SHA-256 `469ab941f2212a95131ef5557364d591057518b54adc32b8ad1e75b5ee99d1eb`. Nine fields are canonical decimal strings under FS_IDENTITY_DECIMAL_V1. Full literal identities are in inspection.json. Reviewed only own source.py/source.raw copies. Subsequently read prior v4 report for original findings; current conclusions were independently derived from v5 source.

All line references below refer to owned source.py, byte-identical to run-phase-v5.py. No interpreter/binary preimage, large JSON, or private credential data was copied. Only bounded Python metadata tooling ran; it did not import or execute the subject.

## Requirements Review

| Requirement | Static result | Evidence |
|---|---|---|
| Exact nine canonical decimal string fields; fresh source held PRE/POST full SHA/size | Present for successful captures; failed PRE source gets no actual POST observation | 10-14, 93-124, 256-269; C3 |
| Fresh full encoded/decoded backing hash/size/all9, gzip EOF; immutable-byte reuse only | Present on ordinary successful path | 68-92, 101-122; supplied identity must exactly equal generated all-nine identity |
| Stream bounded source/backing memory | Present for large byte streams | 81-88, 98, 109, 116, 260; metadata helper reads explicitly capped |
| Structured source/backing/preflight/FD errors | Improved; failed PRE source evidence incomplete | 323-343, 267-269; C3 |
| Approved fixed argv/env/cwd, only owned phases, shared absolute120, no original execution | Present in reviewed source; original/native commands are outside this subreview | 11, 33, 300-302, 314-322, 348; numeric reserves at 304; no subject commands executed |
| Resource insufficient NO_CHILD Python134217728 / Node536870912, max/missing diagnostics | Literal numeric gate correct; max explicitly held; missing reads captured as primary/secondary error | 41-42, 303-311, 323-343; normal resource hold runs source_POST |
| Actual owner/child PID/startTime/PGID/rawargv; retained pidfd-only signaling | Present once assignment/binding completes | 125-168, 201-217; C2 creation gap remains |
| Stable census, PID/start/PGID/SID/provenance; absence/reuse/uncertainty fail | Incomplete: retained member outside PGID filter omitted; absent leader not distinguished | 169-200; C1 |
| Exception/handled signal lifetime, final cleanup and no false empty/no leaks | Incomplete | 285-286, 316, 218-255, 338-340; C1-C2 |
| Fresh post-kill/post-reap bounded final census | Explicitly attempted, but census membership coverage is insufficient | 248-255; C1 |
| Source POST never fabricates original outcome; original/private/paid/ROOT held | Present; no qualification inferred from these literals | 339; no original commands executed |
| Runtime synthetic failure/signal coverage | Not authorized, not performed, no PASS claimed | Explicit review scope |

## Issues Found

### Critical (must fix; blocks scoped PASS)

**C1 — Census can omit a previously positively bound owned descendant and claim groupEmpty (138, 175-198, 338-340).** The leader is observed regardless of PGID, but other retained self.members are only discovered through process_pin(pid, pgid=original_group). At line138 an observed process outside the group returns None. If a previously bound descendant changes process group/session, it is absent from rows and effectfulRows despite its retained pidfd. Once the leader exits, a final census can therefore produce complete:true, effectfulRows:[], groupEmpty:true and even completeOwnedEvidence:true while that owned descendant remains active. This is a static control-flow case, not an observed escape. Independently observe every retained PID/startTime without the group filter, require its expected PGID/SID, and mark escape/rebind/identity uncertainty incomplete/conflicting without signals to uncertain processes. Keep discovery and tracked-member verification separate, and ensure final empty proof covers every positively bound member.

The same census treats leader absence as leader_live=False and can return complete:true (177-198). This does not fulfill the explicit leaderabsence-failure requirement for observations during an unreaped lifetime. Record absence/reuse as uncertainty unless an observed successful reap establishes the expected absent-leader phase; even then verify all retained members before empty proof. Merely disallowing new members when the leader is absent is insufficient.

**C2 — Handled signals can interrupt child creation before ownership assignment (285-286, 314-317, 219-220, 339).** The raising SIGTERM/SIGINT handler is active during Popen. A signal after OS child creation/constructor return but before self.child receives the result leaves self.child=None. The finally then records NO_CHILD_CREATED, childExecuted:false, complete:true empty census and performs no owned-child binding/reap. This falsely describes an unknown creation outcome and can leave a child alive. A surrounding finally alone cannot close that creation/assignment interval. Defer handled interruption through creation and ownership registration, for example mask/defer SIGTERM/SIGINT before Popen and deliver the pending request only after the object is retained (and bound where appropriate), with carefully covered failure paths. Record creation attempted/outcome unknown when construction cannot establish absence; never infer NO_CHILD solely from self.child=None after an attempted spawn.

### Important (should fix)

**C3 — Failed PRE source descriptors have no fresh held POST and an acquisition/registration signal gap (94-95, 267-269).** A capture failure after source open, including backing verification failure after the source was fully hashed, leaves a pending_source row containing only path. source_POST closes it without fresh identity/hash/size observation or a source POST error record. In addition, a handled signal between os.open returning at94 and registration at95 leaves the FD outside both held/pending tracking. Protect acquisition-to-registration against handled interruption, retain available PRE identity/hash/stage data, and attempt a bounded fresh held POST for every successfully opened source descriptor, recording partial/error observations when a full read cannot finish. Close each tracked FD in its own finally. Do not claim full every-source failure-path coverage from a close receipt alone.

### Minor

Dense semicolon control flow makes acquisition/ownership and finally boundaries harder to audit. Small helpers with explicit ownership transfer would improve static reviewability.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 2/5 | C1-C3 leave required cleanup certainty and every-source error coverage unmet |
| Code Quality | 2/5 | Incorrect empty/no-child inferences and interrupted ownership transfer |
| Pattern Adherence | 4/5 | Owned evidence, literal identity schema, no secrets/original approval claims |
| Completeness | 2/5 | Binding and final census infrastructure exists but critical boundary paths remain |

Average: 2.5/5. Test Quality is not scored: this is an explicitly static source subreview, not a test task. Scoped PASS requires fulfillment5 and every applicable dimension>=4. Dynamic behavior is unqualified; absence of authorized runtime coverage is not itself a static-source defect.

## Recommendation

Repair tracked-member census coverage and phase-specific leaderabsence handling; protect child creation/assignment and source FD acquisition/registration from handled interruption; preserve fresh POST/error evidence for failed PRE sources. Capture a new immutable version and obtain a new independent static review. Preserve all original/private/native/paid/ROOT holds and the approved limits. This report authorizes no execution.
