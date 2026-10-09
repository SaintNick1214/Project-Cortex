/** Real owned Neo4j/Memgraph proofs. Deliberately fail when prerequisites are absent. */
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import neo4j, { type Session } from 'neo4j-driver';
import { describe, expect, it, jest } from '@jest/globals';
import { Cortex, CypherGraphAdapter } from '../../src/index';
import type { GraphConnectionConfig } from '../../src/graph/types';

const fixture = process.env.CORTEX_GRAPH_PROOF_ROOT;
if (!fixture) throw new Error('Set CORTEX_GRAPH_PROOF_ROOT to the prepared owned graph fixture before selecting these runtime proofs.');
if (!process.env.HOME || process.env.HOME !== process.env.CORTEX_TEST_HOME_ROOT || !process.env.HOME.startsWith(fixture+'/')) throw new Error('Runtime proof requires an externally isolated HOME.');
const task28Root = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/cli-sandbox-2026/task28-transport/graph';
const task28 = fixture === task28Root;
if (task28) {
  const metadata: unknown = JSON.parse(fs.readFileSync(fixture+'/ownership.json','utf8'));
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Task28 fixture ownership binding required.');
  const ownership = metadata as Record<string, unknown>;
  if (ownership.owner !== 'task28' || ownership.composeProject !== 'cortex-task28-transport' || ownership.nativeUrl !== 'http://127.0.0.1:45510' ||
      JSON.stringify(ownership.graphUris) !== JSON.stringify(['bolt://127.0.0.1:45587','bolt://127.0.0.1:45588'])) {
    throw new Error('Task28 fixture ownership binding required.');
  }
}
if (process.env.CONVEX_URL !== (task28 ? 'http://127.0.0.1:45510' : 'http://127.0.0.1:43210')) throw new Error('Owned native Convex target required.');
const proofOwner = task28 ? 'task28' : 'task15';
const ownedLabel = task28 ? 'Task28Owned' : 'Task15Owned';
const linkType = task28 ? 'TASK28_LINK' : 'TASK15_LINK';
const configs: Record<string, GraphConnectionConfig> = JSON.parse(fs.readFileSync(fixture+'/connection.json','utf8'));
const sentinels: Record<string, { id: number; properties: Record<string, unknown> }> = JSON.parse(fs.readFileSync(fixture+'/sentinels.json','utf8'));
for (const [engine, config] of Object.entries(configs)) {
  if (!(task28 ? ['bolt://127.0.0.1:45587','bolt://127.0.0.1:45588'] : ['bolt://127.0.0.1:45387','bolt://127.0.0.1:45388']).includes(config.uri)) throw new Error('Unowned graph target refused.');
  describe(`real ${engine} runtime safety`, () => {
    async function sentinel(): Promise<void> {
      const driver=neo4j.driver(config.uri,neo4j.auth.basic(config.username,config.password));
      try {
        const session=driver.session();
        try {
          const result=await session.run('MATCH(n:__TEST__ {owner:$owner}) RETURN id(n) AS id, properties(n) AS properties',{owner:proofOwner+'-unrelated-sentinel'});
          expect(result.records).toHaveLength(1);
          expect(result.records[0].get('id').toNumber()).toBe(sentinels[engine].id);
          expect(result.records[0].get('properties')).toEqual(sentinels[engine].properties);
        } finally { await session.close(); }
      } finally { await driver.close(); }
    }
    it('preserves sentinel identity/bytes across successful and authentication-failed TS probes',async()=>{
      await sentinel();
      const adapter=new CypherGraphAdapter(); await adapter.connect(config); await adapter.disconnect();
      const failed=new CypherGraphAdapter();
      await expect(failed.connect({...config,password:'deliberately-wrong-'+proofOwner+'-password'})).rejects.toThrow(/authentication failed/);
      expect(await failed.isConnected()).toBe(false); await sentinel();
    });
    it('preserves the sentinel through a simulated unsupported capability over a real fallback connection', async () => {
      const adapter=new CypherGraphAdapter();
      const internal=adapter as unknown as { getSession(): Session };
      const createSession=internal.getSession.bind(adapter);
      jest.spyOn(internal,'getSession').mockImplementation(() => {
        const session=createSession(); const run=session.run.bind(session);
        session.run=((...args: Parameters<Session['run']>) => {
          if(args[0]==='RETURN elementId(null) AS id') throw Object.assign(new Error("Function 'elementId' doesn't exist."), {code:'Memgraph.ClientError.MemgraphError.MemgraphError'});
          return run(...args);
        }) as Session['run'];
        return session;
      });
      await adapter.connect(config);
      const owner=proofOwner+'-fallback-'+randomUUID();
      const id=await adapter.createNode({label:ownedLabel,properties:{owner}});
      try { expect((await adapter.getNode(id))?.properties.owner).toBe(owner); await sentinel(); }
      finally { await adapter.deleteNode(id); await adapter.disconnect(); await sentinel(); }
    });
    it('supports node/edge CRUD and directed traversal with exact record cleanup',async()=>{
      const adapter=new CypherGraphAdapter(); await adapter.connect(config);
      const owner=proofOwner+'-'+randomUUID(); const ids:string[]=[];
      try {
        const one=await adapter.createNode({label:ownedLabel,properties:{owner,name:'first',version:1}}); ids.push(one);
        const two=await adapter.createNode({label:ownedLabel,properties:{owner,name:'second'}}); ids.push(two);
        expect((await adapter.getNode(one))?.properties.name).toBe('first');
        await adapter.updateNode(one,{version:2}); expect((await adapter.getNode(one))?.properties.version).toBe(2);
        const edge=await adapter.createEdge({type:linkType,from:one,to:two,properties:{owner}});
        const traversal=await adapter.traverse({startId:one,maxDepth:1,direction:'OUTGOING',relationshipTypes:[linkType]});
        expect(traversal.some(node=>node.id===two)).toBe(true);
        await adapter.deleteEdge(edge); expect(await adapter.traverse({startId:one,maxDepth:1,direction:'OUTGOING',relationshipTypes:[linkType]})).toHaveLength(0);
        await adapter.deleteNode(one); expect(await adapter.getNode(one)).toBeNull();
      } finally {
        for(const id of ids) await adapter.deleteNode(id);
        expect(await adapter.findNodes(ownedLabel,{owner})).toHaveLength(0);
        await adapter.disconnect(); await sentinel();
      }
    });
    it('leaves an injected caller-owned adapter usable after SDK shutdown', async () => {
      const adapter=new CypherGraphAdapter(); await adapter.connect(config);
      const cortex=await Cortex.create({convexUrl:process.env.CONVEX_URL!,convexLogger:false,graph:{adapter},graphEnabled:false,resilience:{enabled:false}});
      await cortex.shutdown(); cortex.close();
      const id=await adapter.createNode({label:ownedLabel,properties:{owner:proofOwner+'-manual-'+randomUUID()}});
      try { expect((await adapter.getNode(id))?.label).toBe(ownedLabel); }
      finally { await adapter.deleteNode(id); await adapter.disconnect(); await sentinel(); }
    });
    it('persists SDK memory, syncs graph nodes/relationships, recalls content and releases automatic ownership',async()=>{
      const space=proofOwner+'-ts-'+engine+'-'+randomUUID(); const conversation=space+'-conversation'; const user=space+'-user'; const entities=[space+'-A',space+'-B',space+'-C'];
      const cortex=await Cortex.create({convexUrl:process.env.CONVEX_URL!,convexLogger:false,graphEnabled:true,graphConnection:config,resilience:{enabled:false}});
      const inspector=new CypherGraphAdapter(); await inspector.connect(config);
      try {
        await cortex.memorySpaces.register({memorySpaceId:space,type:'personal',name:space});
        const result=await cortex.memory.remember({memorySpaceId:space,conversationId:conversation,userMessage:'Task15 sapphire bicycle preference',agentResponse:'Sapphire bicycle recorded',userId:user,userName:user,agentId:space+'-agent'});
        expect(result.memories.length).toBeGreaterThanOrEqual(2);
        expect(await inspector.findNodes('Memory',{memorySpaceId:space})).toHaveLength(2);
        expect(await inspector.findNodes('Conversation',{conversationId:conversation})).toHaveLength(1);
        const relationships=await inspector.query('MATCH(m:Memory {memorySpaceId:$space})-[:REFERENCES]->(c:Conversation {conversationId:$conversation}) RETURN count(m) AS count',{space,conversation});
        expect(Number(relationships.records[0].count)).toBe(2);
        await cortex.facts.store({memorySpaceId:space,fact:'sapphire bicycle relates the first two entities',factType:'relationship',subject:entities[0],predicate:'knows',object:entities[1],confidence:95,sourceType:'manual'});
        await cortex.facts.store({memorySpaceId:space,fact:entities[1]+' navigates '+entities[2],factType:'relationship',subject:entities[1],predicate:'knows',object:entities[2],confidence:95,sourceType:'manual'});
        const recalled=await cortex.memory.recall({memorySpaceId:space,query:'sapphire bicycle',userId:user,limit:10});
        expect(recalled.totalResults).toBeGreaterThan(0); expect(JSON.stringify(recalled)).toContain('sapphire'); expect(recalled.sources.graph.count).toBeGreaterThan(0); expect(recalled.graphExpansionApplied).toBe(true);
      } finally {
        await cortex.memorySpaces.delete(space,{cascade:true,reason:proofOwner+' owned proof cleanup'});
        await inspector.query('MATCH(n) WHERE n.memorySpaceId=$space OR n.conversationId=$conversation OR n.userId=$user OR n.agentId=$agent OR n.name IN $entities DETACH DELETE n',{space,conversation,user,agent:space+'-agent',entities});
        expect(await cortex.memorySpaces.get(space)).toBeNull();
        await cortex.users.delete(user,{cascade:false});
        await cortex.agents.unregister(space+'-agent');
        await cortex.shutdown(); cortex.close(); await inspector.disconnect(); await sentinel();
      }
    });
  });
}
