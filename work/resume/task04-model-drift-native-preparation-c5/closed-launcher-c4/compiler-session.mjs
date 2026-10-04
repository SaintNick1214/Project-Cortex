import {captureRows,actualRow,preimageRoot} from './preimage-store.mjs';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';import {snapshotBuild} from './route-policy.mjs';import {recordedEsbuild} from './recorded-esbuild.mjs';import {verifyGraph} from './fixed-command-launcher.mjs';
const H=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixedNames=new Set(['bundle.mjs','handlers.mjs','inventory-bundle.mjs','actual-handlers.mjs','actual-handler.mjs','bootstrap.mjs','before-schema.mjs','task04-native-admission-fixture-c5.mjs','task04-model-drift-native-extension-preparation-c1.mjs']);
const dynamicName=/^router-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.mjs$/;
/** One serial compiler port per fixed graph. Every generated import is registered from observed output bytes. */
export function compilerSession({descriptor,policy,toolClosure,sourceFence,recordRoot,moduleBoundary,deadlineMs,inputClosure=toolClosure,archiveRoot=preimageRoot}){
 let pending=Promise.resolve(),ordinal=0;
 const receipts=[];
 function prebytes(rows,area){return rows.map(row=>{const bytes=fs.readFileSync(row.path);if(bytes.length!==row.bytes||H(bytes)!==row.sha256)throw Error('QA_BRIDGE_COMPILER_INPUT_DRIFT');const p=policy.writePath(path.join(area,row.sha256+'.prebytes.gz'));if(!fs.existsSync(p))fs.writeFileSync(p,zlib.gzipSync(bytes,{mtime:0}),{flag:'wx',mode:0o600});const encoded=fs.readFileSync(p);if(!zlib.gunzipSync(encoded).equals(bytes))throw Error('QA_BRIDGE_COMPILER_PREBYTES');return {...row,beforeByteBacking:p,encodedSHA256:H(encoded)};});}
 async function invoke(options){
  const invocationStart=Date.now(),effectiveDeadline=Math.min(deadlineMs,invocationStart+20000);if(!Number.isSafeInteger(deadlineMs)||effectiveDeadline<=invocationStart)throw Error('QA_BRIDGE_COMPILER_DEADLINE');sourceFence();const o=snapshotBuild(options);if(!descriptor||!descriptor.compilerRoutes?.includes('RECORDED_ESBUILD_SERVICE')||descriptor.launchAuthority!=='NONE'&&descriptor.launchAuthority!=='EXTERNAL_ROOT_REQUIRED')throw Error('QA_BRIDGE_COMPILER_DESCRIPTOR');
  if(o.outfile!==undefined&&(!fixedNames.has(path.basename(o.outfile))&&!dynamicName.test(path.basename(o.outfile))))throw Error('QA_BRIDGE_COMPILER_OUTPUT_FAMILY');
  const outputs=o.outfile===undefined?[]:[o.outfile];for(const p of outputs)policy.writePath(p);
  if(o.outdir!==undefined&&(o.write!==false||!['/tmp/NOT_WRITTEN_NATIVE_PREPARATION_GRAPH','/tmp/NOT_WRITTEN_RUNTIME_TIER_GRAPH'].includes(o.outdir)))throw Error('QA_BUILD_ROUTE');
  for(const p of o.entryPoints??[])policy.readPath(p);if(o.stdin?.resolveDir)policy.readPath(o.stdin.resolveDir);
  const area=policy.writePath(path.join(recordRoot,'compiler-'+String(++ordinal).padStart(4,'0')));fs.mkdirSync(area,{mode:0o700});
  const dynamic=(o.entryPoints??[]).map(actualRow);const consumed=[...new Map([...inputClosure,...dynamic].map(r=>[r.path,r])).values()];const captured=captureRows(consumed,{root:archiveRoot,virtual:o.stdin?[{source:'ESBUILD_STDIN_SOURCE',contents:o.stdin.contents}]:[]});const archives=captured.files;sourceFence();
  const r=await recordedEsbuild({policy,toolClosure,sourceFence,entryOutputs:outputs,recordRoot:area,options:o,inputClosure:consumed,deadlineMs:effectiveDeadline});
  const produced=[];
  if(o.write!==false&&o.outfile!==undefined){for(const p of [o.outfile,...(o.sourcemap&&o.sourcemap!=='inline'?[o.outfile+'.map']:[])]){policy.writePath(p);const bytes=fs.readFileSync(p),row={path:p,bytes:bytes.length,sha256:H(bytes)};produced.push(row);if(p.endsWith('.mjs'))moduleBoundary?.registerProduced(row,'SOURCE_BOUND_ESBUILD');}}
  const receipt={commandId:descriptor.id,parentAbsoluteDeadline:deadlineMs,invocationStart,effectiveDeadline,compilerBudgetMs:20000,sourcePRE:archives,captureUTC:{utcPRE:captured.utcPRE,utcPOST:captured.utcPOST},sourcePOST:consumed.map(row=>{const b=fs.readFileSync(row.path);return{path:row.path,bytes:b.length,sha256:H(b)};}),produced,service:r.summary};receipts.push(receipt);fs.writeFileSync(policy.writePath(path.join(area,'compiler-composition-receipt.json')),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});return r.result;
 }
 return Object.freeze({build(options){const result=pending.then(()=>invoke(options));pending=result.then(()=>undefined,()=>undefined);return result;},async joined(){await pending;return receipts.slice();},receipts});
}
