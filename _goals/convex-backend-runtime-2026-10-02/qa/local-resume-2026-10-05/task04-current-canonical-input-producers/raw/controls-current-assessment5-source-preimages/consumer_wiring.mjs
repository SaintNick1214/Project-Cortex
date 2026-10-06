// Prospective literal consumer adapter. Original modules remain reference-only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {strictJSON,shape,pin as validatePin,validateOutput} from './consumer_schema.mjs';
const PHASE='/var/tmp/cortex-task04-c8-r3-phase';
const outputs=['package-graph.json','original-read-map.json','historical-plan-index.json','package-aliases.json','candidate/mirror-source-transform-map.json','candidate/finite-producer-rules.json','candidate/prepared-source-inputs.json'];
const H=b=>crypto.createHash('sha256').update(b).digest('hex');
const fields=['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'];
function identity(s){return{schema:'FS_IDENTITY_DECIMAL_V1',fields:Object.fromEntries(fields.map(k=>[k,String(s[k==='mtime_ns'?'mtimeNs':k==='ctime_ns'?'ctimeNs':k])]))};}
const same=(a,b)=>fields.every(k=>a?.schema==='FS_IDENTITY_DECIMAL_V1'&&b?.schema===a.schema&&a.fields[k]===b.fields[k]);
function held(pin){
  validatePin(pin,['beforeByteBacking','original','originalSHA256','originalIdentity','rows','historicalBytes','encoding']);
  const pre=fs.lstatSync(pin.path,{bigint:true});
  if(!pre.isFile()||pre.nlink!==1n||fs.realpathSync(pin.path)!==pin.path||!same(identity(pre),pin.identity))throw Error('CONSUMER_CURRENT_SINGLE_LINK_PIN');
  const fd=fs.openSync(pin.path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let raw;
  try{if(!same(identity(pre),identity(fs.fstatSync(fd,{bigint:true}))))throw Error('CONSUMER_OPEN_DRIFT');
    const chunks=[];let bytes=0;const block=Buffer.alloc(65536);
    for(;;){const n=fs.readSync(fd,block,0,block.length,null);if(!n)break;bytes+=n;if(bytes>pin.bytes)throw Error('CONSUMER_BYTE_BOUND');chunks.push(Buffer.from(block.subarray(0,n)));}
    raw=Buffer.concat(chunks);if(raw.length!==pin.bytes||H(raw)!==pin.sha256||!same(identity(pre),identity(fs.fstatSync(fd,{bigint:true})))||!same(identity(pre),identity(fs.lstatSync(pin.path,{bigint:true}))))throw Error('CONSUMER_EOF_HASH_NINE_DRIFT');
  }finally{fs.closeSync(fd);}return raw;
}
function load(root,receiptPin,publicControl,publicOutputRoot){
  if(publicControl?!root.includes('/task04-c8-current-canonical-input-producers/controls/'):root!==PHASE)throw Error('CONSUMER_LITERAL_PHASE_ROOT');
  const outputRoot=publicControl&&publicOutputRoot?publicOutputRoot:root+'/generated-inputs';
  if(publicOutputRoot&&(!publicControl||!outputRoot.includes('/task04-c8-current-canonical-input-producers/controls/')||!outputRoot.endsWith('/generated-inputs')))throw Error('CONSUMER_PUBLIC_LITERAL_OUTPUT_NAMESPACE');
  if(receiptPin.path!==outputRoot+'/producer-receipt.json')throw Error('CONSUMER_RECEIPT_PATH');
  const receipt=strictJSON(held(receiptPin));
  shape(receipt,['scope','outputs','outputPathSet','directories','inputObservations','actualOutputBytesBeforeReceipt','prewriteDemand','fullEOFCurrentNine','original122','ROOT','enablingAttestation']);
  const historical=['historical-offline-runtime-freeze-extension.json','historical-offline-runtime-freeze-regression.json','historical-offline-runtime-freeze-extra.json','historical-freeze-after-scratch.json'];
  shape(receipt.outputs,[...outputs,...historical]);
  if(receipt.enablingAttestation!==false||receipt.ROOT!=='ABSENT'||receipt.original122!=='HELD'||(publicControl?receipt.scope!=='PUBLIC_SYNTHETIC_SOURCE_CONTROL':receipt.scope!=='CURRENT_SOURCE_PRODUCTION_NOT_QUALIFICATION'))throw Error('CONSUMER_SCOPE_HELD');
  const data={};for(const name of outputs){const pin=receipt.outputs[name];if(pin?.path!==outputRoot+'/'+name)throw Error('CONSUMER_EXACT_OUTPUT_PATH');data[name]=strictJSON(held(pin));}
  const refs=data['candidate/prepared-source-inputs.json'].files;
  const expected=[outputRoot+'/candidate/mirror-source-transform-map.json',outputRoot+'/package-graph.json',outputRoot+'/original-read-map.json',null,outputRoot+'/historical-plan-index.json',outputRoot+'/package-aliases.json',outputRoot+'/candidate/finite-producer-rules.json'];
  if(refs.length!==7||data['candidate/prepared-source-inputs.json'].excludedSelf!=='candidate/prepared-source-inputs.json')throw Error('CONSUMER_PREPARED_SEVEN_DEPENDENCIES');
  refs.forEach((pin,i)=>{if(expected[i]&&pin.path!==expected[i])throw Error('CONSUMER_PREPARED_LITERAL_MEMBERSHIP');held(pin);});
  for(const ref of refs){
    if(ref.beforeByteBacking?.encoding!=='GZIP_EXACT_PREIMAGE')throw Error('CONSUMER_PREPARED_EXACT_GZIP_BACKING');
    const encoded=held(ref.beforeByteBacking),raw=zlib.gunzipSync(encoded,{maxOutputLength:ref.bytes});
    if(raw.length!==ref.bytes||H(raw)!==ref.sha256)throw Error('CONSUMER_PREPARED_BACKING_CONTENT');
  }
  const command=strictJSON(held(refs[3]));
  shape(command,['version','scope','commands','sourceGraph','constraints','originalRecoveredRoots','rawEvidence','currentBlockers','status']);
  const ids=command.commands.map(row=>row.id);if(new Set(ids).size!==ids.length)throw Error('CONSUMER_DUPLICATE_COMMAND_ID');
  for(const name of outputs)validateOutput(name,data[name],root,ids,outputRoot,publicControl);
  function verifyAliases(){
    const aliases=data['package-aliases.json'],graph=data['package-graph.json'];
    if(aliases.packageGraphSHA256!==receipt.outputs['package-graph.json'].sha256||process.env.NODE_PATH!==undefined)throw Error('CONSUMER_GRAPH_HASH_OR_NODE_PATH');
    const base=root+'/mirror/node_modules',directories=[base,base+'/@esbuild',base+'/@types'];
    const children=[['@esbuild','@types','convex','esbuild','semver','typescript','zod'],['linux-x64'],['node']];
    aliases.directories.forEach((row,i)=>{const s=fs.lstatSync(row.path,{bigint:true});if(row.path!==directories[i]||!s.isDirectory()||fs.realpathSync(row.path)!==row.path||s.uid!==BigInt(process.getuid())||!same(identity(s),row.identity)||JSON.stringify(fs.readdirSync(row.path).sort())!==JSON.stringify(children[i].sort()))throw Error('CONSUMER_ALIAS_DIRECTORY_CURRENT_MEMBERSHIP');});
    if(JSON.stringify(aliases.links.map(row=>row.package))!==JSON.stringify(graph.packages))throw Error('CONSUMER_ALIAS_PACKAGE_ORDER');
    aliases.links.forEach(row=>{const pre=fs.lstatSync(row.path,{bigint:true}),literal=Buffer.from(fs.readlinkSync(row.path));const target=root+'/cohorts/packages/node_modules/'+row.package;
      if(row.path!==base+'/'+row.package||row.target!==target||!pre.isSymbolicLink()||pre.nlink!==1n||pre.uid!==BigInt(process.getuid())||!same(identity(pre),row.identity)||literal.toString()!==target||literal.length!==row.literalTargetBytes||H(literal)!==row.literalTargetSHA256||!same(identity(fs.lstatSync(row.path,{bigint:true})),row.identity))throw Error('CONSUMER_LITERAL_ALIAS_CURRENT_NINE');
      const members=graph.files.filter(pin=>pin.path.startsWith(target+'/')).map(pin=>pin.path).sort(),actual=[];
      function walk(p){for(const name of fs.readdirSync(p)){const q=path.join(p,name),s=fs.lstatSync(q,{bigint:true});if(s.isDirectory()&&!s.isSymbolicLink())walk(q);else if(s.isFile()&&s.nlink===1n)actual.push(q);else throw Error('CONSUMER_PACKAGE_SPECIAL_TYPE');}}walk(target);
      if(members.length!==row.capturedPackageRows||JSON.stringify(actual.sort())!==JSON.stringify(members))throw Error('CONSUMER_FULL_PACKAGE_MEMBERSHIP');
    });return true;
  }
  verifyAliases();
  for(const [name,ref]of Object.entries(data['historical-plan-index.json'].perId)){
    if(ref.path!==receipt.outputs['historical-'+name+'.json']?.path||ref.sha256!==receipt.outputs['historical-'+name+'.json'].sha256||!same(ref.identity,receipt.outputs['historical-'+name+'.json'].identity))throw Error('CONSUMER_HISTORY_ENCLOSING_PIN_CONFLICT');
    const value=strictJSON(held(ref));shape(value,['rows','sourcePins','kind','original122','historicalCustody']);
    value.rows.forEach(row=>validatePin(row,['beforeByteBacking','kind','declaredLogicalPath']));
    if(value.rows.length!==ref.rows||value.rows.reduce((total,row)=>total+row.bytes,0)!==ref.historicalBytes)throw Error('CONSUMER_HISTORY_COMPLETE_MEMBERSHIP');
  }
  return Object.freeze({root,outputRoot,receiptPin,data,command,scope:receipt.scope,verifyAliases,
    dispatch(){throw Error('ALL_ORIGINAL_122_ROOT_NATIVE_AND_WHOLE_120_HELD');}});
}
export const loadCanonicalInputs=(receiptPin)=>load(PHASE,receiptPin,false);
export const loadPublicControlInputs=(root,receiptPin,outputRoot)=>load(root,receiptPin,true,outputRoot);

export function wireRegistry(inputs,contract,nodePin){
  const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
  if(H(Buffer.from(canonical(inputs.command)+'\n'))!==contract.commandCanonicalSHA256)throw Error('REGISTRY_ALL_COMMAND_FIELDS_ARGV_GUARDS');
  held(nodePin);const lineage=inputs.data['candidate/mirror-source-transform-map.json'].inputs;
  const byLogical=new Map(lineage.map(row=>[row.logicalSource,row]));
  if(byLogical.size!==lineage.length||byLogical.size!==Object.keys(contract.sources).length)throw Error('REGISTRY_ALL_LITERAL_SOURCE_MAPPINGS');
  const descriptors=inputs.command.commands.map(command=>{
    const entryLogical=command.proposedArgv.find(value=>byLogical.has(value));const entry=byLogical.get(entryLogical);
    if(!entry||entry.sha256!==command.entrySha256)throw Error('REGISTRY_ORIGINAL_ENTRY_HASH');
    const map=new Map(Object.entries(contract.argvDestinationMap).map(([from,to])=>[from,to.replace('${PHASE_ROOT}',inputs.root)]));
    const argv=[nodePin.path,...command.proposedArgv.slice(1).map(value=>{
      if(!value.startsWith('/workspace/Project-Cortex/'))return value;
      if(!map.has(value))throw Error('REGISTRY_UNKNOWN_ABSOLUTE_ARGUMENT');return map.get(value);
    })];
    if(argv[command.proposedArgv.indexOf(entryLogical)]!==entry.destination)throw Error('REGISTRY_LITERAL_ENTRY_DESTINATION');
    return Object.freeze({...command,originalArgv:[...command.proposedArgv],argv,entry:entry.destination,entrySHA256:entry.destinationSHA256,
      originalEntrySHA256:entry.sha256,sourceMap:lineage.map(row=>({path:row.destination,bytes:row.destinationBytes,sha256:row.destinationSHA256,identity:row.destinationIdentity,original:row.source,originalSHA256:row.sha256,originalIdentity:row.sourceIdentity})),
      status:'PREPARED_SOURCE_ONLY_ORIGINAL_LAUNCH_HELD',ROOT:'ABSENT'});
  });
  if(JSON.stringify(descriptors.map(row=>row.id))!==JSON.stringify(contract.originalIds))throw Error('REGISTRY_ALL_ORIGINAL_IDS_ORDER');
  return Object.freeze({descriptors,dispatch(){throw Error('ALL_122_EXECUTION_HELD');}});
}

export function wireComposition(inputs,descriptor,adapterPins,nodePin){
  inputs.verifyAliases();
  const graph=inputs.data['package-graph.json'],lineage=inputs.data['candidate/mirror-source-transform-map.json'].inputs;
  const packageRoot=inputs.root+'/cohorts/packages/node_modules/';
  const tools=['esbuild/lib/main.js','esbuild/package.json','@esbuild/linux-x64/bin/esbuild'].map(relative=>{
    const row=graph.files.find(value=>value.path===packageRoot+relative);if(!row)throw Error('COMPOSITION_EXACT_COMPILER_SOURCE_CLOSURE');return row;
  });
  const original=lineage.map(row=>({path:row.source,bytes:row.bytes,sha256:row.sha256,identity:row.sourceIdentity}));
  const refs=inputs.data['candidate/prepared-source-inputs.json'].files;
  const self=inputs.receiptPin;const preparedPath=inputs.outputRoot+'/candidate/prepared-source-inputs.json';
  const preparedPin=strictJSON(held(self)).outputs['candidate/prepared-source-inputs.json'];
  if(!Array.isArray(adapterPins)||!adapterPins.length||adapterPins.some(row=>!row.path.startsWith(inputs.root+'/candidate/')))throw Error('COMPOSITION_CURRENT_ADAPTER_INPUTS_REQUIRED');
  const merged=new Map();for(const row of [...descriptor.sourceMap,...original,...graph.files,...tools,...adapterPins,...refs,preparedPin,nodePin]){
    const old=merged.get(row.path);if(old&&(old.bytes!==row.bytes||old.sha256!==row.sha256||!same(old.identity,row.identity)))throw Error('COMPOSITION_INCONSISTENT_DUPLICATE_PIN');merged.set(row.path,row);
  }
  const closure=[...merged.values()];
  closure.forEach(held);inputs.verifyAliases();
  return Object.freeze({closure,toolClosure:tools,history:inputs.data['historical-plan-index.json'].perId[descriptor.id]??null,
    preparedSelf:preparedPath,status:'CURRENT_SOURCE_ONLY_NOT_INSTALLED_OR_EVALUATED',ROOT:'ABSENT'});
}
