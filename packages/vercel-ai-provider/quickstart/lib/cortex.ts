import "server-only";
import { Cortex, CypherGraphAdapter, resolveGraphConnection, type Conversation } from "@cortexmemory/sdk";
import { AppError, privateConfiguration, type AppIdentity } from "./app-auth";

export function initializePrivateTransport(client: unknown): undefined {
  const { deploymentKey } = privateConfiguration();
  if (
    !client ||
    typeof client !== "object" ||
    !("setAdminAuth" in client) ||
    typeof client.setAdminAuth !== "function"
  )
    throw new AppError(
      503,
      "Installed client lacks private deployment transport",
    );
  client.setAdminAuth(deploymentKey);
  return undefined;
}
/** Authority comes from the verified cookie gateway, never from caller AuthContext. */
const ownedGraphAdapters = new WeakMap<Cortex, CypherGraphAdapter>();
export async function createScopedCortex(
  account: AppIdentity,
  graph = false,
): Promise<Cortex> {
  const { convexUrl } = privateConfiguration();
  const connection = graph ? resolveGraphConnection({ enabled: true }) : undefined;
  const adapter = connection ? new CypherGraphAdapter() : undefined;
  try {
    if (adapter && connection) {
      await adapter.connect(connection);
    }
    const cortex = await Cortex.create(
      {
      convexUrl,
      auth: { userId: account.accountId, tenantId: account.tenantId },
        graphEnabled: graph,
        ...(adapter ? { graph: { adapter, autoSync: false } } : {}),
      },
      { deploymentOperator: true, initializeTransport: initializePrivateTransport },
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
              new AppError(
                503,
                "Backend cleanup did not finish; retry after checking server configuration",
              ),
            ),
          30000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
/** A deadline reports an unfinished operation; it does not claim that a pending transport joined. */
export async function boundedBackendWork<T>(
  work: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new AppError(
                503,
                "Backend operation did not finish; check server configuration",
              ),
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
  account: AppIdentity,
  work: (cortex: Cortex) => Promise<T>,
  graph = false,
): Promise<T> {
  const cortex = await createScopedCortex(account, graph);
  try {
    return await boundedBackendWork(() => work(cortex));
  } finally {
    await closeOwnedCortex(cortex);
  }
}
export function assertConversationOwner(
  conversation: Conversation | null,
  account: AppIdentity,
  space: string,
): asserts conversation is Conversation {
  if (
    !conversation ||
    conversation.participants.userId !== account.accountId ||
    conversation.memorySpaceId !== space ||
    conversation.tenantId !== account.tenantId
  )
    throw new AppError(404, "Conversation unavailable");
}
export function requireProviderConfiguration(): void {
  privateConfiguration();
  if (!process.env.OPENAI_API_KEY?.trim())
    throw new AppError(
      503,
      "Configure OPENAI_API_KEY on the server before chatting",
    );
}
