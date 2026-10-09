import {describe,it,expect,jest} from '@jest/globals';
import {validateGraphJob,derivedGraphIdentity,primaryGraphIdentity} from '../../src/graph/identity';
import {detectOrphan,deleteWithOrphanCleanup,createDeletionContext} from '../../src/graph/sync/orphanDetection';
import {syncMemoryToGraph,findGraphNodeId} from '../../src/graph/sync/syncUtils';
import {VectorAPI} from '../../src/vector';import type {GraphAdapter} from '../../src/graph/types';
const scope={tenantKnown:true as const,tenantId:'tenant-A',memorySpaceId:'space'},entity=derivedGraphIdentity('Entity','Ada',scope,'person');
describe('managed public scope and disposal boundaries',()=>{
 it.each([undefined,null,{}, {identity:null}, {identity:{kind:'Memory'},projection:null}])('malformed job refuses typed before any graph effect (%p)',value=>{
  try{validateGraphJob(value as never);throw new Error('unexpected success');}catch(e){expect((e as {code:string}).code).toMatch(/^GRAPH_(JOB_UNRESOLVED|IDENTITY_REQUIRED)$/);}
 });
 it('an old logical-only sync helper refuses without an adapter call',async()=>{
  const create=jest.fn();await expect(syncMemoryToGraph({memoryId:'same'} as never,{createNode:create} as never)).rejects.toMatchObject({code:'GRAPH_CAPTURED_JOB_REQUIRED'});expect(create).not.toHaveBeenCalled();
 });
 it('same logical ID cannot redirect exact physical lookup to foreign tuple',async()=>{
  const id=primaryGraphIdentity('Memory','physical-A',scope),foreign=primaryGraphIdentity('Memory','physical-B',{...scope,tenantId:'tenant-B'});
  const find=jest.fn<(...args:unknown[])=>Promise<unknown[]>>().mockResolvedValue([{id:'opaque:native:id',properties:{key:foreign.key,tupleJson:foreign.tupleJson}}]);
  await expect(findGraphNodeId('Memory','same',{findNodes:find} as never,id)).rejects.toMatchObject({code:'GRAPH_IDENTITY_MISMATCH'});expect(find).toHaveBeenCalledWith('CortexV2Memory',{key:id.key},2);
 });
 it('explicit graph-off preserves original resilience and sends no queue request',async()=>{
  const mutation=jest.fn<(...args:unknown[])=>Promise<unknown>>().mockResolvedValue({_id:'physical',memoryId:'logical'}),execute=jest.fn(async(operation:()=>Promise<unknown>)=>operation()),managedTransaction=jest.fn();
  const api=new VectorAPI({mutation} as never,{managedTransaction} as never,{execute} as never);
  await api.store('space',{content:'hello',contentType:'raw',source:{type:'system',timestamp:1},metadata:{importance:50,tags:[]}} as never,{syncToGraph:false});
  expect(execute).toHaveBeenCalledTimes(1);expect(mutation).toHaveBeenCalledTimes(1);expect(mutation.mock.calls[0][1]).not.toHaveProperty('queueGraph');expect(managedTransaction).not.toHaveBeenCalled();
 });
 it.each(['Conversation','Context','Memory','Fact','Immutable','Mutable','Artifact','MemorySpace','User','Agent','Participant'])('orphan degree does not grant primary/protected %s deletion',async kind=>{
  const getNode=jest.fn(),managedTransaction=jest.fn(),adapter={getNode,managedTransaction} as never;
  expect((await detectOrphan('opaque',kind,createDeletionContext('test',undefined,scope),adapter)).isOrphan).toBe(false);
  await expect(deleteWithOrphanCleanup('opaque',kind,createDeletionContext('test',undefined,scope),adapter)).rejects.toMatchObject({code:'GRAPH_ERASURE_BLOCKED'});expect(getNode).not.toHaveBeenCalled();expect(managedTransaction).not.toHaveBeenCalled();
 });
 it('missing exact scope and legacy derived node refuse before destructive work',async()=>{
  const transaction=jest.fn(),getNode=jest.fn<()=>Promise<unknown>>().mockResolvedValue({properties:{kind:'Entity',name:'Ada',type:'person'}}),adapter={getNode,managedTransaction:transaction} as never;
  await expect(deleteWithOrphanCleanup('opaque','Entity',createDeletionContext('test'),adapter)).rejects.toMatchObject({code:'GRAPH_IDENTITY_REQUIRED'});
  await expect(deleteWithOrphanCleanup('opaque','Entity',createDeletionContext('test',undefined,scope),adapter)).rejects.toMatchObject({code:'GRAPH_ERASURE_BLOCKED'});expect(transaction).not.toHaveBeenCalled();
 });
 it('manual incident edge is retained and rolls back the selected derived cleanup',async()=>{
  const query=jest.fn<(...args:unknown[])=>Promise<unknown>>().mockImplementation(async(text)=>String(text).includes('RETURN properties(n)')?{count:1,records:[{node:entity.properties}]}:{count:1,records:[{edge:{},source:entity.properties,target:entity.properties,other:entity.properties,type:'CUSTOM'}]});
  const adapter={getNode:async()=>({properties:entity.properties}),managedTransaction:async(operation:Function)=>operation({query})} as unknown as GraphAdapter;
  await expect(deleteWithOrphanCleanup('opaque','Entity',createDeletionContext('test',undefined,scope),adapter)).rejects.toMatchObject({code:'GRAPH_ERASURE_BLOCKED'});expect(query.mock.calls.some(call=>String(call[0]).includes('DELETE'))).toBe(false);
 });
});
