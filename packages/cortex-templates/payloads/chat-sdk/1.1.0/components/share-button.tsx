"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { VisibilityType } from "@/components/visibility-selector";
import { GlobeIcon, LockIcon, ShareIcon } from "./icons";

interface ShareButtonProps {
  chatId: string;
  initialVisibility: VisibilityType;
}

export function ShareButton({ chatId, initialVisibility }: ShareButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibilityType: initialVisibility,
  });

  const toggleVisibility = async () => {
    setIsLoading(true);
    const newVisibility: VisibilityType =
      visibilityType === "private" ? "public" : "private";

    try {
      await setVisibilityType(newVisibility);
      if (newVisibility === "public") {
        const shareUrl = `${window.location.origin}/share/${chatId}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied! Chat is now public.", {
          description: shareUrl,
        });
      } else {
        toast.success("Chat is now private.");
      }
    } catch {
      toast.error("Failed to update visibility");
    } finally {
      setIsLoading(false);
    }
  };

  const copyShareLink = async () => {
    if (visibilityType === "public") {
      const shareUrl = `${window.location.origin}/share/${chatId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied!", {
        description: shareUrl,
      });
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 px-2"
              disabled={isLoading}
              onClick={toggleVisibility}
              variant="outline"
            >
              {visibilityType === "public" ? (
                <>
                  <GlobeIcon size={14} />
                  <span className="ml-1 hidden md:inline">Public</span>
                </>
              ) : (
                <>
                  <LockIcon size={14} />
                  <span className="ml-1 hidden md:inline">Private</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {visibilityType === "public"
              ? "Click to make private"
              : "Click to make public and copy link"}
          </TooltipContent>
        </Tooltip>

        {visibilityType === "public" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 px-2"
                onClick={copyShareLink}
                variant="ghost"
              >
                <ShareIcon size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy share link</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
