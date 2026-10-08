# Independent Task04 metadata retention implementation C1 judgment

## Verdict: NEEDS_FIXES — isolated offline implementation only

The candidate preserves the accepted original-number, detached-key witness, canonical replay, source closure, historical V1, private backing and fail-closed money behavior. All thirty new controls pass independently. One explicit accepted C2 construction requirement is unmet: witness construction does not consume the remaining complete prospective transcript allowance before sorting/freezing. Later canonical validation correctly rejects overflow, so this finding does not demonstrate capture accepting an oversized transcript or positive money.

This is an independent implementation gate. It authorizes no installation, default change, release, native execution, paid call or Task04 completion. Actual key remains null, ACTUAL_PROOFS remains [], installation remains false, actual money remains EMPTY, embed remains historical V1/UNKNOWN, and unknown outcomes retain full K and STOP.

## Blocking finding: complete prospective envelope is checked after witness construction

Accepted proposal `qa/task04-metadata-retention-design-c2/proposal.md`, Deterministic one-allowance accounting, explicitly requires: “stop at the first key whose addition makes the complete prospective transcript exceed the shared node/byte/depth envelope”; “Never hold a second retained witness outside the budget”; before sorting bound each parent key list by the **remaining** graph capacity and accumulate conservative encoded key bytes before retention.

Candidate `fixture/convex/provider-cost.ts:14` obtains the complete immediate descriptor key list; line15 compares its size only with4096; line18 sorts and retains all names. Lines21–24 canonicalize and detach the complete standalone snapshot with180000 bytes and canonical4096 nodes/depth16. `selectProviderSnapshot` at line26 has no prospective event/prefix parameter or builder. `observer.ts` selectGenerate/nativeEvent constructs that independent snapshot before full event/transcript validation; runner validates the growing prefix only after awaiting nativeEvent. Thus construction is bounded against the standalone witness rather than the remaining complete transcript. The final accepted transcript still has the correct single envelope.

Independent `construction-02` runs actual imported selector/nativeEvent/observer. A legitimate ordinary generate result with4050 raw padding entries and1000 unused metadata keys yields a frozen1001-key witness and a5099-node selected graph. Native finish event construction likewise completes a1001-key witness while prefix+finish totals5092nodes. Subsequent observeGenerate/observeStream deny GRAPH_LIMIT. The probe preserves those correct downstream denials and does not relabel them as failures. Its observed construction outcome substantiates the missing earlier requirement; existing new controls test eventual acceptance/denial and cannot prove construction order.

Repair in a new candidate: construct the witness through the same complete prospective event/transcript builder, using remaining node/encoded-byte/depth capacity before sorting/retaining key strings. Preserve exact initial descriptor safety, full key names, original IEEE number, one shared final allowance and no clipping, CPU counter or caller-supplied counts. Add a control proving construction aborts before an oversized witness is frozen, then rerun the affected new boundaries/source closure and fresh independent gate. Do not edit this frozen C1 evidence.

## Requirements and source/control mapping

| Accepted requirement | Independent assessment | Source and outcome evidence |
|---|---|---|
| Own original finite nonnegative scalar, explicit0, reject-0/nonfinite/wrong kind | PASS offline | provider-cost inspectParent/selectProviderSnapshot; metadata16 controls; outward .000001→2microUSD verified through existing conservativeUsdDecimal/micro |
| Three immediate sorted key/state witnesses, absent vs own null/undefined, safe descriptor/prototype/symbol/accessor/ancestor checks | PASS offline | provider-cost9–61; metadata closed-state adversaries/getter0/ancestor/descriptor controls |
| Discard unrelated values, permit shared unused costDetails, detach/freeze original parents | PASS offline | provider-cost freezeSnapshot; metadata alias/mutation/frozen-state assertions |
| Same generate/finish event, no amount reuse or additional event; embed/V1 unchanged | PASS offline | observer selectGenerate/nativeEvent and closed V1/V2 branches; metadata historical/finish/no-reuse controls;47 original executable/assertion files equal frozen bytes |
| Bound construction against remaining whole prospective transcript before sorting/freezing | **NEEDS_FIXES** | provider-cost14–22,26–37; observer selector/nativeEvent; construction-025099/5092 nodes and downstream rejection |
| Complete accepted canonical prefix ≤512 events/180000UTF8 bytes/4096nodes/depth16, raw8/finish1, no CPU visit counter/count assertions/clipping | PASS for final acceptance | observer observeTranscript/observeStream, canonical unchanged, runner prospective prefix canonicalization; resource4 exact nodes/bytes/depth/event/repeated-prefix controls, metadata raw9/second finish denials. Construction limitation above remains |
| Capture reconstructs canonical reduced shape/states, own-data checks and graph bounds without claiming original prototype reinspection | PASS offline | guard/canonical/validate unchanged; metadata registered capture and resource4; exhaustive byte equality and capture comparisons |
| Raw/native identity, response/model/text/tokens/finish and Object.is same-number correlation; raw tails before finish only | PASS offline | observer rawCostSequences/providerSequence/correlation; metadata mismatches/repeated costs/postfinish/open segment/syntheticflush; stream4 |
| New extraction identifier and source/capsule/key, no old manifest/key reuse, no caller provenance | PASS offline | provider-cost AmountEvidence extraction convex-metadata-cost-correlated-v2; proofs money explicitly refuses amountEvidence; runner compiled pins/P/S bounds; stage6/capability55; exhaustive capsule recomputation and exact VM correspondence |
| Closed original P/S/M1/M2 authority, firsteligible/1000ms/current clock/cancel fence, final direct no-await RPC, owned late work | PASS offline | runner prepareStage/capability/onEvents; no await between finalAdmissionAt predicates and direct ctx.runMutation; C09capability55/C10/admission9/owned10 plus async controls |
| Purge/privacy/no resurrection, immutableT/currentL/fullK | PASS offline | lifecycle/guard/store/repository modules byte unchanged; purge4/capability purge/current-load/refinement controls; public receipt/recovery omit witness/provider amount |
| Preserve fixed14 order/models/options/hash/K314310/profile1536 and no new factory/read | PASS offline | twelve frozen modules unchanged including requests/cases; exact official VM differs only DUMMY factory and public fixed key; adapter14 fake-fetch controls and stage native options |
| Actual keynull/proofs[]/installationfalse/moneyEMPTY/embedUNKNOWN/fullKSTOP; no categories/all-attempt qualification | PASS fail-closed only | installed/proofs/runner; metadata/resource/purge checks; independent-money **FAIL preserved**, observer categories[] and money unknown |
| Preserve original assertions, historical failures and V1 source | PASS preservation; original40 **37PASS3FAIL** | exhaustive-audit-04 verifies47 original files; collector unchanged, original40 raw stdout retains3 actual failures; regression23/6/4/5 PASS |
| Genuine beforeimages, failure history, complete exact-self-only seals and unique files | PASS current-byte evidence with disclosed limits | exhaustive-audit-04 verifies10071 lossless original capture references,88 verification-pinned raw receiptstreams,9 later bookkeeping receipts under full seal; candidate2497/scratch11 exact recursive checks, all nlink1 |

## Independently observed executions

All commands ran offline through own recorder. Receipts preserve UTC start/end, argv, cwd, exit, raw stdout/stderr hashes and source pre/post. Own SHA-unique gzip beforeimages decompress exactly to the captured source. Early pre/post JSON metadata was losslessly compressed to `.json.gz` to reclaim disk; content was not edited. Read either `.json` or `.json.gz` for command brackets. No imported helper assertion or expected outcome was changed.

| Controls | Actual result |
|---|---|
| metadata / metadata-stage / metadata-purge / resource |16/6/4/4 PASS, zero skip |
| c2-capability / c2-capability-c10 |55 PASS / C10 official outcome PASS; inherited helper controls not counted twice |
| c2-admission / c2-owned / c2-retained-refinements / c2-stream |9/10/2/4 PASS; unhandled[] where asserted |
| c2-collect-original-groups |Exit1, total40,37PASS3FAIL,0NOT_RUN,0skip |
| independent-money |Exit1 FAIL; direct synthetic resolver50001, observer money unknown/categories[] |
| independent / independent-account-load / independent-codec / independent-async |6 retained account PASS; corrupt cross-attempt denial with0writes; canonical UTF16/getter0 PASS; owned async rejection with unhandled[] PASS |
| adapter |14 exact fake-fetch wire/model/order controls PASS; mapped historical finish unsupported remains an observation, no native certification |
| regression-offline-check / hostile / refinement-check / independent |23/6/4/5 PASS, native NOT_RUN |
| strict-types / vm-types / typed-lint |Exit0 each; scoped candidate/VM noEmit and complete configured typed lint |
| exhaustive-audit-04 |Exit0;47 assertionfiles,12 unchanged modules, exact VM correspondence,10071 lossless references,88 pinned receiptstreams; original seals match |
| construction-02 |Exit0 diagnostic confirms unmet construction requirement and correct downstream denials |

The original40 failures are preserved: C09/C10 complete part identity loss replay, purge corrupted private canonical, firsteligible persistence response loss. Their historical unchecked issuer path is superseded by exact official capability controls; they remain FAIL in the original assertions, never recounted as success. Money diagnostic remains a material actual-proof blocker independent of the construction finding.

## Pins, history and evidence limits

Candidate report SHA256 b5d04778af29a278617da5fe7d8165f4607e097f60fb555ba8dd501acf494916. QA seal77587788d0d398da6d349399a872f5e91b566b91df79607994117a51c36852a2 includes2497files; scratchseal f4e039811777904cd58d77e9e1806b510bf77ddec1e5347c10c3cae2fc640cfe includes11files. Exact recursive membership, byte hashes, lengths, modes and nlink1 were checked initially and during exhaustive audits, excluding only each namespace's own seal. Nested preimages and partial failed directories are included.

New uninstalled closure405ee8e53fb39732ad5371dd38d9ae060a2b65a604cef27fee927e5f9ffd5d16 was independently recomputed over its declared16modules; separately pinned installed/stage leaves verified. Manifest82e321838f960c6f695fb487e4ccee8729b4fd1df1f07ba5da74e23745f09532, keyID1a4db48bcbc0959348089158ffd5b23e5cfbf125540993aafcc4f6c0fff642de and runnerde45d1e1fa051e72ad159081703b9f57cc056bc17211496311ed87ed98f71566 differ from historical capsule pins. Accepted design155af8a352dc1d19da2910200cba97496ce1115b53c4f3af2b2dc981c32e7f09 and ROOT prospective acceptance652399b42f7b3bb459dcb488eab100b482ce645b131eab2d91df2c1075fababa were read. Corrected design review acknowledges wrong-path historical writes and supplies only prospective corrected evidence; no retrospective scope certification is made.

Historical1670archive hardlink action remains acknowledged. Restoration record and current recursive seal prove all owned regular files now nlink1, with restored byte/mode identity. Original inode/metadata is expressly not claimed. Reading can affect access times; hash equality never proves all metadata or unrelated shared-tree preservation.

Executor first freeze-input check failure is real and preserved: it compared metadata.mjs with stale beforebytes included in a TypeScript-only receipt. Restricting that receipt's currentness requirement to TS/MTS is justified by the actual tsc-only command and noEmit configuration, because it executes/types TS and does not execute the changed JS control. The restriction does not prove the stale JS was unchanged at that earlier time. Current JS assertions are independently rerun with fresh source brackets. No retroactive unchanged-JS claim or deleted failure is accepted.

Own directory creation, recorder bootstrap and direct preliminary read/listing tool calls have no persisted command-specific original beforebytes/UTC receipts; they are conversation-only evidence. Own first construction/audit runs captured all candidate source but initially omitted own newly added probe/audit helper source. construction-02 and exhaustive-audit-03/04 reran with those helpers explicitly captured; earlier outcomes are retained, and initial missing coverage is not reconstructed. Own exhaustive-audit exit1 KeyError arose because verification.json predates nine final bookkeeping receipts; the corrected audit verifies its88 explicitly pinned controls and reports the additional9 under the full seal. It preserves the failed run. Metadata compression is lossless, but its bootstrap shell operation has no command-specific receipt. No native/services/network/Git/private credential/new dependency/subagent/product/frozen QA mutation occurred in this review.

## Dimension scores and recommendation

| Dimension | Score | Basis |
|---|---:|---|
| Requirement fulfillment |3/5|One explicit construction-envelope requirement incomplete; final bounds and fail-closed contracts pass |
| Code quality |4/5|Closed finite validation, descriptor safety, exact source closure and typed checks pass |
| Test quality |4/5|Meaningful imported controls; independent construction probe exposes missing ordering coverage |
| Pattern adherence |4/5|Assigned namespaces, no product/native actions, preserved failures; bootstrap limits disclosed |
| Completeness of bounded offline candidate |3/5|Construction repair and fresh gate required; actual qualification intentionally remains blocked |

Average3.6/5. Keep release held. Repair the construction envelope in a new implementation cycle with refreshed closure/key/source pins and an independently reviewed bounded builder. Actual services, approved extraction/proof registry, method-specific embedding evidence and full category/all-attempt/cancel/reject/drift/finality semantics remain separate incomplete gates. Neither thirty passing new controls nor this review clears those gates.

Own final QA/scratch seals enumerate every recursive file excluding only their own manifest. Final child source audit precedes self-seal bookkeeping. No source write follows freeze.
