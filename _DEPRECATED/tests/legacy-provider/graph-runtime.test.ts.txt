/** Graph-only provider runtime proof, with a deterministic local model and no paid calls. */
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Cortex, CypherGraphAdapter } from '@cortexmemory/sdk';
import { createCortexMemoryAsync } from '../../src/index';
import { CortexMemoryProvider } from '../../src/provider';
import type { GraphConnectionConfig } from '@cortexmemory/sdk';
const root=process.env.CORTEX_GRAPH_PROOF_ROOT;
if(!root) throw new Error('Set CORTEX_GRAPH_PROOF_ROOT to the prepared owned graph fixture.');
if(process.env.HOME!==process.env.CORTEX_TEST_HOME_ROOT || !process.env.HOME?.startsWith(root+'/') || process.env.CONVEX_URL!=='http://127.0.0.1:43210') throw new Error('Unowned provider runtime target refused.');
const configs:Record<string,GraphConnectionConfig>=JSON.parse(fs.readFileSync(root+'/connection.json','utf8'));
for(const [engine,connection] of Object.entries(configs)) {
 it(`real ${engine} manual provider adapter stays usable after factory disposal`,async()=>{
  const adapter=new CypherGraphAdapter(); await adapter.connect(connection);
  const owner=await createCortexMemoryAsync({convexUrl:process.env.CONVEX_URL!,memorySpaceId:'task15-manual-provider',userId:'task15-manual-user',agentId:'task15-manual-agent',enableGraphMemory:false,graphConfig:{adapter}});
  await owner.close();
  const id=await adapter.createNode({label:'Task15Owned',properties:{owner:'task15-manual-provider-'+randomUUID()}});
  try { expect((await adapter.getNode(id))?.label).toBe('Task15Owned'); }
  finally { await adapter.deleteNode(id); await adapter.disconnect(); }
 });
 it(`real ${engine} provider async paths sync and persist recall across two borrowed wrappers`,async()=>{
  if(!['bolt://127.0.0.1:45387','bolt://127.0.0.1:45388'].includes(connection.uri)) throw new Error('Unowned graph target refused.');
  const space='task15-provider-'+engine+'-'+randomUUID(); const user=space+'-user'; const agent=space+'-agent'; const conversation=space+'-conversation';
  const config={convexUrl:process.env.CONVEX_URL!,memorySpaceId:space,userId:user,userName:user,agentId:agent,conversationId:conversation,enableGraphMemory:true,graphConfig:connection};
  const owner=await createCortexMemoryAsync(config);
  const inspector=new CypherGraphAdapter(); await inspector.connect(connection);
  const clean=new Cortex({convexUrl:config.convexUrl,convexLogger:false,resilience:{enabled:false}});
  try {
   await clean.memorySpaces.register({memorySpaceId:space,type:'personal',name:space});
   const model={provider:'local-proof',modelId:'task15-deterministic',specificationVersion:'v2',supportedUrls:{}};
   const one=owner(model); const two=owner(model);
   await Promise.all([one.close(),two.close(),one.close()]);
   await owner.remember('Provider sapphire bicycle preference','Provider sapphire bicycle retained');
   const search=await owner.search('sapphire bicycle');
   expect(search.length).toBeGreaterThan(0); expect(JSON.stringify(search)).toContain('sapphire');
   expect(await inspector.findNodes('Memory',{memorySpaceId:space})).toHaveLength(2);
   expect(await inspector.findNodes('Conversation',{conversationId:conversation})).toHaveLength(1);
   // Independent provider class factory shares selection rules and owns its instance.
   const standalone=await CortexMemoryProvider.create(model,config);
   await Promise.all([standalone.close(),standalone.close()]);
   expect((await owner.search('sapphire bicycle')).length).toBeGreaterThan(0);
   await Promise.all([owner.close(),owner.close()]);
   const recall=await clean.memory.recall({memorySpaceId:space,query:'sapphire bicycle',userId:user});
   expect(recall.totalResults).toBeGreaterThan(0); expect(recall.context?.toLowerCase()).toContain('sapphire');
  } finally {
   await owner.close();
   await clean.memorySpaces.delete(space,{cascade:true,reason:'task15 provider proof cleanup',confirmId:space});
   await clean.users.delete(user,{cascade:false}); await clean.agents.unregister(agent);
   await inspector.query('MATCH(n) WHERE n.memorySpaceId=$space OR n.conversationId=$conversation OR n.userId=$user OR n.agentId=$agent DETACH DELETE n',{space,conversation,user,agent});
   expect(await clean.memorySpaces.get(space)).toBeNull();
   await clean.shutdown(); await inspector.disconnect();
  }
 },30000);
}
