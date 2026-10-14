/** Raw official component reads only; no stored validation decision. */
import { beforeEach, afterEach, expect, it, jest } from "@jest/globals";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { CutoffV1 } from "../../../src/domain/transcript";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { createAuthorityReadScope, freshNativeTranscriptReads, readNativeTranscriptMessages, NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES, NATIVE_TRANSCRIPT_READ_SCOPE_MAX_BYTES, createMemorySourceReadScope, withManagedSourceValidationReads, withNativeSnapshotReads } from "../../../convex-dev/runtimeAuth";
import { transcriptFixture, installMockRoot, transcript } from "../runtimeTranscript/fixture";
beforeEach(() => installMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
async function fixture() { const f = await transcriptFixture(); await f.run(); const ids = [...f.native.messages.keys()];
  const reference = transcript.agentComponent.messages.getMessagesByIds;
  return { ...f, ids, read: (ctx = f.ctx, selected = ids) => readNativeTranscriptMessages(ctx, reference, selected) }; }
it("default/unscoped remains uncached; nested opted-in helper shares exact IDs/order and detached raw rows", async () => {
  const f = await fixture(), spy = jest.spyOn(f.ctx, "runQuery"); await f.read(); await f.read(); expect(spy).toHaveBeenCalledTimes(2);
  const ctx = createAuthorityReadScope(f.ctx, { nativeTranscript: true }); const first = await f.read(ctx), second = await f.read(createAuthorityReadScope(ctx));
  expect(first).toEqual(second); expect(first).not.toBe(second); expect(spy).toHaveBeenCalledTimes(3);
  first[0]!.message = { role: "user", content: "local mutation" }; expect(await f.read(ctx)).toEqual(second);
  await f.read(ctx, ["missing", ...f.ids]); await f.read(ctx, [...f.ids, "missing"]); expect(spy).toHaveBeenCalledTimes(5);
  expect(spy.mock.calls.map(([, args]) => args)).toEqual([{ messageIds: f.ids }, { messageIds: f.ids }, { messageIds: f.ids }, { messageIds: ["missing", ...f.ids] }, { messageIds: [...f.ids, "missing"] }]);
});
it.each(["insert", "patch", "replace", "delete"] as const)("%s invalidates raw native reads before/after, including nested scopes", async method => {
  const f = await fixture(), spy = jest.spyOn(f.ctx, "runQuery"), parent = createAuthorityReadScope(f.ctx, { nativeTranscript: true }), ctx = createAuthorityReadScope(parent), id = f.principal._id as Id<"runtimeAuthPrincipals">;
  await f.read(parent); await f.read(ctx);
  if (method === "insert") await ctx.db.insert("runtimeAuthPrincipals", { issuer: "other", subject: "other", actorKind: "user", version: 1, createdAt: 1 });
  if (method === "patch") await ctx.db.patch("runtimeAuthPrincipals", id, { metadataUserId: "updated" });
  if (method === "replace") await ctx.db.replace("runtimeAuthPrincipals", id, { issuer: "other", subject: "other", actorKind: "user", version: 1, createdAt: 1 });
  if (method === "delete") await ctx.db.delete("runtimeAuthPrincipals", id);
  await f.read(parent); await f.read(ctx); expect(spy).toHaveBeenCalledTimes(2);
});
it.each([false, true])("pending child mutation suppresses hits and failed reads are not cached, failure=%s", async failure => {
  const f = await fixture(), spy = jest.spyOn(f.ctx, "runQuery"); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const error = Error("CHILD_FAILURE"); const parent = { ...f.ctx, runMutation: async () => { await gate; if (failure) throw error; return null; } }; const ctx = createAuthorityReadScope(parent, { nativeTranscript: true });
  await f.read(ctx); const write = ctx.runMutation(); void write.catch(() => {}); await f.read(ctx); await f.read(ctx); expect(spy).toHaveBeenCalledTimes(3);
  release(); if (failure) await expect(write).rejects.toBe(error); else await write; await f.read(ctx); expect(spy).toHaveBeenCalledTimes(4);
  freshNativeTranscriptReads(ctx); spy.mockRejectedValueOnce(error); await expect(f.read(ctx)).rejects.toBe(error); await f.read(ctx); expect(spy).toHaveBeenCalledTimes(6);
});
it.each(["fresh", "writer"] as const)("a late read cannot repopulate after the %s epoch", async boundary => {
  const f = await fixture(), raw = f.ctx.runQuery.bind(f.ctx) as (...args: Parameters<MutationCtx["runQuery"]>) => ReturnType<MutationCtx["runQuery"]>; let enter!: () => void, release!: () => void; const started = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; }); let first = true;
  jest.spyOn(f.ctx, "runQuery").mockImplementation(async (...args: Parameters<MutationCtx["runQuery"]>) => { const value = await raw(...args); if (first) { first = false; enter(); await gate; } return value; });
  const ctx = createAuthorityReadScope(f.ctx, { nativeTranscript: true }), read = f.read(ctx); await started;
  if (boundary === "fresh") freshNativeTranscriptReads(ctx); else await ctx.db.patch("runtimeAuthPrincipals", f.principal._id as Id<"runtimeAuthPrincipals">, { metadataUserId: "changed" });
  release(); await read; await f.read(ctx); expect(f.ctx.runQuery).toHaveBeenCalledTimes(2);
});
it("finite keys/byte bounds fall through, and fresh native/RPC contexts do not share", async () => {
  const f = await fixture(), spy = jest.spyOn(f.ctx, "runQuery"), ctx = createAuthorityReadScope(f.ctx, { nativeTranscript: true });
  for (let i = 0; i < NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES; i++) await f.read(ctx, ["missing:" + i]);
  await f.read(ctx); await f.read(ctx); expect(spy).toHaveBeenCalledTimes(NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES + 2);
  const child = createAuthorityReadScope(f.ctx, { nativeTranscript: true }); await f.read(child); await f.read(child); expect(spy).toHaveBeenCalledTimes(NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES + 3);
  f.native.messages.get(f.ids[0])!.message = { role: "user", content: "x".repeat(NATIVE_TRANSCRIPT_READ_SCOPE_MAX_BYTES + 1) }; const huge = createAuthorityReadScope(f.ctx, { nativeTranscript: true }); await f.read(huge); await f.read(huge); expect(spy).toHaveBeenCalledTimes(NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES + 5);
});

it.each(["complete", "pending", "failed"] as const)("private hydration's second logical raw read stays fresh across an interleaved %s component writer",async boundary=>{
 const f=await fixture();const claimed=await f.call<{runId:string;attemptNumber:number;leaseVersion:number}>( (await import("../runtimeTranscript/fixture")).runs.claimNext,{reference:f.reference,conversationId:f.db.table("runtimeConversations")[0].conversationId,leaseMs:300000});
 const row=f.db.table("runtimeRuns")[0] as unknown as import("../../../convex-dev/_generated/dataModel").Doc<"runtimeRuns">,conversation=f.db.table("runtimeConversations")[0] as unknown as import("../../../convex-dev/_generated/dataModel").Doc<"runtimeConversations">,snapshot=JSON.parse(row.snapshotCanonical!) as CutoffV1;
 expect(claimed.attemptNumber).toBe(1);const query=f.db.query.bind(f.db);let enter!:()=>void,release!:()=>void,releaseWriter!:()=>void;const entered=new Promise<void>(resolve=>{enter=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;}),writerGate=new Promise<void>(resolve=>{releaseWriter=resolve;});let blocked=false;
 jest.spyOn(f.db,"query").mockImplementation(table=>{const builder=query(table),take=builder.take;builder.take=async cap=>{const value=await take(cap);if(table==="runtimeTranscriptMessages"&&!blocked){blocked=true;enter();await gate;}return value;};return builder;});
 const raw=f.ctx.runMutation.bind(f.ctx) as (...args: Parameters<MutationCtx["runMutation"]>) => ReturnType<MutationCtx["runMutation"]>,failure=Error("INTERLEAVED_WRITER_FAILED");
 jest.spyOn(f.ctx,"runMutation").mockImplementation(async (...args:Parameters<MutationCtx["runMutation"]>)=>{if(boundary==="pending")await writerGate;if(boundary==="failed")throw failure;return await raw(...args);});
 const reads=jest.spyOn(f.ctx,"runQuery"),ctx=createAuthorityReadScope(f.ctx,{nativeTranscript:true}),hydration=transcript.hydratePrivateCutoff(ctx,conversation,row,snapshot);void hydration.catch(()=>{});await entered;
 const writing=ctx.runMutation(transcript.agentComponent.messages.updateMessage,{messageId:f.ids[0],patch:{message:{role:"user",content:"interleaved native edit"}}});void writing.catch(()=>{});
 if(boundary==="complete")await writing;
 if(boundary==="failed")await expect(writing).rejects.toBe(failure);
 release();if(boundary==="complete")await expect(hydration).rejects.toThrow("STALE_TRANSCRIPT");else {await hydration;releaseWriter();if(boundary==="pending")await writing;}
 const nativeReads=reads.mock.calls.filter(([ref])=>String((ref as Partial<Record<symbol,string>>)[Symbol.for("toReferencePath")]).endsWith("/getMessagesByIds"));expect(nativeReads).toHaveLength(2);
});

it("original private hydration validates the same canonical cutoff while sharing only official raw messages across helper traversals", async () => {
  const f = await fixture(), { runs } = await import("../runtimeTranscript/fixture");
  await f.call(runs.claimNext, { reference: f.reference, conversationId: f.db.table("runtimeConversations")[0].conversationId, leaseMs: 300000 });
  const row = f.db.table("runtimeRuns")[0] as unknown as import("../../../convex-dev/_generated/dataModel").Doc<"runtimeRuns">;
  const conversation = f.db.table("runtimeConversations")[0] as unknown as import("../../../convex-dev/_generated/dataModel").Doc<"runtimeConversations">, snapshot = JSON.parse(row.snapshotCanonical!) as CutoffV1;
  const spy = jest.spyOn(f.ctx, "runQuery"), oldView = withManagedSourceValidationReads(f.ctx, createMemorySourceReadScope(f.ctx));
  const expected = [await transcript.hydratePrivateCutoff(oldView, conversation, row, snapshot), await transcript.hydratePrivateCutoff(oldView, conversation, row, snapshot)];
  const oldCalls = spy.mock.calls.map(([,args]) => args); spy.mockClear();
  const view = withNativeSnapshotReads(f.ctx, createMemorySourceReadScope(f.ctx));
  expect([await transcript.hydratePrivateCutoff(view, conversation, row, snapshot), await transcript.hydratePrivateCutoff(view, conversation, row, snapshot)]).toEqual(expected);
  expect(spy.mock.calls).toHaveLength(1); expect(oldCalls).toHaveLength(4); expect(spy.mock.calls[0][1]).toEqual(oldCalls[0]);
  const changed = { ...f.ctx }; f.native.messages.get(f.ids[0])!.message = { role: "user", content: "later native transaction edit" };
  await expect(transcript.hydratePrivateCutoff(withNativeSnapshotReads(changed, view), conversation, row, snapshot)).rejects.toThrow("STALE_TRANSCRIPT");
  await expect(transcript.hydratePrivateCutoff(f.ctx, conversation, row, snapshot)).rejects.toThrow("STALE_TRANSCRIPT");
  console.info(JSON.stringify({ type: "k29-private-hydration-raw-messages", originalPhysical: oldCalls.length, currentPhysical: spy.mock.calls.length - 2, originalLogical: 4, nativeLatency: "NOT_RUN" }));
});
