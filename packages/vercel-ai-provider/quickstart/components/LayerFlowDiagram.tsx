"use client";

import { motion } from "framer-motion";
import { LayerCard } from "./LayerCard";
import type { LayerState } from "@/lib/layer-tracking";

interface LayerFlowDiagramProps {
  layers: Record<string, LayerState>;
  isOrchestrating: boolean;
  memorySpaceId: string;
  userId: string;
}

export function LayerFlowDiagram({
  layers,
  isOrchestrating,
  memorySpaceId,
  userId,
}: LayerFlowDiagramProps) {
  // Define the layer flow order
  const topLayers = [
    { key: "memorySpace", name: "Memory Space", icon: "📦" },
    { key: "user", name: "User", icon: "👤" },
    { key: "agent", name: "Agent", icon: "🤖" },
  ];

  const flowLayers = [
    { key: "conversation", name: "Conversation", icon: "💬" },
    { key: "vector", name: "Vector Store", icon: "🎯" },
    { key: "facts", name: "Facts", icon: "💡" },
    { key: "graph", name: "Graph", icon: "🕸️", optional: true },
  ];

  return (
    <div className="space-y-6">
      {/* Title section */}
      <div className="text-center">
        <h3 className="text-lg font-semibold">Memory Orchestration Flow</h3>
        <p className="text-sm text-gray-400 mt-1">
          {isOrchestrating
            ? "Processing your message through Cortex layers..."
            : "Send a message to see data flow through the system"}
        </p>
      </div>

      {/* Top row: Context layers */}
      <div className="flex justify-center gap-3">
        {topLayers.map((layer, i) => (
          <motion.div
            key={layer.key}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <LayerCard
              name={layer.name}
              icon={layer.icon}
              status={layers[layer.key]?.status || "pending"}
              latencyMs={layers[layer.key]?.latencyMs}
              data={layers[layer.key]?.data}
              compact
            />
          </motion.div>
        ))}
      </div>

      {/* Flow connector */}
      <div className="flex justify-center">
        <motion.div
          className="w-0.5 h-8 bg-gradient-to-b from-white/30 to-white/10"
          animate={{
            opacity: isOrchestrating ? [0.3, 1, 0.3] : 0.3,
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Main flow: Processing layers */}
      <div className="space-y-3">
        {flowLayers.map((layer, i) => (
          <motion.div
            key={layer.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
          >
            <LayerCard
              name={layer.name}
              icon={layer.icon}
              status={
                layers[layer.key]?.status ||
                (layer.optional ? "skipped" : "pending")
              }
              latencyMs={layers[layer.key]?.latencyMs}
              data={layers[layer.key]?.data}
              optional={layer.optional}
            />

            {/* Flow connector between layers */}
            {i < flowLayers.length - 1 && (
              <div className="flex justify-center py-2">
                <motion.div
                  className="w-0.5 h-6"
                  style={{
                    background:
                      layers[layer.key]?.status === "complete"
                        ? "linear-gradient(to bottom, rgb(34, 197, 94), rgba(255, 255, 255, 0.1))"
                        : "linear-gradient(to bottom, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05))",
                  }}
                  animate={{
                    opacity:
                      isOrchestrating &&
                      layers[layer.key]?.status === "in_progress"
                        ? [0.3, 1, 0.3]
                        : 1,
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-white/10">
        <div className="flex justify-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span>Processing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>Complete</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-700" />
            <span>Skipped</span>
          </div>
        </div>
      </div>

      {/* Context info */}
      <div className="text-center text-xs text-gray-600">
        <p>
          Space: <code className="text-gray-400">{memorySpaceId}</code> • User:{" "}
          <code className="text-gray-400">{userId}</code>
        </p>
      </div>
    </div>
  );
}
