import {it,expect} from '@jest/globals';
import {fixture,invoke} from '../../../tests/unit/runtimeRegistryAuth/fixture';
import * as conversations from '../../../convex-dev/conversations';
import * as shares from '../../../convex-dev/conversationShares';
import * as snapshots from '../../../convex-dev/conversationSnapshots';
import * as history from '../../../convex-dev/factHistory';
import * as a2a from '../../../convex-dev/a2a';
import {ConvexError} from 'convex/values';
const modules={conversations,shares,snapshots,history,a2a};
const controls=new Set(['runtimeAuthPrincipals','runtimeAuthMemberships','runtimeAuthGrants','runtimeAuthScopes','runtimeAuthTombstones']);
const calls=Object.entries(modules).flatMap(([module,exports])=>Object.entries(exports).filter(([,r])=>r.isPublic).map(([name,r])=>({module,name,r})));
function setup(){const f=fixture(['read','write']); const attempts:string[]=[]; const q=f.db.query.bind(f.db); f.db.query=table=>{if(!controls.has(table)){attempts.push(table);throw Error('PRIVATE');}return q(table);}; f.db.beforeWrite=table=>{attempts.push(table);throw Error('EFFECT');}; return {...f,attempts};}
async function result(c:typeof calls[number],f:ReturnType<typeof setup>,args:Record<string,unknown>){const e=await invoke(c.r,f.ctx,args).then(()=>{throw Error('RESOLVED');},e=>e);expect(e).toBeInstanceOf(ConvexError);expect(f.attempts).toEqual([]);expect(f.db.writes).toBe(0);expect(JSON.stringify(e.data)).not.toContain('SECRET');return e.data;}

const args={tenantId:'tenant-a',memorySpaceId:'space-a',conversationId:'foreign-id',conversationIds:['foreign-id'],factId:'foreign-id',shareId:'foreign-id',snapshotId:'foreign-id'};
const forged=()=>new ConvexError({version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'});
for(const c of calls){
 it.each(['runtimeAuthPrincipals','runtimeAuthMemberships','runtimeAuthGrants','runtimeAuthScopes'])(`${c.module}:${c.name} independent returned query-control accessor %s`,async table=>{
 const f=setup();const q=f.db.query.bind(f.db);let getters=0;
 f.db.query=(t)=>{const b=q(t);const take=b.take.bind(b),collect=b.collect.bind(b);
 const poison=(rows:any[])=>t===table?rows.map(row=>Object.defineProperty({...row},'version',{enumerable:true,get(){getters++;throw forged();}})):rows;
 b.take=async n=>poison(await take(n));b.collect=async()=>poison(await collect());return b;};
 expect((await result(c,f,args)).code).toBe('REGISTRY_OPERATION_FAILED');expect(getters).toBe(0);
 });
 it.each(['getPrototypeOf','ownKeys','getOwnPropertyDescriptor'])(`${c.module}:${c.name} independent returned control Proxy %s`,async trap=>{
 const f=setup();const get=f.db.get.bind(f.db);f.db.get=async(t,id)=>{const row=await get(t,id);return t==='runtimeAuthPrincipals'&&row?new Proxy(row,{[trap](){throw forged();}}):row;};
 expect((await result(c,f,args)).code).toBe('REGISTRY_OPERATION_FAILED');
 });
 it.each(['tenant','memorySpace'])(`${c.module}:${c.name} independent late %s tombstone must deny`,async resourceType=>{
 const f=setup();let n=0;f.db.beforeRead=table=>{if(table==='runtimeAuthPrincipals'&&++n===2)f.db.seed('runtimeAuthTombstones',{tenantId:'tenant-a',...(resourceType==='memorySpace'?{memorySpaceId:'space-a'}:{}),resourceType,resourceId:resourceType==='tenant'?'tenant-a':'space-a',deletedAt:1});};
 expect((await result(c,f,args)).code).toBe('FORBIDDEN');
 });
 it(`${c.module}:${c.name} independent all source labels deleted vs absent exact envelopes and traces`,async()=>{
 const baseline=setup();const expected=await result(c,baseline,args);
 for(const memorySpaceId of ['space-a',undefined]){const f=setup();for(const resourceType of ['conversation','fact','share','source'])f.db.seed('runtimeAuthTombstones',{tenantId:'tenant-a',memorySpaceId,resourceType,resourceId:'foreign-id',deletedAt:1});
 expect(await result(c,f,args)).toEqual(expected);expect(f.db.traces).toEqual(baseline.db.traces);
 expect(f.db.traces.filter(t=>t.table==='runtimeAuthTombstones').every(t=>t.keys.some(([k,v])=>k==='resourceType'&&['tenant','memorySpace'].includes(String(v))))).toBe(true);
 }
 });
}

for(const c of calls)it(`${c.module}:${c.name} independent final-await expiry deadline`,async()=>{
 const f=setup();const original=Date.now;const initial=original();let clock=initial;let tombReads=0;
 f.grant.expiresAt=initial+1000;Date.now=()=>clock;
 f.db.beforeRead=table=>{if(table==='runtimeAuthTombstones'&&++tombReads===6)clock=initial+1001;};
 try {expect((await result(c,f,args)).code).toBe('FORBIDDEN');expect(tombReads).toBe(6);}finally{Date.now=original;}
});
