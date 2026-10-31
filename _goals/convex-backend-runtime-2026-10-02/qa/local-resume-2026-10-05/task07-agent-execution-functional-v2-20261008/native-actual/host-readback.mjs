import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha,denied} from './common.mjs';
const c=await openOwnedContext();try{
 await c.verifyTarget('host-final-target-verified');
 const pre=JSON.parse(await readFile(join(q,'update-owned-preimage.json'),'utf8'));
 const preserved=[];for(const pin of pre.preserved){const bytes=await readFile(join(c.host,pin.path));assert.equal(sha(bytes),pin.sha256);preserved.push(pin);}
 const notes=await c.hostOwner.query('host:authenticated',{});assert.equal(notes.length,1);
 assert.equal(notes[0].owner,'host-owner');
 const node=await c.hostOwner.action('hostNode:health',{});assert.equal(node.runtime,'node');assert.equal(node.subject,'host-owner');
 const wrongAuth=await denied(()=>c.owner.query('host:authenticated',{}));
 const route=await fetch(c.state.url.replace('.convex.cloud','.convex.site')+'/host-health',{signal:AbortSignal.timeout(30000)});
 assert.equal(route.status,200);const text=await route.text();assert.equal(text,'host-route-preserved');
 await c.publish('host-final-readback',{status:'PASS',target:c.state.projectId,preserved,hostIndexNotes:notes,node,http:{status:route.status,text},separateAuthDenial:c.publicError(wrongAuth),noModelCalls:true});
}finally{await c.close();}
