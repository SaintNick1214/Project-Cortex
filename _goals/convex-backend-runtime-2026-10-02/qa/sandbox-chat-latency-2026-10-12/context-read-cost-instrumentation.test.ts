import fs from "node:fs";
import crypto from "node:crypto";
/** Actual native handlers and installed Workflow executor; controlled DB/component ports, no live OCC/SLO claim. */
import { afterAll, afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { MutationCtx } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/_generated/server";
import { assertNativeArgs } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeAgent/native-arguments";
const starts: unknown[][] = [];
const originalStackLimit = Error.stackTraceLimit;
const host = globalThis as typeof globalThis & { Convex?: unknown }, originalHost = host.Convex;
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start(...args: unknown[]) { starts.push(args); return "workflow:routing"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeIngestion/fixture");
const { clone, ledger } = await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture");
const runtime = await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent");
const runs = await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runs");
const memory = await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemory");
const definitions = await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/agentDefinitions");
beforeEach(() => {
  installIngestionMockRoot(); starts.length = 0; Error.stackTraceLimit = 60;
  host.Convex = { asyncSyscall: async (name: string, input: string) => {
    if (name !== "1.0/createFunctionHandle") throw new Error(`Unexpected syscall ${name}`);
    return JSON.stringify(`function://${JSON.parse(input).name}`);
  } };
});
afterEach(() => { jest.restoreAllMocks(); host.Convex = originalHost; Error.stackTraceLimit = originalStackLimit; });
async function fixture(options: { strict?: boolean; warn?: boolean; maxContextTokens?: number } = {}) {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = [];
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    calls.push(name);
    if (name.startsWith("runtimeAgent:")) {
      const registration = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(registration, args); return invoke(registration, f.ctx, args);
    }
    if (name.startsWith("runtimeMemory:")) return invoke(memory[name.split(":")[1] as keyof typeof memory], f.ctx, args);
    return query(ref, args);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); }
    calls.push(name);
    if (name.startsWith("runtimeAgent:")) {
      const registration = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(registration, args); return f.call(registration, args);
    }
    if (name === "runs:claimNext") return f.call(runs.claimNext, args);
    return mutation(ref, args);
  }) as MutationCtx["runMutation"];
  async function start(startContext = true) {
    let request = f.request();
    if (options.strict || options.warn || options.maxContextTokens) {
      const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
        memorySpaceId: "space-a", clientMutationId: "routing-policy", expectedPreviousVersion: 0,
        definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, maxContextTokens: options.maxContextTokens ?? 16_384,
          ...(options.strict ? { memoryMode: "strict", requiredStages: ["facts"] } : {}),
          barrier: { deadlineMs: 100, onFailure: options.warn ? "incomplete" : "fail" } } },
      }); request = { ...request, agentId: published.agentId, agentVersion: published.version };
    }
    // A short valid input fits the small context-cap fixture; the warning
    // text is what must overflow, not the original transcript admission.
    if (options.maxContextTokens) request = { ...request, parts: [{ type: "text", text: "." }] };
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request }); await f.call(runtime.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0], args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    if (startContext) await f.call(runtime.startContext, args); return { run, args };
  }
  async function prior(count = 1, complete = false) {
    const sources = [];
    for (let index = 0; index < count; index++) {
      const source = await f.source(`Prior authorized evidence ${index}`, `prior:${index}`); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); sources.push(source);
    }
    if (complete) for (const event of f.db.table("runtimeIngestionEvents")) event.factsState = event.vectorsState = "complete";
    return sources;
  }
  return { ...f, get grant() { return f.grant; }, calls, start, prior };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
const outputDir = "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12";
const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value, (_key, item) => item === undefined ? { __contextReadUndefined: true } : item)).digest("hex");
interface Read { method: string; table: string; identity: string; selector: unknown; rows: number; ids: string[]; bytes: number; phase: string; nativeFrame: string; epoch: number; sites: string[]; dependencies: unknown[] }
const allResults: unknown[] = [];
function trace(f: Fixture) {
  const entries: Read[] = [], nativeCalls: unknown[] = []; let epoch = 0, nativeFrame = "parent", serial = 0;
  const stack = () => (new Error().stack ?? "").split("\n").filter(line => /convex-dev\/(runtimeAgent|runtimeMemoryContext|runtimeModelPolicy|agentDefinitions|runtimeTranscript|runtimeAgentFence|runtimeMemoryRepository|runtimeContextWitness|runtimeIngestion|runtimeDataAuth|runtimeAuth)\./.test(line)).map(line => line.trim());
  const capture = (method: string, table: string, selector: unknown, result: unknown, sites: string[]) => {
    const rows = Array.isArray(result) ? result : result && typeof result === "object" && "page" in result ? (result as { page: unknown[] }).page : result ? [result] : [];
    const values = rows as Record<string, unknown>[];
    const phase = sites.some(s => s.includes("saveContextHandler")) ? "save-fence" : "prepare-probe";
    entries.push({ method, table, selector, identity: digest([method,table,selector]), rows: rows.length, ids: values.map(row => String(row._id ?? "")),
      bytes: Buffer.byteLength(JSON.stringify(result)), phase, nativeFrame, epoch, sites,
      dependencies: ["runtimeMemorySources","runtimeIngestionEvents","runtimeMemoryVectorGenerations"].includes(table) ? values.map(row=>({id:row._id,lineage:row.lineage,sourceId:row.sourceId,
        contentHash:row.contentHash,ownerPrincipalId:row.ownerPrincipalId,sequence:row.sequence,factsState:row.factsState,vectorsState:row.vectorsState})) : [] });
  };
  const get = f.db.get.bind(f.db); jest.spyOn(f.db,"get").mockImplementation(async (table,id)=>{ const sites=stack(), result=await get(table,id); capture("get",table,{id},result,sites);return result; });
  const query = f.db.query.bind(f.db);
  jest.spyOn(f.db,"query").mockImplementation(table=>{
    const builder=query(table), selectors: unknown[] = []; let index="",order="";
    const indexed=builder.withIndex;
    builder.withIndex=(name,callback)=>{ index=name; return indexed(name,q=>{
      const record=q as Record<string, unknown>;let proxy: Record<string, unknown>;
      proxy=new Proxy(record,{get(target,key){const method=Reflect.get(target,key); if(typeof method!=="function")return method;
        return (...args: unknown[])=>{selectors.push([String(key),...args]);const result=Reflect.apply(method,target,args);return result===target?proxy:result;};}});
      return callback(proxy);
    }); };
    const originalOrder=builder.order;builder.order=value=>{order=value;return originalOrder(value);};
    for(const terminal of ["take","unique","first","collect","paginate"] as const){const original=builder[terminal];
      Reflect.set(builder,terminal,async (...args: unknown[])=>{const sites=stack(), result=await Reflect.apply(original,builder,args);capture("query",table,{index,selectors,order,terminal,args},result,sites);return result;});
    }return builder;
  });
  for(const name of ["insert","patch","replace","delete"] as const){const original=f.db[name];
    Reflect.set(f.db,name,async(...args:unknown[])=>{epoch++;try{return await Reflect.apply(original,f.db,args);}finally{epoch++;}});
  }
  const originalQuery=f.ctx.runQuery.bind(f.ctx);
  f.ctx.runQuery=(async(ref,args)=>{
    let name="";try{name=getFunctionName(ref);}catch{name=(ref as Partial<Record<symbol,string>>)[Symbol.for("toReferencePath")]??"unknown-component";}
    const before=nativeFrame, frame=++serial;nativeFrame=String(frame)+":"+name;
    const sites=stack();try{const result=await originalQuery(ref,args);const rows=Array.isArray(result)?result:result&&typeof result==="object"&&"page"in result?(result as {page:unknown[]}).page:result?[result]:[];
      nativeCalls.push({name,argsHash:digest(args),resultRows:rows.length,resultBytes:Buffer.byteLength(JSON.stringify(result)),sites,phase:sites.some(s=>s.includes("saveContextHandler"))?"save-fence":"prepare-probe",frame});return result;
    }finally{nativeFrame=before;}
  }) as MutationCtx["runQuery"];
  const originalMutation=f.ctx.runMutation.bind(f.ctx);f.ctx.runMutation=(async(ref,args)=>{epoch++;try{return await originalMutation(ref,args);}finally{epoch++;}})as MutationCtx["runMutation"];
  return {entries,nativeCalls};
}
function projected(entries: Read[]) {
  const grouped=new Map<string,{read:Read;calls:number;docs:number}>();for(const read of entries){const key=read.nativeFrame+":"+read.phase+":"+read.epoch+":"+read.identity;
    const group=grouped.get(key);if(group){group.calls++;group.docs+=read.rows;}else grouped.set(key,{read,calls:1,docs:read.rows});}
  const policy=(read:Read)=>read.nativeFrame==="parent"&&(read.table==="runtimeModelQualifications"||read.table==="runtimeModelPolicies"&&JSON.stringify(read.selector).includes('["eq","scope","deployment"]'));
  const all=entries.reduce((sum,e)=>sum+e.rows,0), candidate=entries.filter(policy).reduce((sum,e)=>sum+e.rows,0), retained=[...grouped.values()].filter(g=>policy(g.read)).reduce((sum,g)=>sum+g.read.rows,0);
  return {observedRawReturnedDocuments:all,policyCandidateDocumentsBefore:candidate,policyCandidateDocumentsAfterPotential:retained,allDocumentsAfterPotential:all-candidate+retained,
    freshSaveFenceIsDistinct:true,crossNativeQueryReuse:false,implemented:false,
    repeated:[...grouped.values()].filter(g=>g.calls>1).map(g=>({table:g.read.table,selector:g.read.selector,phase:g.read.phase,nativeFrame:g.read.nativeFrame,epoch:g.read.epoch,calls:g.calls,docs:g.docs,oneReadDocs:g.read.rows,sites:g.read.sites})).sort((a,b)=>b.docs-a.docs)};
}
it.each(["routed-empty","routed-unrepresented","original-empty-with-pending-witness"])("records actual controlled raw read identities for %s",async mode=>{
  const f=await fixture();if(mode!=="routed-empty")await f.prior(1,false);const {args}=await f.start();
  const observed=trace(f), result=await f.call(mode==="original-empty-with-pending-witness"?runtime.prepareEmptyContext:runtime.prepareRoutedContext,args);
  expect(result).toEqual({state:mode==="routed-unrepresented"?"NEEDS_ACTION":"COMPLETE"});expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  const root=f.db.table("runtimeModelPolicies").filter(row=>row.scope==="deployment");
  allResults.push({mode,result,fixture:{manifestId:(root[0].root as {manifestId:string}).manifestId,revision:(root[0].root as {revision:number}).revision,policies:root.length,
    qualifications:f.db.table("runtimeModelQualifications").length,transcriptPins:JSON.parse(f.db.table("runtimeRuns")[0].snapshotCanonical as string).messages.length,
    savedMessagePins:(f.db.table("runtimeAgentExecutions")[0].savedMessagePins as unknown[]).length,sourceWitnesses:(f.db.table("runtimeAgentExecutions")[0].sourceWitnesses as unknown[]).length},
    projection:projected(observed.entries),rawReads:observed.entries,nativeCalls:observed.nativeCalls});
});
afterAll(()=>{fs.writeFileSync(outputDir+"/context-read-cost-observed.json",JSON.stringify({controlledFixtureOnly:true,actualHandlers:true,nativeServiceCalls:0,performanceClaim:false,results:allResults},null,2)+"\n",{flag:"wx"});});
