import {beforeEach,afterEach,describe,it,expect,jest} from '@jest/globals';
import {getFunctionName} from 'convex/server';
import type {ConvexClient} from 'convex/browser';
import type {RuntimeClientPort} from '../../../src/client-runtime/client';
import {CortexRuntimeClient} from '../../../src/client-runtime/client';
import {MemoryAPI} from '../../../src/memory';
import {rememberInput,rememberResult} from '../../../src/client-runtime/remember';
const {installIngestionMockRoot,transcriptFixture,transcript}=await import('../runtimeTranscript/fixture');
const capture=await import('../../../convex-dev/runtimeMemoryCapture');
const clientModule=await import('../../../convex-dev/runtimeClient');
const conversations=await import('../../../convex-dev/conversations');
beforeEach(()=>installIngestionMockRoot());afterEach(()=>{jest.restoreAllMocks();});
const input={conversationId:'capture-a',requestId:'exchange-1',userMessage:'My favorite color is coral.',agentResponse:'I have recorded your preference.',userId:'user-a',userName:'Synthetic',agentId:'external-assistant',metadata:{tags:['preference']}};
async function fixture() {
  const f=await transcriptFixture({maxContextTokens:16384}); const calls:string[]=[];
  const port={setAuth:(_fetch:unknown,changed:(ok:boolean)=>void)=>changed(true),close:async()=>{},query:async()=>{throw Error('No query port');},action:async()=>{throw Error('No Action port');},onUpdate:()=>{throw Error('No subscription port');},
    mutation:async(ref:Parameters<typeof getFunctionName>[0],args:unknown)=>{const name=getFunctionName(ref);calls.push(name);
      if(name==='runtimeClient:session')return f.call(clientModule.session,args);
      if(name==='runtimeMemoryCapture:rememberExchange')return f.call(capture.rememberExchange,args);
      if(name==='runtimeMemoryCapture:rememberStatus')return f.call(capture.rememberStatus,args);
      throw Error('Unknown read/write registration '+name);
    }} as unknown as RuntimeClientPort;
  return {...f,get grant(){return f.grant;},port,calls};
}
describe('ordinary canonical backend remember',()=>{
  it('actual SDK captures two canonical messages and trace rows once, then appends a second exchange under its capture policy',async()=>{
    const f=await fixture(),client=new CortexRuntimeClient({deploymentUrl:'https://fixture.convex.cloud',client:f.port,fetchToken:async()=>null});
    try {
      const first=await client.remember(input);
      expect(first).toMatchObject({created:true,memoryStatus:'pending',stages:{facts:['pending','skipped'],vectors:['pending','pending']}});
      expect(f.native.messages.size).toBe(2);expect(f.db.table('runtimeTranscriptMessages')).toHaveLength(2);expect(f.db.table('runtimeMemoryCaptureMessages')).toHaveLength(2);
      expect(f.db.table('runtimeMemorySources')).toHaveLength(2);expect(f.db.table('runtimeIngestionEvents')).toHaveLength(2);expect(f.db.table('conversations')).toHaveLength(0);
      const rows=f.db.table('runtimeMemoryCaptureMessages');expect(rows.map(r=>r.attribution)).toEqual(['external_capture','external_capture']);
      expect(JSON.parse(rows[0].metadataCanonical as string)).toMatchObject({actorUserId:'user-a',actorPrincipalId:f.principal._id,requestId:input.requestId,metadata:input.metadata});
      expect(f.db.table('runtimeMemorySources')[1].lineage).toMatchObject({role:'assistant',trust:'assistant_claim'});
      expect(f.db.table('runtimeConversations')[0].manualWriteLocked).toBe(true);
      const replay=await client.remember(input);expect(replay.created).toBe(false);expect(replay.messageIds).toEqual(first.messageIds);
      const next=await client.remember({...input,requestId:'exchange-2',userMessage:'I also like autumn.',expectedRevision:first.historyRevision});
      expect(next.messageIds).not.toEqual(first.messageIds);expect(f.native.messages.size).toBe(4);expect(f.db.table('runtimeIngestionEvents')).toHaveLength(4);
      expect(f.calls.filter(c=>c==='runtimeMemoryCapture:rememberExchange')).toHaveLength(3);
      expect(await client.rememberStatus(first.receiptId)).toMatchObject({receiptId:first.receiptId,memoryStatus:'pending'});
    }finally{await client.close();}
  });
  it('actual ordinary MemoryAPI standard exchange routes to backend only, with empty derived arrays and a durable receipt',async()=>{
    const f=await fixture(),api=new MemoryAPI(f.port as ConvexClient);
    const result=await api.remember({conversationId:'capture-a',memorySpaceId:'space-a',userId:'user-a',userName:'Synthetic',userMessage:input.userMessage,agentResponse:input.agentResponse});
    expect(result.facts).toEqual([]);expect(result.memories).toEqual([]);expect(result.conversation.messageIds).toHaveLength(2);expect(result.durable?.memoryStatus).toBe('pending');
    expect(f.calls).toEqual(['runtimeClient:session','runtimeMemoryCapture:rememberExchange','runtimeClient:session']);
    const next=await api.remember({conversationId:'capture-a',memorySpaceId:'space-a',userId:'user-a',userName:'Synthetic',userMessage:input.userMessage,agentResponse:input.agentResponse});
    expect(next.durable?.created).toBe(true);expect(next.durable?.requestId).not.toBe(result.durable?.requestId);expect(f.native.messages.size).toBe(4);
    const replay=await api.remember({conversationId:'capture-a',memorySpaceId:'space-a',userId:'user-a',userName:'Synthetic',userMessage:input.userMessage,agentResponse:input.agentResponse,requestId:result.durable!.requestId});
    expect(replay.durable?.created).toBe(false);expect(f.native.messages.size).toBe(4);
  });
  it.each(['extractFacts','generateEmbedding','extractContent','observer','skipLayers','autoEmbed'] as const)('refuses caller option %s before native dispatch',async key=>{
    const f=await fixture();const args={...input,memorySpaceId:'space-a',[key]:key==='skipLayers'?['facts']:key==='autoEmbed'?true:()=>{throw Error('Caller invoked');}};
    await expect(new MemoryAPI(f.port as ConvexClient).remember(args)).rejects.toMatchObject({code:'CAPABILITY_UNAVAILABLE'});expect(f.calls).toEqual([]);
  });
  it('admin capture lock denies new exchange and exact replay; it never unlocks manual writes',async()=>{
    const f=await fixture(),first=await f.call<{conversationId:string;historyRevision:number;receiptId:string}>(capture.rememberExchange,{input});
    await expect(f.call(conversations.addMessage,{conversationId:first.conversationId,message:{id:'manual',role:'user',content:'blocked'}})).rejects.toThrow('TRANSCRIPT_LOCKED');
    await f.call(capture.setCaptureLock,{conversationId:first.conversationId,expectedRevision:first.historyRevision,locked:true});
    for(const requestId of ['exchange-1','exchange-2'])await expect(f.call(capture.rememberExchange,{input:{...input,requestId}})).rejects.toThrow('TRANSCRIPT_LOCKED');
    expect(f.native.messages.size).toBe(2);expect(f.db.table('runtimeConversations')[0].manualWriteLocked).toBe(true);
    expect(await f.call(capture.rememberStatus,{receiptId:first.receiptId})).toMatchObject({created:false,memoryStatus:'pending'});
    f.grant.revokedAt=1;await expect(f.call(capture.rememberStatus,{receiptId:first.receiptId})).rejects.toThrow('FORBIDDEN');
  });
  it('cannot convert a managed Agent conversation or bypass its manual lock',async()=>{
    const f=await fixture(),run=await f.run();
    await expect(f.call(capture.rememberExchange,{input:{...input,conversationId:run.conversationId}})).rejects.toThrow('TRANSCRIPT_LOCKED');
    expect(f.db.table('runtimeMemoryCaptureConversations')).toHaveLength(0);expect(f.native.messages.size).toBe(1);
    await expect(f.call(capture.setCaptureLock,{conversationId:run.conversationId,expectedRevision:1,locked:false})).rejects.toThrow('INVALID_STATE');
  });
  it.each(['userId','participantId'] as const)('caller %s cannot become another principal',async key=>{
    const f=await fixture();await expect(f.call(capture.rememberExchange,{input:{...input,[key]:'outsider'}})).rejects.toThrow('FORBIDDEN');expect(f.native.messages.size).toBe(0);
  });
  it('changed request reuse and stale revision refuse without second message/source/job',async()=>{
    const f=await fixture();await f.call(capture.rememberExchange,{input});
    await expect(f.call(capture.rememberExchange,{input:{...input,userMessage:'changed'}})).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await expect(f.call(capture.rememberExchange,{input:{...input,requestId:'exchange-2',expectedRevision:0}})).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect(f.native.messages.size).toBe(2);expect(f.db.table('runtimeIngestionEvents')).toHaveLength(2);
  });
  it.each(['revocation','deletion','edit'] as const)('fresh receipt and exact replay reject %s',async fault=>{
    const f=await fixture(),first=await f.call<{conversationId:string;receiptId:string;messageIds:string[];historyRevision:number}>(capture.rememberExchange,{input});
    if(fault==='revocation')f.grant.revokedAt=1;
    else if(fault==='deletion')f.db.table('runtimeConversations')[0].tombstonedAt=1;
    else {await f.call(transcript.setPolicy,{conversationId:first.conversationId,expectedRevision:first.historyRevision,manualWriteLocked:false});const bridge=f.db.table('runtimeTranscriptMessages')[0];
      await f.call(transcript.edit,{conversationId:first.conversationId,expectedRevision:f.db.table('runtimeConversations')[0].historyRevision,messageId:first.messageIds[0],expectedMessageRevision:bridge.revision,parts:[{type:'text',text:'changed'}]});}
    await expect(f.call(capture.rememberStatus,{receiptId:first.receiptId})).rejects.toThrow();
    await expect(f.call(capture.rememberExchange,{input})).rejects.toThrow();expect(f.native.messages.size).toBe(2);
  });
  it('scheduler failure after native completion rolls back both messages, metadata and capture; same request recovers once',async()=>{
    const f=await fixture(),original=f.ctx.scheduler.runAfter;
    f.ctx.scheduler.runAfter=async()=>{throw Error('scheduler fault');};
    await expect(f.call(capture.rememberExchange,{input})).rejects.toThrow('scheduler fault');
    expect(f.native.messages.size).toBe(0);expect(f.db.table('runtimeMemoryCaptures')).toHaveLength(0);expect(f.db.table('runtimeMemoryCaptureMessages')).toHaveLength(0);
    f.ctx.scheduler.runAfter=original;await f.call(capture.rememberExchange,{input});expect(f.native.messages.size).toBe(2);
  });
  it('ordinary generated intent is retained on a lost capture reply, with one-copy recovery using its explicit ID',async()=>{
    const f=await fixture(),original=f.port.mutation.bind(f.port);let fail=true;
    f.port.mutation=(async(ref,args)=>{const result=await original(ref,args);if(getFunctionName(ref)==='runtimeMemoryCapture:rememberExchange'&&fail){fail=false;throw Error('Lost reply');}return result;}) as RuntimeClientPort['mutation'];
    const api=new MemoryAPI(f.port as ConvexClient),params={conversationId:'capture-a',memorySpaceId:'space-a',userMessage:input.userMessage,agentResponse:input.agentResponse};
    let requestId:string|undefined;try{await api.remember(params);}catch(error){expect(error).toMatchObject({outcome:'uncertain'});requestId=(error as {requestId:string}).requestId;}
    expect(requestId).toMatch(/^remember:/);expect(f.native.messages.size).toBe(2);
    const recovered=await api.remember({...params,requestId});expect(recovered.durable?.created).toBe(false);expect(f.native.messages.size).toBe(2);
  });
  it('late grant revocation after profile read rolls back capture and async registration',async()=>{
    const f=await fixture(),original=f.ctx.runQuery.bind(f.ctx);let reached=false;
    f.ctx.runQuery=(async(ref,args)=>{const result=await original(ref,args);let name:string|undefined;try{name=getFunctionName(ref);}catch{/* Official child-component refs are not same-component function names. */}if(name==='runtimeModelPolicy:embeddingProfile'&&!reached){reached=true;f.grant.revokedAt=1;}return result;}) as typeof f.ctx.runQuery;
    await expect(f.call(capture.rememberExchange,{input})).rejects.toThrow('FORBIDDEN');expect(reached).toBe(true);
    expect(f.native.messages.size).toBe(0);expect(f.db.table('runtimeIngestionEvents')).toHaveLength(0);expect(f.db.table('runtimeMemoryCaptures')).toHaveLength(0);
  });
  it('no missing identity, read-only writer, expired grant, duplicate grant, or foreign scope can capture',async()=>{
    for(const fault of ['identity','read_only','expired','duplicate','scope']) {
      const f=await fixture();if(fault==='identity')f.identity(null);if(fault==='read_only')f.grant.capabilities=['read'];if(fault==='expired')f.grant.expiresAt=1;
      if(fault==='duplicate')f.db.seed('runtimeAuthGrants',{...f.grant,_id:'runtimeAuthGrants:duplicate'});
      await expect(f.call(capture.rememberExchange,{input,...(fault==='scope'?{memorySpaceId:'other'}:{})})).rejects.toThrow();expect(f.native.messages.size).toBe(0);
    }
  });
  it('read-only status reports actual asynchronous stage transitions and retains source/profile fences',async()=>{
    const f=await fixture(),first=await f.call<{receiptId:string}>(capture.rememberExchange,{input});
    for(const event of f.db.table('runtimeIngestionEvents')){event.factsState=(event.lineage as {role:string}).role==='user'?'complete':'skipped';event.vectorsState='complete';}
    expect(await f.call(capture.rememberStatus,{receiptId:first.receiptId})).toMatchObject({created:false,memoryStatus:'complete'});
    f.db.table('runtimeIngestionEvents')[0].vectorsState='unknown';
    expect(await f.call(capture.rememberStatus,{receiptId:first.receiptId})).toMatchObject({memoryStatus:'failed'});
    f.db.table('runtimeMemorySources')[0].contentHash='changed';
    await expect(f.call(capture.rememberStatus,{receiptId:first.receiptId})).rejects.toThrow();
  });
  it('SDK projects only allowed reply fields and rejects an accessor tuple without reading it after a committed capture',async()=>{
    const f=await fixture(),original=f.port.mutation.bind(f.port);let getterReads=0;
    f.port.mutation=(async(ref,args)=>{const result=await original(ref,args);if(getFunctionName(ref)!=='runtimeMemoryCapture:rememberExchange')return result;
      const ids=['message-a','message-b'];Object.defineProperty(ids,'0',{get(){getterReads++;throw Error('Private getter');}});
      return {...result as Record<string,unknown>,messageIds:ids,privatePayload:'discarded'};}) as RuntimeClientPort['mutation'];
    const client=new CortexRuntimeClient({deploymentUrl:'https://fixture.convex.cloud',client:f.port,fetchToken:async()=>null});
    try{await expect(client.remember(input)).rejects.toMatchObject({code:'INVALID_RESPONSE',outcome:'uncertain'});expect(getterReads).toBe(0);expect(f.native.messages.size).toBe(2);}finally{await client.close();}
  });
  it('never invokes accessors, ignores extra output payloads, and rejects unsupported shapes/bounds',()=>{
    let invoked=false;const malicious={...input};Object.defineProperty(malicious,'metadata',{enumerable:true,get(){invoked=true;throw Error('private');}});
    expect(()=>rememberInput(malicious)).toThrow();expect(invoked).toBe(false);
    expect(()=>rememberInput({...input,tools:[]})).toThrow();expect(()=>rememberInput({...input,userMessage:'x'.repeat(120001)})).toThrow();
    expect(()=>rememberResult({})).toThrow();
  });
});
