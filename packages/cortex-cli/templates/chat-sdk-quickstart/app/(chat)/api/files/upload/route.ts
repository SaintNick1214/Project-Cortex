import { identifier, requestBytes, withRuntime } from "@/lib/runtime/server";
/** Binary delivery stays on the accepted private HTTP asset path, maximum20MB. */
export async function POST(request: Request) {
  return withRuntime(request, async (client) => {
    const requestId = identifier(
      new URL(request.url).searchParams.get("requestId")
    );
    const bytes = await requestBytes(request, 20_000_000, 60_000);
    return client.uploadAsset(bytes, {
      mimeType:
        request.headers.get("content-type") ?? "application/octet-stream",
      requestId,
    });
  });
}
