/** Browser-safe capture shape. Neither labels nor metadata establish authority. */
import type {RuntimeRememberInput, RuntimeRememberResult} from './types.js';
import {deliveryDeadline, identifier, invalid, natural, object} from './validation.js';
import {runtimeEmbeddingProfile} from './extensions.js';
function plain(value:unknown, depth=0):unknown {
  if(depth>8) invalid('INVALID_INPUT');
  if(value===null||typeof value==='boolean'||typeof value==='string')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value)) {
    if(value.length>64||Object.getPrototypeOf(value)!==Array.prototype)invalid('INVALID_INPUT');
    const d=Object.getOwnPropertyDescriptors(value);
    if(Reflect.ownKeys(d).length!==value.length+1||Reflect.ownKeys(d).some(k=>typeof k!=='string'||!('value' in d[k]!)))invalid('INVALID_INPUT');
    return value.map(v=>plain(v,depth+1));
  }
  const row=object(value),d=Object.getOwnPropertyDescriptors(row);
  if(Object.keys(d).length>64)return invalid('INVALID_INPUT');
  return Object.fromEntries(Object.keys(d).sort().map(k=>[k,plain(d[k]!.value,depth+1)]));
}
export function rememberInput(value:unknown):RuntimeRememberInput {
  const row=object(value),allowed=['conversationId','requestId','userMessage','agentResponse','userId','agentId','participantId','userName','expectedRevision','metadata'];
  if(Object.keys(row).some(k=>!allowed.includes(k)))invalid('INVALID_INPUT');
  const conversationId=identifier(row.conversationId),requestId=identifier(row.requestId,128);
  if(typeof row.userMessage!=='string'||typeof row.agentResponse!=='string'||!row.userMessage.trim()||!row.agentResponse.trim())invalid('INVALID_INPUT');
  const text=row.userMessage+row.agentResponse;
  if(new TextEncoder().encode(text).length>120000||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text))invalid('INVALID_INPUT');
  const labels=Object.fromEntries(['userId','agentId','participantId','userName'].filter(k=>row[k]!==undefined).map(k=>[k,identifier(row[k],256)]));
  const metadata=row.metadata===undefined?undefined:plain(object(row.metadata)) as Readonly<Record<string,unknown>>;
  if(metadata!==undefined&&new TextEncoder().encode(JSON.stringify(metadata)).length>4000)invalid('INVALID_INPUT');
  return {conversationId,requestId,userMessage:row.userMessage,agentResponse:row.agentResponse,...labels,
    ...(row.expectedRevision===undefined?{}:{expectedRevision:natural(row.expectedRevision)}),...(metadata===undefined?{}:{metadata})};
}
export function rememberResult(value:unknown):RuntimeRememberResult {
  const row=object(value),scope=object(row.scope),stages=object(row.stages);
  const tuple=(v:unknown):readonly [string,string]=>{
    if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length!==2)invalid('INVALID_RESPONSE');
    const descriptors=Object.getOwnPropertyDescriptors(v);
    if(Reflect.ownKeys(descriptors).length!==3||!descriptors['0']||!descriptors['1']||!('value' in descriptors['0'])||!('value' in descriptors['1']))invalid('INVALID_RESPONSE');
    return [identifier(descriptors['0']!.value,512),identifier(descriptors['1']!.value,512)];
  };
  if(row.version!==1||typeof row.created!=='boolean'||!['pending','complete','failed'].includes(row.memoryStatus as string))invalid('INVALID_RESPONSE');
  const stateTuple=(v:unknown):readonly [string,string]=>{const pair=tuple(v);if(pair.some(s=>!['pending','running','complete','skipped','failed','unknown','dead_letter'].includes(s)))invalid('INVALID_RESPONSE');return pair;};
  return {version:1,receiptId:identifier(row.receiptId,512),requestId:identifier(row.requestId,128),conversationId:identifier(row.conversationId),
    scope:{tenantId:identifier(scope.tenantId),memorySpaceId:identifier(scope.memorySpaceId)},principalId:identifier(row.principalId),
    messageIds:tuple(row.messageIds),sourceEventIds:tuple(row.sourceEventIds),historyRevision:natural(row.historyRevision),created:row.created,
    memoryStatus:row.memoryStatus as RuntimeRememberResult['memoryStatus'],profile:runtimeEmbeddingProfile(row.profile),
    stages:{facts:stateTuple(stages.facts),vectors:stateTuple(stages.vectors)},...(row.deliveryExpiresAt===undefined?{}:{deliveryExpiresAt:deliveryDeadline(row.deliveryExpiresAt)})};
}
