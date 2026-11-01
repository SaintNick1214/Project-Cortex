import "server-only";
import { randomUUID } from "node:crypto";
import { ToolLoopAgent, stepCountIs, embed } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { CortexMemoryProvider } from "@cortexmemory/vercel-ai-provider";
import {
  requireSession,
  selectSpace,
  privateConfiguration,
  AppError,
} from "../app-auth";
import {
  createScopedCortex,
  closeOwnedCortex,
  boundedBackendWork,
  requireProviderConfiguration,
} from "../cortex";

/** Server usage: verify the request, then await handle.close() in finally after
 * generate/stream and provider persistence finish. Caller IDs are never authority.
 */
export async function createMemoryAgent(request: Request) {
  const account = await requireSession(request);
  requireProviderConfiguration();
  const space = selectSpace(account, {
    memorySpaceId:
      new URL(request.url).searchParams.get("memorySpaceId") || undefined,
  });
  const cortex = await createScopedCortex(
    account,
    process.env.CORTEX_GRAPH_SYNC === "true",
  );
  try {
    const conversationId = randomUUID();
    await boundedBackendWork(() =>
      cortex.conversations.create({
        conversationId,
        memorySpaceId: space,
        type: "user-agent",
        participants: {
          userId: account.accountId,
          agentId: "quickstart-assistant",
        },
      }),
    );
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const provider = new CortexMemoryProvider(
      openai("gpt-4o-mini"),
      {
        convexUrl: privateConfiguration().convexUrl,
        userId: account.accountId,
        memorySpaceId: space,
        conversationId,
        agentId: "quickstart-assistant",
        enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",
        enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === "true",
        embeddingProvider: {
          generate: async (value) =>
            (
              await embed({
                model: openai.embedding("text-embedding-3-small"),
                value,
                abortSignal: AbortSignal.timeout(30000),
              })
            ).embedding,
        },
      },
      cortex,
    );
    assertSupportedProvider(provider);
    const agent = new ToolLoopAgent({
      model: provider,
      instructions:
        "Use the verified user's current conversation and recalled context accurately.",
      stopWhen: stepCountIs(5),
    });
    return {
      agent,
      conversationId,
      close: async () => {
        try {
          await provider.close();
        } finally {
          await closeOwnedCortex(cortex);
        }
      },
    };
  } catch (error) {
    await closeOwnedCortex(cortex);
    throw error;
  }
}
function assertSupportedProvider(
  provider: CortexMemoryProvider,
): asserts provider is CortexMemoryProvider & {
  readonly specificationVersion: "v3" | "v4";
} {
  if (!["v3", "v4"].includes(provider.specificationVersion))
    throw new AppError(503, "Use an AI SDK 7 compatible model");
}
export type MemoryAgentUIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  createdAt?: Date;
  parts?: Array<
    | { type: "text"; text: string }
    | { type: "tool-invocation"; toolCallId: string; state: string }
  >;
};
