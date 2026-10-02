import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { AttachmentsAPI } from '../../../src/attachments';
import type { ConvexClient } from 'convex/browser';

afterEach(() => jest.restoreAllMocks());

describe('attachment upload', () => {
  const params = {memorySpaceId:'space-example',userId:'user-example',type:'file' as const,filename:'example.txt'};
  it('uploads the blob and registers its actual MIME type and byte size', async () => {
    const file = new Blob(['café'],{type:'text/plain'});
    const api = new AttachmentsAPI({} as ConvexClient);
    jest.spyOn(api,'generateUploadUrl').mockResolvedValue({uploadUrl:'https://example.com/upload'});
    const register = jest.spyOn(api,'attach').mockResolvedValue({attachmentId:'attachment-example'} as never);
    const send = jest.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({storageId:'storage-example'})));
    await api.upload({...params,file});
    expect(send).toHaveBeenCalledWith('https://example.com/upload',{method:'POST',headers:{'Content-Type':'text/plain'},body:file});
    expect(register).toHaveBeenCalledWith(expect.objectContaining({storageId:'storage-example',mimeType:'text/plain',size:file.size}));
  });
  it('uses a binary MIME type when the blob has none', async () => {
    const api = new AttachmentsAPI({} as ConvexClient);
    jest.spyOn(api,'generateUploadUrl').mockResolvedValue({uploadUrl:'https://example.com/upload'});
    const register = jest.spyOn(api,'attach').mockResolvedValue({attachmentId:'attachment-example'} as never);
    jest.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({storageId:'storage-example'})));
    await api.upload({...params,file:new Blob(['data'])});
    expect(register).toHaveBeenCalledWith(expect.objectContaining({mimeType:'application/octet-stream'}));
  });
  it('does not register a failed upload', async () => {
    const api = new AttachmentsAPI({} as ConvexClient);
    jest.spyOn(api,'generateUploadUrl').mockResolvedValue({uploadUrl:'https://example.com/upload'});
    const register = jest.spyOn(api,'attach');
    jest.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:403,statusText:'Forbidden'}));
    await expect(api.upload({...params,file:new Blob(['data'])})).rejects.toThrow('File upload failed: Forbidden');
    expect(register).not.toHaveBeenCalled();
  });
});
