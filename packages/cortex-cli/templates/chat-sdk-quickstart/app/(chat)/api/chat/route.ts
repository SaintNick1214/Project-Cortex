import { body, exact, identifier, withRuntime } from "@/lib/runtime/server";
/** One canonical remote submit; the app does no inference, history replay or tool execution. */
export async function POST(request: Request) {
  return withRuntime(request, async (client) => {
    const value = await body(request);
    exact(value, [
      "requestId",
      "text",
      "conversationId",
      "agentId",
      "agentVersion",
    ]);
    const requestId = identifier(value.requestId),
      agentId = identifier(value.agentId ?? process.env.CORTEX_AGENT_ID);
    const agentVersion =
      value.agentVersion ?? Number(process.env.CORTEX_AGENT_VERSION ?? 1);
    if (
      typeof value.text !== "string" ||
      typeof agentVersion !== "number" ||
      !Number.isSafeInteger(agentVersion) ||
      agentVersion < 1
    ) {
      throw new Error("INVALID_INPUT");
    }
    const handle = await client.submit({
      agentId,
      agentVersion,
      clientRequestId: requestId,
      parts: [{ text: value.text, type: "text" }],
      version: 1,
      ...(value.conversationId === undefined
        ? {}
        : { conversationId: identifier(value.conversationId) }),
    });
    await client.start(handle, { streaming: true });
    return { handle, version: 1 };
  });
}
export async function DELETE(request: Request) {
  return withRuntime(request, async (client) => {
    const runId = identifier(new URL(request.url).searchParams.get("runId"));
    return client.cancel(await client.attach(runId));
  });
}
