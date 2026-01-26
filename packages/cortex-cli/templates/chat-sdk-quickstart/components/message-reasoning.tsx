"use client";

import { BrainIcon, DatabaseIcon, SaveIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "./elements/reasoning";

export type ReasoningType = "llm" | "memory-recall" | "memory-storage";

const REASONING_ICON_MAP: Record<ReasoningType, React.ComponentType<{ className?: string }>> = {
  "memory-recall": DatabaseIcon,
  "memory-storage": SaveIcon,
  "llm": BrainIcon,
};

const REASONING_LABEL_MAP: Record<ReasoningType, string> = {
  "memory-recall": "Recalling Memory",
  "memory-storage": "Storing Memory",
  "llm": "Thinking",
};

type MessageReasoningProps = {
  isLoading: boolean;
  reasoning: string;
  reasoningType?: ReasoningType;
};

export function MessageReasoning({
  isLoading,
  reasoning,
  reasoningType = "llm",
}: MessageReasoningProps) {
  const [hasBeenStreaming, setHasBeenStreaming] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setHasBeenStreaming(true);
    }
  }, [isLoading]);

  const icon = REASONING_ICON_MAP[reasoningType];
  const label = REASONING_LABEL_MAP[reasoningType];

  return (
    <Reasoning
      data-testid="message-reasoning"
      defaultOpen={hasBeenStreaming}
      isStreaming={isLoading}
    >
      <ReasoningTrigger icon={icon} label={label} />
      <ReasoningContent>{reasoning}</ReasoningContent>
    </Reasoning>
  );
}
