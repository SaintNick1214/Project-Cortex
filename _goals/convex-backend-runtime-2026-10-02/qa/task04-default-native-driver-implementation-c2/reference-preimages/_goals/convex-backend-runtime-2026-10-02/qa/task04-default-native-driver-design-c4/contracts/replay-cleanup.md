# C3 immutable staging replay and closed-account lifecycle authority

This contract resolves the two C2 conflicts. Its operation-specific ordering is normative together with corrected current staging/managed contracts; lineage is historical evidence only. No actual/native/provider/managed behavior is certified. Format version2 is schema version, never incremented. Convex row OCC validates reads/writes; there is NO custom storage revision field. “one write” assertions count committed db insert/replace/patch operations by table and successful transaction publication, not a version2->3 transition. Capture updates one account row; stage/cleanup transactions can write several distinct rows, whose exact bounded count is specified. Failed/denied/collision/replay transactions have zero db writes unless a separate explicit STOP-control transaction is called.

## Persisted complete stage identity

```ts
interface StageIdentity { version:1; scenarioId:"C09"|"C10";
 dispatchIdentity:H; binding:BindingV2; partSequence:N; rawPartDigest:H;
 stageCanonicalHash:H; trigger:"revoke"|"cancel" }
interface StageRow {accountHash:H;scenarioId:"C09"|"C10";dispatchIdentity:H;
 stageIdentityCanonical:string;stageIdentityHash:H;partSequence:N;rawPartDigest:H;
 stageHash:H;privateCanonical:string;trigger:"revoke"|"cancel";
 sourceEpoch:Epoch;grantEpoch:Epoch;createdAt:Time}
```

stageHash=SHA256(UTF8 canonical {text}); stageCanonicalHash=stageHash. stageIdentityCanonical=accepted canonical(StageIdentity) <=4096bytes; stageIdentityHash=SHA256(that UTF8). Binding includes immutable dispatch's pre-trigger grant/source epochs/target/operator/manifest/import-closure. It does not adopt post-trigger epochs. Persist all named StageRow fields with exact own-key validation; verify redundant scenario/dispatch/partSequence/rawPartDigest/trigger/hash/epochs equal identity every load. Table unique by_dispatch; >1rows corruption/STOP, never choose one. partSequence identifies contiguous native event sequence0..511; rawPartDigest is digest of EXACT correlated raw part nomination, not just its text. C09 trigger revoke; C10 trigger cancel; anything else invalid.

stageAndTrigger args EXACT {scenarioId,dispatchIdentity,binding,stageCanonical,stageHash,partSequence,rawPartDigest}, internal owned observer only. Server derives StageIdentity trigger and hashes. stageCanonical valid nonempty bounded {text}; argument stageHash must match computed hash. Same-text different sequence/raw digest yields different StageIdentity. Historical record hashes are nomination identity, not actual serving/cost/decoder proof.

### Branch precedence

1. Validate exact argument structure/canonical bounds, derive fixed scenario/trigger and complete identity, then read account+attempt+unique StageRow using ORIGINAL immutable dispatch binding. Authenticate server-owned observer capability or ROOT closed-recovery operator; neither can be caller-provided hash or a grant-renewal. Verify account installed binding, exact attempt/checkpoint/scenario/dispatch and row immutable operator/target/account ownership. This step does NOT require live grant/current old epoch/!revoked/!cancelled/!stopped because it can only inspect existing immutable receipt identity.
2. If StageRow EXISTS and its complete stageIdentityCanonical+hash+stageHash/private bytes identity match requested identity: return {kind:"replay",trigger,stageIdentityHash,stageHash}, ZERO writes, BEFORE live fences. Public/operator return contains hashes only; never privateCanonical/text, never invokes control/factory/token/native, reopens attachment or renews a window. This branch recovers exact committed C09/C10 response loss after their own closure.
3. If StageRow EXISTS but requested complete identity differs: return {kind:"collision",reason:"part-identity"}, ZERO writes. Same text with changed sequence/digest is collision. No second stage insertion, no refreshed-grant acceptance. Dispatcher may call idempotent separate STOP-control (already revoked/cancelled remains closed, often0writes). Altered immutable dispatch binding is forbidden/identity-denied before the row is usable, never a historical replay.
4. If StageRow ABSENT: apply ordinary live staging/inference fences (current owner/origin grant/source/profile/hypothesis source snapshot, no STOP/revoke/cancel/tombstone, active inflight same attempt, current original deadline); late/new part returns {kind:"denied",reason:"closed"|"ineligible"|"stale"}, ZERO writes. Historical recovery capability never inserts a new stage. Original observer capability can insert only while live/eligible/current. Account/source epoch changes cannot be normalized to allow insertion.
5. Fresh eligible insertion atomically inserts1StageRow, replaces1account row setting attempt trigger identity hash/control/closed attachments, and C09 updates1grant row inactive+epoch+1. C10 does not mutate grant. Total writes C09=3/C10=2; monetary known/reserved/active unchanged. No acknowledged or unknown-response state can have a committed stage without control. Transaction rollback commits0rows. Same-key retry follows branch2. No new native request.

Attempt triggerStageHash remains stageHash (content hash), add triggerIdentityHash:H|null REQUIRED to AttemptV2, null iff trigger none, exact StageRow stageIdentityHash otherwise. Account parser validates retained trigger canonical/hash plus StageRow relation before purge or exact retained purge T relation after purge via internal load before any control-sensitive operation, without exposing staging bytes. Existing immutable v1/synthetic packets unchanged; C3 future fixture alone gains these fields.

## Operation-specific authority

Live read/write/search/new-stage inference keeps all C2 fresh grant/source/profile/closure fences. Destructive/recovery operations use ROOT ownership authority, not the inference grant. Identity is obtained from verified root operator ctx.auth (or reviewed operator-only internal rootcontrol closure) and hashed server-side; caller arguments never supply identity/principal/operator credentials. ROOT authority is installed exact target+operator+account/manifest binding, independent of revoked experiment inference grant. It neither grants new inference nor authorizes private result hydration. New staging only owned observer; closed root control may inspect/replay existing receipts, never manufacture them.

```ts
interface RootOwned {accountHash:H;targetHash:H;manifestHash:H;operatorHash:H;
 tenantHash:H;spaceHash:H;ownerHash:H;sourceId:Id<"fixtureSources">;
 chunkId:Id<"fixtureChunks">;grantId:Id<"fixtureGrants">}
interface DeleteIntent {owned:RootOwned;cleanupKey:H;expectedSourceRevision:Epoch;
 expectedSourceEpoch:Epoch;expectedGrantEpoch:Epoch}
interface RevokeIntent {owned:RootOwned;revokeKey:H;expectedGrantEpoch:Epoch}
type Deny={kind:"denied";reason:"wrong-owner"|"wrong-scope"|"wrong-target"|"stale"|"corrupt"};
deleteOwned(ctx:MutationCtx,intent:DeleteIntent):
 {kind:"tombstoned"|"replay"|"already-tombstoned";receiptHash:H}|Deny|
 {kind:"collision";reason:"intent-identity"};
revokeOwned(ctx:MutationCtx,intent:RevokeIntent):
 {kind:"revoked"|"replay"|"already-revoked";receiptHash:H}|Deny|
 {kind:"collision";reason:"intent-identity"};
inspectTrigger(ctx:QueryCtx,args:{accountHash:H;dispatchIdentity:H}):
 {kind:"recorded";trigger:"revoke"|"cancel";stageHash:H;stageIdentityHash:H}|
 {kind:"absent"}|Deny;
recoverOwnedEvidence(ctx:QueryCtx,args:{owned:RootOwned}):
 {kind:"summary";evidenceSnapshotHash:H;sourceTombstoned:boolean;grantActive:boolean;
 stageReceipts:{scenarioId:"C09"|"C10";stageHash:H;stageIdentityHash:H}[];
 active:CaseId|null;reserved:N;known:N;stopped:boolean}|Deny;
purgeOwnedPrivate(ctx:MutationCtx,args:{owned:RootOwned;purgeKey:H;
 evidenceSnapshotHash:H}):{kind:"purged"|"replay";receiptHash:H}|Deny;
```

Every recovery/destruction derives verified ROOT operator, checks RootOwned equals installation's exact source/chunk/grant IDs + immutable tenant/space/owner/target/manifest/account and each existing row ownership. Deleted/closed inference grants do not invalidate root identity, but wrong root operator/target/scope always denied0writes; no selectors permit broad corpus cleanup. Public summaries contain no source/vector/text/raw/keys/grant ID/private bytes; internal args IDs are selectors, never returned privately through inspectTrigger. Summary is bounded at most14attempts/2stages/42evidence rows, only hashes/liabilities. inspectTrigger accepts original closed attempt, no live grant predicate or current source epoch requirement; absent+closed is honest absent, never authorize new stage. Pending/unknown RPC recovery reads only existing commit truth.

Ownership of source/chunk/grant cannot change: rows keep immutable creation binding/accountHash fields REQUIRED (add accountHash+targetHash+operatorHash+manifestHash to all fixture grant/source/chunk/vector/evidence/stage rows), and repository checks them. Root cannot delete by “current claimant owner” after scope transfer; foreign row mismatch corrupt/denied. Native target identifiers/signing material remain root-private, not in this packet. Source revision/hash can change within owned fixture but ownership metadata never changes. Destructive intent expected epochs must match current rows for FRESH effect; stale intent denies0writes. STOP/revoked/cancelled/attachedclosed alone are NOT stale deletion fences.

## Lifecycle receipt table and replay

fixtureLifecycle exact row/canonical/domain/projection schema and every-load validation are now normative in hash-recovery.md. It retains intentCanonical/receiptCanonical plus before/after/evidence/liability/trigger canonical preimages, all exact hashes/redundancies; combined row<=65536bytes, max1record/operation/account. This is immutable control/evidence receipt storage, NEVER a monetary/permit ledger. No aggregate hash is treated as an invertible trigger record.


For delete/revoke: ROOT ownership first, exact intent parse/hash and existing lifecycle lookup BEFORE current epoch/tombstone/active-grant checks. Existing same complete intent -> replay receipt ZERO writes, including original expected epochs which became stale due to its own effect. Existing same key changed expected epoch/owned fields => collision0writes; unrelated wrong owner still denied before receipt disclosure. If no same-key receipt but operation receipt already exists (max1), only same complete intent allowed; new key cannot create new lifecycle authority. If resource already tombstoned/inactive due to a prior SOURCE deletion/C09 effect with NO root lifecycle receipt: check current expected epochs+ownership, return already-tombstoned/already-revoked with computed existing-state receiptHash0writes, no new lifecycle record or repeated epoch bump. Otherwise current expected epochs plus exact owned rows permit fresh effect. This gives finite no-write repeats without accepting stale ownership.

Fresh delete rereads account/grant/source/chunk/all owned vector<=1/stage<=2/evidence<=42/lifecycle atomically; invalid cardinality corrupt/denied. Compute before/evidence hashes from bounded private data internally, without delivering bytes. Tombstone source/chunk/vector and source revision+epoch+1; set account.sourceCurrent=false/close attachments/privateCanonical, preserving known/reserved/active/original attempt facts. Grant may already inactive; delete does NOT increment/regrant it. Retain original private staging/evidence until evidence snapshot and root purge proof. Insert1delete receipt same transaction. Writes max source1+chunk1+vector1+account1+lifecycle1=5, fewer if no vector/no account closure change; no change rows not rewritten. All liability fields equal pre/post. Delete after unknown STOP or C09 revoke works because ROOT ownership fence ignores only inference grant activity/STOP/closure, not ownership/current expected epochs. Repeat exact intent0writes.

Fresh revoke verifies ROOT ownership/current expected grant epoch, updates1grant active=false epoch+1 and1account revoke/private-close, inserts1revoke receipt; max3writes. Already-revoked C09 grant returns already-revoked0writes with current expected epoch. No inference grant refresh, source/profile/model change or window renewal. Every new hidden third call remains impossible.

recoverOwnedEvidence builds exact versioned E/L/T/S canonical projections and hashes per hash-recovery.md in query transaction and returns only evidenceSnapshotHash plus allowlisted summary. ROOT may retain sanctioned bounded raw evidence through a separate **not provided/not authorized here** private storage workflow; this API never returns it. No unspecified read-current exception is needed for cleanup: hashing can happen server-side after closure.

purgeOwnedPrivate requires target/source tombstoned and grant inactive, installed ROOT identity/owned scope, current evidenceSnapshotHash recomputed in SAME mutation and matching supplied hash; stale snapshot denies0writes. This hash is root acknowledgment of evidence frozen/retained receipt, not an invented actual proof. First purge creates immutable purge lifecycle receipt and deletes ONLY owned private stages<=2/evidence<=42/vector<=1 bytes; keeps source/chunk tombstones, all experimentControls monetary/attempt facts and lifecycle receipt hashes. Account privateCanonical already null; forbid purging active liability facts, permits or tombstones. max46deletions+writes (2stage+42evidence+1vector+1receipt). Existing exact purge intent replay before current evidence recompute returns0writes even though private rows have gone; mismatched key/snapshot collision/denial. Root must preserve summary/evidence hashes outside the target before final retirement; unresolved upstream lifetime/charge remains unknown, active slot/reservation are never released by purge/retirement.

Wrong owner on closed-account deletion/recovery/inspect/purge => denied0writes/no summary/private leak; new stale expected epoch delete => denied0writes; exact own prior effect replay => receipt0writes; new stage after closure with no row => denied0writes; same-text changed historical stage => collision0writes. There is no live-authority bypass for inference/read/search/attachment, and cleanup never revives a run, delivers result, mints a token or invokes native.

Exact alias used by managed-fixture.md:
```ts
type DeleteResult={kind:"tombstoned"|"replay"|"already-tombstoned";receiptHash:H}|
 Deny|{kind:"collision";reason:"intent-identity"};
```

Post-purge distinction: source/chunk/account/lifecycle tombstones/attempt trigger hashes are retained. inspectTrigger returns recorded from immutable attempt.trigger/triggerStageHash/triggerIdentityHash corroborated by existing StageRow BEFORE purge or retained full triggerCanonical/T in a fully validated immutable purge lifecycle receipt AFTER purge; missing StageRow without that owned purge receipt is corrupt, never absent-success. Exact stageAndTrigger replay after private StageRow was intentionally purged returns denied closed (no new insertion/private recreation); operator recovery still returns persisted hash-only trigger fact. Thus replay availability does not require indefinite retention of private staging bytes, and purge does not erase historical control/liability evidence. The post-purge path never reports a nonexistent stage as a newly successful mutation.

C4 hash-recovery.md freezes ALL lifecycle hash domains/preimages/row redundancies/no-write hashes and retained triggerCanonical relation. Historical L/S snapshots are never compared against current late-refined liability. Account retainedTriggerCanonical/SetHash is immutable except fresh atomic staging addition and is included in each lifecycle E/S/R projection.
