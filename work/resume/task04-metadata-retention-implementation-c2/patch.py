from pathlib import Path
q=Path('_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2');b=q/'fixture/convex'
p=b/'provider-cost.ts';s=p.read_text();s="import {retainProviderKeys} from './observation-builder.ts';\n"+s
s=s.replace("parent:Parent;descriptors:Descriptors|null","parent:Parent;descriptors:Descriptors|null;sourceKeys:string[]")
s=s.replace("descriptors:null}","descriptors:null,sourceKeys:[]}")
s=s.replace("  if(keys.length>4096)fail('GRAPH_LIMIT');\n","")
s=s.replace("parent:{state:'record',keys:(keys as string[]).sort()},descriptors:d","parent:{state:'record',keys:[]},descriptors:d,sourceKeys:keys as string[]")
s=s.replace("selectProviderSnapshot(root:unknown)","selectProviderSnapshot(root:unknown,prospective:(snapshot:ProviderSnapshot)=>unknown)")
s=s.replace(" return freezeSnapshot({providerCost:cost,providerShape:[a.parent,b.parent,c.parent]});"," const snapshot:ProviderSnapshot={providerCost:cost,providerShape:[a.parent,b.parent,c.parent]};\n retainProviderKeys(snapshot,[a.sourceKeys,b.sourceKeys,c.sourceKeys],prospective);\n return freezeSnapshot(snapshot);")
p.write_text(s)
p=b/'observer.ts';s=p.read_text()
start=s.index('export function selectGenerate(');end=s.index('\nexport function selectEmbed',start)
s=s[:start]+"""function prospective(method:'generate'|'stream',sequence:number,kind:Event['kind'],data:unknown,prefix:readonly Event[]){
 if(sequence!==prefix.length)fail('EVENT_IDENTITY');if(sequence>=512)fail('STREAM_BOUND');
 return {version:2,method,events:[...prefix,{sequence,kind,digest:'0'.repeat(64),data}],ended:method==='generate'?'returned':'reader-done'};
}
export function selectGenerate(r:LanguageModelV4GenerateResult){
 const response=field(r,'response'),metadata=response===null?null:{id:field(response,'id'),modelId:field(response,'modelId')};
 const base={body:response===null?null:field(response,'body'),content:field(r,'content'),finish:selectedFinish(field(r,'finishReason')),usage:selectedUsage(field(r,'usage')),metadata};
 return {...base,...selectProviderSnapshot(r,snapshot=>prospective('generate',0,'raw',{...base,...snapshot},[]))};
}"""+s[end:]
s=s.replace("nativeEvent(sequence:number,part:LanguageModelV4StreamPart)","nativeEvent(sequence:number,part:LanguageModelV4StreamPart,prefix?:readonly Event[])")
s=s.replace("else if(type==='finish')data={finish:selectedFinish(p.finishReason??null),usage:selectedUsage(p.usage),...selectProviderSnapshot(part)};","""else if(type==='finish'){
 const base={finish:selectedFinish(p.finishReason??null),usage:selectedUsage(p.usage)};
 // Historical two-argument helper emits V1 only. Actual V2 source requires prefix.
 data=prefix===undefined?base:{...base,...selectProviderSnapshot(part,snapshot=>prospective('stream',sequence,kind,{...base,...snapshot},prefix))};
}""")
s=s.replace("else data={type};return await makeEvent(sequence,kind,data)","else data={type};if(prefix!==undefined)canonical(prospective('stream',sequence,kind,data,prefix),180000);return await makeEvent(sequence,kind,data)")
p.write_text(s)
p=b/'runner.ts';s=p.read_text();assert 'nativeEvent(events.length,item.value)' in s;s=s.replace('nativeEvent(events.length,item.value)','nativeEvent(events.length,item.value,events)');p.write_text(s)
# New C1 metadata controls: interface plumbing only, assertions untouched.
for name in ['metadata.mjs','metadata-stage.mjs','metadata-purge.mjs']:
 p=q/'fixture/checks'/name;s=p.read_text()
 # generic sequential native-event helpers only; source-specific explicit loops below if necessary.
 s=s.replace("nativeEvent(i,p[i])","nativeEvent(i,p[i],out)")
 s=s.replace("nativeEvent(i,parts[i])","nativeEvent(i,parts[i],events)")
 p.write_text(s)
