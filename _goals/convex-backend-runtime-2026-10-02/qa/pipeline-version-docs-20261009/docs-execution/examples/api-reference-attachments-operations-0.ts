import type { Cortex } from '@cortexmemory/sdk';

export async function readApprovedAttachmentPage(cortex: Cortex,
  memorySpaceId: string, cursor?: string) {
  const page = await cortex.attachments.list({ memorySpaceId, type: 'image', limit: 20, cursor });
  return { files: page.attachments.map(file => ({ id: file.attachmentId,
    filename: file.filename, bytes: file.size })), nextCursor: page.hasMore ? page.cursor : undefined };
}
