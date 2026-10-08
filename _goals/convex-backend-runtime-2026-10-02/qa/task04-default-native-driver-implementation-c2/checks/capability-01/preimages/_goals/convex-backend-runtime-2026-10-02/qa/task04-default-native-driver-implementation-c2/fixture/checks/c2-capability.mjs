import assert from 'node:assert/strict';
import {h as prefix} from './independent-prefix.mjs';
import {Harness} from './harness.mjs';
import {canonical,digest} from '../convex/validate.ts';
import {OWNER_RUN_ID,BINDING} from '../convex/installed.ts';
import * as originalRunner from '../convex/runner.ts';
import * as originalLifecycle from '../convex/lifecycle.ts';
import * as runner from '../../fixture-vm/convex/runner.ts';
import * as lifecycle from '../../fixture-vm/convex/lifecycle.ts';
import {setParts} from '../../fixture-vm/convex/dummy-port.mjs';
const base=prefix.state();base.attempts.pop();base.next--;base.active=null;base.reserved=0;prefix.setState(base);const baseRows=structuredClone(prefix.rows);
assert.equal(String(runner.OFFICIAL_DRIVER.execute),String(originalRunner.OFFICIAL_DRIVER.execute));
const fresh=()=>{const h=new Harness();h.rows=structuredClone(baseRows);h.controls=prefix.controls;return h;};
const parts=[{type:'raw',rawValue:{id:'DUMMY',model:'openai/gpt-4o-mini',choices:[{index:0,delta:{content:'first'},finish_reason:null}]}},{type:'text-start',id:'DUMMY'},{type:'text-delta',id:'DUMMY',delta:'first'}];
setParts(parts);const h=fresh(),action=h.action(),old=action.runMutation;let issued,native=0;action.runMutation=async(ref,args)=>{if(ref[Symbol.for('functionName')].endsWith('stageAndTrigger')){issued=structuredClone(args);native++;return h.mutation(lifecycle.stageAndTrigger,args)}return old(ref,args)};
const result=await runner.buildRunner(runner.OFFICIAL_DRIVER,{entry:1000,native:15000,persistence:1000,cleanup:10})(action,{scenarioId:'C09',ownerRunId:OWNER_RUN_ID});assert.equal(native,1);assert.ok(issued);assert.equal(h.rows.filter(r=>r._table==='fixtureStages').length,1);assert.equal(h.state().revoked,true);assert.equal(h.state().active,'C09');assert.equal(h.state().attempts.at(-1).known,null);assert.equal('capabilityCanonical' in result,false);assert.equal('text' in result,false);
const outcomes=[{name:'exact official source body DUMMY factory issues fresh registered C09 atomic stage',status:'PASS'}];
const w=h.writes;assert.equal((await h.mutation(lifecycle.stageAndTrigger,{...issued,capabilityCanonical:undefined})).kind,'replay');for(const change of [{partSequence:511},{rawPartDigest:'f'.repeat(64)}])assert.equal((await h.mutation(lifecycle.stageAndTrigger,{...issued,...change})).kind,'collision');assert.equal(h.writes,w);outcomes.push({name:'historical full identity replay/collision before capability/live fences zero writes',status:'PASS'});
async function denial(label,args){const x=fresh();await x.reserve('C09');await x.enter('C09');const writes=x.writes;const state=x.rows.find(r=>r._table==='experimentControls').stateCanonical;const got=await x.mutation(lifecycle.stageAndTrigger,args);assert.equal(got.kind,'denied',label);assert.equal(x.writes,writes,label);assert.equal(x.rows.find(r=>r._table==='experimentControls').stateCanonical,state,label);outcomes.push({name:label,status:'PASS'});}
const noCap={...issued};delete noCap.capabilityCanonical;await denial('ROOT old sevenargs cannot manufacture fresh stage',noCap);
assert.equal((await originalLifecycle.stageAndTrigger._handler({db:fresh().queryDb([]),auth:prefix.auth},noCap).catch(()=>({kind:'denied'}))).kind,'denied');
const cap=JSON.parse(issued.capabilityCanonical),p=JSON.parse(cap.nominationCanonical),s=JSON.parse(cap.submissionCanonical);
for(const key of Object.keys(p)){const changed={...p,[key]:null};await denial('tampered P field '+key,{...issued,capabilityCanonical:canonical({...cap,nominationCanonical:canonical(changed,190000)},193000)});}
for(const key of Object.keys(s)){await denial('tampered S field '+key,{...issued,capabilityCanonical:canonical({...cap,submissionCanonical:canonical({...s,[key]:null},4096)},193000)});}
for(const key of ['nominationMac','submissionMac'])await denial('tampered '+key,{...issued,capabilityCanonical:canonical({...cap,[key]:'e'.repeat(64)},193000)});
await denial('noncanonical outer envelope',{...issued,capabilityCanonical:' '+issued.capabilityCanonical});
await denial('overbound outer envelope before parsing',{...issued,capabilityCanonical:'x'.repeat(193001)});
await denial('later shaped sequence cannot replace firsteligible',{...issued,partSequence:issued.partSequence+1});
assert.equal(await originalRunner.verifyStageCapability(issued),false);outcomes.push({name:'uninstalled actual verifier refuses DUMMY VM key',status:'PASS'});
const noDriver=fresh();await assert.rejects(originalRunner.run._handler(noDriver.action(),{scenarioId:'C09',ownerRunId:OWNER_RUN_ID}),/OFFICIAL_NATIVE_DRIVER_NOT_IMPLEMENTED/);assert.equal(noDriver.state().next,12);outcomes.push({name:'actual action uninstalled missingdriver before effect',status:'PASS'});
// Source-only server test obtains an entered original attempt; test config is fixed DUMMY only.
const raw=JSON.parse(issued.capabilityCanonical);raw.nominationCanonical=canonical({...p,observerTranscriptCanonical:'x'.repeat(180001)},190000);await denial('child observer bound before retention',{...issued,capabilityCanonical:canonical(raw,193000)});
assert.equal(issued.stageHash,await digest(issued.stageCanonical));assert.deepEqual(issued.binding,BINDING);
console.log(JSON.stringify({scope:'DUMMY_SOURCE_VM_REGISTERED_CAPABILITY_NO_ACTUAL_FACTORY_KEY_OR_NATIVE',outcomes,skipped:0}));
