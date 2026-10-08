import { Cortex } from '../src';
import { ConvexClient } from 'convex/browser';
import { createNamedTestRunContext, ScopedCleanup } from './helpers';

describe('fact similarity retrieval', () => {
  const run = createNamedTestRunContext('facts-ranking');
  const space = run.memorySpaceId('ranking');
  let cortex: Cortex;
  let cleanup: ScopedCleanup;
  let client: ConvexClient;
  let exactId: string;
  const vector = (x: number, y: number) => [x,y,...Array<number>(1534).fill(0)];

  beforeAll(async () => {
    const url = process.env.CONVEX_URL || 'http://127.0.0.1:3210';
    cortex = new Cortex({convexUrl:url});
    client = new ConvexClient(url);
    cleanup = new ScopedCleanup(client,run);
    for (const [text,x,y,tenant] of [
      ['The customer enjoys violet hues',1,0,'tenant-example-a'],
      ['A related preference',0.8,0.6,'tenant-example-a'],
      ['Unrelated financial information',0,1,'tenant-example-a'],
      ['A separate organization preference',1,0,'tenant-example-b'],
    ] as const) {
      const fact = await cortex.facts.store({memorySpaceId:space,fact:text,factType:'preference',confidence:95,sourceType:'system',tags:['ranking'],tenantId:tenant,embedding:vector(x,y)});
      if (text === 'The customer enjoys violet hues') exactId = fact.factId;
    }
  });
  afterAll(async () => {
    await cleanup?.cleanupAll();
    await cortex?.shutdown();
    await client?.close();
  });
  it('finds a paraphrase without a shared search keyword and orders by similarity', async () => {
    // This represents an embedding for "favorite purple color". That query
    // shares no words with the stored fact, so lexical fallback cannot pass.
    const found = await cortex.facts.semanticSearch(space,vector(1,0),{tenantId:'tenant-example-a',minScore:0,limit:10});
    expect(found.map(fact => fact.fact)).toEqual(['The customer enjoys violet hues','A related preference','Unrelated financial information']);
    expect(found[0].factId).toBe(exactId);
  });
  it('applies relevance thresholds and tenant scope', async () => {
    const strong = await cortex.facts.semanticSearch(space,vector(1,0),{tenantId:'tenant-example-a',minScore:0.9,limit:10});
    expect(strong.map(fact => fact.factId)).toEqual([exactId]);
    const other = await cortex.facts.semanticSearch(space,vector(1,0),{tenantId:'tenant-example-b',minScore:0.9,limit:10});
    expect(other).toHaveLength(1);
    expect(other[0].tenantId).toBe('tenant-example-b');
  });
});
