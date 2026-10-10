import { CypherGraphAdapter, type GraphConnectionConfig } from '@cortexmemory/sdk';

export async function readAdministrativeGraph(config: GraphConnectionConfig, ownerId: string) {
  const adapter = new CypherGraphAdapter();
  try {
    await adapter.connect(config);
    const summary = await adapter.query({
      cypher: 'MATCH (n:AdministrativeTask) WHERE n.ownerId = $ownerId RETURN n.title AS title LIMIT 20',
      params: { ownerId },
    });
    const nodes = await adapter.findNodes('AdministrativeTask', { ownerId }, 20);
    const startId = nodes[0]?.id;
    const related = startId ? await adapter.traverse({
      startId, relationshipTypes: ['DEPENDS_ON'], maxDepth: 2, direction: 'OUTGOING',
      filter: 'connected.ownerId = $ownerId', filterParams: { ownerId },
    }) : [];
    return { rows: summary.records, count: summary.count, related };
  } finally {
    await adapter.disconnect();
  }
}
