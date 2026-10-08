# Metadata retention C2: replayable shape and exact resource boundary

Status: DESIGN ONLY; fresh independent review required. C1 NEEDS FIXES report SHA256ae0da221338d40c55165230e2e80e65734f7b0a0d64b0798da80f318233fead5 and coordinator rejection remain unchanged. This C2 replaces only C1's discarded-descriptor/cumulative-visit budget paragraph. Original source findings, original-number semantics, raw/native/dispatch correlation, privacy/stage/purge obligations and positive-money blockers remain requirements.

## Concrete repair

Retain a bounded private shape witness alongside the already proposed providerCost projection in the SAME generate or finish event:
providerShape = exact tuple [sourceParent, metadataParent, convexParent].
Each parent entry is exact {state:"record"|"missing"|"invalid", keys:string[]}.
Record keys are ALL immediate own string key names, sorted by accepted UTF16 lexical order, unique, well-formed. Each key must have a present enumerable data descriptor; no inherited key, symbol, accessor or nonenumerable key is admissible as record. Missing/invalid keys arrays are empty. SourceParent is result for generate or native finish part for stream and must be record for admissible retained amount. MetadataParent is its own providerMetadata; convexParent is that record's own convexGateway. Missing includes absent/null/undefined. Invalid includes unsupported kind/prototype/selected-parent ancestor alias/reflection rejection. Invalid shape cannot qualify amount even if another projection says present.

The native selector creates this witness synchronously from original descriptors, alongside the exact scalar cost; no caller supplies a count or witness choice. Witness snapshots are new frozen ordinary data, with no original references. Provider cost is present only when all three entries are record, sourceParent.keys contains providerMetadata, metadataParent.keys contains convexGateway, convexParent.keys contains cost, and the own descriptor value is the finite nonnegative non--0 original number. A present number requires no amount conversion yet. Missing/invalid states and keys must structurally agree: missing metadata requires absent/null/undefined parent and convex missing; invalid metadata gives convex invalid; missing convex or cost makes cost missing. Keys alone cannot distinguish absent from own null/undefined or recover a discarded value; initial selector records those classifications, and capture validates their finite consistency rather than claiming original object reread.

Other native event kinds do not add a witness. Generate event.data exact new keys are {body,content,finish,usage,metadata,providerCost,providerShape}; finish event.data exact keys {finish,usage,providerCost,providerShape}. Version2 exact tuple/parent/cost validators reject extra fields and states. Embed remains exact historical method-specific V1 with no metadata amount/witness.

Unused values are NEVER recursively retained: costDetails, acceptedPredictionTokens and other namespace values appear only as immediate key-name strings. Provider source legitimately aliases costDetails to raw usage.cost_details; this unused alias is permitted. A selected parent equal to an ancestor remains invalid. The witness carries original key names (potentially private upstream information), so it is stored only in owned private transcript backing and purged with that backing. It is never public metadata, result or summary.

## Deterministic one-allowance accounting

The sole observation DATA budget is the complete detached canonical transcript graph at each prefix: <=512 native events, <=180000 UTF8 canonical bytes, <=4096 nodes, maximum depth16 with root depth0, <=8 original raw usage-bearing chunks, <=1 native finish. All existing raw/body/selected output data AND providerCost AND providerShape inhabit this single graph. No extra selector graph/descriptor-work/prefix-visit allowance or counter is added.

Node definition matches frozen canonical: each occurrence of a scalar/null/array/object increments1; object property NAMES do not separately increment nodes. Object property values and array elements are children at parent depth+1. Shared object identity/cycles in retained graph are refused, so occurrence and traversed-node counts agree. Empty objects/arrays each count1. Witness parent objects/arrays and each key-name STRING value naturally count as nodes; additional immediate original parent keys therefore incur one retained scalar node each, plus their canonical encoded bytes. Fixed witness containers/state strings/cost fields count exactly like every other retained value. There is no abstract three-versus-four source-parent visit charge.

Byte definition is UTF8 length of the entire accepted canonical encoding (sorted object keys, exact scalar JSON encoding). Count every key's encoded spelling, quotes, escape sequences, delimiters and value, including witness key-name strings. Encoding a well-formed supplementary character counts its actual UTF8 representation; control characters count JSON escapes. No human display length, original source key UTF16 length, unescaped byte estimate or caller byte tally is accepted. Depth counts witness arrays/objects too, not original discarded parent depth.

Revalidate a growing prefix from its entire retained graph, once per validation call. CPU work of repeated visits does not add to DATA size; validating an identical prefix100 times has the same data-node/byte result. New event data is added once and all earlier retained events remain counted on every check; no resetting or excluding the prefix history. This is the existing canonical graph-size limit made explicit, not a cumulative CPU quota. Native event creation and subsequent prefix/capture canonicalization may repeat work, but cannot renew the180000/4096 data allowance. The witness is constructed only for its unique native generate/finish event; rerunning a reducer never appends another witness or synthetic event.

Original descriptor/prototype/accessor checks are INITIAL trusted official-source runtime checks. They inspect the original parents to produce a detached snapshot; their ephemeral reflection work is not represented as additional decoder nodes and is not a new allowance. To bound retained construction, collect/sort the key witness only into the same observation builder; stop at the first key whose addition makes the complete prospective transcript exceed the shared node/byte/depth envelope. Never hold a second retained witness outside the budget or clip it to fit. Before sorting, each parent finite key list is bounded by the remaining4096 graph capacity (a necessary precheck, never permission to exceed final canonical size); key-byte accumulation accounts conservative encoded key strings before retaining. Existing reflection creates a key list before checking length; arbitrary hostile Proxy allocations/traps are outside the admitted ordinary native/Convex value boundary, and constant-memory reflection is not claimed. Unsafe reflection or overflow produces UNKNOWN/STOP with no qualified partial witness.

Original descriptor values of unrelated fields are discarded, but their NAME charges are fully replayable because names remain in providerShape. No caller count, source-work assertion or signed count substitutes for actual retained data. A witness is not a proof that accessors/prototypes never existed; original safety rests on the approved official issuer/source installation. Capture separately proves reduced own-data shape, exact graph dimensions and cost/raw correlation. This precise separation is deliberate.

## Capture and source binding

Capture parses exact V2 canonical transcript, recomputes all graph-node/depth/UTF8 limits, revalidates the witness tuple/keys/state consistency, preserved numeric value and raw/native ID/model/text/token/finish linkage, and derives its own source nomination. It can reproduce every charged node/byte/depth from the retained representation. It does NOT claim to reexecute original descriptor/prototype inspection or inspect original unselected values after they have been discarded.

Original-number copying remains Object.is(raw usage.cost,mapped cost), stable across raw usage occurrences; numeric0 is an observed scalar only, absent never0. The accepted IEEE upper-neighbor rational outward microceil remains the sole numeric conversion candidate, including .000001→2microUSD; no Math.round, costNanos, toFixed, token price or lexical-only requirement. Overflow, negative/-0/nonfinite/malformed/oversize remains UNKNOWN; no full cost cap/output-dependent clipping.

Witness/cost are bound to exact V2 event digest and full transcript digest, existing method/dispatch/context/ID/model/native/wire/target/source installation, exact private extraction identifier convex-metadata-cost-correlated-v2 and provider/mapper source pins. A structurally valid arbitrary witness alone is not provider provenance: no caller-labelled witness/source/count/proof may nominate actual money. The future official issuer and capture/source closure must be reviewed together; current compiled registry EMPTY refuses every actual positive. Source/identity authenticity remains an explicit actual/native installation gate, not something key names or hashes prove.

Extra unused key with same scalar projection produces DIFFERENT retained witness and transcript. Capture supplied the smaller witness can correctly recount only that smaller retained snapshot, but cannot certify it belonged to the original larger object unless the trusted-source binding is established. Mutating a retained witness after event construction changes canonical event/transcript hashes; a whole coherent resealing by a caller still supplies no official source provenance or actual proof. Any genuine backing missing/purged returns UNKNOWN/STOP rather than accepting digest-only semantics.

## Frozen requirements retained

The new witness changes proposed V2 bytes relative to C1's proposed V2; C1 was never installed. New design/source installation pins must reflect this exact C2 schema. Historical V1 receipts/transcripts/failures remain byte unchanged and are never upgraded. Raw prefix events are unchanged: no cost/witness added to raw events, unchanged rawPartDigest and firsteligible raw sequence. Source root key names describe the native part/result, not the generated selected event's keys; capture knows this distinction and must not infer an original-key witness from its event projection.

One reader and fixed14 order/models/factories/options/native/wire hashes/U/M/K314310/profile1536 remain. No additional native event/fetch/callback/AI-budget dependency/architecture/estimate/Jev is adopted. Raw usage-only tails before native finish allowed; contradictory repeated costs, postfinish tails, open empty text segment, second finish and synthetic flush remain rejected.

C09/C10 private issuer/verifier capability closure changes only after new installation review; P/S/M1/M2 authority fields/domains, firsteligible semantics, immutable historical replay, no old-key/source-manifest reuse, original1000ms phase, final no-await current fence/direct RPC, owned pending/late work, purge/privacy/immutableT/currentL/no resurrection remain. Witness construction is synchronous before original awaited sealing/preparation; no async work is inserted into final admission block. Additional resource failures leave UNKNOWN/fullK/STOP without native replay, phase reset or liability reset.

Money categories/all attempts/drift/ledger finality/native service/proof registry remain EMPTY. No inference category, guessed rejection/cancellation zero or whole-invocation closure. Stable drift may retain private scalar but cannot qualify delivery or money. Embed remains UNKNOWN. Existing diagnostic FAIL and original C1 rejection remain preserved.

## Acceptance matrix

| DUMMY/subsequent outcome | Required result |
|---|---|
| Identical scalar projection, one extra unused parent key | Scalar equal; witness/digest/nodes/bytes differ by actual retained key string; source shape not discarded |
| Exactly4096 nodes /4097 | Initial retained projection and capture identical allow/deny; no asserted count |
| Exactly180000 bytes /180001; depth16/17 | Same initial/capture outcome, full canonical encoding, no clipping/second envelope |
| Metadata absent/invalid/accessor/prototype/alias | Trusted original selector denies unsafe source; reduced capture validates finite state; never claims original reinspection |
| Shared unused costDetails | Only key name retained, legitimate alias not rejected |
| Parent mutated after snapshot | Frozen witness/scalar/digests unchanged |
| Prefix validation repeated100times | Same size; no repeated CPU charge or allowance renewal |
| New events cumulatively exceed4096/180000 | All history remains counted; reject added event |
| Witness key/state/cost altered but old digest supplied | Capture event/transcript mismatch; deny |
| Caller supplies smaller/coherently rehashed witness | Graph recount applies to supplied graph; actual provenance/positive money remains unqualified |
| Prefix firsteligible/replay/purge/deadline | Raw event identity stable; backing deleted; source/version pins closed; original phase/final fence intact |

Owned resource-controls.mjs is a DUMMY specification model, not production code. It reproduces C1's discarded-information adversary, verifies the witness solves exact boundaries and capture replay, checks cumulative/repeated-prefix/UTF8/depth behavior and scalar/alias/getter0. It does not certify imported current observer/capture/stage wiring, crypto/private key/native/provider service or whole-charge proof.

## Evidence

Minimal command-specific original input preimages and raw UTC/argv/cwd/stdout/stderr/exit/source-after are retained. Initial path listing/bootstrap gaps are honestly NOT_CAPTURED. Public source interpretation and frozen C1 failure are read-only; no historical tree copied. Own exact-self-only recursive QA/scratch seals include nested preimages. No product/source/current installation/oldQA/private/env/network/service/paid/Git/dependency/children writes or actions. Mandatory fresh independent design judgment follows this immutable packet; no implementation release follows this assignment.
