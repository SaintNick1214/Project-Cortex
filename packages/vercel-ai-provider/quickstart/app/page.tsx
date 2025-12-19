'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useLayerTracking } from '@/lib/layer-tracking';

// Dynamic imports to avoid SSR issues with framer-motion
const ChatInterface = dynamic(() => import('@/components/ChatInterface').then(m => ({ default: m.ChatInterface })), { ssr: false });
const LayerFlowDiagram = dynamic(() => import('@/components/LayerFlowDiagram').then(m => ({ default: m.LayerFlowDiagram })), { ssr: false });
const MemorySpaceSwitcher = dynamic(() => import('@/components/MemorySpaceSwitcher').then(m => ({ default: m.MemorySpaceSwitcher })), { ssr: false });

export default function Home() {
  const [memorySpaceId, setMemorySpaceId] = useState('quickstart-demo');
  const [userId] = useState('demo-user');
  const {
    layers,
    isOrchestrating,
    startOrchestration,
    updateLayer,
    resetLayers,
  } = useLayerTracking();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
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

          <MemorySpaceSwitcher
            value={memorySpaceId}
            onChange={setMemorySpaceId}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Section */}
        <div className="flex-1 flex flex-col border-r border-white/10">
          <ChatInterface
            memorySpaceId={memorySpaceId}
            userId={userId}
            onOrchestrationStart={startOrchestration}
            onLayerUpdate={updateLayer}
            onReset={resetLayers}
          />
        </div>

        {/* Layer Flow Visualization */}
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
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <span>Cortex SDK v0.21.0</span>
            <span>•</span>
            <span>Vercel AI SDK v4</span>
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
