/** Actual ordinary API adapter, controlled official Convex mutation ports, no service/rollback claim. */
import {afterEach,beforeEach,describe,expect,it,jest} from '@jest/globals';
import type {ConvexClient} from 'convex/browser';
import {getFunctionName} from 'convex/server';
import {MemoryAPI} from '../../../src/memory';
import {DEFAULT_EMBEDDING_PROFILE as profile} from '../../../src/domain/profile';
const params={conversationId:'capture-a',memorySpaceId:'space-a',userMessage:'I like coral.',agentResponse:'Captured.',requestId:'one-intent'};
const actor={version:1,tenantId:'tenant-a',memorySpaceId:'space-a',principalId:'principal-a',userId:'user-a'};
function deferred<T>() {let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(hang?:'pre'|'capture'|'post') {
  const calls:string[]=[],original=deferred<unknown>();let sessions=0,captures=0,observerCount=0;
  const receipt={version:1,receiptId:'receipt-a',requestId:params.requestId,conversationId:'canonical-a',scope:{tenantId:actor.tenantId,memorySpaceId:actor.memorySpaceId},principalId:actor.principalId,
    messageIds:['message-user','message-assistant'],sourceEventIds:['source-user','source-assistant'],historyRevision:1,created:true,memoryStatus:'pending',profile,stages:{facts:['pending','skipped'],vectors:['pending','pending']}};
  const then=original.promise.then.bind(original.promise);
  // Prove that the issued promise has rejection observers, rather than being abandoned at timeout.
  jest.spyOn(original.promise,'then').mockImplementation(((...args:Parameters<typeof original.promise.then>)=>{if(args[1])observerCount++;return Reflect.apply(then,original.promise,args);}) as typeof original.promise.then);
  const mutation=jest.fn<(ref:Parameters<ConvexClient['mutation']>[0],args:unknown)=>Promise<unknown>>(async(ref,args)=>{
    const name=getFunctionName(ref);calls.push(name);
    if(name==='runtimeClient:session'){const phase=++sessions===1?'pre':'post';return phase===hang?original.promise:actor;}
    if(name==='runtimeMemoryCapture:rememberExchange'){captures++;receipt.requestId=(args as {input:{requestId:string}}).input.requestId;return hang==='capture'?original.promise:receipt;}
    throw Error('Unexpected registration');
  });
  const close=jest.fn<()=>Promise<void>>(async()=>{}),port={mutation,close} as unknown as ConvexClient;
  return {api:new MemoryAPI(port),calls,original,receipt,close,get captures(){return captures;},get observers(){return observerCount;}};
}
beforeEach(()=>{jest.useFakeTimers();});afterEach(()=>{jest.useRealTimers();jest.restoreAllMocks();});
async function tick(){for(let i=0;i<8;i++)await Promise.resolve();}
describe('ordinary remember bounded observation',()=>{
  it.each(['pre','capture','post'] as const)('%s hanging RPC stops at the original 12s bound with honest disposition and no retry',async phase=>{
    const f=fixture(phase),outcome=f.api.remember(params).catch(error=>error);let settled=false;void outcome.then(()=>{settled=true;});
    await tick();await jest.advanceTimersByTimeAsync(11999);expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);expect(await outcome).toMatchObject({code:'RPC_DEADLINE_EXCEEDED',outcome:phase==='pre'?'not_dispatched':'uncertain',requestId:params.requestId});
    expect(f.calls).toHaveLength(phase==='pre'?1:phase==='capture'?2:3);expect(f.captures).toBe(phase==='pre'?0:1);expect(jest.getTimerCount()).toBe(0);expect(f.observers).toBeGreaterThan(0);expect(f.close).not.toHaveBeenCalled();
  });
  it.each(['pre','capture','post'] as const)('late %s success after timeout cannot resume the chain or deliver a false result',async phase=>{
    const f=fixture(phase),outcome=f.api.remember(params).catch(error=>error);await tick();await jest.advanceTimersByTimeAsync(12000);const failure=await outcome,before=[...f.calls];
    f.original.resolve(phase==='capture'?f.receipt:actor);await tick();await jest.advanceTimersByTimeAsync(12000);
    expect(await outcome).toBe(failure);expect(f.calls).toEqual(before);expect(f.captures).toBe(phase==='pre'?0:1);expect(jest.getTimerCount()).toBe(0);expect(f.close).not.toHaveBeenCalled();
  });
  it.each(['pre','capture','post'] as const)('late %s rejection stays observed and cannot trigger a duplicate capture',async phase=>{
    const f=fixture(phase),outcome=f.api.remember(params).catch(error=>error);await tick();await jest.advanceTimersByTimeAsync(12000);const failure=await outcome,before=[...f.calls];
    f.original.reject(Error('Private transport failure'));await tick();
    expect(await outcome).toBe(failure);expect(f.calls).toEqual(before);expect(f.observers).toBeGreaterThan(0);expect(jest.getTimerCount()).toBe(0);expect(JSON.stringify(failure)).not.toContain('Private transport failure');
  });
  it('success before the bound clears every timer and issues each native registration once',async()=>{
    const f=fixture();const result=await f.api.remember(params);expect(result.durable?.receiptId).toBe('receipt-a');expect(f.calls).toEqual(['runtimeClient:session','runtimeMemoryCapture:rememberExchange','runtimeClient:session']);expect(f.captures).toBe(1);expect(jest.getTimerCount()).toBe(0);expect(f.close).not.toHaveBeenCalled();
  });
  it.each(['pre','capture','post'] as const)('%s immediate rejection is opaque, bounded, and keeps request identity',async phase=>{
    const f=fixture(phase),outcome=f.api.remember({...params,requestId:undefined}).catch(error=>error);await tick();f.original.reject(undefined);
    expect(await outcome).toMatchObject({code:'TRANSPORT_ERROR',outcome:phase==='pre'?'not_dispatched':'uncertain',requestId:expect.stringMatching(/^remember:/)});expect(jest.getTimerCount()).toBe(0);expect(f.captures).toBe(phase==='pre'?0:1);
  });
});
