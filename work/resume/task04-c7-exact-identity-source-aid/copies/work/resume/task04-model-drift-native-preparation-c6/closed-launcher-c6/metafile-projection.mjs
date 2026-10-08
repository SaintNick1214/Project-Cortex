import path from 'node:path';import crypto from 'node:crypto';import {heldSnapshot} from './preimage-store.mjs';
const R='/workspace/Project-Cortex',M='/dev/shm/cortex-native-c6-closed-launcher-c6/mirror',H=b=>crypto.createHash('sha256').update(b).digest('hex');
/** Only the two original metadata writers consume these projected source names.
 * Output names/options and raw compiler metadata remain untouched. */
export function projectFixedMetafile({descriptor,metafile,inputRows}){
 if(!['runner-closure','dependency-tiers'].includes(descriptor.id))throw Error('QA_BRIDGE_METAFILE_DESCRIPTOR');
 const declared=new Map(descriptor.sourceMap.map(r=>[r.path,r])),consumed=new Map(inputRows.map(r=>[r.path,r])),bindings=[],names=new Map();
 const meta=structuredClone(metafile);if(!meta||!meta.inputs||!meta.outputs)throw Error('QA_BRIDGE_METAFILE_SCHEMA');
 for(const key of Object.keys(meta.inputs)){
  const source=path.resolve(R,key);if(key!==path.relative(R,source))throw Error('QA_BRIDGE_METAFILE_NONCANONICAL');
  if(!consumed.has(source))throw Error('QA_BRIDGE_METAFILE_INPUT');const consumedPin=consumed.get(source),current=heldSnapshot(source);if(current.bytes.length!==consumedPin.bytes||H(current.bytes)!==consumedPin.sha256)throw Error('QA_BRIDGE_METAFILE_SOURCE_DRIFT');if(!consumedPin.identity||Object.keys(consumedPin.identity).some(k=>current.identity[k]!==consumedPin.identity[k]))throw Error('QA_BRIDGE_METAFILE_CONSUMED_IDENTITY');let projected=key;
  if(source.startsWith(M+'/')){
   const row=declared.get(source);if(!row||row.original!==path.join(R,path.relative(M,source)))throw Error('QA_BRIDGE_METAFILE_MEMBER');
   const before=current,original=heldSnapshot(row.original),originalPin=consumed.get(row.original);if(!originalPin?.identity||Object.keys(originalPin.identity).some(k=>original.identity[k]!==originalPin.identity[k]))throw Error('QA_BRIDGE_METAFILE_CONSUMED_IDENTITY');if(before.bytes.length!==row.bytes||H(before.bytes)!==row.sha256||!originalPin||original.bytes.length!==originalPin.bytes||H(original.bytes)!==row.originalSHA256||originalPin.sha256!==row.originalSHA256)throw Error('QA_BRIDGE_METAFILE_SOURCE_DRIFT');
   projected=path.relative(R,row.original);bindings.push({rawKey:key,projectedKey:projected,mirror:{path:source,bytes:before.bytes.length,sha256:row.sha256,identity:before.identity},original:{path:row.original,bytes:original.bytes.length,sha256:row.originalSHA256,identity:original.identity},recipe:'EXACT_DESCRIPTOR_SOURCE_MAP_DESTINATION_TO_ORIGINAL'});
  }
  if([...names.values()].includes(projected))throw Error('QA_BRIDGE_METAFILE_COLLISION');names.set(key,projected);
 }
 const reference=key=>{if(!names.has(key))throw Error('QA_BRIDGE_METAFILE_REFERENCE');return names.get(key);};
 const mapped={};for(const[key,value]of Object.entries(meta.inputs)){for(const item of value.imports??[])if(!item.external)item.path=reference(item.path);mapped[reference(key)]=value;}meta.inputs=mapped;
 for(const value of Object.values(meta.outputs)){if(value.entryPoint!==undefined)value.entryPoint=reference(value.entryPoint);if(value.inputs!==undefined){const inputs={};for(const[key,item]of Object.entries(value.inputs))inputs[reference(key)]=item;value.inputs=inputs;}}
 return {metafile:meta,bindings,scope:'EXACT_RUNNER_CLOSURE_DEPENDENCY_TIERS_SOURCE_MAP_ONLY',rawMetafileSHA256:H(Buffer.from(JSON.stringify(metafile))),projectedMetafileSHA256:H(Buffer.from(JSON.stringify(meta)))};
}
