import assert from 'node:assert/strict';
import {Harness} from './harness.mjs';
import {capture,mockResolver,modes} from './controls.mjs';
import * as guard from '../convex/guard.ts';
import * as life from '../convex/lifecycle.ts';
import {BINDING,ACCOUNT_HASH} from '../convex/installed.ts';
import {ORDER} from '../convex/cases.ts';
import {canonical,digest} from '../convex/validate.ts';
const outcomes=[];async function test(name,fn){try{await fn();outcomes.push({name,status:'PASS'})}catch(error){outcomes.push({name,status:'FAIL',error:String(error)});console.log(JSON.stringify({scope:'OFFLINE_LIFECYCLE_ONLY',outcomes}));throw error}}
async function toStage(id,before=false){modes.lifetime=true;modes.money=true;const h=await new Harness().setup(guard.buildControls(mockResolver));for(const current of ORDER){if(before&&current===id)return h;await h.reserve(current);await h.enter(current);if(current===id)return h;await capture(h,current)}throw Error('NO_STAGE')}
async function stageArgs(h,id){const a=h.state().attempts.find(a=>a.scenarioId===id),stageCanonical=canonical({text:'private first part'});return {scenarioId:id,dispatchIdentity:a.dispatchIdentity,binding:BINDING,stageCanonical,stageHash:await digest(stageCanonical),partSequence:2,rawPartDigest:'d'.repeat(64)}}
async function owned(h){const r=h.rows.find(r=>r._table==='fixtureInstallation');return {accountHash:ACCOUNT_HASH,targetHash:BINDING.targetHash,manifestHash:BINDING.manifestHash,operatorHash:BINDING.operatorHash,scope:{tenantHash:r.tenantHash,spaceHash:r.spaceHash,ownerHash:r.ownerHash},sourceId:r.sourceId,chunkId:r.chunkId,grantId:r.grantId}}
async function intent(h,operation,key='f'.repeat(64)){const o=await owned(h),source=h.rows.find(r=>r._id===o.sourceId),grant=h.rows.find(r=>r._id===o.grantId);let extra;if(operation==='delete')extra={expectedSourceRevision:source.revision,expectedSourceEpoch:source.epoch,expectedGrantEpoch:grant.epoch};else if(operation==='revoke')extra={expectedGrantEpoch:grant.epoch};else{const r=await h.query(life.recoverOwnedEvidence,{ownedCanonical:canonical(o)});assert.equal(r.kind,'summary');extra={evidenceSnapshotHash:r.evidenceSnapshotHash}}return {intentCanonical:canonical({domain:`cortex.experiment.${operation}-intent.v1`,version:1,owned:o,intentKey:key,...extra})}}
export {toStage,stageArgs,owned,intent};
