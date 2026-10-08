import "server-only";
import { Cortex, CypherGraphAdapter, resolveGraphConnection, type Conversation, type Artifact } from "@cortexmemory/sdk";
import { auth } from "@/app/(auth)/auth";
import {
  privateConfiguration,
  initializePrivateTransport,
  privateCall,
} from "./private-backend";
import { ChatSDKError } from "./errors";
export type AppScope = {
  userId: string;
  tenantId: string;
  memorySpaceId: string;
};
export function getMemorySpaceId(userId: string): string {
  if (!userId) throw new ChatSDKError("unauthorized:api");
  return `${process.env.MEMORY_SPACE_ID || "chat-sdk-demo"}-${userId}`;
}
export function getAgentId(): string {
  return process.env.AGENT_ID || "chat-assistant";
}
export async function requireScope(expectedUserId?: string): Promise<AppScope> {
  const session = await auth();
  if (!session?.user?.id) throw new ChatSDKError("unauthorized:api");
  if (expectedUserId !== undefined && expectedUserId !== session.user.id)
    throw new ChatSDKError("forbidden:api");
  const { tenantId } = privateConfiguration();
  return {
    userId: session.user.id,
    tenantId,
    memorySpaceId: getMemorySpaceId(session.user.id),
  };
}
const ownedGraphAdapters = new WeakMap<Cortex, CypherGraphAdapter>();
export async function createScopedCortex(
  scope: AppScope,
  graph = false,
): Promise<Cortex> {
  // Genuine bounded HTTP refusal occurs before WebSocket construction/model calls.
  await privateCall("app/chatUsers:credentialByEmail", { email: "" }).catch(
    (error) => {
      throw error;
    },
  );
  const connection = graph ? resolveGraphConnection({ enabled: true }) : undefined;
  const adapter = connection ? new CypherGraphAdapter() : undefined;
  try {
    if (adapter && connection) {
      await adapter.connect(connection);
    }
    const cortex = await Cortex.create(
      {
      convexUrl: privateConfiguration().convexUrl,
      auth: { userId: scope.userId, tenantId: scope.tenantId },
        graphEnabled: graph,
        ...(adapter ? { graph: { adapter, autoSync: false } } : {}),
      },
      { initializeTransport: initializePrivateTransport },
    );
    if (adapter) {
      ownedGraphAdapters.set(cortex, adapter);
    }
    return cortex;
  } catch (error) {
    if (adapter) {
      await adapter.disconnect();
    }
    throw error;
  }
}
export async function closeOwnedCortex(cortex: Cortex): Promise<void> {
  const adapter = ownedGraphAdapters.get(cortex);
  ownedGraphAdapters.delete(cortex);
  cortex.close();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        try {
          await cortex.shutdown();
        } finally {
          if (adapter) {
            await adapter.disconnect();
          }
        }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ChatSDKError("offline:api", "Backend cleanup did not finish"),
            ),
          30000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function withCortex<T>(
  scope: AppScope,
  work: (client: Cortex) => Promise<T>,
  graph = false,
): Promise<T> {
  const client = await createScopedCortex(scope, graph);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(client),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ChatSDKError(
                "offline:api",
                "Backend operation did not finish; check server configuration",
              ),
            ),
          30000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await closeOwnedCortex(client);
  }
}
export function assertChatOwner(
  conversation: Conversation | null,
  scope: AppScope,
): asserts conversation is Conversation {
  if (
    !conversation ||
    conversation.participants.userId !== scope.userId ||
    conversation.tenantId !== scope.tenantId ||
    conversation.memorySpaceId !== scope.memorySpaceId
  )
    throw new ChatSDKError("not_found:chat");
}
export function assertArtifactOwner(
  artifact: Artifact | null,
  scope: AppScope,
): asserts artifact is Artifact {
  if (
    !artifact ||
    artifact.userId !== scope.userId ||
    artifact.tenantId !== scope.tenantId ||
    artifact.memorySpaceId !== scope.memorySpaceId
  )
    throw new ChatSDKError("not_found:document");
}
