import {
  authStatus,
  errorResponse,
  privateConfiguration,
} from "@/lib/app-auth";
/** Minimal public readiness; no SDK resources or client-asserted authority. */
export async function GET(request: Request) {
  try {
    privateConfiguration();
    await authStatus(request);
    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: { convexBackend: { status: "ok" } },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
