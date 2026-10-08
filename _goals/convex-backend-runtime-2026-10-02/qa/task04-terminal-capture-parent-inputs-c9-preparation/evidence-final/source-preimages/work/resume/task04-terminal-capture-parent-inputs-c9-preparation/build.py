from pathlib import Path
import json,re
r=Path('/workspace/Project-Cortex');old=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c8-preparation';q=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c9-preparation';base=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-native-extension-preparation-c4'
tracker="""const output=(name,value)=>{
  const path=resolve(scratch,name),state={name,created:false,written:false,durable:false,closed:false};
  exclusive(path,value,true,undefined,{deadlineMs:deadline,beforeCreate:()=>parentDeadline(deadline),observe:phase=>{
   if(phase==='created'){assert.equal(state.created,false,'PARENT_OUTPUT_CREATED_ONCE');state.created=true;effects.privateOutputs.push(name);effects.privateOutputStates.push(state);}
   else{assert.equal(state.created,true,'PARENT_OUTPUT_CREATED');assert.ok(['written','durable','closed'].includes(phase),'PARENT_OUTPUT_PHASE');state[phase]=true;}
  }});
  parentDeadline(deadline);
 };"""
for name in ['extension','regression']:
 request=json.loads(((base if name=='extension' else base/'regression')/'project-request.json').read_text());source=(old/f'parent-inputs-{name}.mjs').read_text().replace('native-extension-preparation-c3','native-extension-preparation-c4').replace('native-extension-c3','native-extension-c4').replace('native-regression-c3','native-regression-c4');source=re.sub(r'export const profileContract=Object.freeze\(.*?\);','export const profileContract=Object.freeze('+json.dumps(request,separators=(',',':'))+');',source,count=1)
 source=source.replace('configurationCalls:0,privateOutputs:[]','configurationCalls:0,privateOutputs:[],privateOutputStates:[]');source=source.replace("const output=(name,value)=>{const path=resolve(scratch,name);parentDeadline(deadline);exclusive(path,value);effects.privateOutputs.push(name);};",tracker);source=source.replace("privateOutputs:Object.freeze([...effects.privateOutputs])","privateOutputs:Object.freeze([...effects.privateOutputs]),privateOutputStates:Object.freeze(effects.privateOutputStates.map(state=>Object.freeze({...state})))")
 (q/f'parent-inputs-{name}.mjs').write_text(source)
 watch=(old/f'current-inputs-{name}.mjs').read_text().replace('native-extension-preparation-c3','native-extension-preparation-c4').replace('strictProfile,candidateArgument}','strictProfile,candidateArgument,parentDeadline}')
 watch=watch.replace('export async function main(){const deadline=Date.now()+120000;', "let watcherStarted=false;\nexport async function main(){assert.equal(watcherStarted,false,'PARENT_WATCHER_ALREADY_STARTED');watcherStarted=true;const deadline=Date.now()+120000;const effects={privateOutputs:[],privateOutputStates:[]};"+tracker+"try{")
 for file,value in [('current-physical-id-input-receipt.json','proof'),('argument-scope.json','scope')]:watch=watch.replace("exclusive(resolve(scratch,'"+file+"'),"+value+")","output('"+file+"',"+value+")")
 watch=watch.replace("exclusive(resolve(scratch,'public-arguments.json'),", "output('public-arguments.json',")
 watch=watch.replace("process.stdout.write(JSON.stringify({status:'PASS_SOURCE_BOUND_INPUTS'", "parentDeadline(deadline);process.stdout.write(JSON.stringify({status:'PASS_SOURCE_BOUND_INPUTS'")
 ending="+'\\n');}\nif(process.argv[1]"
 newEnding="+'\\n');}catch(error){if(error&&typeof error==='object'){try{Object.defineProperty(error,'parentCurrentInputEffects',{value:Object.freeze({status:'FAIL',privateOutputs:Object.freeze([...effects.privateOutputs]),privateOutputStates:Object.freeze(effects.privateOutputStates.map(state=>Object.freeze({...state})))}),enumerable:true});}catch{}}throw error;}}\nif(process.argv[1]"
 assert ending in watch;watch=watch.replace(ending,newEnding);(q/f'current-inputs-{name}.mjs').write_text(watch)
for file in ['accepted-c6-parent-inputs.mjs.text','accepted-c6-current-inputs.mjs.text','accepted-c6-results-final02.json','accepted-c6-prior-review-results.json','prior-c7-results-extension.json','prior-c7-results-regression.json']:(q/file).write_bytes((old/file).read_bytes())
review=r/'_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-parent-inputs-c8-review'
for file in ['report.md','qa-manifest.json','hostile-identity-extension.mjs.text','hostile-identity-regression.mjs.text']:(q/('prior-c8-review-'+file)).write_bytes((review/file).read_bytes())
