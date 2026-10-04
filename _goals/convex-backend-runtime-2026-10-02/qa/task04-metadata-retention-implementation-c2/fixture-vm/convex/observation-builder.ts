import {canonical,bytes,fail} from './validate.ts';
import type {ProviderSnapshot} from './provider-cost.ts';
/** Only canonical-valid complete prospective DATA determines remaining capacity.
 * Reflection key lists already exist; no retained witness is sorted or copied yet. */
export function retainProviderKeys(snapshot:ProviderSnapshot,sourceKeys:readonly (readonly string[])[],prospective:(snapshot:ProviderSnapshot)=>unknown):void{
 const graph=prospective(snapshot),encoded=canonical(graph,180000);
 let nodes=0;const keyDepths=new Map<object,number>();
 function measured(value:unknown,depth:number):void{
  nodes++;
  if(value!==null&&typeof value==='object'){
   for(const parent of snapshot.providerShape)if(value===parent.keys)keyDepths.set(value,depth+1);
   for(const child of Object.values(value))measured(child,depth+1);
  }
 }
 measured(graph,0);
 let remainingNodes=4096-nodes,remainingBytes=180000-bytes(encoded);
 for(let i=0;i<3;i++){
  const keys=sourceKeys[i]!,parent=snapshot.providerShape[i]!,keyDepth=keyDepths.get(parent.keys);
  if(keyDepth===undefined)fail('PROSPECTIVE_SHAPE');
  if(keys.length>remainingNodes||keys.length&&keyDepth>16)fail('GRAPH_LIMIT');
  for(let j=0;j<keys.length;j++){
   const encodedKey=JSON.stringify(keys[j]);
   const charge=bytes(encodedKey)+(j===0?0:1);
   if(charge>remainingBytes)fail('BYTE_LIMIT');
   remainingNodes--;remainingBytes-=charge;
  }
 }
 // Every complete reflected key set has passed the SAME full prospective capacity.
 for(let i=0;i<3;i++)snapshot.providerShape[i]!.keys=[...sourceKeys[i]!].sort();
 canonical(prospective(snapshot),180000);
}
