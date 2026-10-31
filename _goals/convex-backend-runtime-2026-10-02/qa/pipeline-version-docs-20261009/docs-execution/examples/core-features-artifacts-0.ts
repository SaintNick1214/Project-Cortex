import type { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';

export async function createDocument(client: CortexRuntimeClient, requestId: string, prompt: string) {
  const job = await client.submitContentJob({ version: 1, requestId, intent: 'text', prompt });
  return client.getContentJob(job.jobId);
}
