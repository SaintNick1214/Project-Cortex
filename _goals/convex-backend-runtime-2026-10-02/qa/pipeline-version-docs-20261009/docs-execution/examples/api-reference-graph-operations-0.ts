import { ConvexGraphWorkerTransport, CortexGraphWorker, CypherProjectionConnector }
  from '@cortexmemory/sdk/runtime/graph';

export async function runGraph(options: {
  deploymentUrl: string;
  tenantId: string;
  memorySpaceId: string;
  connectorId: string;
  workerId: string;
  uri: string;
  username: string;
  password: string;
  fetchToken: (signal: AbortSignal) => Promise<string>;
  signal: AbortSignal;
}) {
  const connector = new CypherProjectionConnector({
    engine: 'neo4j', uri: options.uri, username: options.username, password: options.password,
    tenantId: options.tenantId, memorySpaceId: options.memorySpaceId, connectorId: options.connectorId,
  });
  const transport = new ConvexGraphWorkerTransport({ deploymentUrl: options.deploymentUrl, fetchToken: options.fetchToken });
  const worker = new CortexGraphWorker({
    tenantId: options.tenantId, memorySpaceId: options.memorySpaceId,
    connectorId: options.connectorId, workerId: options.workerId, connector, transport,
  });
  try { await worker.run(options.signal); }
  finally { await worker.close(); }
}
