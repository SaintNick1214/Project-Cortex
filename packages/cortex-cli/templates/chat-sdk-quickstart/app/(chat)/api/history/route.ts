import { withRuntime } from "@/lib/runtime/server";
export async function GET(request: Request) {
  return withRuntime(request, (client) => {
    const id = new URL(request.url).searchParams.get("conversationId");
    return id ? client.messages(id) : client.listConversations(50);
  });
}
