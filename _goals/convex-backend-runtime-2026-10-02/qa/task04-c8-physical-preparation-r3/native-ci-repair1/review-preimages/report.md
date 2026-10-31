# Task Judgment: Task04 native CI infrastructure proposal

## Verdict: REJECT

Scope is **INFRASTRUCTURE_PROPOSAL_ONLY**. This judgment does not accept Task04, a Linux runtime binding, physical preparation, any subject, historical C7 custody, or the full goal. The proposed workflow must remain inactive at this hash. No numerical-cycle limit was applied; requirements and assertions were unchanged.

Reviewed packet: `native-ci-proposal-packet-manifest.json`, SHA256 `598ac93dcf4593ff16bfaca3c228e5226f6e002336c6e80759cd0c7bc35f9bfb`, 110146 bytes, 73 files and eight directories. Source manifest: SHA256 `73800802fb9d40e5024ae11c79278d49f2b9231763d7c7bff2b8233b97989f1b`, 2414 bytes, 13 source files / 118087 bytes. Workflow proposal: SHA256 `2e4346321c9efa93730dc397cc2dc522dbeeee8509da25a5e0befaebfea69731`, 2873 bytes. The actual workflow target remained absent.

## Evidence Review

Read the checkout AGENTS.md, runtime adapter, project profile, pessimistic-judge role, judge-task rubric, feature-orchestrator, active root manifest, Task04 task, producer report, all CI source bodies, resource derivation and named raw receipts. Independently bound every sealed file through full reads, EOF, SHA256 and all nine decimal stat fields, with held descriptors and unchanged path stat. Checked all eight directory memberships and identities before and after. Parent's authorized checkpoint moved HEAD from `8321c329dd6aec4538de0dd4181345da0cf67c85` to `2d2513853b1e3deef344247797501c0265bbdf37`; the reviewed source packet and route bytes did not change.

The review executed host-only Python AST parses, Ruby Psych workflow parsing with branch/path/permission/owner-job assertions, 19 direct AST/source seams and negative controls, a C4 map read/decode/hash check, and a read-only Git/API audit. Seams substitute effects into reviewer-owned dummy fixtures. No Docker, service, inference, CLI, native subject, compiler, cohort, or qualification was run. The original volumes and the external sibling container were not accessed. Two reviewer-harness setup failures were retained in separate receipts before the successful controls; they are not producer runtime failures. Initial reviewer-seal verification also observed a ctime-only change to reviewer-owned verdict.json with unchanged bytes/size/mode. Its initial seal and drift receipt were preserved before the final reviewer artifact binding; no producer source was repinned.

All 361 route parts, six routes / 1872365422 encoded bytes, were independently fully read in the worktree and compared to raw `git cat-file --batch` blobs: exact size, SHA256, Git blob OID, EOF and unchanged all9. Pinned commit `11002ce3db6b2fd26c2dacf45234ff22cc81edcd`, tree `ad06ab2452751e8906981472b87a6cf0616501ab`, current HEAD's route OIDs, and the remote pinned commit/tree matched. This establishes current content availability only. Historical C7's five acknowledged publication parts out of 36, 31 unverified parts, part0005's only copy, 4224 unpublished object gaps and 11 forensic references retain their separate status; this judgment does not upgrade any of them.

The C4 map independently matches both pinned compressed and decoded hashes, eight roots, 148325 rows, 148295 regular rows / 3110990905 bytes, and all 30 literal targets / 4474 bytes with their exact hashes. The prospective materializer differs from the preserved R3 materializer by exactly one `symlink` to `literal-symlink` comparison token. Its original count, byte and identity assertions remain. It was not invoked.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Exact reviewed packet and source, pre/post bytes/all9/directory memberships | Yes | `source-binding-pre.json`, `source-binding-post.json`; 73 files/eight directories identical |
| Workflow inactive until fresh PASS; exact branch and workflow-path trigger | Yes | Actual target absent; `workflow-yaml-parse.json`; proposed workflow lines 3–6 |
| Contents read, credential persistence false, official immutable action pins | Yes, source | Proposed workflow lines 8–9, 22–25, 36; named read-only action/source receipts |
| Public pinned build; no registry push, secrets, production, services, paid selection, compiler, cohort or subjects | Yes, source | Dockerfile; bootstrap-npm.py; ci-run.py lines 44–60; source-only entrypoints |
| Actual native x64/Python3.12/Node24.15/npm12.2, pidfd lifecycle, literal argv, readable mappings and full all9 source backings must be measured | Blocked | Guards are present, but exact alias-loop seam proves capture fails on a directory; no Linux execution claims |
| Same owner, termination and binding expiry; later bulk remains held | Yes, source only | ci-run.py lines 95–111; native-capability.py lines 178–205, 184/189; terminal-owner negative control |
| Actual 6GiB memory and matched swap; literal reserve and disk/inode checks | Yes, source only | ci-run.py lines 55–58; native-capability.py lines 22–42; low-reserve/unbounded-cgroup/extra-swap negative controls |
| Allowlisted, finite artifact export and failure preservation | Partial | ci-run.py lines 64–102; traversal/unallowlisted/capacity controls pass, but command output is buffered before its bound is checked |
| Exact finite resource derivation preserves payload + same RAW and metadata ceilings | Arithmetic verified; directory completeness needs correction | Exact sum is 48565865408; inode equation yields 317987; derivation omits initializer bin/infra directories |
| Prior 107945366382 ceiling and failures are preserved | Yes | plan.json; arithmetic error remains 68 bytes; literal-kind failure remains failed; pre/post seal equality |
| Current six-route Git content, separate from historical custody | Yes | `current-git-route-byte-review.json`; full361 worktree/rawGit comparisons and remote commit/tree |
| First job cannot release bulk on a fit diagnostic; seven canonical inputs/subject closures remain unknown | Yes, source | native-capability.py line 189; README; finite proposal; no materializer invocation |
| Original122/eightnative20/wholeabsolute120/FULL-RPC/501 semantic IDs/301 unresolved meanings and ROOT gates unchanged | Yes, held | Plan and source receipts retain these obligations; no functional qualification or ROOT acceptance |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 2/5 | Narrow effects and custody distinctions hold; mandatory native capture cannot finish with the reviewed alias loop |
| Code Quality | 2/5 | Directory enters strict regular-file closure; command output bounds are post-buffer checks |
| Test Quality | 3/5 | Producer AST/YAML/hash evidence is honest but did not detect the closure defect; reviewer direct controls do detect it |
| Pattern Adherence | 4/5 | Isolated ownership, current bytes versus historical custody, retained failures, no weakened assertions |
| Completeness | 2/5 | Native capture completion is unreachable at this source; finite directory coverage needs reconciliation |

**Average: 2.6/5.** REJECT follows the rubric's dimension ≤2 threshold and the concrete blocking defect. Absence of Linux runtime execution is intentional for this source gate, not a claim that runtime requirements passed.

## Issues Found

### Critical (must fix — blocks PASS)

1. **Directory alias is passed to regular-file capture.** `native-ci-a5/native-capability.py:173–176` observes the literal `/opt/cortex-c8/python/bin` alias, then unconditionally adds its resolved target to `sources`. `bootstrap-npm.py:43` creates that alias to `/usr/local/bin`, a directory. `native-capability.py:59–62` opens and requires each source to be a regular single-link file. The exact reviewed alias loop, effect-substituted into reviewer-owned paths, adds the bin directory; the exact reviewed `capture()` then raises `RUNTIME_REGULAR_SINGLE_LINK_SOURCE`. A regular-file control passes, and hardlink rejection remains strict. Preserve both file assertions. Record and verify the directory alias plus its finite directory membership separately; add only regular resolved targets to the file closure. Do not activate the rejected hash.

### Important (should fix)

2. **Command output limits are checked after all output has been buffered.** `native-ci-a5/ci-run.py:12–17` uses `subprocess.run(stdout=PIPE, stderr=PIPE, timeout=900)`, then checks lengths. This limits accepted output but does not bound host memory while a build/command emits data. The same pattern exists in native version/child output collection at `native-capability.py:139,181,197`. Use bounded streaming, preserving finite failure diagnostics and terminating/joining only owned children on overflow. The tar export's membership/byte checks are separate and remain effective; they do not bound these command buffers.

3. **Finite preparation directory derivation omits initializer directories.** `derive-finite-demand-attempt3.py:144–163` derives the physical directory set and fixed output parents. The retained initializer at `initialize-phase.py:28–29` additionally creates top-level `bin` and `infra`; neither enters that set. The four bin entries at initializer lines 42–53 and `bindings/initialization.json` at line 61 also need explicit finite output membership. The 70385-directory count therefore is not an exact complete initializer/preparation membership, even though the 48565865408 arithmetic and 317987 equation faithfully reproduce their stated inputs. Reconcile the precise helper/output directory derivation and inode/block allocation before claiming a revised complete ceiling. Keep the current proposal, its 68-byte transcription failure and old broad bound unchanged as history. No bulk effect is currently released, so this finding does not imply an attempted under-admitted copy.

### Minor (consider fixing)

- No additional minor finding. The preserved older source-parse receipt has earlier helper hashes; `native-ci-final-source-checks.json` correctly covers the final sealed helper bytes. Do not treat the older parse receipt as final-source proof.

## Test Coverage Analysis

| Source behavior | Direct checks | Actual outcome verified? |
|---|---:|---|
| File closure and alias-directory bug | Four | Yes: exact loop adds directory; exact capture rejects it; regular source accepted; hardlink rejected |
| 6GiB/no-swap/literal reserve | Four | Yes under substituted cgroup/disk reads; extra swap, reserve shortfall and unbounded max reject |
| Raw kernel argv assertion | Two | Yes under byte substitutions; exact argv accepted, Rosetta wrapper rejected |
| Export membership and byte cap | Six | Yes under tar-member substitutions; traversal/extra/nonnamespaced members and overflow reject |
| Owner termination | One | Yes under inspect substitution; running owner prevents success |
| Arithmetic and exact prospective token delta | Two | Yes: exact byte sum/inode equation and byte-for-byte single-token substitution |

These 19 controls establish source behavior under declared seams. They are not pidfd, Linux filesystem, Docker, Node or native runtime receipts. The complete historical R2 directory derivation was inspected through source and sealed reported metadata proofs; the original R2 volume was not read. C4 metadata and the payload/ceiling arithmetic were independently rederived. The bin/infra omission is directly visible without access to that volume.

## Recommendations and Conditional Release

Produce a distinct repaired source packet and preserve this rejected packet and review. Fix the alias/file closure without weakening regular/all9/EOF assertions; add a meaningful regression seam covering the literal directory alias. Address bounded command collection and reconcile the initializer directory/output inventory. Recheck exact source bytes, manifest, workflow effects and negative controls with a fresh independent judge. **This verdict releases no workflow creation, activation or runtime effect.**

Only a later fresh source PASS on a new exact sealed packet can permit copying its exact reviewed proposal to `.github/workflows/task04-c8-native-infrastructure.yml` and the authorized continuation-branch push. That release must remain limited to the small native capability/source-capture job. Actual image ID, pidfd open/signal0/TERM/poll/close, literal Node kernel argv, readable mappings, complete backing bytes/all9, real resources, same owner and terminal receipt then require fresh independent review. The job's binding expires at owner termination. Even a measured fit does not release bulk preparation; a new same-owner baseline and independent release are required. Seven future canonical inputs and exact compiler/tape/ledger/receipt demands remain held. Task04 and the goal stay incomplete.
