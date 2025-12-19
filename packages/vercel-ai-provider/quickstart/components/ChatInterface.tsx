'use client';

import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';
import type { LayerStatus, MemoryLayer } from '@/lib/layer-tracking';

interface ChatInterfaceProps {
  memorySpaceId: string;
  userId: string;
  onOrchestrationStart?: () => void;
  onLayerUpdate?: (layer: MemoryLayer, status: LayerStatus) => void;
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
  const [suggestedMessages] = useState([
    "Hi! My name is Alex and I work at Acme Corp as a senior engineer.",
    "My favorite color is blue and I love hiking on weekends.",
    "I'm learning Spanish and prefer dark mode interfaces.",
    "What do you remember about me?",
  ]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: '/api/chat',
    body: { memorySpaceId, userId },
    onResponse: () => {
      // Trigger orchestration visualization when response starts
      onOrchestrationStart?.();
      
      // Simulate layer updates (in real app, these would come from Convex subscriptions)
      simulateLayerUpdates();
    },
    onFinish: () => {
      // Mark all layers complete
      onLayerUpdate?.('conversation', 'complete');
      onLayerUpdate?.('vector', 'complete');
      onLayerUpdate?.('facts', 'complete');
    },
  });

  // Simulate layer updates for demo (replace with real Convex subscriptions)
  const simulateLayerUpdates = () => {
    const layers: { layer: MemoryLayer; delay: number }[] = [
      { layer: 'memorySpace', delay: 50 },
      { layer: 'user', delay: 80 },
      { layer: 'agent', delay: 100 },
      { layer: 'conversation', delay: 300 },
      { layer: 'vector', delay: 500 },
      { layer: 'facts', delay: 800 },
      { layer: 'graph', delay: 1000 }, // Added graph layer
    ];

    layers.forEach(({ layer, delay }) => {
      setTimeout(() => {
        onLayerUpdate?.(layer, 'in_progress');
      }, delay);
      setTimeout(() => {
        onLayerUpdate?.(layer, 'complete');
      }, delay + 200);
    });
  };

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSuggestedMessage = (message: string) => {
    setInput(message);
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
              This demo shows how Cortex orchestrates memory across multiple layers in real-time.
              Try telling me about yourself!
            </p>

            {/* Suggested messages */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {suggestedMessages.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedMessage(msg)}
                  className="px-3 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors text-left"
                >
                  {msg.length > 40 ? msg.slice(0, 40) + '...' : msg}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={`message-animate flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-cortex-600 text-white'
                  : 'bg-white/10 text-white'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
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

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Tell me about yourself..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cortex-500 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
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
