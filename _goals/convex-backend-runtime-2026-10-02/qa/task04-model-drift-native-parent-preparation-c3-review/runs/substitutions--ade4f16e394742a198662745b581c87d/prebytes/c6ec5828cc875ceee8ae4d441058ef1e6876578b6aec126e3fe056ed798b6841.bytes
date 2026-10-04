/** Finite owned incremental body, absolute deadline; cleanup never replaces primary. */
export async function ownedResponseBytes(response,maxBytes,deadline,{requireBody=false,ceilingCode='QA_RESPONSE_CEILING'}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<0||!Number.isFinite(deadline))throw Error('QA_BODY_BOUND');
 const reader=response.body?.getReader();if(!reader){if(requireBody)throw Error('QA_RESPONSE_BODY');if(Date.now()>=deadline)throw Error('QA_RESPONSE_DEADLINE');return Buffer.alloc(0);}let size=0,primary;const parts=[];
 const secondary=(name,error)=>{if(primary&&typeof primary==='object')try{Object.defineProperty(primary,name,{value:error,enumerable:true});}catch{}};
 const remaining=()=>{if(Date.now()>=deadline)throw Error('QA_RESPONSE_DEADLINE');return deadline-Date.now();};
 const bounded=async(pending,cleanup=false)=>{let timer;try{return await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('QA_RESPONSE_DEADLINE')),cleanup?Math.max(1,deadline-Date.now()):remaining());})]);}finally{clearTimeout(timer);}};
 try{remaining();while(true){remaining();const {done,value}=await bounded(reader.read());remaining();if(done)break;if(!ArrayBuffer.isView(value)||value.BYTES_PER_ELEMENT!==1)throw Error('QA_RESPONSE_CHUNK');size+=value.byteLength;if(size>maxBytes)throw Error(ceilingCode);parts.push(Buffer.from(value));}return Buffer.concat(parts,size);}
 catch(error){primary=error;try{await bounded(reader.cancel(),true);}catch(cancelError){secondary('qaBodyCancelFailure',cancelError);}throw error;}
 finally{try{reader.releaseLock();}catch(releaseError){if(primary)secondary('qaBodyReleaseFailure',releaseError);else throw releaseError;}}
}
