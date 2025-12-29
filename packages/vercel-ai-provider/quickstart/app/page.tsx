"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { useLayerTracking } from "@/lib/layer-tracking";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { AdminSetup } from "@/components/AdminSetup";
import { LoginScreen } from "@/components/LoginScreen";

// Dynamic imports to avoid SSR issues with framer-motion
const ChatInterface = dynamic(
  () =>
    import("@/components/ChatInterface").then((m) => ({
      default: m.ChatInterface,
    })),
  { ssr: false },
);
const LayerFlowDiagram = dynamic(
  () =>
    import("@/components/LayerFlowDiagram").then((m) => ({
      default: m.LayerFlowDiagram,
    })),
  { ssr: false },
);
const MemorySpaceSwitcher = dynamic(
  () =>
    import("@/components/MemorySpaceSwitcher").then((m) => ({
      default: m.MemorySpaceSwitcher,
    })),
  { ssr: false },
);
const HealthStatus = dynamic(
  () =>
    import("@/components/HealthStatus").then((m) => ({
      default: m.HealthStatus,
    })),
  { ssr: false },
);
const ChatHistorySidebar = dynamic(
  () =>
    import("@/components/ChatHistorySidebar").then((m) => ({
      default: m.ChatHistorySidebar,
    })),
  { ssr: false },
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main App Content (with auth)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MainContent() {
  const { isLoading, isAdminSetup, isAuthenticated, user } = useAuth();
  const [memorySpaceId, setMemorySpaceId] = useState("quickstart-demo");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const {
    layers,
    isOrchestrating,
    startOrchestration,
    updateLayer,
    resetLayers,
  } = useLayerTracking();

  // Handle new chat
  const handleNewChat = useCallback(() => {
    setCurrentConversationId(null);
    resetLayers();
  }, [resetLayers]);

  // Handle conversation selection
  const handleSelectConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId);
    resetLayers();
  }, [resetLayers]);

  // Handle conversation update (e.g., title change after first message)
  const handleConversationUpdate = useCallback((conversationId: string) => {
    // Update current conversation ID if it was null (new chat created)
    if (!currentConversationId) {
      setCurrentConversationId(conversationId);
    }
  }, [currentConversationId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cortex-500 to-cortex-700 flex items-center justify-center animate-pulse">
            <span className="text-3xl">🧠</span>
          </div>
          <p className="text-gray-400">Loading Cortex...</p>
        </div>
      </div>
    );
  }

  // First-run: Admin setup
  if (isAdminSetup === false) {
    return <AdminSetup />;
  }

  // Not authenticated: Login/Register
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Get userId from authenticated user
  const userId = user?.id || "demo-user";

  // Main authenticated interface
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cortex-500 to-cortex-700 flex items-center justify-center">
              <span className="text-xl">🧠</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Cortex Memory Quickstart</h1>
              <p className="text-sm text-gray-400">
                Real-time memory orchestration demo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <HealthStatus />
            <MemorySpaceSwitcher
              value={memorySpaceId}
              onChange={setMemorySpaceId}
            />
          </div>
        </div>
      </header>

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat History Sidebar */}
        <ChatHistorySidebar
          memorySpaceId={memorySpaceId}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
        />

        {/* Center: Chat Section */}
        <div className="flex-1 flex flex-col border-r border-white/10">
          <ChatInterface
            memorySpaceId={memorySpaceId}
            userId={userId}
            conversationId={currentConversationId}
            onOrchestrationStart={startOrchestration}
            onLayerUpdate={updateLayer}
            onReset={resetLayers}
            onConversationUpdate={handleConversationUpdate}
          />
        </div>

        {/* Right: Layer Flow Visualization */}
        <div className="w-[480px] flex flex-col bg-black/20">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="text-lg">📊</span>
              Memory Orchestration Flow
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Watch data flow through Cortex layers in real-time
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <LayerFlowDiagram
              layers={layers}
              isOrchestrating={isOrchestrating}
              memorySpaceId={memorySpaceId}
              userId={userId}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <span>Cortex SDK v0.24.0</span>
            <span>•</span>
            <span>Vercel AI SDK v5</span>
          </div>
          <a
            href="https://cortexmemory.dev/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Documentation →
          </a>
        </div>
      </footer>
    </main>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page Component (wraps with AuthProvider)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Home() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
