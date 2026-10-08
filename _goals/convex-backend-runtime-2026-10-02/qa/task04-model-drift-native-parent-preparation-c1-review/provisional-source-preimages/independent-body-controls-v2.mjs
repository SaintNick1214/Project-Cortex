import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
const [sourcePath,outPath]=process.argv.slice(2);
const source=fs.readFileSync(sourcePath,'utf8');
const results=[];
async function one(name,options={}) {
 const clock={now:1000}, effects={reader:0,reads:0,cancels:0,releases:0,realNetwork:0,privateReads:0,signatures:0};
 const primary=new Error('DUMMY_FIRST_READ_FAILURE'), secondary=new Error('DUMMY_RELEASE_FAILURE');
 const context=vm.createContext({Buffer,Date:class extends Date{static now(){return clock.now;}},setTimeout,clearTimeout,AbortSignal,process:{argv:['node','DUMMY_CONTROL'],getuid:()=>process.getuid()}});
 const module=new vm.SourceTextModule(source,{context,identifier:sourcePath,initializeImportMeta:meta=>meta.url='file://'+sourcePath});
 const guard={livePreflight:()=>{throw Error('NO_LIVE');},root:'/DUMMY',repo:'/DUMMY',scratch:'/DUMMY',json:()=>{throw Error('NO_PRIVATE');},exclusive:()=>{throw Error('NO_OUTPUT');},sha256:v=>crypto.createHash('sha256').update(v).digest('hex'),canonical:()=>{throw Error('NO_READ');},preservationPreflight:()=>{throw Error('NO_PREFLIGHT');}};
 await module.link(async spec=>{const exports=spec==='./guard.mjs'?guard:await import(spec);return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context});});await module.evaluate();
 const sizes=options.sizes??[2];let index=0;
 const reader={async read(){effects.reads++;if(options.readFailure)throw primary;if(options.lateRead)await new Promise(done=>setTimeout(done,30));if(options.expireRead)clock.now=130000;if(index<sizes.length)return {done:false,value:new Uint8Array(sizes[index++])};return {done:true};},async cancel(){effects.cancels++;if(options.cancelFailure)throw new Error('DUMMY_CANCEL_FAILURE');},releaseLock(){effects.releases++;if(options.releaseFailure)throw secondary;}};
 const response={status:options.status??200,body:options.noBody?null:{getReader(){effects.reader++;return reader;}}};
 let value,error;try{value=await module.namespace.boundedParentBody(response,options.deadline??121000);}catch(caught){error=caught;}
 if(options.expectError){assert.ok(error,name+' error required');if(options.errorMatch)assert.match(error.message,options.errorMatch);if(options.firstIdentity)assert.equal(error,primary,name+' first error identity');assert.equal(value,undefined);}
 else {assert.equal(error,undefined,name);assert.equal(value,sizes.reduce((a,b)=>a+b,0));}
 if(effects.reader)assert.equal(effects.releases,1,name+' releases exactlyonce');
 if(options.expectCancel!==undefined)assert.equal(effects.cancels,options.expectCancel,name+' cancellation');
 results.push({name,status:'PASS',value:value??null,error:error?{name:error.name,message:error.message,firstIdentity:error===primary}:null,effects});
}
await one('empty-success',{sizes:[]});await one('two-byte-success');await one('exact16KiB-single',{sizes:[16384]});await one('exact16KiB-chunked',{sizes:[8192,8192]});
await one('oversize-single',{sizes:[16385],expectError:true,errorMatch:/BYTES/,expectCancel:1});await one('oversize-chunked',{sizes:[8192,8193],expectError:true,errorMatch:/BYTES/,expectCancel:1});
await one('read-first-error',{readFailure:true,expectError:true,firstIdentity:true,expectCancel:1});await one('read-cancel-error',{readFailure:true,cancelFailure:true,expectError:true,firstIdentity:true,expectCancel:1});
await one('read-release-error',{readFailure:true,releaseFailure:true,expectError:true,firstIdentity:true,expectCancel:1});await one('oversize-release-error',{sizes:[16385],releaseFailure:true,expectError:true,errorMatch:/BYTES/,expectCancel:1});
await one('release-only-error',{releaseFailure:true,expectError:true,errorMatch:/RELEASE/});await one('missing-body',{noBody:true,expectError:true,errorMatch:/BODY/,expectCancel:0});
await one('expired-before-body',{deadline:1000,expectError:true,errorMatch:/TOTAL_TIME/,expectCancel:0});await one('read-crosses-deadline',{expireRead:true,expectError:true,errorMatch:/TOTAL_TIME/,expectCancel:1});
await one('actual-late-read',{lateRead:true,deadline:1005,expectError:true,errorMatch:/DEADLINE/,expectCancel:1});
await one('HTTP403-cancel-before-read',{status:403,expectError:true,errorMatch:/owned peer environment update/,expectCancel:1});await one('HTTP403-cancel-secondary',{status:403,cancelFailure:true,expectError:true,errorMatch:/owned peer environment update/,expectCancel:1});await one('HTTP403-cancel-release-secondary',{status:403,cancelFailure:true,releaseFailure:true,expectError:true,errorMatch:/owned peer environment update/,expectCancel:1});
const result={argv:process.argv,cwd:process.cwd(),utc:new Date().toISOString(),source:{path:sourcePath,bytes:Buffer.byteLength(source),sha256:crypto.createHash('sha256').update(source).digest('hex')},defined:results.length,failed:0,skipped:0,results,scope:'EXACT_SOURCE_HELPER_DUMMY_STREAMS_ONLY_NO_NETWORK_PRIVATE_OR_SIGNING'};
fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'PASS',defined:results.length,sourceSHA256:result.source.sha256}));
