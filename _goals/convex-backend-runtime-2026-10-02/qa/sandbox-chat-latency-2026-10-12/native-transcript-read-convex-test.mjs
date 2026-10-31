/** Real convex-test0.0.61 + installed Agent0.7.3 component; no cloud/OCC/SLO claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {defineSchema,defineTable,getFunctionAddress} from 'convex/server';
import {v} from 'convex/values';
import {createThread,saveMessages} from '@convex-dev/agent';
import {defineTestApp} from './native-transcript-read-scratch/node_modules/convex-test/dist/index.js';
import {createAuthorityReadScope,readNativeTranscriptMessages} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAuth.ts';
import {agentComponent} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeTranscript.ts';
const Q=path.dirname(fileURLToPath(import.meta.url));
const root='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const componentRoot=path.join(root,'node_modules/@convex-dev/agent/dist/component');
const componentSchema=(await import(pathToFileURL(path.join(componentRoot,'schema.js')))).default;
const modules=Object.fromEntries((await fs.readdir(componentRoot,{recursive:true})).filter(name=>name.endsWith('.js')).map(name=>['./'+name,()=>import(pathToFileURL(path.join(componentRoot,name)))]));
const app=defineTestApp({schema:defineSchema({marks:defineTable({value:v.string()})})});
const ref=agentComponent.messages.getMessagesByIds;
let nativeReads=0;
function scope(ctx){const port={...ctx,runQuery:async(reference,args)=>{if(JSON.stringify(getFunctionAddress(reference))===JSON.stringify(getFunctionAddress(ref)))nativeReads++;return await ctx.runQuery(reference,args);}};return createAuthorityReadScope(port,{nativeTranscript:true});}
const read=(ctx,ids)=>readNativeTranscriptMessages(ctx,ref,ids);
const definitions=app.defineModules({test:{
 pair:app.query({args:{ids:v.array(v.string())},handler:async(ctx,{ids})=>{const a=scope(ctx);const first=await read(a,ids),second=await read(createAuthorityReadScope(a),ids);first[0].message.content='detached local edit';const third=await read(a,ids);assert.deepEqual(third,second);return third;}}),
 writer:app.mutation({args:{ids:v.array(v.string()),fail:v.boolean()},handler:async(ctx,{ids,fail})=>{const a=scope(ctx);const original=await read(a,ids);await a.runMutation(agentComponent.messages.updateMessage,{messageId:ids[0],patch:{message:{role:'user',content:'component edit'}}});const changed=await read(a,ids);assert.equal(changed[0].message.content,'component edit');await a.db.insert('marks',{value:'parent write'});assert.deepEqual(await read(a,ids),changed);if(fail)throw Error('ROLLBACK_PARENT_AND_COMPONENT');return {old:original[0].message.content,new:changed[0].message.content};}}),
}});
const t=definitions.createTest();t.registerComponent('agent',componentSchema,modules);
const seed=await t.run(async ctx=>{const threadId=await createThread(ctx,agentComponent,{});return await saveMessages(ctx,agentComponent,{threadId,messages:[{role:'user',content:'initial native message'}]});});
const ids=seed.messages.map(row=>row._id);const checks=[];
const run=async(name,fn)=>{const before=nativeReads;await fn();checks.push({name,passed:true,officialNativeReads:nativeReads-before});};
await run('real official query retains raw readset, nested scope reuse, detached values',async()=>{const rows=await t.query(definitions.api.test.pair,{ids});assert.equal(rows[0].message.content,'initial native message');assert.equal(nativeReads,1);});
await run('fresh query invocation does not retain the prior raw scope',async()=>{await t.query(definitions.api.test.pair,{ids});assert.equal(nativeReads,2);});
await run('same parent component+DB writers invalidate before/after and expose writes',async()=>{const result=await t.mutation(definitions.api.test.writer,{ids,fail:false});assert.deepEqual(result,{old:'initial native message',new:'component edit'});assert.equal(nativeReads,5);});
await run('actual cross-component parent failure rolls all writes back',async()=>{await t.run(ctx=>ctx.runMutation(agentComponent.messages.updateMessage,{messageId:ids[0],patch:{message:{role:'user',content:'before rollback'}}}));await assert.rejects(t.mutation(definitions.api.test.writer,{ids,fail:true}),/ROLLBACK_PARENT_AND_COMPONENT/);const rows=await t.query(definitions.api.test.pair,{ids});assert.equal(rows[0].message.content,'before rollback');const marks=await t.run(ctx=>ctx.db.query('marks').collect());assert.equal(marks.length,1);});
await run('Action calls retain two separate native parent scopes',async()=>{const before=nativeReads;await t.action(async ctx=>{await ctx.runQuery(definitions.api.test.pair,{ids});await ctx.runQuery(definitions.api.test.pair,{ids});});assert.equal(nativeReads-before,2);});
const output={convexTestVersion:'0.0.61',convexVersion:'1.46.0',agentVersion:'0.7.3',checks,passed:checks.every(x=>x.passed),nativeReads,realInstalledComponentHandlers:true,providerCalls:0,cloudCalls:0,boundary:'Supported in-memory Convex DB/component transactions and rollback; actual native OCC/engine scheduling/latency pending.'};
await fs.writeFile(path.join(Q,'native-transcript-read-convex-test-'+(process.argv[2]??'v1')+'.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(output));
