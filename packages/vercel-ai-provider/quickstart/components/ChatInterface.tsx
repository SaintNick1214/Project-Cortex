"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type {
  LayerStatus,
  MemoryLayer,
  LayerState,
  RevisionAction,
} from "@/lib/layer-tracking";

// Type for layer update data parts from the stream
interface LayerUpdateData {
  layer: MemoryLayer;
  status: LayerStatus;
  timestamp: number;
  latencyMs?: number;
  data?: LayerState["data"];
  error?: { message: string; code?: string };
  revisionAction?: RevisionAction;
  supersededFacts?: string[];
}

interface ChatInterfaceProps {
  memorySpaceId: string;
  userId: string;
  conversationId: string | null;
  onOrchestrationStart?: () => void;
  onLayerUpdate?: (
    layer: MemoryLayer,
    status: LayerStatus,
    data?: LayerState["data"],
    revisionInfo?: {
      action?: RevisionAction;
      supersededFacts?: string[];
    },
  ) => void;
  onReset?: () => void;
  onConversationUpdate?: (conversationId: string, title: string) => void;
}

export function ChatInterface({
  memorySpaceId,
  userId,
  conversationId,
  onOrchestrationStart,
  onLayerUpdate,
  onReset,
  onConversationUpdate,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [suggestedMessages] = useState([
    "Hi! My name is Alex and I work at Acme Corp as a senior engineer.",
    "My favorite color is blue and I love hiking on weekends.",
    "I'm learning Spanish and prefer dark mode interfaces.",
    "What do you remember about me?",
  ]);

  // Create transport with body parameters - memoized to prevent recreation
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { memorySpaceId, userId, conversationId },
      }),
    [memorySpaceId, userId, conversationId],
  );

  // Handle layer data parts from the stream
  const handleDataPart = useCallback(
    (dataPart: unknown) => {
      const part = dataPart as { type: string; data?: unknown };
      if (part.type === "data-orchestration-start") {
        onOrchestrationStart?.();
      }

      if (part.type === "data-layer-update") {
        const event = part.data as LayerUpdateData;
        onLayerUpdate?.(event.layer, event.status, event.data, {
          action: event.revisionAction,
          supersededFacts: event.supersededFacts,
        });
      }

      // Handle conversation title update
      if (part.type === "data-conversation-update") {
        const update = part.data as { conversationId: string; title: string };
        onConversationUpdate?.(update.conversationId, update.title);
      }
    },
    [onOrchestrationStart, onLayerUpdate, onConversationUpdate],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onData: handleDataPart,
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load messages when conversation changes
  useEffect(() => {
    // Clear messages first
    setMessages([]);

    // If no conversation selected, nothing more to do
    if (!conversationId) {
      return;
    }

    // Fetch conversation history
    const loadConversationHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const response = await fetch(
          `/api/conversations?conversationId=${encodeURIComponent(conversationId)}`
        );

        if (!response.ok) {
          console.error("Failed to load conversation history");
          return;
        }

        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
          // Transform to the format expected by useChat
          const loadedMessages = data.messages.map((msg: { id: string; role: string; content: string; createdAt: string }) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: new Date(msg.createdAt),
          }));
          setMessages(loadedMessages);
        }
      } catch (error) {
        console.error("Error loading conversation history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadConversationHistory();
  }, [conversationId, setMessages]);

  // Determine if we're actively streaming (only time to show typing indicator)
  const isStreaming = status === "streaming";

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput("");

    try {
      await sendMessage({ text: message });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleSuggestedMessage = (message: string) => {
    setInput(message);
  };

  // Extract text content from message parts (AI SDK v5 format)
  const getMessageContent = (message: { content?: string; parts?: Array<{ type: string; text?: string }> }): string => {
    if (typeof message.content === "string") {
      return message.content;
    }
    if (message.parts) {
      return message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
    }
    return "";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <svg
                className="animate-spin h-8 w-8 text-cortex-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-gray-400 text-sm">Loading conversation...</span>
            </div>
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cortex-500/20 to-cortex-700/20 flex items-center justify-center">
              <span className="text-3xl">🧠</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {conversationId ? "Continue your conversation" : "Start a new conversation"}
            </h2>
            <p className="text-gray-400 max-w-md mx-auto mb-6">
              This demo shows how Cortex orchestrates memory across multiple
              layers in real-time. Try telling me about yourself!
            </p>

            {/* Suggested messages */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {suggestedMessages.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedMessage(msg)}
                  className="px-3 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors text-left"
                >
                  {msg.length > 40 ? msg.slice(0, 40) + "..." : msg}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={message.id || i}
            className={`message-animate flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                message.role === "user"
                  ? "bg-cortex-600 text-white"
                  : "bg-white/10 text-white"
              }`}
            >
              <p className="whitespace-pre-wrap">
                {getMessageContent(message)}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator - only show during active streaming */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-white/10 px-4 py-3 rounded-2xl">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input - only disabled during active streaming, NOT during background orchestration */}
      <div className="border-t border-white/10 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me about yourself..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cortex-500 transition-colors"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-6 py-3 bg-cortex-600 hover:bg-cortex-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
          >
            Send
          </button>
        </form>

        {messages.length > 0 && (
          <button
            onClick={onReset}
            className="mt-2 text-sm text-gray-500 hover:text-white transition-colors"
          >
            Clear visualization →
          </button>
        )}
      </div>
    </div>
  );
}
