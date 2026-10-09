import "server-only";
import { ChatSDKError } from "./errors";
export function requireSameOrigin(request: Request): void {
  if (["GET", "HEAD"].includes(request.method)) return;
  const origin = process.env.CORTEX_APP_ORIGIN;
  if (!origin)
    throw new ChatSDKError(
      "offline:api",
      "Configure CORTEX_APP_ORIGIN on the server",
    );
  if (request.headers.get("origin") !== origin)
    throw new ChatSDKError("forbidden:api");
}
export async function privateRequest(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    requireSameOrigin(request);
    return await work();
  } catch (error) {
    return error instanceof ChatSDKError
      ? error.toResponse()
      : new ChatSDKError(
          "offline:api",
          "Private backend unavailable; check server configuration",
        ).toResponse();
  }
}
