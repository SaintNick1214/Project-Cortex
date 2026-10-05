# Task Judgment: Task04 C4 portable version-bound catalog release

## Verdict: PASS

**Scope: frozen offline release proposal only. Average: 4.4/5. Actual root remains all136 PRE; the judge applied no root splice.**

I independently read the repository/runtime/profile/orchestration/judge instructions, the entire subject report and operational modules, exact four-file patch, transition manifests and raw execution evidence. I reproduced behavior in a review-owned copied checkout and an additional arbitrary checkout relocation. The fifteen operational modules in the review copy remained byte-identical to the frozen subject. Assertions were unchanged. Only literal dependency link routing and review-owned output state were adapted; the relocated actual POST tests retained their relative imports and normal CLI route without a source-root fixture override.

## Frozen subject identity

| Artifact | SHA256 | Closure |
|---|---|---|
| Subject report.md | 841e95226a00808f98f84b04dcc71879a61fb6af7525f0d9f27eb2254c2aa39a | Fully read |
| Subject qa-manifest.json | 1c05d786b4da42bbfffcfe5bac3392295f2fba12a6091ac611fda048d5c9ee1d | All2025 rows, one literal link |
| Subject scratch-manifest.json | 6fa7df014823c84929a2bd0a163b216cd5b03385e7180555c7a15b415d50d5f6 | All19 rows |
| POST source-runtime.json | 0b95c86c703e9b73d1ed707e0dcd38805e5a3f3c408e2bbaa1a1ba3d7c532792 | Exact136 POST-only |
| Held four-file patch | 404dcbff1fbe2fdf783dcd46c03d3baa9c4b8fff4c6e9d3eb7128873b6c3c223 | Exact reviewed C2 patch plus sole C4 route replacement |

All regular files and literal readlink bytes were enumerated recursively with no symlink traversal. Each closure excludes only its exact root self-manifest; nested preimages, history, failure artifacts and manifests remain included. I additionally verified C3 QA2336/scratch19, C2 QA836/fresh-review626, C1 QA1424 with11 literal links, C1 review2177 with20 literal links, and C1-review scratch5. Full historical failures remain original external immutable evidence. No C3 deployment approval was inferred.

## Requirements review

| Requirement | Met? | Independent evidence |
|---|---|---|
| Original136 PRE preserved, only approved4 change and other132 exact | Yes | checks/final-full-closure-source; all actual136 root hashes equal source-before; all136 PRE preimages preserved, all136 POST preimage hashes and lengths exact |
| Sole exact4 postimages from reviewed C2 patch plus version route | Yes | checks/approved-patch-proof proves whole patch byte equality after only C2→C4 route substitution; checks/closure-source-verification proves four C3 postimages plus only C3→C4 route substitution |
| Runtime hard-pinned136 POST-only, PRE solely transition precondition | Yes | current-compose.mjs immutable digest; checks/release22-qualified and remaining-validation; PRE accepted only by read-only verifyReleaseState, POST denied on actual PRE checkout |
| Normal CLI structural root, no supplied/env root option | Yes | repository-location.mjs fixed packet/qa/goal/_goals ancestry and ancestor inspection; checks/portable454 exact-byte arbitrary relocation |
| PRE normal function/CLI denies before effects | Yes | release22-qualified normal PRE mkdir/mkdtemp0, no CLI output; portable454 mixed0 same PRE graph denies0allocations |
| All15 mixed states and four corruptions deny before allocation | Yes | release22-qualified and portable454 zero mkdir/mkdtemp, outputs absent, no private residue |
| ExactPOST succeeds through normal CLI in arbitrary checkout | Yes | portable454 normal CLI yields31tables/184indices/275endpoints and exact136 POST read-only precondition; copied modules exact |
| Actual planned root postimage suites portable with assertions/imports preserved | Yes | portable454: four suites454PASS, failed0/pending0; original relative imports and normal CLI; full names equal frozen reference; catalog-names-proof additionally matches original PRE failure records |
| Baseline semantic/schema/catalog invariants preserved | Yes | remaining-validation adverse30; catalog-names-proof all259 baseline endpoints deep-equal, current275=200public+75internal; native controls enforce26+5/184/16, selected25 remains7public18internal, validators/returns/visibility exact |
| Source/tree/leaf/ancestor fences and private0700 exclusive copy preserved | Yes | containment24-qualified actual source drift, dynamic sibling, symlink/hardlink, ancestor/output/copy fences; preserved-core-proof containment and network/native/semantic guard modules byte-identical to C3 |
| Finally cleanup and caller-identity preservation on errors | Yes | containment24-qualified eight stage failures, three genuine child failures with raw stderr/diagnostics before cleanup, late replacement, partial publication preserving caller-late-file, opaque accessors, diagnostic retention failure; no private/relocation residue |
| Socket/TLS/HTTP2/UDP/listen guard prevents underlying transports | Yes | containment24-qualified independent17-entrypoint stub proof: transportCalls0/realNetwork0; no socket opened |
| Installed scoped types/lint pass, dependencies unchanged | Yes | remaining-validation child UTC/argv/cwd/raw stdout/stderr/exits: tsc and ESLint0, no installation/dependency mutation |
| Frozen evidence and unrelated root work untouched | Yes | Every captured check rehashes the entire subject before/after; qualified final behavior checks capture actual136 root bytes before execution and hashes after; final-full-closure-source confirms all historical and subject closures exact |
| Review failures and bootstrap gaps honestly retained | Yes | bootstrap.json and failure-disclosures.json; both failed own attempts preserved with raw outputs and module bytes; no failed attempt relabeled PASS |

## Evidence and reproduction details

The review-owned checkout contains original PRE136 bytes and exact copied C4 modules with a staged POST graph. An additional isolated arbitrary checkout receives exact POST136 graph bytes and exact operational module bytes; its normal CLI discovers its own structural repositoryRoot. Six fenced dependency package manifests remain regular single-link files; all other installed dependency entries are reused by recorded literal links. The relocated normal CLI and actual four root postimage suites do not use composeForControls. The transient arbitrary checkout is deleted in finally, while full output, commands and454 results remain in review-owned evidence.

Qualified acceptance receipts are checks/portable454, checks/release22-qualified, checks/containment24-qualified, checks/remaining-validation, checks/final-full-closure-source, checks/approved-patch-proof, checks/preserved-core-proof and checks/catalog-names-proof. Each has real before-execution subject copies, operation modules/test/source copies, exact argv/cwd/UTC/raw stdout/stderr/exit, complete subject post hashes, and actual136 root byte preimages/hashes bracketing the final qualified checks. Preliminary inspection and setup checks preceded stronger actual-root bracketing and are retained as exploratory evidence rather than substituted for those qualified runs. Initial instruction/discovery/report reads occurred before capture bootstrap and are explicitly NOT_CAPTURED.

The whole259 endpoint baseline is deep-equal in the newly composed inventory, with only sixteen approved INTERNAL registrations added. Original26 table definitions and artifact registrations remain exact against the baseline witness; five approved table definitions/eleven indices yield31/184. Canonical-extra and forged-root controls deny. Native TableDefinition export is installed-library OFFLINE metadata reflection and does not certify native service/deployment/codegen behavior.

## Issues found

### Critical

None for this bounded frozen offline release proposal.

### Important

None blocking the proposed exact four-file source release. ROOT must still independently read/accept this report, freshly verify all136 PRE and held patch/postimage pins, serialize only the exact four-file splice, verify all136 POST, and create NEW actual-root454 execution/source-specific evidence and review. This judgment does not bypass that sequence.

### Minor

The subject check-history.json retains a stale `NEW_C3_OFFLINE_INVOCATIONS_ONLY` scope label although its actual command paths and UTC receipts are C4; its `readOnlyMissingPath` references discovery-gaps.json while the frozen packet uses discovery.json. This is an evidence-index wording issue; raw C4 receipts and the complete exact closure establish the observed commands. Preserve the frozen subject and clarify the labels in a future separate invocation report rather than rewriting history.

## Own failure disclosure

1. checks/release22 exit1: the review initially copied the subject's already populated witness directory. The unchanged output guard correctly rejected it with OUTPUT_PREEXISTING_ENTRIES_DENIED on the final positive. I parked that copied witness in the owned checkout and reran unchanged controls successfully. The copied witness and failed raw receipt remain preserved.
2. checks/containment24 exit1: I accidentally overlapped containment and release positive checks in the same review-owned work root. The unchanged control's global private-directory snapshot observed the other check's active private directory and asserted NO_OWNED_PRIVATE_RESIDUE. Both transient directories were ultimately cleaned. Serial containment24-final and containment24-qualified passed unchanged; no subject defect or universal concurrent-control guarantee is inferred. The failed receipt and expected genuine child error stderr remain preserved.

The initial setup capture version did not capture its own bootstrap script preimage or actual-root bracketing. It retained the complete subject preimage and disclosed that gap; the final qualified checks use the enhanced collector with genuine script/module/test/source and actual-root136 byte preimages. Earlier receipts were neither fabricated nor overwritten.

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 5/5 | Every bounded release requirement independently verified including exact-byte normal-CLI relocation and actual454 planned suites |
| Code Quality | 4/5 | Closed structural locator, immutable pins, validation before allocations, finally cleanup; trusted-runtime/filesystem assumptions explicit |
| Test Quality | 5/5 | Full454 names/outcome assertions preserved; meaningful30 semantic/24 containment/22 binding controls, exact arbitrary-checkout reproduction |
| Pattern Adherence | 4/5 | Source serialization, scoped goal evidence, original semantics, installed tooling and checked fixture seam respected |
| Completeness | 4/5 | Portable bounded offline proposal complete; minor evidence-index wording and deliberately separate actual-root release execution |

**Average: 4.4/5.**

## Recommendation and limits

PASS permits ROOT review/acceptance of this frozen C4 proposal and then only the exact approved four-test transition under fresh136 PRE/POST checks. The actual original checkout remains136 PRE and runtime composition remains denied until that transition. Do not install C3, rebaseline, accept mixed hashes, relax source guards, or conflate PRE release preconditions with runtime permission.

No root product/config/test edit, Git operation, dependency installation, private-key/env secret read, network/service/native target/codegen/deployment, paid model or subagent action was performed. JavaScript guard proof is confined to supported entrypoints and independent local stub transports; it is not an OS/native-binding sandbox or universal defense against hostile same-uid actors. This PASS does not certify full core/native/model/money/UI behavior, all17 tasks, the separate Task11 asset failures, the broader70-unit gate, original13 operations, or actual root release completion.
