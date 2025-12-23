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
}

export function ChatInterface({
  memorySpaceId,
  userId,
  onOrchestrationStart,
  onLayerUpdate,
  onReset,
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
        body: { memorySpaceId, userId },
      }),
    [memorySpaceId, userId],
  );

  // Handle layer data parts from the stream
  const handleDataPart = useCallback(
    (dataPart: any) => {
      if (dataPart.type === "data-orchestration-start") {
        onOrchestrationStart?.();
      }

      if (dataPart.type === "data-layer-update") {
        const event = dataPart.data as LayerUpdateData;
        onLayerUpdate?.(event.layer, event.status, event.data, {
          action: event.revisionAction,
          supersededFacts: event.supersededFacts,
        });
      }

      // orchestration-complete is informational - layer diagram already updated
      // via individual layer events
    },
    [onOrchestrationStart, onLayerUpdate],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onData: handleDataPart,
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

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
  const getMessageContent = (message: any): string => {
    if (typeof message.content === "string") {
      return message.content;
    }
    if (message.parts) {
      return message.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("");
    }
    return "";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cortex-500/20 to-cortex-700/20 flex items-center justify-center">
              <span className="text-3xl">🧠</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Welcome to Cortex Memory Demo
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
