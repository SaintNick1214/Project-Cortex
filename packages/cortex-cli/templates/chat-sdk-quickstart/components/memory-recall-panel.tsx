/**
 * @deprecated This component is deprecated. Memory orchestration now renders
 * inline as reasoning panels within messages. See message-reasoning.tsx.
 * Kept for backward compatibility with users who prefer the global panel approach.
 */
"use client";

import type {
  LayerState,
  MemoryLayer,
} from "@cortexmemory/vercel-ai-provider/react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type LayerStatus = LayerState["status"];

interface MemoryRecallPanelProps {
  className?: string;
  isRecalling: boolean;
  layers: Record<MemoryLayer, LayerState>;
}

/**
 * Recall phase layers configuration
 * These layers are involved in retrieving context from memory
 */
const RECALL_LAYERS: MemoryLayer[] = ["vector", "facts", "graph", "context"];

const LAYER_CONFIG: Record<
  MemoryLayer,
  { name: string; icon: string; order: number }
> = {
  agent: { icon: "🤖", name: "Agent", order: 2 },
  context: { icon: "🔍", name: "Context Retrieval", order: 3 },
  // These are storage layers - not shown in recall panel but included for type safety
  conversation: { icon: "💬", name: "Conversation", order: 4 },
  facts: { icon: "💡", name: "Facts Lookup", order: 6 },
  graph: { icon: "🕸️", name: "Graph", order: 7 },
  memorySpace: { icon: "📦", name: "Memory Space", order: 0 },
  user: { icon: "👤", name: "User Profile", order: 1 },
  vector: { icon: "🎯", name: "Vector Search", order: 5 },
};

const STATUS_CONFIG: Record<
  LayerStatus,
  { indicator: string; className: string; dotClass: string }
> = {
  complete: {
    className: "text-green-500",
    dotClass: "bg-green-500",
    indicator: "✓",
  },
  error: {
    className: "text-destructive",
    dotClass: "bg-destructive",
    indicator: "✕",
  },
  in_progress: {
    className: "text-blue-500",
    dotClass: "bg-blue-500 animate-pulse",
    indicator: "◐",
  },
  pending: {
    className: "text-muted-foreground",
    dotClass: "bg-muted-foreground",
    indicator: "○",
  },
  skipped: {
    className: "text-muted-foreground/50",
    dotClass: "bg-muted-foreground/50",
    indicator: "○",
  },
};

function LayerRow({
  layerKey,
  state,
}: {
  layerKey: MemoryLayer;
  state: LayerState;
}) {
  const config = LAYER_CONFIG[layerKey];
  const statusConfig = STATUS_CONFIG[state.status];

  // Generate preview text from data
  const preview = useMemo(() => {
    if (!state.data) {
      return null;
    }
    if (state.data.id) {
      return state.data.id;
    }
    if (state.data.preview) {
      return state.data.preview;
    }
    if (state.data.metadata) {
      const meta = state.data.metadata;
      if ("memories" in meta) {
        return `${meta.memories} memories`;
      }
      if ("count" in meta) {
        return `${meta.count} items`;
      }
      if ("vectorMatches" in meta && "factMatches" in meta) {
        return `${meta.vectorMatches} vectors, ${meta.factMatches} facts`;
      }
    }
    return null;
  }, [state.data]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors",
        state.status === "in_progress" && "bg-blue-500/5",
        state.status === "complete" && "bg-green-500/5",
        state.status === "skipped" && "opacity-50"
      )}
    >
      {/* Status indicator */}
      <span className={cn("w-4 text-sm font-medium", statusConfig.className)}>
        {statusConfig.indicator}
      </span>

      {/* Icon and name */}
      <span className="text-sm">{config.icon}</span>
      <span className="text-sm font-medium flex-1 truncate">{config.name}</span>

      {/* Preview text */}
      {preview && state.status === "complete" && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
          {preview}
        </span>
      )}

      {/* Latency */}
      <span
        className={cn(
          "text-xs tabular-nums w-12 text-right",
          state.latencyMs === undefined
            ? "text-muted-foreground/30"
            : "text-muted-foreground"
        )}
      >
        {state.latencyMs === undefined ? "-" : `${state.latencyMs}ms`}
      </span>
    </div>
  );
}

export function MemoryRecallPanel({
  layers,
  isRecalling,
  className,
}: MemoryRecallPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Auto-collapse when recall completes
  useEffect(() => {
    if (!isRecalling) {
      // Small delay to let user see the completed state
      const timer = setTimeout(() => setIsOpen(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isRecalling]);

  // Calculate total latency from completed recall layers
  const totalLatency = useMemo(
    () =>
      RECALL_LAYERS.reduce((sum, layerKey) => {
        const layer = layers[layerKey];
        return sum + (layer?.latencyMs ?? 0);
      }, 0),
    [layers]
  );

  // Get sorted recall layer entries (only recall layers)
  const sortedLayers = useMemo(
    () =>
      RECALL_LAYERS.map(
        (layerKey) => [layerKey, layers[layerKey]] as [MemoryLayer, LayerState]
      )
        .filter(([, state]) => state && state.status !== "skipped")
        .sort(([a], [b]) => LAYER_CONFIG[a].order - LAYER_CONFIG[b].order),
    [layers]
  );

  // Count completed layers
  const completedCount = useMemo(
    () =>
      RECALL_LAYERS.filter((layerKey) => {
        const status = layers[layerKey]?.status;
        return status === "complete" || status === "skipped";
      }).length,
    [layers]
  );

  const totalCount = RECALL_LAYERS.length;

  // Don't render if no recall layers have activity
  if (sortedLayers.length === 0) {
    return null;
  }

  return (
    <Collapsible
      className={cn(
        "border rounded-lg bg-card shadow-sm overflow-hidden",
        isRecalling && "ring-1 ring-blue-500/30",
        className
      )}
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
          type="button"
        >
          {/* Search icon with animation during recall */}
          <Search
            className={cn(
              "h-4 w-4",
              isRecalling ? "text-blue-500 animate-pulse" : "text-primary"
            )}
          />

          {/* Title */}
          <span className="text-sm font-medium flex-1">Memory Recall</span>

          {/* Progress indicator */}
          {!!isRecalling && (
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalCount}
            </span>
          )}

          {/* Total latency */}
          {totalLatency > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {totalLatency}ms
            </span>
          )}

          {/* Chevron */}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-2 pb-2 space-y-0.5 border-t">
          {sortedLayers.map(([layerKey, state]) => (
            <LayerRow key={layerKey} layerKey={layerKey} state={state} />
          ))}
        </div>

        {/* Status legend */}
        <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>Retrieving</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>Complete</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
