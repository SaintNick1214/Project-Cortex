/** Unpaid admin-only capability discovery with the official deployment service token. */
import {getServiceToken} from 'convex/server';
import {internalAction} from './_generated/server';
export const metadata=internalAction({args:{},handler:async()=>{
 const token=await getServiceToken('ai-gateway');
 const response=await fetch('https://ai-gateway.convex.dev/v1/models',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),redirect:'error'});
 const raw=await response.text();if(new TextEncoder().encode(raw).length>2000000)throw Error('METADATA_BODY_LIMIT');
 let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return {status:response.status,configuration:'unknown',bodyKind:'non-json',modelCalls:0};}
 if(!response.ok){const error=typeof parsed==='object'&&parsed!==null&&'error'in parsed?(parsed as {error:unknown}).error:undefined;const record=typeof error==='object'&&error!==null?error as {code?:unknown;message?:unknown}:undefined;return {status:response.status,configuration:'unavailable',publicCode:typeof record?.code==='string'?record.code.slice(0,128):'METADATA_DENIED',message:typeof record?.message==='string'?record.message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted]').slice(0,512):'metadata request denied',modelCalls:0};}
 const object=parsed as {data?:unknown[];models?:unknown[]};const rows=Array.isArray(parsed)?parsed:object.data??object.models??[];
 const selected=rows.filter((row:unknown)=>typeof row==='object'&&row!==null&&'id'in row&&/gpt-image|veo|imagen/.test(String((row as {id:unknown}).id)));
 return {status:response.status,configuration:'model-catalog-readable',asyncVideoConfiguration:'UNKNOWN_UNTIL_NATIVE_START',catalogCount:rows.length,selected,modelCalls:0};
}});
