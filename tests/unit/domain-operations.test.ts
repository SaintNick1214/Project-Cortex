import { collectDomain, selectDomain, mutateSelected, partialFrom, confirmation, resolveDomainTenant, domainLoader } from '../../src/common/domainPaging';
import { domainCsv, domainJson, factsExport, memoryExport } from '../../src/common/domainExport';
import { DomainOperationPartialError } from '../../src/types';
import { ConvexError, jsonToConvex } from 'convex/values';
const row = (id: string) => ({_id:id});
const page = (ids: string[], cursor: string, isDone=false) => ({page:ids.map(row),continueCursor:cursor,isDone});
it('discards provisional split rows, exhausts bounded left/right/tail and empty advancing pages, deduplicates physical IDs',async()=>{
 const requests: unknown[]=[];
 const load=async(r:{cursor:string|null;endCursor:string|null})=>{requests.push({...r});
  if(r.cursor===null&&r.endCursor===null)return {...page(['provisional'],'bad'),pageStatus:'SplitRequired',splitCursor:'mid'};
  if(r.cursor===null&&r.endCursor==='mid')return page(['a'],'left');
  if(r.cursor==='left')return page([],'mid');
  if(r.cursor==='mid')return page(['a','b'],'tail');
  return page(['c'],'end',true);
 };
 expect((await collectDomain(load)).map(x=>x._id)).toEqual(['a','b','c']);
 expect(requests).toEqual([{cursor:null,endCursor:null},{cursor:null,endCursor:'mid'},{cursor:'left',endCursor:'mid'},{cursor:'mid',endCursor:null},{cursor:'tail',endCursor:null}]);
});
it('fixed endCursor completes subrange although whole-query isDone is false',async()=>{const seen:string[]=[];const load=async(r:any)=>{seen.push(JSON.stringify(r));if(r.endCursor===null&&r.cursor===null)return {...page(['discard'],'provisional'),pageStatus:'SplitRequired',splitCursor:'x'};return r.endCursor==='x'?page(['left'],'x'):page(['right'],'done',true);};expect((await collectDomain(load)).map(x=>x._id)).toEqual(['left','right']);expect(seen).toHaveLength(3);});
it.each([null,{page:[],isDone:false,continueCursor:''},{page:[],isDone:'true',continueCursor:'x'},{page:[],isDone:false,continueCursor:'x',pageStatus:'SplitRequired',splitCursor:null}])('malformed or nonadvancing native page refuses completion: %j',async(value)=>{await expect(collectDomain(async()=>value)).rejects.toThrow(/DOMAIN_/);});
it('late page failure aborts collection instead of returning a complete-looking prefix',async()=>{let calls=0;await expect(collectDomain(async()=>{if(calls++)throw new ConvexError('DOMAIN_READ_BUDGET_EXCEEDED');return page(['a'],'advance');})).rejects.toThrow('DOMAIN_READ_BUDGET_EXCEEDED');expect(calls).toBe(2);});
it('physical preflight rejects a changed boundary duplicate fingerprint',async()=>{let calls=0;await expect(selectDomain(async()=>({...page(['a'],calls?'end':'next',!!calls++),fingerprints:{a:(calls===1?'a':'b').repeat(64)}}))).rejects.toThrow('DOMAIN_SELECTION_CHANGED');});
it('cancel before query or mutation makes no transport call and preserves unstarted IDs',async()=>{const controller=new AbortController();controller.abort();let calls=0;await expect(collectDomain(async()=>{calls++;return page([],'end',true);},{signal:controller.signal})).rejects.toThrow('DOMAIN_CANCELLED');try{await mutateSelected('erase',[{document:row('a'),physicalId:'a',fingerprint:'a'.repeat(64)}],async()=>{calls++;return{deleted:true};},{signal:controller.signal});throw new Error('unexpected');}catch(error){expect(error).toBeInstanceOf(DomainOperationPartialError);expect((error as DomainOperationPartialError).partial.unstartedPhysicalIds).toEqual(['a']);}expect(calls).toBe(0);});
it('after-send loss has unknown lower/possible count, stops later send, and observes delayed natural settlement',async()=>{let sends=0,settled=false;const pending=new Promise<{deleted:boolean}>(resolve=>setTimeout(()=>{settled=true;resolve({deleted:true});},30));const selected=['a','b'].map(id=>({document:row(id),physicalId:id,fingerprint:'a'.repeat(64)}));try{await mutateSelected('erase',selected,()=>{sends++;return pending;},{deadlineMs:1});throw new Error('unexpected');}catch(error){const partial=(error as DomainOperationPartialError).partial;expect(partial.confirmedCount).toBe(0);expect(partial.possibleCount).toBe(1);expect(partial.unknownPhysicalIds).toEqual(['a']);expect(partial.unstartedPhysicalIds).toEqual(['b']);}await pending;expect(settled).toBe(true);expect(sends).toBe(1);});
it('native application rollback is distinguished from transport uncertainty and absent response does not count',async()=>{try{await mutateSelected('erase',[{document:row('a'),physicalId:'a',fingerprint:'a'.repeat(64)}],async()=>{throw new ConvexError('DOMAIN_SELECTION_CHANGED');});throw new Error('unexpected');}catch(error){expect((error as DomainOperationPartialError).partial.outcomes[0].disposition).toBe('knownRolledBack');}const p=await mutateSelected('erase',[{document:row('a'),physicalId:'a',fingerprint:'a'.repeat(64)}],async()=>({deleted:false}));expect(p.confirmedCount).toBe(0);expect(p.outcomes[0].disposition).toBe('alreadyAbsent');});
it.each([Infinity,NaN,-1,1.5])('confirmation threshold is finite nonnegative integer: %s',confirmationThreshold=>expect(()=>confirmation(1,{confirmationThreshold})).toThrow());
it('requireConfirmation needs explicit finite threshold; false retains default10',()=>{expect(()=>confirmation(1,{requireConfirmation:true})).toThrow('DOMAIN_CONFIRMATION_REQUIRED');expect(()=>confirmation(11,{requireConfirmation:false})).toThrow('DELETE_MANY_THRESHOLD_EXCEEDED');expect(()=>confirmation(11,{confirmationThreshold:11})).not.toThrow();});
it.each(['', '   '])('empty tenant is refused: %j',tenant=>expect(()=>resolveDomainTenant(undefined,tenant)).toThrow());
it('partial summary counts each disposition honestly',()=>{const p=partialFrom(['knownCommitted','outcomeUnknown','knownRolledBack','alreadyAbsent','unstarted'].map((disposition,i)=>({physicalId:String(i),disposition:disposition as any})));expect(p.confirmedCount).toBe(1);expect(p.possibleCount).toBe(2);expect(p.remainingPhysicalIds).toEqual(['1','2','4']);});
it('official JSON preserves int64/bytes/nonfinite/-0; CSV keeps comma/newline/quotes/Unicode',()=>{const input={integer:9223372036854775807n,bytes:new Uint8Array([0,255]).buffer,nan:NaN,negativeZero:-0,unicode:'雪,\n"'};const decoded=jsonToConvex(JSON.parse(domainJson(input))) as any;expect(decoded.integer).toBe(input.integer);expect(decoded.bytes).toEqual(input.bytes);expect(Number.isNaN(decoded.nan)).toBe(true);expect(Object.is(decoded.negativeZero,-0)).toBe(true);expect(domainCsv(['column'],[['雪,\n"']])).toBe('"column"\r\n"雪,\n"""');});
it('JSONLD omits unset optional properties and preserves validFrom=0; includeFacts is associated per memory',()=>{const f={_id:'f',factId:'fact-1',fact:'x',factType:'custom',confidence:90,tags:[],sourceType:'manual',createdAt:0,validFrom:0,sourceRef:{memoryId:'m1'}} as any;const graph=JSON.parse(factsExport([f],'jsonld').data)['@graph'][0];expect(graph.validFrom).toBe('1970-01-01T00:00:00.000Z');expect(graph).not.toHaveProperty('validThrough');const m=(id:string)=>({memoryId:id,content:'x',sourceType:'system',importance:50,tags:[],createdAt:0} as any);const rows=JSON.parse(memoryExport([m('m1'),m('m2')],{format:'json',includeFacts:true},[f]).data);expect(rows[0].facts).toHaveLength(1);expect(rows[1].facts).toEqual([]);});

import { MemoryAPI } from '../../src/memory';
it('forget keeps source live during cascade and forwards existing optional conversation behavior',async()=>{
 const memory=new MemoryAPI({} as any),calls:string[]=[];
 (memory as any).vector={get:async()=>({conversationRef:{conversationId:'c',messageIds:['m']}}),delete:async()=>calls.push('memory')};
 (memory as any).cascadeDeleteFacts=async(_s:string,_m:string,c:string)=>{expect(c).toBe('c');expect(calls).toEqual([]);calls.push('facts');return {count:2,factIds:['f1','f2']};};
 (memory as any).conversations={get:async()=>({messageCount:3}),delete:async()=>calls.push('conversation')};
 expect(await memory.forget('space','memory',{deleteConversation:true,deleteEntireConversation:true})).toEqual({memoryDeleted:true,conversationDeleted:true,messagesDeleted:3,factsDeleted:2,factIds:['f1','f2'],restorable:false});expect(calls).toEqual(['facts','memory','conversation']);
});
it('forget preflight rejection preserves source and suppresses optional conversation effects',async()=>{
 const memory=new MemoryAPI({} as any);let effects=0;
 (memory as any).vector={get:async()=>({conversationRef:{conversationId:'c',messageIds:['m']}}),delete:async()=>effects++};
 (memory as any).cascadeDeleteFacts=async()=>{throw new Error('SOURCE_PROVENANCE_UNRESOLVED');};
 (memory as any).conversations={delete:async()=>effects++};
 await expect(memory.forget('space','memory',{deleteConversation:true,deleteEntireConversation:true})).rejects.toThrow('SOURCE_PROVENANCE_UNRESOLVED');expect(effects).toBe(0);
});
it('fixed delete preflight IDs work when supported Node runtime has no global crypto',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
 try {let observed:any;const load=domainLoader({query:async(_r:any,args:any)=>{observed=args;return {page:[],isDone:true,continueCursor:'end'};}} as any,'facts',{selectionMode:'delete',memorySpaceId:'space'});await load({cursor:null,endCursor:null});expect(observed.deleteOperationPrefix).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/);}
 finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else Reflect.deleteProperty(globalThis,'crypto');}
});
