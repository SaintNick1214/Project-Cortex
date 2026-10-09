import { getChatById, getDocumentById } from "../db/queries";
import { requireScope } from "../cortex";
import { ChatSDKError } from "../errors";
import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { codeDocumentHandler } from "@/artifacts/code/server";
import { sheetDocumentHandler } from "@/artifacts/sheet/server";
import { textDocumentHandler } from "@/artifacts/text/server";
import type { ArtifactKind } from "@/components/artifact";
import { saveDocument } from "../db/queries";
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
  instructions?: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  /** Optional conversation ID to link the artifact to */
  conversationId?: string;
  /** Optional message ID within the conversation */
  messageId?: string;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  /** Optional conversation ID to maintain the link */
  conversationId?: string;
  /** Optional message ID within the conversation */
  messageId?: string;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      await requireScope(args.session?.user?.id);
      if (
        args.conversationId &&
        !(await getChatById({ id: args.conversationId }))
      )
        throw new ChatSDKError("not_found:chat");
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        instructions: args.instructions,
        dataStream: args.dataStream,
        session: args.session,
        conversationId: args.conversationId,
        messageId: args.messageId,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
          conversationId: args.conversationId,
          messageId: args.messageId,
        });
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      await requireScope(args.session?.user?.id);
      const document = await getDocumentById({ id: args.document.id });
      if (!document) throw new ChatSDKError("not_found:document");
      const draftContent = await config.onUpdateDocument({
        document,
        description: args.description,
        dataStream: args.dataStream,
        session: args.session,
        conversationId: args.conversationId,
        messageId: args.messageId,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          id: args.document.id,
          title: args.document.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
          conversationId: args.conversationId,
          messageId: args.messageId,
        });
      }

      return;
    },
  };
}

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
];

export const artifactKinds = ["text", "code", "sheet"] as const;
