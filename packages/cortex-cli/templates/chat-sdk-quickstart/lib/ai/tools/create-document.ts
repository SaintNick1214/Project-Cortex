import { requireScope } from "@/lib/cortex";
import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  session: Session;
  conversationId: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const createDocument = ({
  session,
  dataStream,
  conversationId,
}: CreateDocumentProps) =>
  tool({
    description:
      "Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title, kind, and specific requested content. Include the user's exact content, formatting, and data requirements in instructions.",
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
      instructions: z.string().optional().describe("The user's specific document content, formatting, code behavior, or table data requirements."),
    }),
    execute: async ({ title, kind, instructions }) => {
      await requireScope(session.user?.id);
      const id = generateUUID();

      dataStream.write({
        type: "data-kind",
        data: kind,
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        instructions,
        dataStream,
        session,
        conversationId,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title,
        kind,
        content: "A document was created and is now visible to the user.",
      };
    },
  });
