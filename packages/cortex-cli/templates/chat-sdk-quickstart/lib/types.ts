import type {
  LayerEvent,
  OrchestrationSummary,
  RecallSummary,
} from "@cortexmemory/sdk";
import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";

/**
 * Placeholder types for Chat SDK integration
 * These replace the deleted Drizzle schema types
 * These types are implemented and used by the Chat SDK ↔ Cortex layer
 */

export interface Chat {
  createdAt: Date;
  id: string;
  title: string;
  updatedAt: Date;
  userId: string;
  visibility: "private" | "public";
}

export interface Vote {
  chatId: string;
  isUpvoted: boolean;
  messageId: string;
}

export interface Document {
  content: string | null;
  createdAt: Date;
  id: string;
  kind: ArtifactKind;
  title: string;
  updatedAt: Date;
  userId: string;
}

export interface Suggestion {
  createdAt: Date;
  description: string | null;
  documentCreatedAt: Date;
  documentId: string;
  id: string;
  isResolved: boolean;
  originalText: string;
  suggestedText: string;
  userId: string;
}

export interface DBMessage {
  attachments: unknown[];
  chatId: string;
  createdAt: Date;
  id: string;
  parts: unknown;
  role: "user" | "assistant" | "system";
}

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  "recall-start": { orchestrationId: string };
  "recall-complete": RecallSummary;
  "remember-start": { orchestrationId: string };
  "remember-complete": OrchestrationSummary;
  "layer-update": LayerEvent;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
