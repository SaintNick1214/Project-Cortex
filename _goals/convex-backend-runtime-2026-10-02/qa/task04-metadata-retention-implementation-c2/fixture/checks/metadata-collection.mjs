import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
const hashes=[],log=console.log;let outcomes=[];
console.log=(...args)=>{for(const a of args)if(typeof a==='string'){try{const j=JSON.parse(a);if(j.outcomes)outcomes=j.outcomes;}catch{/* retain raw non-JSON output */}}log(...args);};
registerHooks({load(url,context,next){const result=next(url,context);if(url.endsWith('/fixture/checks/metadata.mjs')){
 const source=String(result.source),needle='console.log(JSON.stringify({outcomes}));throw e';
 if(source.split(needle).length!==2)throw new Error('COLLECTOR_WRAPPER');
 const changed=source.replace(needle,'console.log(JSON.stringify({outcomes}));return');
 hashes.push({url,rawSHA256:createHash('sha256').update(source).digest('hex'),loadedSHA256:createHash('sha256').update(changed).digest('hex'),change:'Only outer failure-report rethrow suppressed; all callback assertions unchanged'});
 return {...result,source:changed};}return result;}});
await import('./metadata.mjs');
log(JSON.stringify({scope:'UNCHANGED_C1_METADATA16_ASSERTION_BODY_FAILURE_COLLECTION_NOT_QUALIFICATION',hashes,total:outcomes.length,passed:outcomes.filter(x=>x.status==='PASS').length,failed:outcomes.filter(x=>x.status==='FAIL').length,notRun:16-outcomes.length,outcomes}));
process.exitCode=outcomes.some(x=>x.status==='FAIL')?1:0;
