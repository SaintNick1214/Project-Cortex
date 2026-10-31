/** Compatibility names for retained editor components; generation is a durable backend job. */

import type {
  ContentSubmitV1,
  RuntimeContentJobV1,
} from "@cortexmemory/sdk/runtime";
import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";
import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import type { ArtifactKind } from "@/components/artifact";
import type { ChatMessage, Document } from "../types";
export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
};
export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  conversationId?: string;
  messageId?: string;
  hostToken?: string;
};
export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  conversationId?: string;
  messageId?: string;
  hostToken?: string;
  artifactVersion?: number;
  requestId: string;
};
export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};
export const artifactKinds = ["text", "code", "sheet"] as const;
export async function submitDocument(
  token: string,
  request: ContentSubmitV1
): Promise<RuntimeContentJobV1> {
  if (!token) {
    throw new Error("A verified host JWT is required.");
  }
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL required");
  }
  const client = new CortexRuntimeClient({
    deploymentUrl: convexUrl,
    fetchToken: async () => token,
    scope: {
      ...(process.env.CORTEX_TENANT_ID
        ? { tenantId: process.env.CORTEX_TENANT_ID }
        : {}),
      ...(process.env.CORTEX_MEMORY_SPACE_ID
        ? { memorySpaceId: process.env.CORTEX_MEMORY_SPACE_ID }
        : {}),
    },
  });
  try {
    await client.session();
    return await client.submitContentJob(request);
  } finally {
    await client.close();
  }
}
export function backendDocumentHandler(
  kind: "text" | "code" | "sheet"
): DocumentHandler {
  return {
    kind,
    onCreateDocument: async (args) => {
      const job = await submitDocument(args.hostToken ?? "", {
        intent: kind,
        prompt: args.title,
        requestId: args.id,
        version: 1,
        ...(args.conversationId ? { conversationId: args.conversationId } : {}),
        ...(args.messageId ? { sourceMessageId: args.messageId } : {}),
      });
      args.dataStream.write({
        data: job.artifactId!,
        transient: true,
        type: "data-id",
      });
    },
    onUpdateDocument: async (args) => {
      if (!args.artifactVersion) {
        throw new Error("An immutable artifact version is required.");
      }
      const job = await submitDocument(args.hostToken ?? "", {
        artifact: {
          artifactId: args.document.id,
          version: args.artifactVersion,
        },
        intent: kind,
        prompt: args.description,
        requestId: args.requestId,
        version: 1,
        ...(args.conversationId ? { conversationId: args.conversationId } : {}),
      });
      args.dataStream.write({
        data: job.artifactId!,
        transient: true,
        type: "data-id",
      });
    },
  };
}
export const documentHandlersByArtifactKind = artifactKinds.map(
  backendDocumentHandler
);
