/** Configuration readiness only. Verified runtime/service outcomes come from authenticated client calls. */
export async function GET() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL && process.env.NEXT_PUBLIC_CORTEX_AGENT_ID);
  return Response.json({ version: 1, status: configured ? "configured" : "unconfigured",
    transport: "cortex.remote.v1", timestamp: new Date().toISOString() }, { status: configured ? 200 : 503 });
}
