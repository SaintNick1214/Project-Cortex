/** The canonical quickstart uses the authenticated Convex remote-run transport. */
export async function POST() {
  return Response.json({ version: 1, code: "REMOTE_RUN_TRANSPORT_REQUIRED",
    message: "Use the authenticated Cortex remote-run transport in the quickstart.",
    retryable: false, outcome: "not_dispatched" }, { status: 410 });
}
