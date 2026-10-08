# Standalone managed default-profile repository (design only)

No production model root or previous vector schema import. Profile EXACT accepted six fields: profileId cortex-text-small-1536-v1, modelId openai/text-embedding-3-small, dimensions1536, normalization text-nfc-lf-v1, chunking codepoint-1600-overlap-200-v1, indexName by_default_embedding_v1. PROFILE_HASH is canonical six-field hash, not an invented actual revision. Official native embed model unchanged. Numeric vectors finite1536/-0 refused by mutation before storage; vector index dimensions1536.

Schema design example (registered only in future newly reviewed standalone fixture):

```ts
const scope={tenantHash:v.string(),spaceHash:v.string(),ownerHash:v.string()};
fixtureGrants: defineTable({...scope, grantHash:v.string(), epoch:v.number(),
 operatorHash:v.string(), active:v.boolean(), profileHash:v.string()})
 .index("by_grant",["grantHash"]),
fixtureSources: defineTable({...scope, sourceKey:v.string(), sourceHash:v.string(),
 revision:v.number(), epoch:v.number(), profileHash:v.string(), tombstone:v.boolean()})
 .index("by_source",["sourceKey"]),
fixtureChunks: defineTable({...scope, sourceId:v.id("fixtureSources"), chunkKey:v.string(),
 sourceRevision:v.number(), sourceHash:v.string(), profileHash:v.string(), textHash:v.string(),
 tombstone:v.boolean()}).index("by_chunk",["chunkKey"]),
fixtureVectors: defineTable({...scope, sourceId:v.id("fixtureSources"),chunkId:v.id("fixtureChunks"),
 sourceRevision:v.number(),sourceHash:v.string(),profileHash:v.string(), vector:v.array(v.number()),
 receiptHash:v.string(),dispatchIdentity:v.string(),writeKey:v.string(),tombstone:v.boolean()})
 .index("by_write",["writeKey"])
 .index("by_source",["sourceId"])
 .vectorIndex("by_default_embedding_v1",{vectorField:"vector",dimensions:1536,
 filterFields:["tenantHash","spaceHash","ownerHash","profileHash"]}),
fixtureStages: defineTable({accountHash:v.string(),scenarioId:v.string(),dispatchIdentity:v.string(),
 stageHash:v.string(),privateCanonical:v.string(),trigger:v.string(),sourceEpoch:v.number(),
 grantEpoch:v.number(),createdAt:v.number()}).index("by_dispatch",["dispatchIdentity"])
```

Table validators are necessary Convex primitives, not full semantic validation: every internal repository handler exact-key validates H/ID/Epoch/N from receipt contract, table IDs via corresponding v.id, exact stored profileHash, all scope fields H; createdAt Time. Table writes internal only. Grants/source/chunks provision operator-only internal root action/mutations on verified fixture target, never caller-derived tenant claims. At most1grant/1source/1chunk/E11vector plus at most2stage records per account, no dynamic corpus. fixtureSources owns source revision/hash, chunks own deterministic one-chunk textHash; no canonical request text or vector in public receipt. Source model/chunk profile belongs server constant; deployment/profile epochs bound in account. Sources contain no user data. Unique query via indexes prevents duplicate silently accepted rows; >1 match corrupt/STOP.

```ts
interface RepoFence {binding:BindingV2; tenantHash:H;spaceHash:H;ownerHash:H;
 grantId:Id<"fixtureGrants">;sourceId:Id<"fixtureSources">;chunkId:Id<"fixtureChunks">;
 sourceHash:H;sourceRevision:Epoch;chunkTextHash:H;profileHash:H;dispatchIdentity:H}
writeE11(ctx:MutationCtx, fence:RepoFence, vector:number[], receiptHash:H):
 {kind:"written"|"replay";vectorId:Id<"fixtureVectors">;vectorHash:H}|
 {kind:"denied";reason:"stale"|"scope"|"closed"|"collision"};
readOwned(ctx:QueryCtx,fence:RepoFence,vectorId:Id<"fixtureVectors">):
 {kind:"current";sourceHash:H;sourceRevision:Epoch;vectorHash:H}|
 {kind:"denied";reason:"stale"|"scope"|"closed"};
searchE14(ctx:ActionCtx,fence:RepoFence,queryVector:number[],limit:1):
 Promise<{kind:"current";matches:Match[]}|{kind:"denied";reason:"stale"|"scope"|"closed"}>;
deleteOwned(ctx:MutationCtx,fence:RepoFence):{tombstoned:true};
```

Match EXACT {sourceKey:H,sourceRevision:Epoch,sourceHash:H,profileHash:H,score:number}; score finite/-0 refused, at most1 match, NO IDs/vector/text/private/tenant/grant in public result. Internal vectorSearch candidate score/id stays private and must validate before hydration. Unscored read receipt never returns vector except a separate internal root cleanup/evidence method with current authority. Public runner result cannot hydrate staging/private tables. Operation fence must match account manifest binding and E11/E14 attempts; write allowed ONLY E11 with first-capture-qualified terminal+money+serving+usage, attachment authority current, exact finite profile vector/hash/native correspondence. E12/E13 have no write path at all. E14 query search permitted ONLY qualified terminal+money+serving+usage/current authority with separately admitted E14 identity, not E11 native-hash reuse. Empty actual proof registry means these methods currently deny closed until qualified facts exist; managed evidence NOT_RUN.

Atomic fence checker in EVERY mutation/query rereads account, grant, source, chunk by exact IDs; checks operator/grant hash+epoch active, scope equal on all rows, source epoch/revision/hash/profile matches fence/account, !tombstone, chunk sourceId/revision/hash/textHash/profile+scope exact and !tombstone, current window/proof/profile/source flags and !revoked/cancelled/stopped/closed authority. Production source IDs/hashes are never accepted. Current profile epoch may come from account fixed binding and current profile flag; no separate mutable profile alias. Proof actual model can never silently relabel vector profile.

writeKey=H(canonical{account binding, E11 dispatchIdentity, sourceId,sourceRevision,sourceHash,chunkId,chunkTextHash,profileHash}). One transaction checks all fences and unique writeKey; absent -> inserts exactly1vector. Existing exact dispatch/receipt/vectorHash/profile/source tuple -> replay zero writes; differing vector/receipt/current source -> collision zero writes plus explicit STOP-control path. Async native embedding occurs outside mutation; recheck all current records AFTER embedding in write mutation, never rely on before-inference check. A stale/revoked/deleted source yields denied0writes and no vector resurrection.

searchE14: first internal query returns exact fenced snapshot + opaque epoch binding. Action invokes official ctx.vectorSearch("fixtureVectors","by_default_embedding_v1",{vector:queryVector,limit:1,filter:q=>q.and(q.eq("tenantHash",...),q.eq("spaceHash",...),q.eq("ownerHash",...),q.eq("profileHash",PROFILE_HASH))}). Vector index cannot filter source/tombstone; final internal hydrate query therefore rereads account/grant/source/chunk and EVERY returned vector atomically, revalidates original snapshot source revision/hash/epoch/grant/profile and each vector owner/source/chunk/profile/revision/hash/receipt against current source. Tombstoned/stale/wrong scope candidate is excluded, no fallback/increasedlimit/rescan. If authority/source changes between preflight and hydration -> denied/no matches, not a misleading fresh empty success. At most1 candidate, return one allowlisted Match; zero candidates under current fence -> current matches[]. Caller's limit/model/filter arguments are not accepted. After hydration runner must recheck authority immediately before emitting public summary; if revoked in intervening action gap, withhold. Query transaction is authoritative hydration point, not promise of atomic transaction across asynchronous index search.

Delete mutation rereads exact owned fence then marks source/chunk/vector tombstone atomically, increments source revision/epoch, closes account authority/sourceCurrent and stage/private attachments in same transaction. Subsequent cleanup may physically delete vectors/stage bytes only after evidence hashing, preserving tombstone until root target retirement. Unique owned max1source/vector makes bounded collect limit2 with >1 corruption denial, no global purge. Revocation sets grant.active=false and grant epoch+1, closes account attachments and stage read authority atomically. Wrong tenant/space/owner/grant denies0writes; stale fence cannot delete somebody else's rows.

Negative controls: source revision/hash edited during embedding => E11 denied0insert; duplicate exact write =>0newrows; different receipt/hash=>collision; wrong scope/profile1536/finite shape=>0writes; E12/E13 invocation=>no write function; deletion during embedding=>tombstone survives/no resurrection; source/grant mutation after vectorSearch awaits but before hydrate=>denied no Match; stale candidate =>excluded; wrong index/profile query=>denied before vectorSearch; two unique write rows=>corruption STOP, never choose first. Genuine managed search/native transaction outcomes remain NOT_RUN.

Private evidence table is additionally defined in observer-proofs.md: at most42 records/account (first+2refinements across14 attempts), each <=180000 canonical bytes; no keys/headers/request prompts stored, all access internal. It is a bounded evidence store, not a permit/charge authority. Stage rows max2 per account. Table schema primitives accept numbers/strings but semantic exact parsers impose Epoch/H/private byte limits and zero unknown fields on every handler before database calls; proof IDs never become Convex authorization IDs. A source tombstone is a durable authority fact, not deleted until target retirement.
