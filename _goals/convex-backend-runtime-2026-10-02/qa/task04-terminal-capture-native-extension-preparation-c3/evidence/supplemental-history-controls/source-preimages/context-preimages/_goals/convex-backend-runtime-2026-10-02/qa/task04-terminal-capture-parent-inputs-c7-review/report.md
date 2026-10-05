# Task Judgment: Task04 terminal capture parent inputs C7 preparation

## Verdict: REJECT

The frozen public preparation has two blocking deadline defects in both parent helpers. It is not authorized for effects by this review. Original 262 offline outcomes reproduce successfully, but four independent counterexamples prove late signing and late private outputs. These defects concern the mandatory 120-second setup gate; native execution remains NOT_RUN.

## Evidence Review

Reviewed repository AGENTS.md, .agents/CODEX-RUNTIME.md, PROJECT-PROFILE.md, pessimistic-judge role and judge-task criteria, current goal/Task04, architecture and decision register. User execution authorization and numerical cycle waiver are preserved; neither removes independent acceptance or bounded-effect requirements. Scope here is public parent custody and preparation only, not whole Task04 completion.

Subject report SHA256 bd98507f4e39bacb5409e3e761ef6a5786294870ea26f2f72b2e3252b444755b; subject manifest SHA256 e0d14520c50a081cafb6f7c0e367af6299de24040679d0017bcf0f1635c18d20. Independently rehashed all179 subject rows before and after execution: zero mismatch; identical pre/post. Exact helper/source preimages and accepted binding checks are retained. Fresh actual ambient Node24.19.0 and absolute npm wrapper12.2.0 observed; PATH wrapper never used as a node binary.

Fresh reviewer-owned executions: extension84, regression84, actual unadapted validateTarget72, exact livePreflight22. All passed; zero skipped/todo. Original62 C6 names/outcomes per profile remain exactly equal through source assertions. Four additional hostile assertions passed by confirming the defects, not by certifying compliant behavior. Raw stdout/stderr, argv/cwd/UTC receipts and executable preimages accompany each command. No setup failure occurred in these fresh runs. Producer exploratory failure raw remains unavailable exactly as disclosed in failed-probes.json; no missing transcript/raw/preimage was reconstructed.

## Requirements Review

| Requirement | Result | Evidence |
|---|---|---|
| Distinct exact profile imports, requests/purpose/run/operation/name nonce/private paths; unknown candidate denial | MET_OFFLINE | Four authoritative helpers statically import native profile guards; original VM controls and actual guard controls bind exact requests; public-interface/source preimages |
| Cross-profile/C8/retired/production/shared denial and repeated immutable identity | MET_OFFLINE |84+84 VM outcomes and72 actual target controls; C8 project3139649/deployment exciting-snake-863 explicitly denied |
| Current product policy/schema/test and accepted offline reviews/root acceptance | MET_OFFLINE | accepted-bindings-check.json matches all8 public source/review/acceptance SHA256; actual strictProfile and drift controls execute |
| File owner0600/nlink1, directory owner0700, canonical/symlink/traversal fences | MET_OFFLINE | Actual canonical and filesystem metadata operate on isolated DUMMY600/700 fixtures; retained controls cover owner/mode/hardlink/symlink failures |
| Key/JWKS matching, no keysCreated, exactly8 signatures/1 owned peer configuration; no reset/purge/rotation | MET_MOCKED_ONLY | Healthy mock setup asserts8 signatures,1 mock request, exact variable and5 output names; mismatch denied. No actual keys, JWTs, matching or transport executed |
| Deadline starts before full scanner, expires before keyread | MET_OFFLINE | Main deadline declared first; entry scanner expiry rejects with zero mock keyreads; watcher same entry bound |
| Deadline expires before signing | NOT_MET_BLOCKING | hostile-extension.stdout and hostile-regression.stdout first case: expiry after key derivation yields8 mock signatures then later PARENT_TOTAL_TIME_BUDGET |
| Deadline expires before every private output | NOT_MET_BLOCKING | Both hostile streams second case: expiry after first proof still writes historical-native-locators.json, identities.json, peer-config.json |
| Deadline before owned peer configuration; watcher entry/final/each-output checks | MET_OFFLINE | Setup counterexamples configuration count0; watcher source checks before each output plus scanner expiry controls; no real configuration |
| Provision5calls150s/retirement5calls180s bounds preserved | STATIC_MET | Exact contracts retain constants; executable native mechanics assessed by separate native-profile review and remain NOT_RUN here |
| BOTH current operation and attempt created receipts, exact table/kind/id/name/digest/operation/run/target, reread before output | MET_OFFLINE | Healthy watcher checks both receipt keys and target run; all corruption/missing/extra-field/changed receipt controls deny; runtime exact receipt operation plus exact target request/run binds |
| Exact generator for all287 registrations,200 public87 internal; no hidden RPC/storage | MET_OFFLINE | Healthy watcher compares each generated argument against actual imported argumentsFor and counts; runtime watcher has no transport; storage/RPC counters0 |
| FOUR historical SHA/bytes and NINE locator hashes plus historical functions unchanged | MET_STATIC_AND_DUMMY | independent-history-comparison.json independently matches exact1412-byte constants and3584-byte historicalEvidence/initialProof/validateHistoricalInputs segment to public C6; DUMMY VM exercises hashing/journal/proof checks |
| No actual C11 private material read, substitutions VM-only | MET | Runtime helper source untouched; private paths relocated beneath review scratch; historical expected constants rebound only to explicit DUMMY corpus; actual historical verification NOT_RUN |
| Historical accepted/failed C7/C8 packets immutable, full guard at entry/final/perRPC operative source | MET_STATIC_WITH_LIMITS | Subject pre/post179 stable; runtime imported livePreflight calls reviewed/sourcePreflight; preservationPreflight at entry/final. Native complete historical scanner separately assessed, not invoked privately here |
| Original62 outcomes plus84+84/72/22 are meaningful and freshly executed | MET_WITH_BLOCKING_GAP | Original controls reproduce262 and assert outcomes; they miss signing and inter-output expiry proved by4 fresh counterexamples |
| Frozen hashes/receipts/discovery/raw evidence and honest failures | MET_WITH_DISCLOSED_LIMIT | Subject pre/post, preimages, receipts, discovery; producer missing exploratory raw acknowledged, never reconstructed |
| Native/signing/target/publication/decoder/paid/UI/whole04/goal claims restricted | MET | All real effects remain NOT_RUN; none certified by mock preparation |

## Issues Found

### Critical: missing effect-boundary deadline gates

1. parent-inputs-extension.mjs:40 and parent-inputs-regression.mjs:40 create all eight JWT signatures without parentDeadline(deadline) in jwt or immediately before sign. The last check is before key reading/derivation/config parsing at line39. Advance the mocked clock beyond120seconds after createPublicKey.export: both sources perform8 sign calls and only reject later at line41. Add a deadline gate before each actual signing effect, with hostile tests crossing the deadline before first and subsequent signatures. Preserve exact8 for successful setup and retain partial-effect receipts on failure; no reset/reseed/rotation.

2. Both parent helpers:41 gate only the first of four exclusive outputs. Advance time after initial-physical-id-provenance.json: historical-native-locators.json, identities.json and peer-config.json still emit after expiry, then line42 rejects before transport. Add a deadline gate immediately before each exclusive output and peer secret generation if treated as a bounded setup effect; test expiry after each previous output. Preserve proof-before-history/identities/config ordering and exclusive creation. A later error does not undo late issuance.

The hostile harnesses execute the actual runtime main through SourceTextModule. Runtime helper bodies are unchanged, except historical expected constants are DUMMY-rebound in VM exactly as disclosed. Mock createPublicKey.export advances clock for defect1; mock exclusive advances clock only after the first successful output for defect2. These represent synchronous work crossing a fixed total-time deadline. The true sign/network/private operations are never entered.

### Important

The report claim that setup checks its120second bound before effects overstates coverage. Original scanner-boundary tests pass because they inject expiry before the existing checks; they do not validate deadlines between checks and later effects. Update preparation claims only after corrected fresh independent review. No other blocker is asserted from unavailable native/private evidence.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5| Mandatory signing/output deadline requirements fail in both profiles |
| Code Quality |3/5| Strong custody/source fences; missing checks around irreversible effects |
| Test Quality |3/5|262 meaningful outcome controls; mandatory effect-boundary gaps exposed by4 new counterexamples |
| Pattern Adherence |4/5| Public immutable adapters, native guard imports, explicit source authority and scope restriction |
| Completeness |2/5| Frozen packet present but cannot pass preparation gate while late effects remain |

Average:2.8/5. REJECT follows judge-task threshold of any dimension≤2. Numerical review-cycle waiver does not change this threshold.

## Adaptations and execution boundaries

Full producer VM harness copies run in work/resume/task04-terminal-capture-parent-inputs-c7-review/{extension,regression}; output destinations moved only to this new QA packet. Authoritative helper/native source paths remain the frozen public subject. Public accepted-source reads map back to the current repo; no product hash rebinding occurs. Private historical/key/receipt/environment paths map to new DUMMY scratch; private key mock is NONCREDENTIAL-DUMMY-KEY. Historical expected SHA/bytes and locator hashes are changed only inside VM source to DUMMY fixtures. In actual-target tests only output destinations moved. Exact livePreflight tests relocate files to phase-DUMMY scratch and mock reviewed(); they preserve actual canonical/file metadata and validateTarget. Extra hostile source adaptations only add clock advances to mock public-key export and mock exclusive after first write. Exact adapted scripts and deduplicated DUMMY VM preimages are retained.

Real historicalEvidence/main/currentTarget/private key check/provision/deploy/retire were never invoked. Main/currentTarget/historicalEvidence run only in controlled VMs with explicit DUMMY files. No real environment/key/JWT/signing/network/services/targets/RPC/storage/paid/UI/Git/product/profile/old-QA changes or subagents. Writes restricted to this new review packet and unique scratch. Runtime native profile guard imports are inert and direct validateTarget receives DUMMY values. All native private reads, actual signing, target/publication/decoder/paid/UI/whole04/goal acceptance remain NOT_RUN.

## Recommendation

Keep native execution blocked. Repair both parent helpers' per-signature and per-output deadline gates in a newly authorized producer packet, retain histories, refreeze both native profiles because consumed helper hashes change, rerun the existing controls plus every effect-boundary expiry test, and obtain a fresh independent preparation judgment. Do not reset or overwrite failed/private receipts to force a retry.
