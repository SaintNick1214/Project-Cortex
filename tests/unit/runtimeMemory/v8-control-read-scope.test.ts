/** Raw rows only: original query builders/cardinality, explicit V8 owner, no service. */
import {afterEach,expect,it,jest} from '@jest/globals';
import {makeFunctionReference} from 'convex/server';
import type {MutationCtx} from '../../../convex-dev/_generated/server';
import {fixture} from '../runtimeMetadataAuth/fixture';
import {createAuthorityReadScope,createMemorySourceReadScope,createV8AuthorityReadScope,withNativeSnapshotReads,withManagedSourceReads,
 readV8AgentExecutionRows,readV8AgentToolRows,readManagedSourceRows,hashV8CanonicalBytes,MANAGED_SOURCE_READ_SCOPE_MAX_ENTRIES,MANAGED_SOURCE_READ_SCOPE_MAX_BYTES} from '../../../convex-dev/runtimeAuth';
import {semanticHash} from '../../../src/domain/profile';
afterEach(()=>{jest.restoreAllMocks();});
function setup(){
 const f=fixture({space:'space-a'}),execution=f.db.seed('runtimeAgentExecutions',{tenantId:'tenant-a',memorySpaceId:'space-a',runId:'run',attemptNumber:1,state:'ready',leaseVersion:1}),tool=f.db.seed('runtimeAgentOperations',{tenantId:'tenant-a',memorySpaceId:'space-a',runId:'run',attemptNumber:1,kind:'tool',state:'prepared'});
 const db=Object.assign(f.db,{delete:async(table:string,id:string)=>{const rows=f.db.table(table),i=rows.findIndex(row=>row._id===id);if(i<0)throw Error('Missing row');rows.splice(i,1);f.db.writes++;}});
 const query=f.db.query.bind(f.db),built:unknown[]=[],takes:{table:string;limit:number}[]=[];
 jest.spyOn(f.db,'query').mockImplementation(table=>{built.push(['query',table]);const b=query(table),withIndex=b.withIndex.bind(b),take=b.take.bind(b);
  b.withIndex=(name,callback)=>{built.push(['index',table,name]);return withIndex(name,q=>{const proxy=new Proxy(q,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;return(...args:unknown[])=>{built.push([String(key),...args]);const result=Reflect.apply(value,target,args);return result===target?proxy:result;};}});return callback(proxy);});};
  b.take=async n=>{takes.push({table,limit:n});return take(n);};return b;});
 const ctx={...f.ctx,db} as unknown as MutationCtx,scope=createV8AuthorityReadScope(ctx,{managedSources:true});
 const exec=(target:Pick<MutationCtx,'db'>=scope,run='run',attempt=1,tenant='tenant-a',space='space-a')=>readV8AgentExecutionRows(target,tenant,space,run,attempt);
 const tools=(target:Pick<MutationCtx,'db'>=scope)=>readV8AgentToolRows(target,'tenant-a','space-a','run',1);
 return{...f,db,ctx,scope,execution,tool,built,takes,exec,tools,nativeQuery:query};
}
it('only exact returned private V8 owner retains rows; spreads/prototypes/views/default lanes keep original reads',async()=>{
 const f=setup();await f.exec();await f.exec();await f.tools();await f.tools();expect(f.takes).toEqual([{table:'runtimeAgentExecutions',limit:2},{table:'runtimeAgentOperations',limit:33}]);
 const ownBuilt=[...f.built];expect(ownBuilt.filter(row=>Array.isArray(row)&&row[0]==='query')).toHaveLength(4);
 const copied=Object.defineProperties({...f.scope},Object.getOwnPropertyDescriptors(f.scope));
 for(const ctx of [f.ctx,createAuthorityReadScope(f.ctx),createMemorySourceReadScope(f.ctx),{...f.scope},Object.create(f.scope),copied,withNativeSnapshotReads(f.ctx,f.scope),withManagedSourceReads(f.ctx,f.scope)]){
  const start=f.takes.length;await f.exec(ctx);await f.exec(ctx);await f.tools(ctx);await f.tools(ctx);expect(f.takes.length-start).toBe(4);
 }
 const next=createV8AuthorityReadScope({...f.ctx},{managedSources:true}),start=f.takes.length;await f.exec(next);await f.exec(next);expect(f.takes.length-start).toBe(1);
});
it('keeps tenant/space/run/attempt, limit and operation distinct; clones raw arrays and absence',async()=>{
 const f=setup();const first=await f.exec();first[0]!.state='unknown';first.push(first[0]!);expect(await f.exec()).toMatchObject([{state:'ready'}]);
 for(const [tenant,space,run,attempt] of [['other','space-a','run',1],['tenant-a','other','run',1],['tenant-a','space-a','other',1],['tenant-a','space-a','run',2]] as const){expect(await f.exec(f.scope,run,attempt,tenant,space)).toEqual([]);expect(await f.exec(f.scope,run,attempt,tenant,space)).toEqual([]);}
 await f.tools();expect(f.takes).toHaveLength(6);await f.scope.db.insert('runtimeAgentExecutions',{...f.execution,runId:'new'} as never);expect(await f.exec(f.scope,'new')).toHaveLength(1);
});
it('preserves take cardinality and original query errors, never caching a failure',async()=>{
 const f=setup();f.db.seed('runtimeAgentExecutions',{...f.execution,_id:'runtimeAgentExecutions:duplicate'});expect(await f.exec()).toHaveLength(2);
 for(let i=0;i<34;i++)f.db.seed('runtimeAgentOperations',{...f.tool,_id:`runtimeAgentOperations:${i}`});expect(await f.tools()).toHaveLength(33);
 const error=Error('ORIGINAL_TAKE_ERROR'),query=f.nativeQuery;let fails=true,count=0;
 jest.spyOn(f.db,'query').mockImplementation(table=>{const b=query(table),take=b.take;b.take=async n=>{count++;if(fails)throw error;return take(n);};return b;});
 const fresh=createV8AuthorityReadScope({...f.ctx});await expect(f.exec(fresh)).rejects.toBe(error);await expect(f.exec(fresh)).rejects.toBe(error);fails=false;await f.exec(fresh);await f.exec(fresh);expect(count).toBe(3);
});
it.each(['insert','patch','replace','delete'] as const)('every original %s of either table evicts BOTH control families',async method=>{
 const f=setup();for(const table of ['runtimeAgentExecutions','runtimeAgentOperations'] as const){await f.exec();await f.tools();const start=f.takes.length,row=table==='runtimeAgentExecutions'?f.execution:f.tool;
  if(method==='insert')await f.scope.db.insert(table,{...row,_id:`${table}:new`} as never);
  else if(method==='delete')await (f.scope.db as unknown as typeof f.db).delete(table,row._id);
  else await (f.scope.db as unknown as Pick<typeof f.db,'patch'|'replace'>)[method](table,row._id,method==='replace'?{...row,state:'changed'}:{state:'changed'});
  expect(await f.exec()).toEqual(await f.exec(f.ctx));expect(await f.tools()).toEqual(await f.tools(f.ctx));expect(f.takes.length-start).toBe(4);
 }
});
it.each(['control','financial','source','security','unknown','failed','component','fluent'])('any %s writer clears both families and preserves original result/error',async kind=>{
 const f=setup();let ctx=f.ctx;
 if(kind==='component')ctx={...ctx,runMutation:async()=>{f.execution.state='changed';return'original-child';}} as unknown as MutationCtx;
 if(kind==='fluent'){const table=f.db.table.bind(f.db);Object.defineProperty(f.db,'table',{configurable:true,value:(name:string)=>name==='fluent'?{patch:async()=>{f.execution.state='changed';return'original-fluent';}}:table(name)});}
 const scope=createV8AuthorityReadScope(ctx,{managedSources:true});await f.exec(scope);await f.tools(scope);const start=f.takes.length;
 if(kind==='component')expect(await scope.runMutation(makeFunctionReference<'mutation'>('control:child'),{})).toBe('original-child');
 else if(kind==='fluent')expect(await (scope.db as unknown as {table(name:string):{patch():Promise<string>}}).table('fluent').patch()).toBe('original-fluent');
 else if(kind==='failed')await expect(scope.db.patch('runtimeAgentExecutions','missing' as never,{state:'bad'} as never)).rejects.toThrow('Missing row');
 else{const table=kind==='financial'?'runtimeBudgetAccounts':kind==='source'?'runtimeMemorySources':kind==='security'?'runtimeAuthGrants':kind==='unknown'?'unknown':'runtimeRuns';const row=f.db.seed(table,{value:1});await scope.db.patch(table as never,row._id as never,{value:2} as never);}
 await f.exec(scope);await f.tools(scope);expect(f.takes.length-start).toBe(2);
});
it('suppresses reads during pending writes, rejects late population and does not coalesce misses',async()=>{
 const f=setup();let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r),patch=f.db.patch.bind(f.db);
 jest.spyOn(f.db,'patch').mockImplementation(async(table,id,value)=>{enter();await gate;return patch(table,id,value);});
 await f.exec();await f.tools();const write=f.scope.db.patch('runtimeAgentExecutions',f.execution._id as never,{state:'changed'} as never);await entered;
 const start=f.takes.length;await f.exec();await f.exec();await f.tools();await f.tools();expect(f.takes.length-start).toBe(4);release();await write;expect(await f.exec()).toMatchObject([{state:'changed'}]);await f.tools();expect(f.takes.length-start).toBe(6);
 let reads=0,unblock!:()=>void,readEntered!:()=>void;const stalled=new Promise<void>(r=>unblock=r),readGate=new Promise<void>(r=>readEntered=r),query=f.nativeQuery;jest.spyOn(f.db,'query').mockImplementation(table=>{const b=query(table),take=b.take;b.take=async n=>{const rows=await take(n);if(table==='runtimeAgentExecutions'&&++reads===1){readEntered();await stalled;}return rows;};return b;});
 const fresh=createV8AuthorityReadScope({...f.ctx}),late=f.exec(fresh);await readGate;await f.exec(fresh);await fresh.db.patch('runtimeAgentExecutions',f.execution._id as never,{state:'newer'} as never);unblock();await late;expect(await f.exec(fresh)).toMatchObject([{state:'newer'}]);expect(reads).toBe(3);
});
it('shares the existing bounded entry/byte budget with source rows',async()=>{
 const f=setup();for(let i=0;i<MANAGED_SOURCE_READ_SCOPE_MAX_ENTRIES-1;i++)await readManagedSourceRows(f.scope,'tenant-a','space-a',`missing:${i}`);
 await f.exec();const start=f.takes.length;await f.exec();await f.tools();await f.tools();expect(f.takes.length-start).toBe(2);
 f.execution.payload='x'.repeat(MANAGED_SOURCE_READ_SCOPE_MAX_BYTES);const fresh=createV8AuthorityReadScope({...f.ctx}),before=f.takes.length;await f.exec(fresh);await f.exec(fresh);expect(f.takes.length-before).toBe(2);
});
it('retains only the exact successful SHA-256 bytes on the exact owner, with all other lanes fresh',async()=>{
 const f=setup(),digest=globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle),spy=jest.spyOn(globalThis.crypto.subtle,'digest').mockImplementation(digest);
 const bytes='{"message":"current"}',expected=await semanticHash(bytes);spy.mockClear();expect(await hashV8CanonicalBytes(f.scope,bytes)).toBe(expected);expect(await hashV8CanonicalBytes(f.scope,bytes)).toBe(expected);expect(spy).toHaveBeenCalledTimes(1);
 await hashV8CanonicalBytes(f.scope,bytes+' ');expect(spy).toHaveBeenCalledTimes(2);
 for(const ctx of [undefined,f.ctx,createAuthorityReadScope(f.ctx),createMemorySourceReadScope(f.ctx),{...f.scope},Object.create(f.scope),withNativeSnapshotReads(f.ctx,f.scope)]){const start=spy.mock.calls.length;await hashV8CanonicalBytes(ctx,bytes);await hashV8CanonicalBytes(ctx,bytes);expect(spy.mock.calls.length-start).toBe(2);}
 const fresh=createV8AuthorityReadScope({...f.ctx});await hashV8CanonicalBytes(fresh,bytes);expect(spy.mock.calls.length).toBe(17);
});
it.each(['insert','patch','replace','delete','component','failed'] as const)('exact-byte hash is cold after every %s writer',async method=>{
 const f=setup(),digest=globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle),spy=jest.spyOn(globalThis.crypto.subtle,'digest').mockImplementation(digest);
 const scope=method==='component'?createV8AuthorityReadScope({...f.ctx,runMutation:async()=>null} as MutationCtx):f.scope;
 await hashV8CanonicalBytes(scope,'current');await hashV8CanonicalBytes(scope,'current');expect(spy).toHaveBeenCalledTimes(1);
 if(method==='component')await scope.runMutation(makeFunctionReference<'mutation'>('hash:child'),{});
 else if(method==='failed')await expect(scope.db.patch('runtimeAgentExecutions','missing' as never,{state:'unknown'})).rejects.toThrow();
 else if(method==='insert')await scope.db.insert('runtimeAgentExecutions',{...f.execution} as never);
 else if(method==='delete')await (scope.db as unknown as typeof f.db).delete('runtimeAgentExecutions',f.execution._id);
 else await (scope.db as unknown as Pick<typeof f.db,'patch'|'replace'>)[method]('runtimeAgentExecutions',f.execution._id,method==='replace'?{...f.execution,state:'unknown'}:{state:'unknown'});
 await hashV8CanonicalBytes(scope,'current');expect(spy).toHaveBeenCalledTimes(2);
});
it('failed/parallel/late digests cannot populate across a pending writer and the shared byte/entry caps apply',async()=>{
 const f=setup(),digest=globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle),error=Error('ORIGINAL_DIGEST_FAILURE');let fail=true,release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);let pause=false;
 const spy=jest.spyOn(globalThis.crypto.subtle,'digest').mockImplementation(async(...args)=>{if(fail)throw error;const result=await digest(...args);if(pause){pause=false;entered();await gate;}return result;});
 await expect(hashV8CanonicalBytes(f.scope,'x')).rejects.toBe(error);await expect(hashV8CanonicalBytes(f.scope,'x')).rejects.toBe(error);fail=false;pause=true;const late=hashV8CanonicalBytes(f.scope,'x');await started;
 await hashV8CanonicalBytes(f.scope,'x');await f.scope.db.patch('runtimeAgentExecutions',f.execution._id as never,{state:'unknown'});release();await late;await hashV8CanonicalBytes(f.scope,'x');expect(spy).toHaveBeenCalledTimes(5);
 const fresh=createV8AuthorityReadScope({...f.ctx},{managedSources:true});for(let i=0;i<MANAGED_SOURCE_READ_SCOPE_MAX_ENTRIES;i++)await readManagedSourceRows(fresh,'tenant-a','space-a',`missing:${i}`);
 const before=spy.mock.calls.length;await hashV8CanonicalBytes(fresh,'overflow');await hashV8CanonicalBytes(fresh,'overflow');expect(spy.mock.calls.length-before).toBe(2);
 const oversized=createV8AuthorityReadScope({...f.ctx}),large='x'.repeat(MANAGED_SOURCE_READ_SCOPE_MAX_BYTES),count=spy.mock.calls.length;await hashV8CanonicalBytes(oversized,large);await hashV8CanonicalBytes(oversized,large);expect(spy.mock.calls.length-count).toBe(2);
});
