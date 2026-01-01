"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

interface ChatHistorySidebarProps {
  memorySpaceId: string;
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function groupByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "Last 7 Days": [],
    Older: [],
  };

  for (const conv of conversations) {
    const convDate = new Date(conv.updatedAt);
    const convDay = new Date(
      convDate.getFullYear(),
      convDate.getMonth(),
      convDate.getDate()
    ).getTime();

    if (convDay >= today) {
      groups.Today.push(conv);
    } else if (convDay >= yesterday) {
      groups.Yesterday.push(conv);
    } else if (convDay >= weekAgo) {
      groups["Last 7 Days"].push(conv);
    } else {
      groups.Older.push(conv);
    }
  }

  return groups;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ChatHistorySidebar({
  memorySpaceId,
  currentConversationId,
  onSelectConversation,
  onNewChat,
}: ChatHistorySidebarProps) {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(
        `/api/conversations?userId=${encodeURIComponent(user.id)}&memorySpaceId=${encodeURIComponent(memorySpaceId)}`
      );
      const data = await response.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, memorySpaceId]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Refresh conversations periodically (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Delete conversation
  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(conversationId);

    try {
      const response = await fetch(`/api/conversations?conversationId=${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed with status ${response.status}`);
      }

      // Remove from local state only after successful deletion
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      // If deleted conversation was selected, trigger new chat
      if (conversationId === currentConversationId) {
        onNewChat();
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const groupedConversations = groupByDate(conversations);
  const groups = ["Today", "Yesterday", "Last 7 Days", "Older"];

  return (
    <div className="w-64 h-full flex flex-col bg-black/40 border-r border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cortex-500 to-cortex-700 flex items-center justify-center">
            <span className="text-sm">🧠</span>
          </div>
          <span className="font-semibold text-sm">Cortex Demo</span>
        </div>

        <button
          onClick={onNewChat}
          className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Chat
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg
              className="animate-spin h-5 w-5 text-gray-400"
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
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No conversations yet</p>
            <p className="mt-1 text-xs">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const groupConvos = groupedConversations[group];
              if (groupConvos.length === 0) return null;

              return (
                <div key={group}>
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {group}
                  </div>
                  <div className="space-y-1">
                    {groupConvos.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => onSelectConversation(conv.id)}
                        className={`group relative px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                          conv.id === currentConversationId
                            ? "bg-cortex-600/20 text-white"
                            : "hover:bg-white/5 text-gray-300"
                        }`}
                      >
                        <div className="pr-6">
                          <div className="text-sm font-medium truncate">
                            {conv.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatTime(conv.updatedAt)}
                            {conv.messageCount > 0 && (
                              <span className="ml-2">
                                {conv.messageCount} message
                                {conv.messageCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => handleDelete(e, conv.id)}
                          disabled={deletingId === conv.id}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all"
                          title="Delete conversation"
                        >
                          {deletingId === conv.id ? (
                            <svg
                              className="w-4 h-4 animate-spin text-gray-400"
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
                          ) : (
                            <svg
                              className="w-4 h-4 text-gray-400 hover:text-red-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cortex-500 to-cortex-700 flex items-center justify-center text-sm font-medium">
            {user?.displayName?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {user?.displayName || user?.id}
            </div>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
