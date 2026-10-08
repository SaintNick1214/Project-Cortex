/** FIXTURE ONLY. Internal deploy-operator functions, never shipped production source.
 * No table scans, public bootstrap, global purge, storage or external effects. */
import { internalMutation, internalQuery, internalAction } from './_generated/server';
import type { TableNames } from './_generated/dataModel';
import { v } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
const tables = new Set<string>(['conversations','conversationShares','conversationSnapshots','immutable','mutable','memories','facts','factHistory','memorySpaces','contexts','agents','sessions','governancePolicies','governanceEnforcement','graphSyncQueue','artifacts','attachments','runtimeAuthPrincipals','runtimeAuthMemberships','runtimeAuthScopes','runtimeAuthGrants','runtimeAuthTombstones','runtimeMemorySources','runtimeMemoryChunks','runtimeMemoryVectors','runtimeMemoryReceipts']);
const rowSpec = v.object({ table:v.string(), value:v.any() });
const refSpec = v.object({ table:v.string(), id:v.string() });
function prefix(run:string): string {
 if (!/^foundation-[a-f0-9]{32}$/.test(run)) throw new Error('Invalid fixture run');
 return run + ':';
}
function table(name:string): TableNames {
 if (!tables.has(name)) throw new Error('Fixture table not allowed');
 return name as TableNames; // Exact whitelist; production schema validates inserted values.
}
function owned(run:string, value:unknown): boolean {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const record = value as Record<string,unknown>;
 return ['tenantId','subject','id','memorySpaceId','sessionId','namespace','agentId','artifactId','contextId'].some(key => typeof record[key] === 'string' && record[key].startsWith(prefix(run)));
}
function bound(run:string,count:number): void {prefix(run);if(count<1||count>320)throw new Error('Fixture row ceiling');}
export const seed = internalMutation({ args:{run:v.string(), rows:v.array(rowSpec)}, handler:async(ctx,args)=>{
 bound(args.run,args.rows.length);
 const result:Array<{table:string;id:string}>=[];
 for(const row of args.rows) {
  if (!owned(args.run,row.value) || JSON.stringify(row.value).length>65536) throw new Error('Unowned or oversized fixture');
  // v.any is deliberate only at the trusted internal fixture boundary. Convex schema remains exact.
  const id=await ctx.db.insert(table(row.table),row.value);result.push({table:row.table,id});
 }
 return result;
}});
export const snapshot = internalQuery({ args:{run:v.string(), refs:v.array(refSpec)}, handler:async(ctx,args)=>{
 bound(args.run,args.refs.length);
 const results=[];
 for(const ref of args.refs){const id=ctx.db.normalizeId(table(ref.table),ref.id);if(!id)throw new Error('Invalid fixture id');const row=await ctx.db.get(id);
  if(row&&!owned(args.run,row))throw new Error('Unowned fixture reference');results.push({table:ref.table,id:ref.id,row});}
 return results;
}});
export const cleanup = internalMutation({ args:{run:v.string(), refs:v.array(refSpec)}, handler:async(ctx,args)=>{
 bound(args.run,args.refs.length);let deleted=0;
 for(const ref of args.refs){const id=ctx.db.normalizeId(table(ref.table),ref.id);if(!id)throw new Error('Invalid fixture id');const row=await ctx.db.get(id);
  if(row&&!owned(args.run,row))throw new Error('Unowned fixture reference');if(row){await ctx.db.delete(id);deleted++;}}
 return {deleted};
}});
export const ownedTombstones = internalQuery({args:{run:v.string(),tenantIds:v.array(v.string())},handler:async(ctx,args)=>{
 prefix(args.run);if(args.tenantIds.length<1||args.tenantIds.length>4||args.tenantIds.some(id=>!id.startsWith(prefix(args.run))))throw new Error('Unowned tenant');
 const refs=[];
 for(const tenantId of args.tenantIds){const rows=await ctx.db.query('runtimeAuthTombstones').withIndex('by_resource',q=>q.eq('tenantId',tenantId)).take(321);
 if(rows.length>320)throw new Error('Fixture tombstone ceiling');for(const row of rows)refs.push({table:'runtimeAuthTombstones',id:row._id});}
 if(refs.length>320)throw new Error('Fixture tombstone ceiling');return refs;
}});

export const discoverOwnedEffects = internalQuery({args:{run:v.string(),tenantIds:v.array(v.string())},handler:async(ctx,args)=>{
 prefix(args.run);if(args.tenantIds.length<1||args.tenantIds.length>4||args.tenantIds.some(id=>!id.startsWith(prefix(args.run))))throw new Error("Unowned tenant");
 const refs:Array<{table:string;id:string}>=[];
 for(const tenantId of args.tenantIds){
  {const rows=await ctx.db.query("conversations").withIndex("by_tenantId",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"conversations",id:row._id});}
  {const rows=await ctx.db.query("conversationShares").withIndex("by_tenant_shareId",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"conversationShares",id:row._id});}
  {const rows=await ctx.db.query("conversationSnapshots").withIndex("by_tenant_snapshotId",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"conversationSnapshots",id:row._id});}
  {const rows=await ctx.db.query("immutable").withIndex("by_runtime_scope",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"immutable",id:row._id});}
  {const rows=await ctx.db.query("mutable").withIndex("by_runtime_scope",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"mutable",id:row._id});}
  {const rows=await ctx.db.query("memories").withIndex("by_runtime_scope_memoryId",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"memories",id:row._id});}
  {const rows=await ctx.db.query("facts").withIndex("by_runtime_scope_factId",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"facts",id:row._id});}
  {const rows=await ctx.db.query("memorySpaces").withIndex("by_runtime_scope_owner",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"memorySpaces",id:row._id});}
  {const rows=await ctx.db.query("contexts").withIndex("by_runtime_scope_context",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"contexts",id:row._id});}
  {const rows=await ctx.db.query("agents").withIndex("by_runtime_scope_agent",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"agents",id:row._id});}
  {const rows=await ctx.db.query("sessions").withIndex("by_runtime_scope",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"sessions",id:row._id});}
  {const rows=await ctx.db.query("governancePolicies").withIndex("by_runtime_scope_active",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"governancePolicies",id:row._id});}
  {const rows=await ctx.db.query("governanceEnforcement").withIndex("by_runtime_scope_executed",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"governanceEnforcement",id:row._id});}
  {const rows=await ctx.db.query("graphSyncQueue").withIndex("by_runtime_worker_entity",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"graphSyncQueue",id:row._id});}
  {const rows=await ctx.db.query("artifacts").withIndex("by_tenant_space",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"artifacts",id:row._id});}
  {const rows=await ctx.db.query("attachments").withIndex("by_tenantId",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"attachments",id:row._id});}
  {const rows=await ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"runtimeAuthScopes",id:row._id});}
  {const rows=await ctx.db.query("runtimeAuthTombstones").withIndex("by_resource",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"runtimeAuthTombstones",id:row._id});}
  {const rows=await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"runtimeMemorySources",id:row._id});}
  {const rows=await ctx.db.query("runtimeMemoryChunks").withIndex("by_scope_chunk",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"runtimeMemoryChunks",id:row._id});}
  {const rows=await ctx.db.query("runtimeMemoryVectors").withIndex("by_scope_vector",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"runtimeMemoryVectors",id:row._id});}
  {const rows=await ctx.db.query("runtimeMemoryReceipts").withIndex("by_scope_receipt",q=>q.eq("tenantId",tenantId)).take(321);if(rows.length>320)throw new Error("Owned table ceiling");for(const row of rows)refs.push({table:"runtimeMemoryReceipts",id:row._id});}
 }if(refs.length>320)throw new Error("Owned total ceiling");return refs;
}});
// Bounded tiny real storage IDs for v.id('_storage') argument validation only.
const storageSlot=v.union(v.literal('owned'),v.literal('foreign'));
export const storageCatalog = internalQuery({args:{run:v.string(),slot:storageSlot},handler:async(ctx,args)=>{
 prefix(args.run);return await ctx.db.query('mutable').withIndex('by_namespace_key',q=>q.eq('namespace',`${args.run}:fixture-storage`).eq('key',args.slot)).unique();
}});
export const registerStorage = internalMutation({args:{run:v.string(),slot:storageSlot,id:v.id('_storage')},handler:async(ctx,args)=>{
 prefix(args.run);const prior=await ctx.db.query('mutable').withIndex('by_namespace_key',q=>q.eq('namespace',`${args.run}:fixture-storage`).eq('key',args.slot)).unique();
 if(prior)throw new Error('Storage slot already owned');const now=Date.now();
 const catalogId=await ctx.db.insert('mutable',{namespace:`${args.run}:fixture-storage`,key:args.slot,value:{run:args.run,storageId:args.id},tenantId:`${args.run}:catalog`,createdAt:now,updatedAt:now});
 return {id:args.id,catalogId};
}});
export const storeTiny = internalAction({args:{run:v.string(),slot:storageSlot},handler:async(ctx,args)=>{
 prefix(args.run);const prior=await ctx.runQuery(makeFunctionReference<'query'>('qualificationOwned:storageCatalog'),args);if(prior)throw new Error('Storage slot already owned');
 const id=await ctx.storage.store(new Blob(['foundation-validator-fixture'],{type:'text/plain'}));
 try{return await ctx.runMutation(makeFunctionReference<'mutation'>('qualificationOwned:registerStorage'),{...args,id});}
 catch {await ctx.storage.delete(id);throw new Error('Storage catalog registration failed');}
}});
export const cleanupStorage = internalMutation({args:{run:v.string(),slot:storageSlot,catalogId:v.id('mutable'),id:v.id('_storage')},handler:async(ctx,args)=>{
 prefix(args.run);const row=await ctx.db.get('mutable',args.catalogId);
 if(!row){if(await ctx.db.system.get(args.id)===null)return {deleted:false};throw new Error('Storage ownership catalog missing');}
 if(row.namespace!==`${args.run}:fixture-storage`||row.key!==args.slot||row.tenantId!==`${args.run}:catalog`||!row.value||row.value.run!==args.run||row.value.storageId!==args.id)throw new Error('Unowned storage cleanup');
 await ctx.storage.delete(args.id);await ctx.db.delete('mutable',args.catalogId);return {deleted:true};
}});
export const storageSnapshot = internalQuery({args:{run:v.string(),files:v.array(v.object({slot:storageSlot,catalogId:v.id('mutable'),id:v.id('_storage')}))},handler:async(ctx,args)=>{
 prefix(args.run);if(args.files.length>2)throw new Error('Storage file ceiling');const result=[];
 for(const file of args.files){const row=await ctx.db.get('mutable',file.catalogId);if(!row||row.namespace!==`${args.run}:fixture-storage`||row.key!==file.slot||row.value?.run!==args.run||row.value?.storageId!==file.id)throw new Error('Unowned storage snapshot');result.push({id:file.id,metadata:await ctx.db.system.get(file.id)});}
 return result;
}});
