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
for(const c of calls){
const input={tenantId:'tenant-a',memorySpaceId:'space-a',conversationId:'same-id',conversationIds:['same-id'],factId:'same-id',shareId:'same-id',snapshotId:'same-id'};
it.each(['membership-version','membership-revoke','grant-revoke','grant-expire','tenant-epoch','scope-delete'])(`${c.module}:${c.name} fresh late %s`,async variant=>{const f=setup();let n=0;f.db.beforeRead=table=>{if(table==='runtimeAuthPrincipals'&&++n===2){if(variant==='membership-version')f.membership.version=2;if(variant==='membership-revoke')f.membership.revokedAt=1;if(variant==='grant-revoke')f.grant.revokedAt=1;if(variant==='grant-expire')f.grant.expiresAt=Date.now()-1;if(variant==='tenant-epoch')f.db.table('runtimeAuthScopes')[0].epoch=2;if(variant==='scope-delete')f.db.table('runtimeAuthScopes')[1].deletedAt=1;}};expect((await result(c,f,input)).code).toBe('FORBIDDEN');});
it(`${c.module}:${c.name} source IDs and foreign presence preserve unauthorized/readiness`,async()=>{for(const denied of [false,true]){let baseline:unknown;for(const id of ['same-id','foreign-id','missing-id']){const f=setup();if(denied)f.grant.revokedAt=1;f.db.seed('conversations',{tenantId:'tenant-b',memorySpaceId:'space-a',conversationId:'foreign-id',private:'SECRET'});const data=await result(c,f,{...input,conversationId:id,conversationIds:[id],factId:id,shareId:id,snapshotId:id});expect(data.code).toBe(denied?'FORBIDDEN':'CAPABILITY_NOT_READY');if(baseline)expect(data).toEqual(baseline);baseline=data;}}});
it(`${c.module}:${c.name} opaque diagnostics never evaluate accessors`,async()=>{for(const loc of ['identity','control']){let getters=0;const data=Object.defineProperty({},'code',{get(){getters++;return 'FORBIDDEN';}});const fault=Object.defineProperty(new Error('SECRET'),'data',{get(){getters++;return data;}});const f=setup();if(loc==='identity')f.ctx.auth.getUserIdentity=async()=>{throw fault;};else f.db.beforeRead=()=>{throw fault;};expect((await result(c,f,input)).code).toBe('REGISTRY_OPERATION_FAILED');expect(getters).toBe(0);}});
}
it.each(['space-a',undefined])('foreign source tombstone oracle at %s',async memorySpaceId=>{
 const c=calls.find(c=>c.module==='conversations'&&c.name==='get')!;
 expect(c).toBeDefined();
 const absent=setup();const present=setup();
 // This trusted tombstone schema has no owner/source authority field. The caller has own-only authority.
 present.db.seed('runtimeAuthTombstones',{tenantId:'tenant-a',memorySpaceId,resourceType:'conversation',resourceId:'foreign-id',deletedAt:1});
 const args={tenantId:'tenant-a',memorySpaceId:'space-a',conversationId:'foreign-id'};
 const a=await result(c,absent,args),b=await result(c,present,args);
 console.log('FOREIGN_TOMBSTONE_ORACLE',JSON.stringify({memorySpaceId:memorySpaceId??'tenant-wide',absent:a,present:b}));
 expect(a).toEqual(b);
});
