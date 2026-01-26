import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { createCortexMemoryAsync } from "@cortexmemory/vercel-ai-provider";
import type { LayerObserver } from "@cortexmemory/vercel-ai-provider";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  getCortexMemoryConfig,
  getMemorySpaceId,
} from "@/lib/cortex-memory-config";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/types";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      if (!isToolApprovalFlow) {
        messagesFromDb = await getMessagesByChatId({ id });
      }
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const isReasoningModel =
      selectedChatModel.includes("reasoning") ||
      selectedChatModel.includes("thinking");

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Layer Observer - emits phase-aware events for real-time UI visualization
        // Includes AI SDK 6 reasoning parts for extended thinking display
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        // Track orchestration IDs for reasoning part emission
        let currentRecallOrchestrationId: string | undefined;
        let currentRememberOrchestrationId: string | undefined;

        // Helper: Map layer names to display names
        const getLayerDisplayName = (layer: string): string => {
          const displayNames: Record<string, string> = {
            memorySpace: "Memory Space",
            user: "User Profile",
            agent: "Agent Context",
            context: "Context Assembly",
            conversation: "Conversation",
            vector: "Vector Search",
            facts: "Facts Engine",
            graph: "Knowledge Graph",
          };
          return displayNames[layer] || layer;
        };

        // Helper: Format layer status with metadata
        const formatLayerStatus = (event: {
          status: string;
          data?: { metadata?: Record<string, unknown> };
        }): string => {
          const { status, data } = event;
          if (status === "complete" && data?.metadata) {
            const meta = data.metadata;
            // Include relevant counts in status
            if (typeof meta.vectorMatches === "number") {
              return `complete (${meta.vectorMatches} matches)`;
            }
            if (typeof meta.factMatches === "number") {
              return `complete (${meta.factMatches} facts)`;
            }
            if (typeof meta.count === "number") {
              return `complete (${meta.count} items)`;
            }
            if (typeof meta.nodes === "number") {
              return `complete (${meta.nodes} nodes)`;
            }
          }
          return status;
        };

        const layerObserver: LayerObserver = {
          // Phase-aware callbacks (v0.35.1+)
          onRecallStart: (orchestrationId) => {
            currentRecallOrchestrationId = orchestrationId;
            try {
              // Emit reasoning-start for recall phase (AI SDK 6 Protocol)
              // Use providerMetadata to pass memory phase since id isn't exposed to UI
              dataStream.write({
                type: "reasoning-start",
                id: `memory-recall-${orchestrationId}`,
                providerMetadata: { cortex: { memoryPhase: "recall" } },
              });
              // Keep existing transient event for backward compatibility
              dataStream.write({
                type: "data-recall-start",
                data: { orchestrationId },
                transient: true,
              });
            } catch (error) {
              console.error("Error in onRecallStart:", error);
              // Ensure reasoning-end is emitted even on error
              try {
                dataStream.write({
                  type: "reasoning-end",
                  id: `memory-recall-${orchestrationId}`,
                });
              } catch {
                // Ignore secondary errors
              }
            }
          },
          onRecallComplete: (summary) => {
            const orchestrationId =
              summary?.orchestrationId || currentRecallOrchestrationId;
            try {
              // Emit reasoning-end for recall phase (AI SDK 6 Protocol)
              dataStream.write({
                type: "reasoning-end",
                id: `memory-recall-${orchestrationId}`,
              });
              // Keep existing transient event for backward compatibility
              dataStream.write({
                type: "data-recall-complete",
                data: summary,
                transient: true,
              });
            } catch (error) {
              console.error("Error in onRecallComplete:", error);
              // Attempt to emit reasoning-end even on error
              try {
                dataStream.write({
                  type: "reasoning-end",
                  id: `memory-recall-${orchestrationId}`,
                });
              } catch {
                // Ignore secondary errors
              }
            }
          },
          onRememberStart: (orchestrationId) => {
            currentRememberOrchestrationId = orchestrationId;
            try {
              // Emit reasoning-start for storage phase (AI SDK 6 Protocol)
              // Use providerMetadata to pass memory phase since id isn't exposed to UI
              dataStream.write({
                type: "reasoning-start",
                id: `memory-storage-${orchestrationId}`,
                providerMetadata: { cortex: { memoryPhase: "storage" } },
              });
              // Keep existing transient event for backward compatibility
              dataStream.write({
                type: "data-remember-start",
                data: { orchestrationId },
                transient: true,
              });
            } catch (error) {
              console.error("Error in onRememberStart:", error);
              // Ensure reasoning-end is emitted even on error
              try {
                dataStream.write({
                  type: "reasoning-end",
                  id: `memory-storage-${orchestrationId}`,
                });
              } catch {
                // Ignore secondary errors
              }
            }
          },
          onRememberComplete: (summary) => {
            const orchestrationId =
              summary?.orchestrationId || currentRememberOrchestrationId;
            try {
              // Emit reasoning-end for storage phase (AI SDK 6 Protocol)
              dataStream.write({
                type: "reasoning-end",
                id: `memory-storage-${orchestrationId}`,
              });
              // Keep existing transient event for backward compatibility
              dataStream.write({
                type: "data-remember-complete",
                data: summary,
                transient: true,
              });
            } catch (error) {
              console.error("Error in onRememberComplete:", error);
              // Attempt to emit reasoning-end even on error
              try {
                dataStream.write({
                  type: "reasoning-end",
                  id: `memory-storage-${orchestrationId}`,
                });
              } catch {
                // Ignore secondary errors
              }
            }
          },
          // Layer updates include phase information
          onLayerUpdate: (event) => {
            try {
              // Only emit reasoning-delta for "complete" status to avoid noise
              // Still emit transient events for all statuses for backward compatibility
              const shouldEmitReasoning = event.status === "complete";

              // Determine phase - use explicit phase if available, otherwise infer from layer
              // Recall layers: memorySpace, user, agent, vector, facts, graph
              // Storage layers: conversation (after response)
              const recallLayers = ["memorySpace", "user", "agent", "vector", "facts", "graph", "context"];
              const inferredPhase = recallLayers.includes(event.layer) ? "recall" : "remember";
              const phase = event.phase || inferredPhase;

              let orchestrationId =
                phase === "recall"
                  ? currentRecallOrchestrationId
                  : currentRememberOrchestrationId;

              // Auto-start reasoning if we get a layer update before start callback
              // This can happen if the SDK emits layer updates without explicit start
              if (!orchestrationId && shouldEmitReasoning) {
                orchestrationId = `auto-${Date.now()}`;
                if (phase === "recall") {
                  currentRecallOrchestrationId = orchestrationId;
                  dataStream.write({
                    type: "reasoning-start",
                    id: `memory-recall-${orchestrationId}`,
                    providerMetadata: { cortex: { memoryPhase: "recall" } },
                  });
                } else {
                  currentRememberOrchestrationId = orchestrationId;
                  dataStream.write({
                    type: "reasoning-start",
                    id: `memory-storage-${orchestrationId}`,
                    providerMetadata: { cortex: { memoryPhase: "storage" } },
                  });
                }
              }

              // Only emit reasoning-delta for complete status
              if (shouldEmitReasoning && orchestrationId) {
                const reasoningId =
                  phase === "recall"
                    ? `memory-recall-${orchestrationId}`
                    : `memory-storage-${orchestrationId}`;

                // Emit reasoning-delta with layer status (AI SDK 6 Protocol)
                // Use markdown list format for proper rendering
                const layerDisplayName = getLayerDisplayName(event.layer);
                const statusText = formatLayerStatus(event);
                dataStream.write({
                  type: "reasoning-delta",
                  id: reasoningId,
                  delta: `- **${layerDisplayName}**: ${statusText}\n`,
                });
              }

              // Keep existing transient event for backward compatibility (all statuses)
              dataStream.write({
                type: "data-layer-update",
                data: event,
                transient: true,
              });
            } catch (error) {
              console.error("Error in onLayerUpdate:", error);
              // Still emit the transient event even if reasoning-delta fails
              try {
                dataStream.write({
                  type: "data-layer-update",
                  data: event,
                  transient: true,
                });
              } catch {
                // Ignore secondary errors
              }
            }
          },
        };

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Cortex Memory Configuration
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Auth context: session.user.id comes from Auth.js JWT session
        // See lib/auth-cortex.ts for getCortexAuthContext() helper
        const cortexConfig = getCortexMemoryConfig(
          getMemorySpaceId(),
          session.user.id, // userId from authenticated JWT session
          id, // conversationId (chat ID)
          layerObserver,
        );

        // Create Cortex memory wrapper
        const cortexMemory = await createCortexMemoryAsync(cortexConfig);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Stream with Cortex Memory-wrapped model
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const result = streamText({
          model: cortexMemory(getLanguageModel(selectedChatModel)),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools: isReasoningModel
            ? []
            : [
                "getWeather",
                "createDocument",
                "updateDocument",
                "requestSuggestions",
              ],
          providerOptions: isReasoningModel
            ? {
                anthropic: {
                  thinking: { type: "enabled", budgetTokens: 10_000 },
                },
              }
            : undefined,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({ session, dataStream }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: id, title });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          // Filter out messages that were already saved (user message was saved earlier)
          // uiMessages contains: DB messages + the new user message
          const existingMessageIds = new Set(uiMessages.map((m) => m.id));
          const newMessages = finishedMessages.filter(
            (msg) => !existingMessageIds.has(msg.id)
          );

          if (newMessages.length > 0) {
            await saveMessages({
              messages: newMessages.map((currentMessage) => ({
                id: currentMessage.id,
                role: currentMessage.role,
                parts: currentMessage.parts,
                createdAt: new Date(),
                attachments: [],
                chatId: id,
              })),
            });
          }
        }
      },
      onError: () => "Oops, an error occurred!",
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          // ignore redis errors
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
