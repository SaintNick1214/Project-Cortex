/** Private bounded diagnostic observations; never authorizes or classifies a denial. */
import { openSync, writeSync, closeSync, fsyncSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export const diagnosticLimits=Object.freeze({bytesPerRecord:65536,records:32});
const hash=value=>createHash('sha256').update(value).digest('hex');
const codes=new Set(['InvalidAuth','InvalidAuthHeader','NoAuthProvider','Unauthenticated','FORBIDDEN','UNAUTHENTICATED','INTERNAL_FAILURE']);
export async function boundedWireBody(response){
 const reader=response.clone().body?.getReader();if(!reader)return {body:'',byteCount:0,truncated:false};
 const chunks=[];let size=0,truncated=false;
 try{while(true){const {done,value}=await reader.read();if(done)break;const remaining=diagnosticLimits.bytesPerRecord-size;if(value.length>remaining){chunks.push(value.subarray(0,remaining));size+=remaining;truncated=true;break;}chunks.push(value);size+=value.length;}}
 finally{void reader.cancel().catch(()=>{});}
 return {body:new TextDecoder('utf-8').decode(Buffer.concat(chunks.map(value=>Buffer.from(value)))),byteCount:size,truncated};
}
export function createWireDiagnostics(directory,origin){
 const stat=lstatSync(directory);if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o777)!==0o700||stat.uid!==process.getuid())throw new Error('Private diagnostic directory rejected');
 const observations=[];let count=0,dropped=0,recentWire;const secrets=new Set();
 const scrub=value=>{let result=String(value);for(const secret of secrets)if(secret)result=result.replaceAll(secret,'[REDACTED]');return result.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_JWT]').replace(/(?:prod|dev):[A-Za-z0-9_-]+\|[A-Za-z0-9]+/g,'[REDACTED_DEPLOY_KEY]');};
 function save(kind,metadata,raw){
  if(count>=diagnosticLimits.records){dropped++;return;}
  const alias='wire-diagnostic-'+randomUUID()+'.json';let text=JSON.stringify({version:1,observedAt:new Date().toISOString(),kind,...metadata,privateDiagnostic:scrub(raw)});
  const originalBytes=Buffer.byteLength(text)+1;if(originalBytes>diagnosticLimits.bytesPerRecord)text=JSON.stringify({version:1,kind,...metadata,privateDiagnostic:'[TRUNCATED]',diagnosticSha256:hash(scrub(raw)),truncated:true});
  if(Buffer.byteLength(text)+1>diagnosticLimits.bytesPerRecord)text=JSON.stringify({version:1,kind,privateDiagnostic:'[TRUNCATED]',diagnosticSha256:hash(scrub(raw)),truncated:true});
  const path=resolve(directory,alias);const fd=openSync(path,'wx',0o600);try{writeSync(fd,text+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  const stat=lstatSync(path);if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o777)!==0o600||stat.uid!==process.getuid()||stat.size>diagnosticLimits.bytesPerRecord)throw new Error('Diagnostic receipt rejected');
  count++;observations.push({alias,kind,...metadata,receiptSha256:hash(text+'\n'),receiptBytes:stat.size});
 }
 return {
  addSecret(value){if(typeof value==='string'&&value.length>=8)secrets.add(value);},
  wire(status,responseOrigin,body,byteCount,truncated){if(responseOrigin!==origin)throw new Error('Diagnostic origin rejected');let shape='non_json',codeHash,code;
   try{const value=JSON.parse(body);shape=Array.isArray(value)?'array':value===null?'null':typeof value;if(value&&typeof value==='object'&&!Array.isArray(value)){shape='object:'+hash(JSON.stringify(Object.keys(value).sort()));if(typeof value.code==='string'){if(codes.has(value.code))code=value.code;else codeHash=hash(value.code);}}}catch{ /* Preserve unknown wire privately; do not infer denial. */ }
   recentWire={metadata:{status,origin:responseOrigin,byteCount,truncated,bodySha256:hash(body),shape,...(code?{code}:{}),...(codeHash?{codeSha256:codeHash}:{})},body};
  },
  clear(){recentWire=undefined;},
  error(error,cachedWire){if(recentWire)save('non_ok_wire',recentWire.metadata,recentWire.body);const message=typeof error?.message==='string'?error.message:'';let data;try{data=JSON.stringify(error?.data);}catch{data='[UNSERIALIZABLE]';}save('caught_native_error',{messageSha256:hash(message),cachedWire:cachedWire===true},JSON.stringify({message,data}));},
  success(){if(recentWire)save('non_ok_wire',recentWire.metadata,recentWire.body);save('unexpected_success',{category:'UNEXPECTED_SUCCESS'},'No result payload captured');},
  summary(){return {recordCount:count,droppedRecords:dropped,maxRecords:diagnosticLimits.records,maxRecordBytes:diagnosticLimits.bytesPerRecord,receipts:[...observations]};}
 };
}
