# C09/C10 private staging and server-owned trigger

Approved request/native/wire hashes/models/U/M/K/order/identity ordinals remain unchanged. No prompt is changed to force the trigger. C09 origin revoke and C10 current-owner cancel run LAST after E14; one active attempt still blocks later work while actual lifetime unknown. Complete money proof remains conditional/EMPTY; uncertainty is an expected honest outcome, not accepted billing readiness.

The first eligible persisted part is EXACT server-owned first nonempty native text-delta from the official reader whose well-formed text is correlated to the current raw choice0 delta, stable raw ID/model and unchanged compiled request. Empty delta, reasoning/tool events, unsupported/unmatched raw delta, overbound text, malformed Unicode, changed raw model/ID or authority already closed => NOT eligible. Eligibility does not assert provider termination, complete usage/money or decoder theorem. Private staging is for control-trigger evidence ONLY. It grants no user-visible partial output privilege, cannot be read/hydrated by public runner/observer, and is distinct from captured qualified terminal private attachment. Raw first-part digest/native-private correspondence are server-observed nominations, never inferred actual serving proof.

```ts
stageAndTrigger(ctx:MutationCtx, args:{scenarioId:"C09"|"C10";
 dispatchIdentity:H;binding:BindingV2;stageCanonical:string;stageHash:H;
 partSequence:N;rawPartDigest:H}):
 {kind:"triggered"|"replay";trigger:"revoke"|"cancel";stageHash:H;stageIdentityHash:H}|
 {kind:"denied";reason:"closed"|"ineligible"|"stale"}|
 {kind:"collision";reason:"part-identity"};
inspectTrigger(ctx:QueryCtx,args:{accountHash:H;dispatchIdentity:H}):
 {kind:"recorded";trigger:"revoke"|"cancel";stageHash:H;stageIdentityHash:H}|
 {kind:"absent"}|Deny;
```

Arguments internal-only from the owned observer closure, not public caller text. stageCanonical EXACT {text:string} with nonempty valid-scalar text, <=case conditionalPrivateMaximumBytes; stageHash exact content digest; complete StageIdentity and persisted row fields are defined in replay-cleanup.md and bind sequence/rawPartDigest/dispatch/BindingV2. Whole accumulated private prefix is bounded against same case result envelope before any RPC; only first eligible part is retained, one row max per dispatch/two max per account. Native text after trigger may only be read into bounded withheld-terminal observation, never staged/attached/delivered. This avoids unbounded storage and supplies no additional production stream route.

Before fresh-effect fences, follow replay-cleanup.md branch precedence: authenticate original immutable dispatch/root recovery ownership, compare a persisted complete StageIdentity including sequence/rawPartDigest/binding, and return exact historical replay0writes or changed-part collision0writes. Only when no prior StageRow exists, within ONE mutation reread account+grant+source/chunk/profile/target binding via LIVE managed fence; verify attempt inflight, active exact dispatch, C09/C10, current owner/origin authority and no prior trigger. Validate candidate eligibility nomination/source digest with closed internal staging capability fixed at driver construction and stored expected native-case hash; capture method cannot submit arbitrary stage text. Insert fixtureStages row and update account attempt.trigger/stageHash; C09 revoke original grant (active=false, epoch+1) + account.revoked=true; C10 account.cancelled=true, original owner cancel only. Close every pending/attached private authority and clear privateCanonical, preserve stage evidence internal only. Account and grant updates commit atomically with stage: there is never a published stage without control effect. No financial reservation or active lifetime changes. Triggered account remains permanently delivery-closed.

Persisted means mutation committed, not local reader arrival. Reader must await stageAndTrigger or its original1000ms persistence deadline, retaining both success/failure continuations. On acknowledged trigger, immediately abort local delivery controller/cancel owned reader; true upstream termination still unknown. For C09 authority denial may stop local reading sooner; for both cases installed late handlers retain observed provider terminal/charge if legitimately available, even if local cancel ends reads. No hidden second request to obtain usage/finish. AbortSignal cancellation is supported local control only.

Response loss: durable stage/control committed but RPC response unavailable => runner queries inspectTrigger within original deadline and retries ONLY exact stage persistence. Exact full StageIdentity canonical/hash replay returns kind replay0writes before live fences even after C09 self-revoke/C10 cancel. Same text with changed sequence/rawPartDigest is collision0writes. inspectTrigger uses ROOT closed-account recovery ownership, not live inference grant; it returns only trigger and content/identity hashes. Differing stage for same dispatch collision0writes; dispatcher idempotently STOPs. Query reports kind absent after failed/rolled-back mutation: may retry the same bounded first stage ONLY within original persistence deadline, never a new prompt/request; no stage committed after deadline/closed authority. Timeout while outcome pending closes local delivery, retains K/active, pending counts/continuations; a late committed atomic trigger still closes authority, never reopens/reissues native. No new local deadline per retry.

No eligible part: reader completes without eligible correlated nonempty text, provider rejects, empty output, lifetime deadline or earlier STOP => trigger=none, stage row absent, record NOT_TRIGGERED_NO_ELIGIBLE_PART in sanitized control receipt. Do not revoke/cancel at invented first event, modify input, replay or force another paid call. Capture genuine terminal/complete charge if independently qualified; otherwise unknown/fullK/STOP. C09/C10 probe outcome remains incomplete rather than falsely tested. If private staging exceeds envelope or unsupported part appears, STOP, row absent, no trigger; liability retained.

A genuinely new part with no historical StageRow after authority closure/source/grant change returns denied0writes/no stage. Existing complete identity replays and differing-part collisions follow historical precedence. A pending reader does not prevent control mutation: mutation ordering/OCC fences its next stage/delivery; when control receipt acknowledgment arrives, abort owner reader. A pending stage RPC is owned and cannot delay local delivery closure indefinitely; timeout1000ms closes locally, preserves uncertain trigger. Cleanup1000ms waits bounded pending tasks then records handles/counts; it does not declare provider/reader terminated. Root retirement retains full original-account known/unknown liability and hashes all staging/private evidence before deletion.

Public output never contains staged text/vector/raw/reasoning/control grants. Before complete terminal capture + known qualified money/serving/usage/current authority, terminal attachment is closed. For C09/C10 successful trigger it stays closed forever even if later terminal/full money arrives. Unknown lifetime keeps active; known money charges once, unknown money retains fullK. Full known charge after revoke/cancel may be aboveK/$10; never clipped. E11/E14 likewise require terminal capture before any private commit/read/search. Stage evidence is neither a private result replay cache nor an alternative authority ledger.

Controls with exact expected outcomes:

| Case | committed staging/control | account/money/slot/public outcome |
|---|---|---|
| first eligible C09 |1stage+1atomic revoke/account update|K retained, active same; closed private/public;0newnative|
| first eligible C10 |1stage+1atomic cancel/account update|K retained, active same; closed private/public;0newnative|
| exact duplicate/committed response loss |replay0writes|same stage/control, no native replay|
| differing duplicate |collision0writes then idempotent STOP|same stage/control, no private reopening|
| mutation rollback |0stage/0control; bounded persistence retry only|original K/active intact|
| no eligible part |0stage/0trigger|incomplete probe, capture independently; no replay|
| late part/stale source/wrong owner |denied0stage|closed output, original liability preserved|
| pending stage/reader local deadline |unknown trigger until durable inspect|K/active/pending counts; localabort≠terminal|
| late terminal/full qualified cost |no new stage|release own slot/charge full once if proven; closed output|
| late unqualified cost |no new stage|retain fullK/unknown, no hidden query/nativecall|

Sequential gate consequence: a committed C09 origin revoke leaves the account revoked/STOPed, so later C10 is denied under preserved guard semantics if reached. Do not reset/regrant/renew to force C10. This initial plan has fourteen maximum permits, not guaranteed fourteen executed probes; report C10 NOT_RUN when prior currentness/uncertainty stops the sequence. This is a concrete conservative outcome, not a fabricated provider conflict or permission request.

C3 exact return union/Root recovery authentication and finite row identity override the simplified C2 historical signatures: see replay-cleanup.md. No private text is returned by replay or inspectTrigger.

C4 fresh StageRow commit also atomically updates required account retainedTriggerCanonical/retainedTriggerSetHash using exact nontext T projection in hash-recovery.md; no extra transaction or privilege. Postpurge historical trigger inspection uses retained full T and fully validated purge record, while exact stage mutation replay remains denied closed.
