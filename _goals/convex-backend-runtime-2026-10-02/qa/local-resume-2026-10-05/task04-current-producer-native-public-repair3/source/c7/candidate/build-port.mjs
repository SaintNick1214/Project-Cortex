import {boundedBuild,snapshotBuild} from './route-policy.mjs';
import {verifyGraph} from './fixed-command-launcher.mjs';
const virtualOutdirs=Object.freeze(['/tmp/NOT_WRITTEN_NATIVE_PREPARATION_GRAPH','/tmp/NOT_WRITTEN_RUNTIME_TIER_GRAPH']);
/** Adapter outside the byte-exact accepted component. Only these two inert noemit forms. */
export function sourceBoundBuild({policy,build,toolClosure,entryOutputs,sourceFence,record}) {
 const allowed=new Set(entryOutputs);
 return async options=>{
  const source=snapshotBuild(options);
  let virtual;
  if(source.outdir!==undefined){
   if(source.write!==false||!virtualOutdirs.includes(source.outdir)||source.outfile!==undefined)throw Error('QA_BUILD_ROUTE');
   virtual=source.outdir;
  }
  const data=virtual===undefined?source:Object.fromEntries(Object.entries(source).filter(([key])=>key!=='outdir'));
  return boundedBuild(policy,async snapshot=>{
   if(snapshot.outfile!==undefined&&!allowed.has(snapshot.outfile))throw Error('QA_BRIDGE_BUILD_OUTPUT');
   verifyGraph(toolClosure);sourceFence();
   const actual=virtual===undefined?snapshot:Object.freeze({...snapshot,outdir:virtual});
   record({kind:'BUILD',options:actual});
   const result=await build(actual);
   sourceFence();verifyGraph(toolClosure);
   if(snapshot.outfile!==undefined)policy.writePath(snapshot.outfile);
   return result;
  })(data);
 };
}
