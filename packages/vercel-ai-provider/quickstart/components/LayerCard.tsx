"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { DataPreview } from "./DataPreview";

type LayerStatus = "pending" | "in_progress" | "complete" | "error" | "skipped";

interface LayerCardProps {
  name: string;
  icon: string;
  status: LayerStatus;
  latencyMs?: number;
  data?: {
    id?: string;
    preview?: string;
    metadata?: Record<string, unknown>;
  };
  compact?: boolean;
  optional?: boolean;
}

const statusConfig: Record<
  LayerStatus,
  { color: string; bgColor: string; text: string }
> = {
  pending: {
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
    text: "○",
  },
  in_progress: {
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    text: "◐",
  },
  complete: {
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    text: "●",
  },
  error: {
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    text: "✕",
  },
  skipped: {
    color: "text-gray-600",
    bgColor: "bg-gray-800/50",
    text: "○",
  },
};

export function LayerCard({
  name,
  icon,
  status,
  latencyMs,
  data,
  compact = false,
  optional = false,
}: LayerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = statusConfig[status];

  if (compact) {
    return (
      <motion.div
        className={`px-3 py-2 rounded-lg border border-white/10 ${config.bgColor} min-w-[100px]`}
        animate={{
          scale: status === "in_progress" ? [1, 1.02, 1] : 1,
          boxShadow:
            status === "complete"
              ? [
                  "0 0 0 0 rgba(34, 197, 94, 0.4)",
                  "0 0 0 4px rgba(34, 197, 94, 0)",
                ]
              : "none",
        }}
        transition={{
          duration: status === "in_progress" ? 1 : 0.5,
          repeat: status === "in_progress" ? Infinity : 0,
        }}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm ${config.color}`}>{config.text}</span>
          <span>{icon}</span>
          <span className="text-xs font-medium truncate">{name}</span>
        </div>
        {latencyMs !== undefined && (
          <div className="text-[10px] text-gray-500 mt-0.5 text-center">
            {latencyMs}ms
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`rounded-xl border border-white/10 ${config.bgColor} overflow-hidden ${
        optional && status === "skipped" ? "opacity-50" : ""
      }`}
      animate={{
        scale: status === "in_progress" ? [1, 1.01, 1] : 1,
      }}
      transition={{
        duration: 1,
        repeat: status === "in_progress" ? Infinity : 0,
      }}
      layout
    >
      <button
        onClick={() => data && setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center gap-3 ${
          data ? "cursor-pointer hover:bg-white/5" : "cursor-default"
        } transition-colors`}
      >
        {/* Status indicator */}
        <motion.div
          className={`w-3 h-3 rounded-full flex-shrink-0 ${
            status === "complete"
              ? "bg-green-500"
              : status === "in_progress"
                ? "bg-yellow-500"
                : status === "error"
                  ? "bg-red-500"
                  : "bg-gray-500"
          }`}
          animate={{
            opacity: status === "in_progress" ? [0.5, 1, 0.5] : 1,
            scale: status === "complete" ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: status === "in_progress" ? 1 : 0.3,
            repeat: status === "in_progress" ? Infinity : 0,
          }}
        />

        {/* Icon and name */}
        <span className="text-lg">{icon}</span>
        <span className="font-medium flex-1 text-left">{name}</span>

        {/* Latency */}
        {latencyMs !== undefined && (
          <span className="text-sm text-gray-400">{latencyMs}ms</span>
        )}

        {/* Optional badge */}
        {optional && (
          <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-gray-400">
            optional
          </span>
        )}

        {/* Expand indicator */}
        {data && (
          <motion.span
            className="text-gray-400"
            animate={{ rotate: isExpanded ? 180 : 0 }}
          >
            ▼
          </motion.span>
        )}
      </button>

      {/* Expandable data preview */}
      <AnimatePresence>
        {isExpanded && data && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-white/10">
              <DataPreview data={data} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
