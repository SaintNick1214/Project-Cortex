import type { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";

export async function uploadPrivateFile(client: CortexRuntimeClient, file: File) {
  return client.uploadAsset(file, {
    requestId: crypto.randomUUID(),
    mimeType: file.type || "application/octet-stream",
    filename: file.name,
  });
}
