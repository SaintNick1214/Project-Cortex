# Task Judgment: K13 joint latency source and test gate

## Verdict: PASS — bounded source/test qualification only

Independent non-author review, average **4.2/5**. There are **zero known actionable breaking findings** in the two bounded changes at the accepted hashes below. This is the coherent source/test gate requested under practical baseline v2. It does not certify new native cloud compatibility, Convex OCC, actual browser/JWT behavior, an under-one-second SLO, prior task reacceptance, or the whole goal. Final audit remains separate.

Repository: SaintNick1214/Project-Cortex at `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`; visibility unverified. Product baseline `2a08b37c23dc4066634d2735da219cb5d09900df`; observed HEAD `162f716bd4a687b2760d35fcc42c2a3b104a6c52` is the later QA-only baseline. Read target AGENTS.md, runtime/profile, pessimistic-judge role and judge-task rubric. Read original Tasks 07/09/14/15/16 only as requirement context; no C7/archive recertification.

## Requirements Review

| Requirement | Met? | Evidence |
| --- | --- | --- |
| UI-1 | Yes | Remove only redundant component watchRun; apply value.run from retained continuous finalOnly observer; preserve transport, deny and cleanup. RuntimeQuickstart.tsx:202-207 allowed inverse restores baseline exactly; runtime-observation.test.ts:8 mounted cases; SDK watchObservation/observeHandler source inspection |
| UI-2 | Yes | Canonical and shipped 1.4.1 mirrors remain exact; QA-only dependencies and lock/catalog changes stay bounded. All eight UI file hashes match; Exactly two dev pins; 765 original lock nodes unchanged, 48 added, zero deleted; All 74 exact 1.4.1 catalog file records match actual bytes and aggregate 235c967cc8d054aaa3639c6f48de6ae366d87f48f6998df4ac0d7480ab818909 |
| BACKEND-1 | Yes | Fresh V4 immediate start uses supported installed Workflow 0.4.8 API, with original claim/execution insertion before initial prefix and no paid Action in parent mutation. runtimeAgent.ts:218-228; Installed manager/start/workflowMutation/step contracts; start-native initial prefix/strict sleep/durable Action/replay/rollback assertions |
| BACKEND-2 | Yes | Handle callback before start ID return using trusted actual completed Workflow document, while retaining strict original completion callback and old V1-V4 registrations/bodies. runtimeAgent.ts:1082-1100; Official completeHandler replaces completed document before callback; Early failure, legacy strict rejection, ten forged-document/identity/context/result negatives; Independent TypeScript AST declaration comparison to baseline |
| BACKEND-3 | Yes | Activate one fresh raw authority read scope only at prepareModelOperation, preserving original predicates/order and writer epoch invalidation. runtimeAgent.ts:655; unchanged original preparation body; Differential results/state/non-authority order equal, 192 versus 28 raw authority reads, two grant gets across write epoch; Late revocation denied with full rollback; unchanged preparation fence suite |
| GUARDS | Yes | Retain historical source/tests/guards and original failures; existing fixture edits only reflect intentional fresh-start API boundary. Existing two fixture inverse patches restore exact baseline; No other original named Agent declaration changes outside workflow/startExecution/prepareModelOperation; Initial Workflow 11/18 plus seven failures and all UI failed receipts preserved; Original sensitive guard/assertion source unchanged |
| EVIDENCE | Yes | Inspect final frozen source, raw discovery/checks, primary installed contracts, and report source/test qualification without native/OCC/SLO claims. All frozen source and raw receipt hashes verified; 1094/1094 across exact 21 paths, zero pending; Canonical 148 and overlapping mirror 148; catalog 24; selected types/lint/build exits zero; No service, inference, deployment, commit or product edit by judge |

## Evidence Review

The canonical component at RuntimeQuickstart.tsx:202–207 removes exactly the redundant watchRun owner and moves its setRun update to the retained continuous finalOnly observer. Its deny callback, subscription cleanup and transport remain. Independent inversion restores baseline bytes exactly. SDK watchObservation still delivers run metadata on empty pages and continues fresh delivery/session/deadline checks after the transport ends. Eight mounted cases assert statuses, post-response memory updates, approval/cancel reachability, three authorization denials, disconnect/reconnect/unmount, signout and SDK auth loss. Their SDK/transport ports are mocks; this is real component behavior under controlled inputs.

The backend at runtimeAgent.ts:218–228 preserves claim/execution insertion, then uses installed Workflow 0.4.8 startAsync:false and reports the actual resulting execution state. Installed start/workflowMutation source confirms immediate initialization; the unchanged V4 inline prefix reaches its durable routing mutation or strict sleep. Actions remain queued steps. New internal onInitialWorkflowComplete at 1088–1100 checks the actual completed component document, ID, generation, pending steps, resolved handler/callback identities, canonical attempt/context/result and ready owned attempt before attaching a missing ID, then calls the byte-identical strict callback at 1082. The official completeHandler writes completion before callback, making getStatus valid here. Canceled completion increments component generation; the missing-ID generation-zero path intentionally fails closed, while later attached cancellations retain the original callback. No other original named Agent declaration changed except workflow construction, startExecution and prepareModelOperation wiring. Independent AST comparisons confirm every V1–V4 registration, strict callback, original preparation handler and observation handler remains identical.

Only prepareModelOperation:655 activates the existing invocation-local raw-authority scope. All original preparation helpers and guard predicates remain; DB and child writes invalidate before/after. The differential fixture checks exact return/stored/native/scheduler state and non-authority read order, 192 versus 28 controlled raw-authority reads, two grant gets across the write epoch, and late revocation rejection/full rollback. Counts are fixture observations, not native performance evidence.

All 12 frozen source hashes and all UI/backend raw receipt hashes match. Exact 1.4.1 payload reads independently verify all 74 catalog rows and aggregate hash `235c967cc8d054aaa3639c6f48de6ae366d87f48f6998df4ac0d7480ab818909`. Catalog changes only target component/package/new-test records and payloadHash. Exactly two QA dev pins were added; all 765 old non-root lock nodes remain unchanged, with 48 additions and zero removals. Existing two test files differ only in intentional fresh-start option/callback expectations and descriptions; independent inverse edits restore their baseline exactly. No original sensitive assertion was removed or weakened.

## Raw Check Coverage

| Check | Observed outcome and limit |
| --- | --- |
| Backend/dependency gate | Raw Jest JSON 1094/1094, 21/21 suites, 0 failed/pending. Actual raw test paths exactly equal all 21 discovery paths. |
| Installed Workflow focused successor | 18/18 controlled-port cases; subset of 1094. Real manager/interpreter/step/environment and official completeHandler; DB/create/journal/getStatus ports are controlled. |
| Existing execution/preparation regression | 86/86; subset of 1094. No additional unique 86 is claimed. |
| Initial Workflow failure | 11/18 plus 7 failures remains preserved. Raw log contains crypto.subtle unavailable under shared deterministic global; successor restores crypto only across native function ports. |
| Canonical quickstart | 148/148 across 8 suites, 0 skips, including 8 new mounted cases. |
| Shipped mirror |Same 148/148 across 8 suites using explicit existing canonical dependencies. Overlaps canonical; no unique 296 or fresh-install claim. |
| Catalog | 24/24, 0 skips. |
| Backend quality |Backend/root/lint TypeScript and scoped four-file ESLint all exit 0. No backend build/package/deploy was run. |
| UI quality |App/strict fixture types, full lint, production Next build all exit 0. Production component frozen since build; later documented repairs are QA fixture/dev metadata only. |

UI original hoisting/React singleton/type-option failures, offline ETARGET, and first mirror dependency failure remain in hashed raw receipts. Watchman recrawl/VM warnings remain visible in backend logs; discovery counts only paths, not six warning lines. Judge inspected raw outcomes and sources, did not rerun already passing checks, start services, invoke inference, deploy, commit or edit product files.

## Dimension Scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement Fulfillment | 5/5 | Every requirement of this explicitly bounded source/test gate mapped to current source, outcomes and exact hashes; native and final audit are separate gates. |
| Code Quality | 4/5 | Small typed internal wrapper resolves actual function handles and fails closed; continuous authorization and scoped writer epoch remain intact. Immediate prefix increases admission read set, requiring later native observation. |
| Test Quality | 4/5 | Eight real-component mounted cases and eighteen installed interpreter/controlled-port cases verify changed outcomes and negative branches; broad unchanged sensitive dependencies pass. Mock ports do not prove engine OCC or real browser/JWT behavior. |
| Pattern Adherence | 4/5 | Uses existing Convex internalMutation validators, component query, canonical equality, strict callback and per-invocation raw read scope; old Workflow journals preserved. |
| Completeness | 4/5 | Source wiring, shipped mirror, manifests, lock, catalog and affected offline checks present and frozen. This source gate does not include candidate packaging/deploy/cloud/browser qualification. |

**Average: 4.2/5**. Requirements 5 reflects this bounded source/test request, not the unmet latency goal.

## Issues Found

### Critical

None found.

### Important

None found within this bounded source/test gate.

### Minor

None actionable. Coverage boundaries are recorded below rather than silently treated as proof.

## Accepted File Hashes

| File | SHA-256 |
| --- | --- |
| packages/vercel-ai-provider/quickstart/components/RuntimeQuickstart.tsx | 1e781488aa1c14b1bde5775766aa977357835045438ea6988993e6297212f528 |
| packages/vercel-ai-provider/quickstart/tests/unit/runtime-observation.test.ts | b091684cbd3b8473dde6ef42ccd5885b87c1eae7fba72bd377db35a7f87cf996 |
| packages/vercel-ai-provider/quickstart/package.json | 5d512e1223da97bada8e5c85055046f2d928b38602303c5b3d53abae3f9c7035 |
| packages/vercel-ai-provider/quickstart/package-lock.json | 27ac4720a2b5aa61325e046b7722d82d35ff97f10748ff8bbcae0f19fdee0c58 |
| packages/cortex-templates/payloads/vercel-ai-quickstart/1.4.1/components/RuntimeQuickstart.tsx | 1e781488aa1c14b1bde5775766aa977357835045438ea6988993e6297212f528 |
| packages/cortex-templates/payloads/vercel-ai-quickstart/1.4.1/tests/unit/runtime-observation.test.ts | b091684cbd3b8473dde6ef42ccd5885b87c1eae7fba72bd377db35a7f87cf996 |
| packages/cortex-templates/payloads/vercel-ai-quickstart/1.4.1/package.json | 4c8ffb59ebb1f60751a2aee403b3da2622ab63d03eeb3120207a98cb09a59008 |
| packages/cortex-templates/catalog.json | f79cc11523a0515218371d4444d8af160c526cc32a5fde1b4893932a5cacd113 |
| convex-dev/runtimeAgent.ts | 1ec557cb9f652dc49ee932677bddf84ec6ea6494eaee78ed66919e18ef242089 |
| tests/unit/runtimeAgent/start-native.test.ts | 02427e532b2c25831f3a921e345b0988235935518466e32cf0d98c2b7a34a6a1 |
| tests/unit/runtimeAgent/empty-context-inline.test.ts | 3cca1de5ec87f020cf82ff3fc4940a650deba0afcfaa2424f2b28e8872f87102 |
| tests/unit/runtimeAgent/context-routing.test.ts | 00604ae5e9cb97534e51dd0139a82aeb201134428b03a8a7e8f2e0b71184efcb |

Final backend source report hash `7d7b662d49fb9efb42611046b986ee0114afeff04ffdd5712509cc5622f149fb`; checks `0f87ab45e370eb13098e0d8955bfc005780e44068e7603810d453f57e1c08cb6`; equivalence `63dab3b94e3d19515cf9d9782656d95e0fa44dc562b6871aed5ca0884df14bef`; installed-primary-contract packet `a9f584ec223f8217a35c299e6a779fab79c2eccd9049be6fa63179e000dc9c4b`. Full source/evidence hashes, requirements, check coverage and retained failures are in the companion JSON.

## Recommendation and Limits

Accept these exact hashes for source/test implementation, then perform the authorized immutable candidate qualification and final audit. Immediate initialization moves guarded prefix work into admission and may enlarge its read set or latency; mocked transactional ports cannot prove native OCC/transaction budgets or net latency benefit. Continuous observation needs changed-build browser verification. Backend packaging and fresh dependency installation remain outside this gate.

The supplied prior K12 browser 20.5156/12.4153-second and CLI 17.7316/18.3989-second intervals remain FAIL against 1000 ms. Prior facts/vectors/provenance/current-auth/contiguous 8/8 results were not recertified here. The inspected prior exact cleanup receipt remains ABSENT for its database/container and reports credentials/directories removed. It does not qualify a future candidate. No new native, OCC or SLO success is claimed.
