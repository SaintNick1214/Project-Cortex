import "server-only";
import { randomUUID } from "node:crypto";
import {
  CortexMemoryProvider,
  createLayerStreamObserver,
  type LayerObserver,
} from "@cortexmemory/vercel-ai-provider";
import { createOpenAI } from "@ai-sdk/openai";
import {
  streamText,
  embed,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import {
  AppError,
  errorResponse,
  requireSession,
  selectSpace,
  privateConfiguration,
} from "./app-auth";
import {
  createScopedCortex,
  closeOwnedCortex,
  boundedBackendWork,
  assertConversationOwner,
  requireProviderConfiguration,
} from "./cortex";

export function latestUserMessage(messages: unknown): UIMessage {
  if (!Array.isArray(messages) || !messages.length || messages.length > 200)
    throw new AppError(400, "messages array is required");
  const message = messages.at(-1);
  if (!message || message.role !== "user" || typeof message.id !== "string")
    throw new AppError(400, "Send a user message");
  const text =
    typeof message.content === "string"
      ? message.content
      : Array.isArray(message.parts) &&
          message.parts.every(
            (part: unknown) =>
              !!part &&
              typeof part === "object" &&
              "type" in part &&
              part.type === "text" &&
              "text" in part &&
              typeof part.text === "string",
          )
        ? message.parts.map((part: { text: string }) => part.text).join("\n")
        : "";
  if (!text.trim() || text.length > 20000)
    throw new AppError(400, "Message text must contain 1 to 20000 characters");
  return { id: message.id, role: "user", parts: [{ type: "text", text }] };
}

/** Both entrypoints use the same verified owner and durable SDK history. */
export async function chat(
  request: Request,
  helperObserver = false,
): Promise<Response> {
  try {
    const account = await requireSession(request);
    requireProviderConfiguration();
    const body = await request.json();
    if (!body || typeof body !== "object")
      throw new AppError(400, "Invalid chat request");
    const space = selectSpace(account, body);
    const latest = latestUserMessage(body.messages);
    if (
      body.conversationId != null &&
      (typeof body.conversationId !== "string" || !body.conversationId.length)
    )
      throw new AppError(400, "Invalid conversation ID");
    const conversationId = body.conversationId || randomUUID();
    const cortex = await createScopedCortex(
      account,
      process.env.CORTEX_GRAPH_SYNC === "true",
    );
    try {
      let conversation = await boundedBackendWork(() =>
        cortex.conversations.get(conversationId, {
          includeMessages: true,
          messageLimit: 100,
        }),
      );
      if (body.conversationId)
        assertConversationOwner(conversation, account, space);
      else if (conversation)
        throw new AppError(409, "Conversation ID already exists");
      const text = latest.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      if (!conversation) {
        // Establish the physical owned registry before capturing conversation references.
        const registry = await boundedBackendWork(() => cortex.memorySpaces.get(space));
        if (!registry)
          await boundedBackendWork(() => cortex.memorySpaces.register({
            memorySpaceId: space,
            tenantId: account.tenantId,
            type: "personal",
            participants: [{ id: account.accountId, type: "user" }],
          }));
        conversation = await boundedBackendWork(() =>
          cortex.conversations.create({
            conversationId,
            memorySpaceId: space,
            type: "user-agent",
            participants: {
              userId: account.accountId,
              agentId: "quickstart-assistant",
            },
            metadata: { title: text.slice(0, 50) },
          }),
        );
      }
      assertConversationOwner(conversation, account, space);
      const history: UIMessage[] = (conversation.messages || [])
        .filter((message) => message.role !== "system")
        .map((message) => ({
          id: message.id,
          role: message.role === "agent" ? "assistant" : "user",
          parts: [{ type: "text", text: message.content }],
        }));
      const modelMessages = await convertToModelMessages([...history, latest]);
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(60000),
      ]);
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          onError: () =>
            "Chat could not finish. Check server configuration and retry.",
          execute: async ({ writer }) => {
            let provider: CortexMemoryProvider | undefined;
            try {
              const helper = helperObserver
                ? createLayerStreamObserver()
                : null;
              if (helper) helper.emitTo(writer);
              const observer: LayerObserver = (helper
                ? {
                    ...helper.observer,
                    onLayerUpdate: (event) =>
                      helper.observer.onLayerUpdate?.({
                        ...event,
                        error: event.error
                          ? { message: "Memory operation failed" }
                          : undefined,
                      }),
                  }
                : null) || {
                onRecallStart: (orchestrationId) =>
                  writer.write({
                    type: "data-orchestration-start",
                    data: { orchestrationId },
                    transient: true,
                  }),
                onLayerUpdate: (event) =>
                  writer.write({
                    type: "data-layer-update",
                    data: {
                      layer: event.layer,
                      status: event.status,
                      timestamp: event.timestamp,
                      latencyMs: event.latencyMs,
                      data: event.data,
                      revisionAction: event.revisionAction,
                      supersededFacts: event.supersededFacts,
                      error: event.error
                        ? { message: "Memory operation failed" }
                        : undefined,
                    },
                    transient: true,
                  }),
                onRememberComplete: (summary) =>
                  writer.write({
                    type: "data-orchestration-complete",
                    data: {
                      orchestrationId: summary.orchestrationId,
                      totalLatencyMs: summary.totalLatencyMs,
                      createdIds: summary.createdIds,
                    },
                    transient: true,
                  }),
              };
              provider = new CortexMemoryProvider(
                openai("gpt-4o-mini"),
                {
                  convexUrl: privateConfiguration().convexUrl,
                  memorySpaceId: space,
                  userId: account.accountId,
                  userName: account.username,
                  conversationId,
                  agentId: "quickstart-assistant",
                  agentName: "Cortex Demo Assistant",
                  enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",
                  enableFactExtraction:
                    process.env.CORTEX_FACT_EXTRACTION === "true",
                  memorySearchLimit: 20,
                  beliefRevision: {
                    enabled: true,
                    slotMatching: true,
                    llmResolution: true,
                  },
                  embeddingProvider: {
                    generate: async (value) =>
                      (
                        await embed({
                          model: openai.embedding("text-embedding-3-small"),
                          value,
                          abortSignal: signal,
                        })
                      ).embedding,
                  },
                  streamingOptions: {
                    storePartialResponse: true,
                    progressiveFactExtraction: true,
                    enableAdaptiveProcessing: true,
                  },
                  layerObserver: observer,
                },
                cortex,
              );
              writer.write({
                type: "data-conversation-update",
                data: {
                  conversationId,
                  title: conversation.metadata?.title || "New chat",
                },
                transient: true,
              });
              if (provider.specificationVersion !== "v3")
                throw new AppError(503, "Use an AI SDK 6 model");
              assertV3Provider(provider);
              const result = streamText({
                model: provider,
                messages: modelMessages,
                system:
                  "You are a helpful assistant. Use the user's current conversation and recalled personal context accurately.",
                abortSignal: signal,
              });
              writer.merge(result.toUIMessageStream());
              // Consume through provider persistence before releasing the app-owned client.
              await new Promise<void>((resolve, reject) => {
                const abort = () =>
                  reject(new AppError(503, "Chat cancelled or timed out"));
                if (signal.aborted) return abort();
                signal.addEventListener("abort", abort, { once: true });
                Promise.resolve(
                  result.consumeStream({
                    onError: () => reject(new AppError(503, "Chat failed")),
                  }),
                )
                  .then(resolve, () => reject(new AppError(503, "Chat failed")))
                  .finally(() => signal.removeEventListener("abort", abort));
              });
            } finally {
              try {
                await provider?.close();
              } finally {
                await closeOwnedCortex(cortex);
              }
            }
          },
        }),
      });
    } catch (error) {
      await closeOwnedCortex(cortex);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}

function assertV3Provider(
  provider: CortexMemoryProvider,
): asserts provider is CortexMemoryProvider & {
  readonly specificationVersion: "v3";
} {
  if (provider.specificationVersion !== "v3")
    throw new AppError(503, "Use an AI SDK 6 model");
}
