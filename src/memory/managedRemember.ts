/** Ordinary remember never reaches legacy operators or caller inference callbacks. */
import type {ConvexClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import type {RememberParams,RememberOptions,RememberResult} from '../types';
import {rememberInput,rememberResult} from '../client-runtime/remember';
import {object,runtimeError,CortexRuntimeError,session,sameScope} from '../client-runtime/validation';
import {randomUUID} from '../common/crypto';
import {validateImportance,validateTags} from './validators';
const sessionRef=makeFunctionReference<'mutation',Record<string,unknown>,unknown>('runtimeClient:session');
const captureRef=makeFunctionReference<'mutation',Record<string,unknown>,unknown>('runtimeMemoryCapture:rememberExchange');
function unavailable():never {throw new CortexRuntimeError('CAPABILITY_UNAVAILABLE');}
/** Observe an issued RPC once. Local timeout never cancels, redispatches or rolls it back. */
function observeRpc<T>(invoke:()=>Promise<T>):Promise<T> {
  return new Promise<T>((resolve,reject)=>{
    let finished=false;
    const finish=(result:{value:T}|{error:unknown})=>{
      if(finished)return;finished=true;clearTimeout(timer);
      if('error' in result)reject(result.error);else resolve(result.value);
    };
    const timer=setTimeout(()=>finish({error:new CortexRuntimeError('RPC_DEADLINE_EXCEEDED','uncertain')}),12_000);
    // Both outcomes stay attached to the original promise even after local timeout.
    try{Promise.resolve(invoke()).then(value=>finish({value}),error=>finish({error}));}
    catch(error){finish({error});}
  });
}
export async function managedRemember(client:ConvexClient,params:RememberParams,options:RememberOptions|undefined,tenantId?:string):Promise<RememberResult> {
  const row=object(params),allowed=['requestId','expectedRevision','conversationId','memorySpaceId','tenantId','userId','agentId','participantId','userName','userMessage','agentResponse','importance','tags'];
  if(Object.keys(row).some(k=>!allowed.includes(k)&&row[k]!==undefined)||options&&Object.keys(object(options)).some(k=>options[k as keyof RememberOptions]!==undefined))unavailable();
  if(params.importance!==undefined)validateImportance(params.importance);
  if(params.tags!==undefined)validateTags(params.tags);
  const metadata={...(params.importance===undefined?{}:{importance:params.importance}),...(params.tags===undefined?{}:{tags:params.tags})};
  const base={conversationId:params.conversationId,userMessage:params.userMessage,agentResponse:params.agentResponse,
    ...(params.userId===undefined?{}:{userId:params.userId}),...(params.agentId===undefined?{}:{agentId:params.agentId}),
    ...(params.participantId===undefined?{}:{participantId:params.participantId}),...(params.userName===undefined?{}:{userName:params.userName}),
    ...(params.expectedRevision===undefined?{}:{expectedRevision:params.expectedRevision}),...(Object.keys(metadata).length?{metadata}:{})};
  const input=rememberInput({...base,requestId:params.requestId??`remember:${randomUUID()}`});
  const selection={...(tenantId===undefined?{}:{tenantId}),...(params.memorySpaceId===undefined?{}:{memorySpaceId:params.memorySpaceId})};
  let issued=false;
  try {
    const current=session(await observeRpc(()=>client.mutation(sessionRef,selection)));
    issued=true;
    const raw=await observeRpc(()=>client.mutation(captureRef,{tenantId:current.tenantId,memorySpaceId:current.memorySpaceId,input}));
    const result=rememberResult(raw);
    try {
      const after=session(await observeRpc(()=>client.mutation(sessionRef,selection)));
      if(!sameScope(current,after)||current.principalId!==after.principalId||!sameScope(current,result.scope)||current.principalId!==result.principalId
        ||result.requestId!==input.requestId||result.deliveryExpiresAt!==undefined&&Date.now()>=result.deliveryExpiresAt)throw new CortexRuntimeError('SESSION_CHANGED');
    }catch(error){throw new CortexRuntimeError(runtimeError(error).code,'uncertain');}
    return {conversation:{conversationId:result.conversationId,messageIds:[...result.messageIds]},memories:[],facts:[],durable:result};
  }catch(error){const failure=runtimeError(error);throw Object.assign(new CortexRuntimeError(failure.code,issued?'uncertain':'not_dispatched'),{requestId:input.requestId});}
}
