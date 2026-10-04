import * as guard from '../convex/guard.ts';
import * as lifecycle from '../convex/lifecycle.ts';
import * as managed from '../convex/managed.ts';
import {BINDING,OWNER_RUN_ID} from '../convex/installed.ts';
import {canonical} from '../convex/validate.ts';
export const ROOT_ID='https://fixture.invalid|operator';
/** Offline snapshot/OCC/rollback/response-loss model only. Real registered handlers run;
 * native DB permissions, vector index, scheduler and action lifetime remain NOT_RUN. */
export class Harness {
 rows=[];version=0;conflicts=0;writes=0;loseResponse=false;failBeforeCommit=false;seq=0;controls=guard;
 auth={getUserIdentity:async()=>({tokenIdentifier:ROOT_ID})};
 queryDb(snapshot){return {get:async id=>structuredClone(snapshot.find(r=>r._id===id)??null),normalizeId:(table,id)=>typeof id==='string'&&id.startsWith(table+':')?id:null,query:table=>({take:async n=>snapshot.filter(r=>r._table===table).slice(0,n).map(r=>{const rest={...r};delete rest._table;return structuredClone(rest)}),withIndex:(_index,cb)=>{const conditions=[];const builder={eq:(k,val)=>{conditions.push([k,val]);return builder}};cb(builder);const matches=()=>snapshot.filter(r=>r._table===table&&conditions.every(([k,v])=>r[k]===v)).map(r=>{const rest={...r};delete rest._table;return structuredClone(rest)});return {unique:async()=>{const out=matches();if(out.length>1)throw Error('NON_UNIQUE');return out[0]??null},take:async n=>matches().slice(0,n)}}})}}
 async mutation(fn,args={}){for(let retry=0;retry<32;retry++){const version=this.version,snapshot=structuredClone(this.rows);let writes=0;const db=this.queryDb(snapshot),clean=r=>{const rest={...r};delete rest._table;return rest};db.get=async id=>{const r=snapshot.find(r=>r._id===id);return r?structuredClone(clean(r)):null};db.insert=async(table,row)=>{writes++;const id=table+':'+(++this.seq);snapshot.push({...structuredClone(row),_id:id,_creationTime:Date.now(),_table:table});return id};db.patch=async(id,patch)=>{writes++;const row=snapshot.find(r=>r._id===id);if(!row)throw Error('MISSING');Object.assign(row,structuredClone(patch))};db.replace=async(id,data)=>{writes++;const i=snapshot.findIndex(r=>r._id===id);if(i<0)throw Error('MISSING');snapshot[i]={...structuredClone(data),_id:id,_creationTime:snapshot[i]._creationTime,_table:snapshot[i]._table}};db.delete=async id=>{writes++;const i=snapshot.findIndex(r=>r._id===id);if(i<0)throw Error('MISSING');snapshot.splice(i,1)};const result=await fn._handler({db,auth:this.auth},args);if(version!==this.version){this.conflicts++;continue}if(this.failBeforeCommit){this.failBeforeCommit=false;throw Error('ROLLBACK_INJECTED')}if(writes){this.rows=snapshot;this.version++;this.writes+=writes}if(this.loseResponse){this.loseResponse=false;throw Error('COMMITTED_RESPONSE_LOST')}return result}throw Error('OCC_EXHAUSTED')}
 async query(fn,args={}){const db=this.queryDb(this.rows);db.get=async id=>{const r=this.rows.find(r=>r._id===id);if(!r)return null;const rest={...r};delete rest._table;return structuredClone(rest)};return fn._handler({db,auth:this.auth},args)}
 async setup(controls=guard){this.controls=controls;await this.mutation(controls.provision);await this.mutation(managed.provisionOwned);return this}
 state(){return JSON.parse(this.rows.find(r=>r._table==='experimentControls').stateCanonical)}
 setState(s){this.rows.find(r=>r._table==='experimentControls').stateCanonical=canonical(s,524288);this.version++}
 args(id='C01'){return {scenarioId:id,ownerRunId:OWNER_RUN_ID,principalHash:BINDING.operatorHash}}
 async reserve(id='C01'){return this.mutation(this.controls.reserveCheckpoint,this.args(id))}
 async enter(id='C01'){const a=this.state().attempts.find(a=>a.scenarioId===id);return this.mutation(this.controls.enterPeer,{...this.args(id),dispatchIdentity:a.dispatchIdentity})}
 action(){return {auth:this.auth,runMutation:async(ref,args)=>{const name=ref[Symbol.for('functionName')];const [mod,key]=name.split(':');return this.mutation((mod==='guard'?this.controls:mod==='lifecycle'?lifecycle:managed)[key],args)},runQuery:async(ref,args)=>{const [mod,key]=ref[Symbol.for('functionName')].split(':');return this.query((mod==='guard'?this.controls:mod==='lifecycle'?lifecycle:managed)[key],args)},vectorSearch:async()=>[]}}
}
