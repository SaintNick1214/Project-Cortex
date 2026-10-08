# Task judgment: C5 closed launcher C1, fresh independent component review

## Verdict: REJECT

Component acceptance is blocked by descriptor-close ownership and compiler option binding defects. Full bridge disposition remains NEEDS_FIX. All 122 original command entries remain HELD. This review releases no original C5/SOURCE/PARENT/ROOT/native/paid/timing gate and does not complete Task04.

## Evidence review

Read repository AGENTS, runtime/profile, pessimistic-judge, judge-task, feature-orchestrator, original Task04 requirements, decision register and complete architecture. Current user-authorized bounded execution supersedes planning-only historical prose; numeric review cycles alone are waived. No subagents, Git, network, native target, paid inference, actual private C11 paths/keys/IDs, approval pins, publication or old-scope writes were used.

Read the complete frozen 6,643-byte candidate report (SHA256 ea9b169f4e1dc2070b543eec97bb37f48c77d9b853f70e74ae5bfc3ca44d6347), implementation, controls and full finite bridge plan. Independently verified the exact physical candidate QA closure (5 rows, manifest 0a19e41d1fed49617eeced06eeb37e43d6d8c2fdbd1c5f7373b5e73a5345243a) and own component work closure (332 rows, 4 literal links, manifest 04c2fe5d310d6763f593a3b5ada928710c3f0e85e4b375b42b09f0e28694e748). No symlink was followed by the seal walker. Reviewed frozen output audit: report 04d2285dff4de8b1b23142c773ef54805ece39f98495b85d849383bbadeb21a8, manifest 936881a4656f2fcbcfa47e216c80253b687ce82aa3a1a62f75f89eff44b77c47, 1,539 modules/3,068 lexical sinks. Lexical inventories are not semantic write confinement.

Copied six component MJS files byte-for-byte into the review's own work scope. All 25 assertions in controls.mjs ran unchanged using the actual absolute Node executable, repository cwd and only fixed PATH plus owned TMPDIR. Exit 0, 25 PASS. An additional 12 outcome controls ran with the same recorded process contract: 9 PASS, 3 FAIL, exit 1. Raw stdout/stderr, actual argv/start/end UTC and exact exit codes are retained in own work. The failing extra controls assert safe denial, rather than treating successful exploitation as PASS.

Fresh sourcePRE has 154 exact byte-backed rows, including reviewed recorder/capture utility, copied and original component sources, installed-tool inventory and current Node binary. Lossless gzip objects were genuinely created and checked by decompression before dispatch. Node is 125,989,464 bytes, SHA256 bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12, encoded backing SHA256 6657afff2b3f5915296a1c7373fa359caa072cf2e5713673555732e1b288c06b. Source byte lengths/hashes match afterward; deliberately restored copied-source drift fixtures can change copied file ctime and no full tool identity equality is claimed.

The independently reviewed capture utility was copied and changed only to route capture files to this review's owned /tmp. Before and after the two-command bounded batch it read all 148,325 literal rows of all eight recovered roots, including eight manifest files and 30 literal links, and hashed every regular byte (3,110,990,905 per capture), using nofollow FD/path identities. Full rows and stable identities are exactly equal afterward. Authenticated existing transport index a82fb82ad92d4a9753a9c7fe612ba880f82f4893a7a6d3e211dc8ec9a4fad869 and all 32 encoded parts were freshly size/hash checked. Existing backing references preserve authentic historical bytes without duplicating them or hardlinking guarded bytes. Historical negative hardlink fixtures remain observations, never operative permission. Ordinary operative historical bindings remain nlink1.

The initial review recorder failed before any original capture or child dispatch because its complete stat_result comparison included access time, which reading can update. The preimage, observed exit1 and failure are preserved. The corrected prospective run compares stable dev/ino/mode/uid/nlink/size/mtime/ctime fields. Earlier candidate gaps remain intact: first23 inherited environment, both original candidate batches missing raw Node byte archives, and internal esbuild service argv/raw NOT_CAPTURED. This review supplies new Node backing only for its own run. Internal esbuild service argv/raw remain NOT_CAPTURED here too. This is toolchain observation with an explicit restricted child environment, not full environment integrity or capture of every OS byte.

## Requirements review

| Requirement | Met? | Evidence |
|---|---|---|
| Exact IDs/argv; unknown ID and forwarded args deny | Yes, component only | Original controls 1–4; all real entries retain held statuses |
| Exact cwd and no arbitrary environment | Yes, synthetic contract only | Original controls 8–9; extra contract controls; recorder explicitly limits child env |
| Entry/transitive source binding, default-deny imports | Yes, bounded synthetic graph | Original controls 5–7; extra source drift/CJS and unsupported import denial |
| Lexical output path, ancestors, final symlink/hardlink protections | Yes, supported tested write methods | Original controls 10–15; extra traversal/ancestor/hardlink outcome checks |
| Fresh descriptor ownership for every supported descriptor operation | No | closeSync and closeOwned close actually reused foreign DUMMY descriptors |
| Finite compiler output options bound before dispatch | No | Plain-object accessor changes outfile; compiler port dispatched once before post-check denial |
| Unchanged original25 and additional meaningful outcomes | Yes, execution evidence; suite incomplete | 25 PASS; extra9 PASS/3 FAIL preserved |
| Genuine current source/tool/Node prebytes, argv/UTC/raw/exit/post | Yes for outer commands; nested tool recording incomplete | sourcePRE/receipt/raw artifacts; esbuild internal argv/raw explicitly NOT_CAPTURED |
| Fresh original8 full byte/identity before/post | Yes, prospective only | Two full gzip captures and exact whole-row comparison |
| Historical continuity | No, honestly retained | All six earlier incident receipts omitted C4 scratch; recovery cannot backfill custody |
| Complete original122 launcher/FS/VM/compiler bridge | No, explicitly held | B01–B10 are a plan, not accepted implementation |
| Task04 register operation keys | Outside component; not accepted by this review | Original task requirement1 remains required at product gate |
| Task04 policy overrides/model/interface/prompt/version/options/tokens/tools | Outside component; not accepted by this review | Original task requirement2 and distinct policy/audit acceptance remain required |
| Task04 atomic budget/concurrency/reservation/settlement/conservative uncertainty | Outside component; not accepted by this review | Original task requirement3 and concurrent/secondary/no-double-settle criteria remain required |
| Task04 safe fallback/no visible replay/no ambiguous paid replay/no embedding-profile drift | Outside component; not accepted by this review | Original third acceptance criterion remains required |

## Issues found

### Critical (must fix; blocks component PASS)

1. **Closing a tracked number can close an unowned reused descriptor.** Candidate route-policy.mjs:19 checks only membership in fds, calls raw fs.closeSync(fd), then deletes the entry. It never checks current fstat against recorded dev/inode. Line29 closeOwned delegates to the same unsafe method, including launcher finally cleanup at closed-launcher.mjs:15. Both fresh controls allocate an owned fd, close it through the host fixture, open an unowned DUMMY file at the same actual fd number, and require the unowned handle to remain open. Both observed EBADF after policy close; failures are preserved verbatim. Write reuse, by contrast, is denied by fdCheck. This is a finite synchronous descriptor lifecycle case, not a kernel or privileged race demand.

   Repair every close entrypoint with fresh descriptor dev/inode ownership validation immediately before close. Closing an originally owned still-open inode must remain possible after its own pathname has been renamed/unlinked: do not naively apply write fdCheck, which requires current pathname equality. A reused foreign inode must receive no close syscall. Reject stale bindings truthfully. Resource closure errors must remain attributable, and cleanup must not silently close foreign handles. No lease/FileHandle helper exists in this component; future B03 ports must enforce the same invariant before they are accepted.

2. **Compiler checks and dispatch read different output option values.** Candidate route-policy.mjs:31 validates options but passes the original object to build. Object.getPrototypeOf(options)===Object.prototype does not exclude getters or mutability. The extra plain-object accessor control returns an owned outfile for the first three reads, then an outside-component DUMMY path. The supplied fake compiler observes the changed value and dispatch count becomes 1; only the post-build fence rejects. The expected zero-dispatch assertion fails. No actual outside native output was created. Existing constant-literal real esbuild positives remain PASS, but do not prove accessor/late-option denial.

   Reject accessors and unsupported nested option shapes, construct an inert finite data snapshot, validate every actual read/output-capable field and dispatch that exact snapshot. Nested stdin/banner/loader structures and arrays must be validated/snapshotted too. B06 already calls for clone/validate and accessor/late-option zero-dispatch controls; that requirement must reach the component implementation or its API must be explicitly narrowed to a separately proven exact fixed data graph. This review does not claim arbitrary malicious-code isolation.

### Important (should fix before accepting extended component claims)

3. **Cleanup failure accounting is incomplete.** route-policy.mjs:19 deletes the tracking entry even when close throws; :29 stops at the first close failure and leaves later descriptors untouched. closed-launcher.mjs:15 preserves a primary error and attaches one nonenumerable qaLauncherCloseFailure, but this does not prove all remaining resources are processed or unresolved handles tracked truthfully. This observation is source review, not an injected-close execution claim. Repair cleanup to attempt all genuinely owned descriptors and preserve every unresolved/secondary close result without replacing the original primary failure. Add actual injected-close and primary/secondary outcome controls in the repair scope.

### Minor

None elevated independently of the defects and explicitly disclosed recording gaps.

## Test coverage analysis

| Behavior | Observed controls | Outcome |
|---|---|---|
| Command ingress/held status/source contract | Original9 plus extra drift/contract | PASS, synthetic only |
| Writable paths/links/FD write/fsync and replacement | Original10–19 plus extra route/reuse | PASS for tested methods |
| CloseSync/closeOwned after actual fd reuse | Two extra tests | FAIL; foreign handle closed |
| Named ESM FS | Extra named write | PASS for exposed synchronous port |
| CJS capability / callbacks / promises / VM/native bridge | CJS and unsupported named import/API denial | Denial PASS; implementation remains absent/held |
| Compiler constant options | Original20–25, actual installed ownfile/noemit | PASS |
| Compiler changing outfile accessor | Extra zero-dispatch control | FAIL |
| Injected cleanup primary/secondary and exhaustive owned-close completion | Source review only | Not executed; required repair coverage |

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 2/5 | Two claimed component guards fail concrete bounded outcomes |
| Code Quality | 2/5 | Close checks omit FD identity; compiler dispatch sees mutable/accessor object |
| Test Quality | 3/5 | Original25 verify meaningful outcomes but miss actual close reuse and late compiler options |
| Pattern Adherence | 4/5 | Explicit holds, owned scopes, original assertions and truthful failures/custody preserved |
| Completeness | 2/5 | Component safety defects unresolved; original bridge intentionally not implemented |

**Average: 2.6/5.** judge-task requires all dimensions at least4 and Requirement Fulfillment5 for PASS; any dimension at most2 yields REJECT. Scope honesty does not cure observed ownership defects.

## Bridge-plan sufficiency and recommendation

All 122 IDs are unique and exactly match the frozen audit command IDs, full proposed argv, entry hashes and output families. Every route reference resolves to one of the ten named routes. The full plan supplies concrete required work rather than claiming those commands safe. B01 covers ingress/runtime capture; B02 named/CJS and callbacks; B03 promises/FileHandle/FDs; B04 nested VM filesystem ports; B05 exact hash-bound generated parent recipe; B06 actual finite compiler options/tool process/TMPDIR; B07 body/watch/inventory/hostile args; B08 ROOT-only scripts; B09 forbidden historical/generated helpers; B10 fresh custody/recording. These are sufficient categories for a bounded next design, but no route is accepted as implemented merely by its presence in the plan.

Refine B03 with the exact close identity/renamed-inode/foreign-reuse and exhaustive cleanup behavior above. Apply B06's existing inert snapshot/accessor denial prospectively. Keep run.py arbitrary-argv forwarding and initialize.py/prepare.py/compile.mjs categorically nonlaunchable. Accept each actual writer only with concrete patched route composition or an equivalent independently reviewed source-specific finite writable-route proof for the trusted fixed graph. Kernel isolation, arbitrary-code protection and whole-OS byte capture are not imposed. Unwrapped real writers, compiler side outputs, uncontrolled package imports, nested VM copies and callable output arguments cannot inherit permission from passing synthetic controls.

Do only new bounded repair work; retain this rejected packet unchanged. Re-run unchanged25, the failing extra outcomes and new cleanup error controls under genuine prospective source/tool/runtime and original8 capture, then obtain a fresh independent component judgment. The real 122-command bridge still needs independent B01–B10 composition review and later original SOURCE/PARENT/ROOT gates. Preserve original22/43/26/287 assertions, historical51 instrumentation/failure categories/no-old-fsync diagnostics, security/regression controls, capsule tiers/caps/deadlines and all functional/product criteria. No practical20m feasibility or paid/native acceptance is established.

All six early C5 receipts remain custody-BROKEN despite exact C4 recovery. This review's two genuine recovered-state captures are new evidence only. ENOSYS38 Landlock observation and lack of privileged race/kernel/malicious-code confinement remain explicit. QA/work seals exclude only their own manifest files; own /tmp artifacts have a separately referenced physical seal. Literal fixture links are recorded without traversal.
