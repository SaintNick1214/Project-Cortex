/**
 * Chat Page - Main UI
 */

'use client';

import { useChat } from 'ai/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="mb-4 pb-4 border-b">
        <h1 className="text-2xl font-bold">Cortex Memory Chat</h1>
        <p className="text-gray-600">
          A demo of persistent memory with Vercel AI SDK
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">👋 Try these memory tests:</p>
            <ul className="text-sm space-y-1">
              <li>"Hi, my name is Alice"</li>
              <li>"My favorite color is blue"</li>
              <li>"I work at Acme Corp"</li>
              <li>Then refresh and ask: "What's my name?"</li>
            </ul>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-100 ml-8'
                : 'bg-gray-100 mr-8'
            }`}
          >
            <div className="font-semibold mb-1">
              {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
            </div>
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ))}
        
        {isLoading && (
          <div className="bg-gray-100 mr-8 p-4 rounded-lg">
            <div className="font-semibold mb-1">🤖 Assistant</div>
            <div className="flex items-center space-x-2">
              <div className="animate-pulse">Thinking...</div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>

      {/* Memory Info */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        💡 Your conversations are stored with Cortex Memory. Refresh the page and the AI will remember you!
      </div>
    </div>
  );
}

