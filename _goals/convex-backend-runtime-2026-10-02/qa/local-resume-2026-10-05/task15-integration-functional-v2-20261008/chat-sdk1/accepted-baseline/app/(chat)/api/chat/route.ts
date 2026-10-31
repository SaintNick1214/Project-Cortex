import type { LayerObserver } from "@cortexmemory/vercel-ai-provider";
import { createCortexMemoryAsync } from "@cortexmemory/vercel-ai-provider";
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
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage, DBMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch {
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
      differenceInHours: 24,
      id: session.user.id,
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
        title: "New chat",
        userId: session.user.id,
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      city,
      country,
      latitude,
      longitude,
    };

    // Note: User message storage is handled by Cortex Memory's rememberStream()
    // to avoid duplicate messages in conversation history.
    // See: rememberStream stores both user and assistant messages with ACID guarantees.

    const isReasoningModel =
      selectedChatModel.includes("reasoning") ||
      selectedChatModel.includes("thinking");

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
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
            agent: "Agent Context",
            context: "Context Assembly",
            conversation: "Conversation",
            facts: "Facts Engine",
            graph: "Knowledge Graph",
            memorySpace: "Memory Space",
            user: "User Profile",
            vector: "Vector Search",
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
          // Layer updates include phase information
          onLayerUpdate: (event) => {
            try {
              // Only emit reasoning-delta for "complete" status to avoid noise
              // Still emit transient events for all statuses for backward compatibility
              const shouldEmitReasoning = event.status === "complete";

              // Determine phase - use explicit phase if available, otherwise infer from layer
              // Recall layers: memorySpace, user, agent, vector, facts, graph
              // Storage layers: conversation (after response)
              const recallLayers = [
                "memorySpace",
                "user",
                "agent",
                "vector",
                "facts",
                "graph",
                "context",
              ];
              const inferredPhase = recallLayers.includes(event.layer)
                ? "recall"
                : "remember";
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
                    id: `memory-recall-${orchestrationId}`,
                    providerMetadata: { cortex: { memoryPhase: "recall" } },
                    type: "reasoning-start",
                  });
                } else {
                  currentRememberOrchestrationId = orchestrationId;
                  dataStream.write({
                    id: `memory-storage-${orchestrationId}`,
                    providerMetadata: { cortex: { memoryPhase: "storage" } },
                    type: "reasoning-start",
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
                  delta: `- **${layerDisplayName}**: ${statusText}\n`,
                  id: reasoningId,
                  type: "reasoning-delta",
                });
              }

              // Keep existing transient event for backward compatibility (all statuses)
              dataStream.write({
                data: event,
                transient: true,
                type: "data-layer-update",
              });
            } catch (error) {
              console.error("Error in onLayerUpdate:", error);
              // Still emit the transient event even if reasoning-delta fails
              try {
                dataStream.write({
                  data: event,
                  transient: true,
                  type: "data-layer-update",
                });
              } catch {
                // Ignore secondary errors
              }
            }
          },
          onRecallComplete: (summary) => {
            // IMPORTANT: Use currentRecallOrchestrationId (set by onRecallStart) first
            // This ensures the reasoning-end ID matches the reasoning-start ID
            const orchestrationId =
              currentRecallOrchestrationId || summary?.orchestrationId;
            try {
              // Emit reasoning-end for recall phase (AI SDK 6 Protocol)
              dataStream.write({
                id: `memory-recall-${orchestrationId}`,
                type: "reasoning-end",
              });
              // Keep existing transient event for backward compatibility
              dataStream.write({
                data: summary,
                transient: true,
                type: "data-recall-complete",
              });
            } catch (error) {
              console.error("Error in onRecallComplete:", error);
              // Attempt to emit reasoning-end even on error
              try {
                dataStream.write({
                  id: `memory-recall-${orchestrationId}`,
                  type: "reasoning-end",
                });
              } catch {
                // Ignore secondary errors
              }
            }
          },
          // Phase-aware callbacks (v0.35.1+)
          onRecallStart: (orchestrationId) => {
            currentRecallOrchestrationId = orchestrationId;
            try {
              // Emit reasoning-start for recall phase (AI SDK 6 Protocol)
              // Use providerMetadata to pass memory phase since id isn't exposed to UI
              dataStream.write({
                id: `memory-recall-${orchestrationId}`,
                providerMetadata: { cortex: { memoryPhase: "recall" } },
                type: "reasoning-start",
              });
              // Keep existing transient event for backward compatibility
              dataStream.write({
                data: { orchestrationId },
                transient: true,
                type: "data-recall-start",
              });
            } catch (error) {
              console.error("Error in onRecallStart:", error);
              // Ensure reasoning-end is emitted even on error
              try {
                dataStream.write({
                  id: `memory-recall-${orchestrationId}`,
                  type: "reasoning-end",
                });
              } catch {
                // Ignore secondary errors
              }
            }
          },
          onRememberComplete: (summary) => {
            // IMPORTANT: Use currentRememberOrchestrationId (set by onRememberStart) first
            // The summary.orchestrationId may be different due to internal remember() call
            const orchestrationId =
              currentRememberOrchestrationId || summary?.orchestrationId;
            try {
              // Emit reasoning-end for storage phase (AI SDK 6 Protocol)
              dataStream.write({
                id: `memory-storage-${orchestrationId}`,
                type: "reasoning-end",
              });
              // Keep existing transient event for backward compatibility
              dataStream.write({
                data: summary,
                transient: true,
                type: "data-remember-complete",
              });
            } catch (error) {
              console.error("Error in onRememberComplete:", error);
              // Attempt to emit reasoning-end even on error
              try {
                dataStream.write({
                  id: `memory-storage-${orchestrationId}`,
                  type: "reasoning-end",
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
                id: `memory-storage-${orchestrationId}`,
                providerMetadata: { cortex: { memoryPhase: "storage" } },
                type: "reasoning-start",
              });
              // Keep existing transient event for backward compatibility
              dataStream.write({
                data: { orchestrationId },
                transient: true,
                type: "data-remember-start",
              });
            } catch (error) {
              console.error("Error in onRememberStart:", error);
              // Ensure reasoning-end is emitted even on error
              try {
                dataStream.write({
                  id: `memory-storage-${orchestrationId}`,
                  type: "reasoning-end",
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
          layerObserver
        );

        // Create Cortex memory wrapper
        const cortexMemory = await createCortexMemoryAsync(cortexConfig);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // Stream with Cortex Memory-wrapped model
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const result = streamText({
          activeTools: isReasoningModel
            ? []
            : [
                "getWeather",
                "createDocument",
                "updateDocument",
                "requestSuggestions",
              ],
          experimental_telemetry: {
            functionId: "stream-text",
            isEnabled: isProductionEnvironment,
          },
          messages: modelMessages,
          model: cortexMemory(getLanguageModel(selectedChatModel)),
          providerOptions: isReasoningModel
            ? {
                anthropic: {
                  thinking: { budgetTokens: 10_000, type: "enabled" },
                },
              }
            : undefined,
          stopWhen: stepCountIs(5),
          system: systemPrompt({ requestHints, selectedChatModel }),
          tools: {
            createDocument: createDocument({ dataStream, session }),
            getWeather,
            requestSuggestions: requestSuggestions({ dataStream, session }),
            updateDocument: updateDocument({ dataStream, session }),
          },
        });

        dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));

        if (titlePromise) {
          const title = await titlePromise;
          // IMPORTANT: Save title to database FIRST, then notify client
          // This ensures when client re-fetches, the new title is already in Convex
          try {
            await updateChatTitleById({
              chatId: id,
              title,
              userId: session.user.id,
            });
          } catch (error) {
            console.error("Error updating chat title:", error);
          }
          // Now notify client to refresh - title is already saved in Convex
          dataStream.write({ data: title, type: "data-chat-title" });
        }
      },
      generateId: generateUUID,
      onError: () => "Oops, an error occurred!",
      onFinish: async ({ messages: finishedMessages }) => {
        // Note: Message storage is handled by Cortex Memory's rememberStream()
        // to avoid duplicate messages in conversation history.
        // rememberStream stores both user and assistant messages with ACID guarantees.
        //
        // Tool approval flow may still need message updates for tool state changes:
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              // Only update existing messages (Cortex messages are immutable, so this is a no-op)
              try {
                await updateMessage({
                  id: finishedMsg.id,
                  parts: finishedMsg.parts,
                });
              } catch {
                // Cortex messages are immutable - this is expected to fail
              }
            }
            // Don't save new messages - rememberStream handles this
          }
        }
        // Normal flow: rememberStream handles all message storage
      },
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
    });

    return createUIMessageStreamResponse({
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ chatId: id, streamId });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch {
          // ignore redis errors
        }
      },
      stream,
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
