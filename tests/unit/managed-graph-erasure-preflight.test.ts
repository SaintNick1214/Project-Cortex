import {describe,it,expect,jest} from '@jest/globals';
import {prepareGraphErasure,type GraphErasureItem} from '../../src/graph/erasure';
import {primaryGraphIdentity,identityProperties,MANAGED_KINDS} from '../../src/graph/identity';
const identity=primaryGraphIdentity('Mutable','physical-source',{tenantKnown:true,tenantId:'tenant',memorySpaceId:null});
const item:GraphErasureItem={identity,sourceRevision:1,ownershipRevision:1,referenceGeneration:'gen',referenceRevision:1,evidence:{targetId:'native-target',generation:'gen',physicalSourceId:identity.physicalSourceId,scopeKnown:true}};
function fixture(owned:unknown[]){
 const preflight=jest.fn<(...args:unknown[])=>Promise<unknown>>().mockResolvedValue({kind:'preflight',checked:0,isDone:true,continueCursor:''}),managedTransaction=jest.fn(),reads:string[]=[];
 const managedRead=jest.fn<(...args:unknown[])=>Promise<unknown>>().mockImplementation(async(text)=>{const query=String(text);reads.push(query);let records:unknown[]=[];
  if(query==='SHOW CONSTRAINT INFO')records=MANAGED_KINDS.map(kind=>({'constraint type':'unique',label:'CortexV2'+kind,properties:['key']}));
  else if(query==='SHOW INDEX INFO')records=MANAGED_KINDS.flatMap(kind=>['key','tenantValue'].map(property=>({'index type':'label+property',label:'CortexV2'+kind,property:[property]})));
  else if(query.includes('WHERE r.ownerKey=$key'))records=owned.map(edge=>({edge}));
  else if(query.includes('RETURN properties(n) AS node'))records=[{node:identityProperties(identity)}];
  return {records,count:records.length};
 });
 return {adapter:{isConnected:async()=>true,managedDialect:async()=> 'memgraph',managedRead,managedTransaction},transport:{preflight},preflight,managedTransaction,reads};
}
describe('source-owned nonincident erase preflight',()=>{
 it.each([{schemaVersion:1,ownerTuple:identity.tupleJson},{schemaVersion:2,ownerTuple:'foreign-tuple'}])('refuses malformed owned Entity-to-Entity relationship before primary admission (%p)',async(edge)=>{
  const f=fixture([edge]),primary=jest.fn();await expect((async()=>{await prepareGraphErasure([item],{adapter:f.adapter as never,disposalTransport:f.transport as never});primary();})()).rejects.toMatchObject({code:'GRAPH_ERASURE_BLOCKED'});expect(primary).not.toHaveBeenCalled();expect(f.preflight).not.toHaveBeenCalled();expect(f.managedTransaction).not.toHaveBeenCalled();expect(f.reads.some(query=>query.includes('WHERE r.ownerKey=$key'))).toBe(true);
 });
 it('overbudget nonincident ownership refuses without treating an examined prefix as complete',async()=>{const f=fixture(Array.from({length:65},()=>({schemaVersion:2,ownerTuple:identity.tupleJson})));await expect(prepareGraphErasure([item],{adapter:f.adapter as never,disposalTransport:f.transport as never})).rejects.toMatchObject({code:'GRAPH_ERASURE_BLOCKED'});expect(f.managedTransaction).not.toHaveBeenCalled();expect(f.preflight).not.toHaveBeenCalled();});
 it('valid owned relationships allow strictly readonly primary admission and copied-data preflight',async()=>{const f=fixture([{schemaVersion:2,ownerTuple:identity.tupleJson}]);expect(await prepareGraphErasure([item],{adapter:f.adapter as never,disposalTransport:f.transport as never})).toHaveLength(1);expect(f.preflight).toHaveBeenCalledTimes(2);expect(f.managedTransaction).not.toHaveBeenCalled();});
});
